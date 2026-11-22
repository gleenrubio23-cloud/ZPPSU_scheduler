import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import ConfirmButton from '@/components/ConfirmButton';
import { ActionButton, Badge, Opts } from '@/components/ui';
import { deptScope, requireRole } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { DAYS } from '@/lib/constants';
import { db, raw, sql } from '@/lib/db';
import { fmtTime, num, termLabel } from '@/lib/format';
import { addOffering, autoAssign, deleteOffering } from '@/actions/offerings';

export const metadata: Metadata = { title: 'Class Offerings' };

export default async function OfferingsPage() {
  const user = await requireRole('admin', 'chair');
  const dept = deptScope(user);
  const term = await activeTerm();
  const termId = term?.id ?? 0;
  const subjDept = dept ? sql`AND sub.department_id = ${dept}` : raw('');

  const [offerings, meetingRows, subjectOptions, sectionOptions] = await Promise.all([
    db.rows(sql`
      SELECT o.id, o.match_score, o.faculty_id, o.enrolled, sub.code, sub.title, sub.units, sub.hours_per_week,
             sec.name AS section_name, u.full_name AS faculty_name,
             COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))) / 3600 FROM schedules s WHERE s.offering_id = o.id), 0)::float AS hours_set
      FROM offerings o
      JOIN subjects sub ON sub.id = o.subject_id
      JOIN sections sec ON sec.id = o.section_id
      LEFT JOIN users u ON u.id = o.faculty_id
      WHERE o.term_id = ${termId} ${subjDept}
      ORDER BY sec.name, sub.code`),
    db.rows(sql`SELECT s.offering_id, s.day, s.start_time, s.end_time, r.name AS room FROM schedules s
                JOIN offerings o ON o.id = s.offering_id JOIN rooms r ON r.id = s.room_id
                WHERE o.term_id = ${termId} ORDER BY s.day, s.start_time`),
    db.pairs(sql`SELECT id, code || ' - ' || title FROM subjects ${dept ? sql`WHERE department_id = ${dept}` : raw('')} ORDER BY code`),
    db.pairs(sql`SELECT id, name FROM sections ORDER BY name`),
  ]);
  const meetings = new Map<number, string[]>();
  for (const m of meetingRows) {
    const list = meetings.get(m.offering_id) ?? [];
    list.push(`${DAYS[m.day].slice(0, 3)} ${fmtTime(m.start_time)}-${fmtTime(m.end_time)}, ${m.room}`);
    meetings.set(m.offering_id, list);
  }
  const unassigned = offerings.filter((o) => !o.faculty_id).length;

  return (
    <Shell user={user} active="/offerings">
      <div className="head">
        <h1>Class Offerings, {termLabel(term)}</h1>
        {unassigned > 0 && (
          <form action={autoAssign}>
            <ConfirmButton className="ok" message={`Assign the best-qualified eligible faculty member to all ${unassigned} unassigned class(es)?`}>
              Auto-assign {unassigned} unassigned
            </ConfirmButton>
          </form>
        )}
      </div>
      {!term ? (
        <div className="alert warning">No active term is set. An administrator must set one under Terms.</div>
      ) : (
        <>
          <div className="card">
            <h2>Offer a subject to a section</h2>
            <form action={addOffering}>
              <div className="form-row">
                <div><label>Subject</label><select name="subject_id" required defaultValue=""><Opts items={subjectOptions} placeholder="Choose" /></select></div>
                <div><label>Section</label><select name="section_id" required defaultValue=""><Opts items={sectionOptions} placeholder="Choose" /></select></div>
                <div><label>Students enrolled (blank = section size)</label><input type="number" name="enrolled" min={1} max={1000} /></div>
              </div>
              <button type="submit">Add offering</button>
            </form>
          </div>
          <div className="card table-wrap">
            {offerings.length === 0 ? <p className="muted">No class offerings for this term yet.</p> : (
              <table>
                <thead><tr><th>Section</th><th>Subject</th><th className="num">Enrolled</th><th>Faculty</th><th>Schedule</th><th className="num">Hours set</th><th /></tr></thead>
                <tbody>
                  {offerings.map((o) => {
                    const short = o.hours_set + 0.001 < o.hours_per_week;
                    return (
                      <tr key={o.id}>
                        <td>{o.section_name}</td>
                        <td><strong>{o.code}</strong> ({num(o.units)} units)<br /><span className="muted">{o.title}</span></td>
                        <td className="num">{o.enrolled}</td>
                        <td>{o.faculty_id ? (<>{o.faculty_name}<br /><Badge kind="info">Match {num(o.match_score)}%</Badge></>) : <Badge kind="warn">Unassigned</Badge>}</td>
                        <td>{meetings.has(o.id)
                          ? meetings.get(o.id)!.map((m, i) => <div key={i}>{m}</div>)
                          : <Badge kind="warn">Not scheduled</Badge>}</td>
                        <td className="num"><Badge kind={short ? 'warn' : 'ok'}>{num(o.hours_set)} / {num(o.hours_per_week)}</Badge></td>
                        <td><div className="actions">
                          <a className="btn small" href={`/offerings/${o.id}/match`}>{o.faculty_id ? 'Change faculty' : 'Match faculty'}</a>
                          <a className="btn small ghost" href={`/offerings/${o.id}/schedule`}>Schedule</a>
                          <ActionButton action={deleteOffering} fields={{ offering_id: o.id }} label="Remove" className="small danger"
                            confirm="Remove this class offering and its schedule?" />
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
