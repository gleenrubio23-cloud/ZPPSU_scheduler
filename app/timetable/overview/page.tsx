/**
 * Whole-week overview: every scheduled class of the active term on one Monday-to-Saturday grid,
 * with subject, section, room and faculty. Admin sees all departments (and may filter by one);
 * a chair sees only classes of their own department (its subjects or its sections).
 */
import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import PrintButton from '@/components/PrintButton';
import { Opts } from '@/components/ui';
import { deptScope, requireRole } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { DAYS, DAY_END, DAY_START } from '@/lib/constants';
import { db, raw, sql } from '@/lib/db';
import { fmtTime, fromMinutes, minutes, num, param, termLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Whole-week Overview' };

type Meeting = {
  day: number; start_time: string; end_time: string; code: string; title: string;
  section_name: string; room_name: string; faculty_name: string | null; dept_code: string;
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin', 'chair');
  const sp = await searchParams;
  const term = await activeTerm();

  const departments = (await db.pairs(sql`SELECT id, code || ' - ' || name FROM departments ORDER BY code`)) as [number, string][];
  // A chair is locked to their own department; an admin may pick one or see all (0).
  const scope = deptScope(user);
  const dept = user.role === 'chair' ? (scope ?? -1) : Number(param(sp, 'dept')) || 0;
  const deptName = departments.find(([k]) => k === dept)?.[1];
  const deptFilter = dept ? sql`AND (sub.department_id = ${dept} OR sec.department_id = ${dept})` : raw('');

  const meetings = await db.rows<Meeting>(sql`
    SELECT s.day, s.start_time, s.end_time, sub.code, sub.title, sec.name AS section_name,
           r.name AS room_name, u.full_name AS faculty_name, d.code AS dept_code
    FROM schedules s
    JOIN offerings o ON o.id = s.offering_id
    JOIN subjects sub ON sub.id = o.subject_id
    JOIN departments d ON d.id = sub.department_id
    JOIN sections sec ON sec.id = o.section_id
    JOIN rooms r ON r.id = s.room_id
    LEFT JOIN users u ON u.id = o.faculty_id
    WHERE o.term_id = ${term?.id ?? 0} ${deptFilter}
    ORDER BY s.day, s.start_time, sec.name`);

  const hours = meetings.reduce((t, m) => t + (minutes(m.end_time) - minutes(m.start_time)) / 60, 0);
  const count = (f: (m: Meeting) => string | null) => new Set(meetings.map(f).filter(Boolean)).size;
  const stats: [string, string][] = [
    ['Class meetings', String(meetings.length)],
    ['Subjects', String(count((m) => m.code))],
    ['Faculty', String(count((m) => m.faculty_name))],
    ['Rooms', String(count((m) => m.room_name))],
    ['Sections', String(count((m) => m.section_name))],
    ['Hours / week', num(hours)],
  ];

  // Hourly rows; each cell lists every class that starts within that hour on that day.
  const first = Math.floor(minutes(DAY_START) / 60) * 60;
  const last = Math.ceil(minutes(DAY_END) / 60) * 60;
  const rows = Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60);
  const cell = (day: number, from: number) =>
    meetings.filter((m) => m.day === day && minutes(m.start_time) >= from && minutes(m.start_time) < from + 60);
  const days = Object.keys(DAYS).map(Number);

  const scopeLabel = user.role === 'chair' ? (deptName ?? 'Your department') : (deptName ?? 'All departments');

  return (
    <Shell user={user} active="/timetable">
      <div className="head no-print">
        <h1>Whole-week Overview, {termLabel(term)}</h1>
        <div>
          <a href="/timetable" className="btn ghost" style={{ marginRight: 8 }}>Back to timetables</a>
          <PrintButton />
        </div>
      </div>

      {user.role === 'admin' && (
        <form method="get" className="card no-print">
          <div className="form-row">
            <div><label>Department</label>
              <select name="dept" defaultValue={String(dept)}>
                <option value="0">All departments</option>
                <Opts items={departments} />
              </select></div>
          </div>
          <button type="submit">Show</button>
        </form>
      )}

      <div className="overview-print">
        <h2 className="print-only">Whole-week Overview, {termLabel(term)}</h2>
        <div className="card">
          <h2>{scopeLabel}</h2>
          <div className="overview-stats">
            {stats.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table className="timetable overview">
              <thead><tr><th style={{ width: 78 }}>Time</th>{days.map((d) => <th key={d}>{DAYS[d]}</th>)}</tr></thead>
              <tbody>
                {rows.map((from) => (
                  <tr key={from}>
                    <td className="time">{fmtTime(fromMinutes(from))}</td>
                    {days.map((day) => (
                      <td key={day}>
                        {cell(day, from).map((m, i) => (
                          <div key={i} className="ov-class">
                            <b>{m.code}</b> <small>{fmtTime(m.start_time)}-{fmtTime(m.end_time)}</small>
                            <div>{m.section_name} · {m.room_name}</div>
                            <div className={m.faculty_name ? undefined : 'muted'}>{m.faculty_name ?? 'No faculty yet'}</div>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card table-wrap">
          <h2>All classes</h2>
          {meetings.length === 0 ? <p className="muted">No classes scheduled.</p> : (
            <table>
              <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Dept</th><th>Section</th><th>Room</th><th>Faculty</th></tr></thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr key={i}>
                    <td>{DAYS[m.day]}</td><td>{fmtTime(m.start_time)} - {fmtTime(m.end_time)}</td>
                    <td><strong>{m.code}</strong> {m.title}</td><td>{m.dept_code}</td>
                    <td>{m.section_name}</td><td>{m.room_name}</td><td>{m.faculty_name ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
