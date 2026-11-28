import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import PrintButton from '@/components/PrintButton';
import FormLetterhead from '@/components/FormLetterhead';
import { Opts } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { db, sql } from '@/lib/db';
import { formTime, minutes, num, param } from '@/lib/format';
import { printSettings } from '@/lib/printSettings';
import { classListCounts, semesterWords } from '@/lib/students';

export const metadata: Metadata = { title: 'Individual Daily Program' };

const DAY_ABBR: Record<number, string> = { 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };

type Meeting = {
  offering_id: number; day: number; start_time: string; end_time: string; code: string;
  section_name: string; room_name: string; enrolled: number;
};

export default async function IdpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const term = await activeTerm();
  const isFaculty = user.role === 'faculty';

  // Faculty print their own IDP; admin and chair may print anyone's, as on the Timetables page.
  const faculty = (await db.pairs(sql`SELECT id, full_name FROM users WHERE role = 'faculty' AND is_active ORDER BY full_name`)) as [number, string][];
  let id = isFaculty ? user.id : Number(param(sp, 'id')) || 0;
  if (!isFaculty && !faculty.some(([k]) => k === id)) id = faculty[0]?.[0] ?? 0;
  const name = isFaculty ? user.full_name : faculty.find(([k]) => k === id)?.[1] ?? '';
  const termId = term?.id ?? 0;

  const [meetings, availability, profile, settings] = await Promise.all([
    db.rows<Meeting>(sql`
      SELECT o.id AS offering_id, s.day, s.start_time, s.end_time, sub.code, sec.name AS section_name,
             r.name AS room_name, o.enrolled
      FROM schedules s
      JOIN offerings o ON o.id = s.offering_id
      JOIN subjects sub ON sub.id = o.subject_id
      JOIN sections sec ON sec.id = o.section_id
      JOIN rooms r ON r.id = s.room_id
      WHERE o.term_id = ${termId} AND o.faculty_id = ${id}
      ORDER BY s.day, s.start_time`),
    db.rows(sql`SELECT day, start_time, end_time FROM faculty_availability WHERE faculty_id = ${id} ORDER BY day, start_time`),
    db.row<{ degree: string | null; academic_rank: string | null }>(sql`
      SELECT (SELECT d.title FROM faculty_degrees d WHERE d.faculty_id = ${id} AND d.status <> 'rejected'
              ORDER BY CASE d.level WHEN 'doctorate' THEN 3 WHEN 'master' THEN 2 ELSE 1 END DESC,
                       (d.status = 'verified') DESC, d.year_graduated DESC NULLS LAST LIMIT 1) AS degree,
             (SELECT p.academic_rank FROM faculty_profiles p WHERE p.user_id = ${id}) AS academic_rank`),
    printSettings(),
  ]);
  // The number of students is the class list when one was entered, otherwise the enrolled count of the offering.
  const listed = await classListCounts([...new Set(meetings.map((m) => m.offering_id))]);
  const students = (m: Meeting) => listed.get(m.offering_id) || m.enrolled;

  const hrs = (m: { start_time: string; end_time: string }) => (minutes(m.end_time) - minutes(m.start_time)) / 60;
  const totalHours = meetings.reduce((t, m) => t + hrs(m), 0);
  const preparations = new Set(meetings.map((m) => m.code)).size;

  // Monday to Friday always; Saturday only when there is a class or official time on it.
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d < 6 || meetings.some((m) => m.day === 6) || availability.some((a) => a.day === 6));
  const byDay = new Map(days.map((d) => [d, meetings.filter((m) => m.day === d)]));
  const bodyRows = days.reduce((n, d) => n + Math.max(1, byDay.get(d)!.length), 0);
  const officialTime = (d: number) => availability.filter((a) => a.day === d)
    .map((a) => `${formTime(a.start_time)} – ${formTime(a.end_time)}`).join(', ');

  let rowIndex = 0;
  const blanks = (n: number) => Array.from({ length: n }, (_, i) => <td key={i} />);

  return (
    <Shell user={user} active="/timetable/idp">
      <div className="head no-print">
        <h1>Individual Daily Program</h1>
        <div className="actions">
          <a className="btn ghost" href={`/timetable${isFaculty ? '' : `?view=faculty&id=${id}`}`}>Back to schedule</a>
          <PrintButton />
        </div>
      </div>

      {!isFaculty && (
        <form method="get" className="card no-print">
          <div className="form-row">
            <div><label>Faculty</label><select name="id" defaultValue={String(id)}><Opts items={faculty} /></select></div>
          </div>
          <button type="submit">Show</button>
        </form>
      )}
      <p className="muted no-print">
        Official time comes from the faculty member&apos;s availability in their profile. The number of students is the
        class list when one was entered, otherwise the enrolled count. Print on long bond paper, landscape.
      </p>

      <div className="paper-wrap">
        <div className="form-sheet idp-sheet">
          <div className="idp-top">
            <FormLetterhead settings={settings} variant="idp" />
            <table className="idp-official">
              <thead><tr><th colSpan={2}>OFFICIAL TIME</th></tr></thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <tr key={d}><td className="d">{d === 4 ? 'THUR' : DAY_ABBR[d]}</td><td>{officialTime(d)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="idp-title">INDIVIDUAL DAILY PROGRAM<br />(Faculty without Designation)</h2>
          <p className="idp-term"><u>{semesterWords(term?.semester ?? '').replace(/ Semester$/, '')}</u> Semester, A.Y.: <u>{term?.school_year ?? ''}</u></p>

          <table className="idp-info">
            <tbody>
              <tr>
                <th>NAME</th><td>: {name.toUpperCase()}</td>
                <th>EDUCATIONAL QUALIFICATION</th><td>: {(profile?.degree ?? '').toUpperCase()}</td>
              </tr>
              <tr>
                <th>ACADEMIC RANK/DESIGNATION</th><td>: {profile?.academic_rank ?? ''}</td>
                <th>MAJOR ASSIGNMENT</th><td>: Teaching</td>
              </tr>
              <tr>
                <th>NUMBER OF PREPARATIONS</th><td>: {preparations}</td>
                <th>NUMBER OF HOURS IN TEACHING</th><td>: {num(totalHours)}</td>
              </tr>
            </tbody>
          </table>

          <table className="idp-grid">
            <colgroup>
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '15%' }} /><col style={{ width: '6%' }} /><col style={{ width: '9.5%' }} /><col style={{ width: '5%' }} /><col style={{ width: '3.5%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '6%' }} /><col style={{ width: '5%' }} /><col style={{ width: '4%' }} /><col style={{ width: '3.5%' }} />
              <col style={{ width: '6.5%' }} /><col style={{ width: '5%' }} /><col style={{ width: '4%' }} /><col style={{ width: '3.5%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={3}>DAY</th>
                <th colSpan={10}>CONTACT HOUR</th>
                <th colSpan={4}>QUASI TEACHING</th>
                <th rowSpan={3}>TOTAL DAILY HOURS</th>
              </tr>
              <tr>
                <th colSpan={5}>ACTUAL TEACHING LOAD</th>
                <th colSpan={5}>OVERLOAD/HONORARIUM</th>
                <th rowSpan={2}>ACTIVITIES</th><th rowSpan={2}>TIME</th><th rowSpan={2}>RM</th><th rowSpan={2}>HRS</th>
              </tr>
              <tr>
                <th>SUBJECT CODE/ COURSE/ YEAR/ SECTION</th><th>NO. OF STUDENTS</th><th>TIME</th><th>RM</th><th>HRS</th>
                <th>SUBJECT CODE/ COURSE/YEAR/ SECTION</th><th>NO. OF STUDENTS</th><th>TIME</th><th>RM</th><th>HRS</th>
              </tr>
            </thead>
            <tbody>
              {days.flatMap((d) => {
                const list = byDay.get(d)!;
                const span = Math.max(1, list.length);
                const dayHours = list.reduce((t, m) => t + hrs(m), 0);
                return Array.from({ length: span }, (_, i) => {
                  const m = list[i];
                  const first = rowIndex++ === 0;
                  return (
                    <tr key={`${d}-${i}`}>
                      {i === 0 && <td rowSpan={span} className="c">{DAY_ABBR[d]}</td>}
                      {m ? (
                        <>
                          <td>{m.code}-{m.section_name.toUpperCase()}</td>
                          <td className="c">{students(m)}</td>
                          <td className="c">{formTime(m.start_time)} – {formTime(m.end_time)}</td>
                          <td className="c">{m.room_name}</td>
                          <td className="c">{num(hrs(m))}</td>
                        </>
                      ) : blanks(5)}
                      {blanks(5)}
                      <td /><td />
                      {first && <td rowSpan={bodyRows} className="office"><span>Name of Office</span></td>}
                      <td />
                      {i === 0 && <td rowSpan={span} className="c">{dayHours ? num(dayHours) : ''}</td>}
                    </tr>
                  );
                });
              })}
              <tr className="total">
                <td colSpan={5} className="r"><b>TOTAL</b></td>
                <td className="c"><b>{num(totalHours)}</b></td>
                <td colSpan={4} className="r"><b>TOTAL</b></td>
                <td />
                <td colSpan={3} className="r"><b>TOTAL</b></td>
                <td />
                <td className="c"><b>{num(totalHours)}</b></td>
              </tr>
            </tbody>
          </table>

          <div className="idp-signs">
            <div><p>Prepared by:</p><b>{name.toUpperCase()}</b><span>{profile?.academic_rank ?? ''}</span></div>
            <div><p>Concurred by:</p><b>{settings.sign_concurred_name}</b><span>{settings.sign_concurred_title}</span></div>
            <div><p>Recommending approval:</p><b>{settings.sign_recommending_name}</b><span>{settings.sign_recommending_title}</span></div>
            <div><p>Approved:</p><b>{settings.sign_approved_name}</b><span>{settings.sign_approved_title}</span></div>
            <div />
            <div><b>{settings.sign_prepared_name}</b><span>{settings.sign_prepared_title}</span></div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
