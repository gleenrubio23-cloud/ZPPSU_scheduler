import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { deptScope, requireUser } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { DAYS } from '@/lib/constants';
import { db, raw, sql } from '@/lib/db';
import { fmtTime, termLabel } from '@/lib/format';
import { classListCounts } from '@/lib/students';

export const metadata: Metadata = { title: 'Class Lists' };

/** Every class of the active term with its class list: faculty see their own classes, a chair their department, the admin all. */
export default async function ClassListsPage() {
  const user = await requireUser();
  const term = await activeTerm();
  const isFaculty = user.role === 'faculty';
  const dept = deptScope(user);
  const scope = isFaculty ? sql`AND o.faculty_id = ${user.id}` : dept ? sql`AND sub.department_id = ${dept}` : raw('');

  const offerings = await db.rows(sql`
    SELECT o.id, o.enrolled, sub.code, sub.title, sec.name AS section_name, u.full_name AS faculty_name
    FROM offerings o
    JOIN subjects sub ON sub.id = o.subject_id
    JOIN sections sec ON sec.id = o.section_id
    LEFT JOIN users u ON u.id = o.faculty_id
    WHERE o.term_id = ${term?.id ?? 0} ${scope}
    ORDER BY sub.code, sec.name`);
  const ids = offerings.map((o) => o.id as number);
  const [counts, meetingRows] = await Promise.all([
    classListCounts(ids),
    ids.length ? db.rows(sql`SELECT offering_id, day, start_time, end_time FROM schedules
                             WHERE offering_id = ANY(${ids}) ORDER BY day, start_time`) : Promise.resolve([]),
  ]);
  const meetings = new Map<number, string[]>();
  for (const m of meetingRows) {
    meetings.set(m.offering_id, [...(meetings.get(m.offering_id) ?? []),
      `${DAYS[m.day].slice(0, 3)} ${fmtTime(m.start_time)}-${fmtTime(m.end_time)}`]);
  }

  return (
    <Shell user={user} active="/classlists">
      <h1>Class Lists, {termLabel(term)}</h1>
      <p className="muted">
        {isFaculty
          ? 'Your classes this term. Open a class to view or print its List of Students. The administrator and the program chair keep the lists.'
          : 'Open a class to enter, edit, or print its List of Students.'}
      </p>
      <div className="card table-wrap">
        {offerings.length === 0 ? <p className="muted">No classes this term.</p> : (
          <table>
            <thead><tr><th>Subject</th><th>Section</th>{!isFaculty && <th>Faculty</th>}<th>Schedule</th><th className="num">Students listed</th><th /></tr></thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.code}</strong> {o.title}</td>
                  <td>{o.section_name}</td>
                  {!isFaculty && <td>{o.faculty_name ?? '-'}</td>}
                  <td>{(meetings.get(o.id) ?? ['Not scheduled']).map((m, i) => <div key={i}>{m}</div>)}</td>
                  <td className="num">{counts.get(o.id) ?? 0} / {o.enrolled}</td>
                  <td><a className="btn small" href={`/offerings/${o.id}/students`}>{isFaculty ? 'View / Print' : 'Open'}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
