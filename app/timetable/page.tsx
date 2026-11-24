import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import PrintButton from '@/components/PrintButton';
import PrintSheet, { type PrintMeeting } from '@/components/PrintSheet';
import { Opts } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { DAYS, DAY_END, DAY_START } from '@/lib/constants';
import { db, raw, sql } from '@/lib/db';
import { fmtTime, fromMinutes, minutes, num, param, termLabel } from '@/lib/format';
import { printSettings } from '@/lib/printSettings';

export const metadata: Metadata = { title: 'Timetables' };

type View = 'faculty' | 'room' | 'section';

export default async function TimetablePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const term = await activeTerm();
  const isFaculty = user.role === 'faculty';

  // Faculty may only see their own schedule; admin and chair may browse any faculty, room, or section.
  const view: View = isFaculty ? 'faculty'
    : (['faculty', 'room', 'section'] as const).find((v) => v === param(sp, 'view')) ?? 'faculty';
  const lists: Record<View, [number, string][]> = {
    faculty: (await db.pairs(sql`SELECT id, full_name FROM users WHERE role = 'faculty' AND is_active ORDER BY full_name`)) as [number, string][],
    room: (await db.pairs(sql`SELECT id, name FROM rooms ORDER BY name`)) as [number, string][],
    section: (await db.pairs(sql`SELECT id, name FROM sections ORDER BY name`)) as [number, string][],
  };
  let id = isFaculty ? user.id : Number(param(sp, 'id')) || 0;
  if (!lists[view].some(([k]) => k === id)) id = lists[view][0]?.[0] ?? 0;
  const label = lists[view].find(([k]) => k === id)?.[1] ?? 'Nothing to show';

  const column = { faculty: 'o.faculty_id', room: 's.room_id', section: 'o.section_id' }[view];
  const meetings = await db.rows(sql`
    SELECT s.day, s.start_time, s.end_time, sub.code, sub.title, sec.name AS section_name,
           r.name AS room_name, u.full_name AS faculty_name
    FROM schedules s
    JOIN offerings o ON o.id = s.offering_id
    JOIN subjects sub ON sub.id = o.subject_id
    JOIN sections sec ON sec.id = o.section_id
    JOIN rooms r ON r.id = s.room_id
    LEFT JOIN users u ON u.id = o.faculty_id
    WHERE o.term_id = ${term?.id ?? 0} AND ${raw(column)} = ${id}
    ORDER BY s.day, s.start_time`);

  // ---------- Details for the printed form ----------
  const settings = await printSettings();
  const termId = term?.id ?? 0;
  const hours = meetings.reduce((t, m) => t + (minutes(m.end_time) - minutes(m.start_time)) / 60, 0);
  const semester = term?.semester ?? '';
  const schoolYear = term?.school_year ?? '';
  type Detail = [[string, string, boolean?], [string, string, boolean?]];
  let printTitle = 'FACULTY TEACHING LOAD';
  let details: Detail[];
  if (view === 'faculty') {
    const profile = await db.row<{ degree: string | null; academic_rank: string | null }>(sql`
      SELECT (SELECT d.title FROM faculty_degrees d WHERE d.faculty_id = ${id} AND d.status <> 'rejected'
              ORDER BY CASE d.level WHEN 'doctorate' THEN 3 WHEN 'master' THEN 2 ELSE 1 END DESC,
                       (d.status = 'verified') DESC, d.year_graduated DESC NULLS LAST LIMIT 1) AS degree,
             (SELECT p.academic_rank FROM faculty_profiles p WHERE p.user_id = ${id}) AS academic_rank`);
    const preparations = (await db.val<number>(sql`
      SELECT COUNT(DISTINCT subject_id) FROM offerings WHERE term_id = ${termId} AND faculty_id = ${id}`)) ?? 0;
    details = [
      [['Name of Faculty', label.toUpperCase()], ['Semester', semester, true]],
      [['Degree', profile?.degree ?? ''], ['School Year', schoolYear, true]],
      [['Academic Rank', profile?.academic_rank ?? ''], ['No. of Preparation', String(preparations)]],
      [['Designation/s', ''], ['No. of Hours', num(hours)]],
    ];
  } else {
    printTitle = view === 'room' ? 'ROOM UTILIZATION SCHEDULE' : 'CLASS SCHEDULE';
    details = [
      [[view === 'room' ? 'Room' : 'Section', label.toUpperCase()], ['Semester', semester, true]],
      [['', ''], ['School Year', schoolYear, true]],
      [['No. of Classes', String(new Set(meetings.map((m) => m.code + m.section_name)).size)], ['No. of Hours', num(hours)]],
    ];
  }

  // A grid of 30-minute rows. grid[day][slot] = meeting that starts there; covered = cells under a tall block.
  const first = minutes(DAY_START);
  const slots = (minutes(DAY_END) - first) / 30;
  const grid: Record<number, Record<number, (typeof meetings)[number] & { span: number }>> = {};
  const covered: Record<number, Set<number>> = {};
  for (const m of meetings) {
    const from = Math.floor((minutes(m.start_time) - first) / 30);
    let span = Math.max(1, Math.ceil((minutes(m.end_time) - minutes(m.start_time)) / 30));
    grid[m.day] ??= {};
    covered[m.day] ??= new Set();
    if (from < 0 || from >= slots || grid[m.day][from] || covered[m.day].has(from)) continue;
    span = Math.min(span, slots - from);
    grid[m.day][from] = { ...m, span };
    for (let i = 1; i < span; i++) covered[m.day].add(from + i);
  }

  return (
    <Shell user={user} active="/timetable">
      <div className="head no-print">
        <h1>{isFaculty ? 'My Schedule' : 'Timetables'}, {termLabel(term)}</h1>
        <div>
          {user.role === 'admin' && <a href="/settings#signatories" className="btn ghost" style={{ marginRight: 8 }}>Edit signatories</a>}
          <PrintButton />
        </div>
      </div>

      {!isFaculty && (
        <form method="get" className="card no-print">
          <div className="form-row">
            <div><label>View by</label><select name="view" defaultValue={view}>
              <Opts items={{ faculty: 'Faculty', room: 'Room', section: 'Section' }} /></select></div>
            <div><label>{view.charAt(0).toUpperCase() + view.slice(1)}</label>
              <select name="id" defaultValue={String(id)}><Opts items={lists[view]} /></select></div>
          </div>
          <button type="submit">Show</button>
        </form>
      )}

      <div className="card no-print">
        <h2>{label}</h2>
        <div className="table-wrap">
          <table className="timetable">
            <thead><tr><th style={{ width: 78 }}>Time</th>{Object.values(DAYS).map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: slots }, (_, slot) => (
                <tr key={slot}>
                  <td className="time">{slot % 2 === 0 ? fmtTime(fromMinutes(first + slot * 30)) : ''}</td>
                  {Object.keys(DAYS).map(Number).map((day) => {
                    if (covered[day]?.has(slot)) return null;
                    const m = grid[day]?.[slot];
                    if (!m) return <td key={day} />;
                    return (
                      <td key={day} className="class" rowSpan={m.span}>
                        <b>{m.code}</b>
                        {fmtTime(m.start_time)}-{fmtTime(m.end_time)}<br />
                        {view !== 'section' && <>{m.section_name}<br /></>}
                        {view !== 'room' && <>{m.room_name}<br /></>}
                        {view !== 'faculty' && (m.faculty_name ?? 'No faculty yet')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card table-wrap no-print">
        <h2>Class list</h2>
        {meetings.length === 0 ? <p className="muted">No classes scheduled.</p> : (
          <table>
            <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Section</th><th>Room</th><th>Faculty</th></tr></thead>
            <tbody>
              {meetings.map((m, i) => (
                <tr key={i}>
                  <td>{DAYS[m.day]}</td><td>{fmtTime(m.start_time)} - {fmtTime(m.end_time)}</td>
                  <td><strong>{m.code}</strong> {m.title}</td><td>{m.section_name}</td><td>{m.room_name}</td><td>{m.faculty_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PrintSheet title={printTitle} view={view} details={details} meetings={meetings as PrintMeeting[]} settings={settings} />
    </Shell>
  );
}
