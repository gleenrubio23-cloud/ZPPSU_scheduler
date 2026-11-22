import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { Badge } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { activeTerm, availabilityChecker, capacityError, scanConflicts, scheduleWarnings } from '@/lib/conflict';
import { DAYS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { fmtTime, hhmm, num, termLabel } from '@/lib/format';

export const metadata: Metadata = { title: 'Conflict Report' };

export default async function ConflictsPage() {
  const user = await requireRole('admin', 'chair');
  const term = await activeTerm();
  const termId = term?.id ?? 0;

  const [conflicts, all, isAvailable, over, incomplete] = await Promise.all([
    scanConflicts(termId),
    db.rows(sql`
      SELECT s.day, s.start_time, s.end_time, o.id AS offering_id, o.faculty_id, o.enrolled, sub.code, sub.room_type,
             sec.name AS section_name, r.name, r.capacity, r.type, u.full_name AS faculty_name
      FROM schedules s JOIN offerings o ON o.id = s.offering_id JOIN subjects sub ON sub.id = o.subject_id
      JOIN sections sec ON sec.id = o.section_id JOIN rooms r ON r.id = s.room_id LEFT JOIN users u ON u.id = o.faculty_id
      WHERE o.term_id = ${termId} ORDER BY s.day, s.start_time`),
    availabilityChecker(),
    db.rows(sql`
      SELECT u.full_name, COALESCE(p.max_units, 21) AS max_units, SUM(s.units) AS units
      FROM offerings o JOIN subjects s ON s.id = o.subject_id JOIN users u ON u.id = o.faculty_id
      LEFT JOIN faculty_profiles p ON p.user_id = u.id
      WHERE o.term_id = ${termId} GROUP BY u.id, u.full_name, p.max_units
      HAVING SUM(s.units) > COALESCE(p.max_units, 21)`),
    db.rows(sql`
      SELECT * FROM (
        SELECT o.id, sub.code, sec.name AS section_name, o.faculty_id, sub.hours_per_week,
               COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))) / 3600 FROM schedules s WHERE s.offering_id = o.id), 0)::float AS hours_set
        FROM offerings o JOIN subjects sub ON sub.id = o.subject_id JOIN sections sec ON sec.id = o.section_id
        WHERE o.term_id = ${termId}
      ) x
      WHERE x.faculty_id IS NULL OR x.hours_set + 0.001 < x.hours_per_week
      ORDER BY x.section_name, x.code`),
  ]);

  // Room capacity problems and softer warnings, per meeting.
  const overCapacity: [string, string, number][] = [];
  const warnings: [string, string, number][] = [];
  for (const m of all) {
    const cls = `${m.code} (${m.section_name}), ${DAYS[m.day]} ${fmtTime(m.start_time)}`;
    const cap = capacityError(m as { name: string; capacity: number }, m.enrolled);
    if (cap) overCapacity.push([cls, cap, m.offering_id]);
    const available = isAvailable(m.faculty_id, m.day, hhmm(m.start_time), hhmm(m.end_time));
    for (const w of scheduleWarnings(m as { room_type: string; faculty_id: number | null; faculty_name: string | null },
      m as { name: string; type: string }, available)) {
      warnings.push([cls, w, m.offering_id]);
    }
  }

  return (
    <Shell user={user} active="/conflicts">
      <h1>Conflict Report, {termLabel(term)}</h1>

      <div className="card table-wrap">
        <h2>Schedule conflicts <Badge kind={conflicts.length ? 'bad' : 'ok'}>{conflicts.length}</Badge></h2>
        {conflicts.length === 0 ? <p>No room, faculty, or section is double-booked.</p> : (
          <table>
            <thead><tr><th>Type</th><th>Day</th><th>First class</th><th>Second class</th><th /></tr></thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={i}>
                  <td>
                    {c.same_room && <><Badge kind="bad">Room: {c.a_room}</Badge> </>}
                    {c.same_faculty && <><Badge kind="bad">Faculty: {c.a_faculty}</Badge> </>}
                    {c.same_section && <Badge kind="bad">Section: {c.a_section}</Badge>}
                  </td>
                  <td>{DAYS[c.day]}</td>
                  <td>{c.a_code} ({c.a_section})<br /><span className="muted">{fmtTime(c.a_start)}-{fmtTime(c.a_end)}, {c.a_room}</span></td>
                  <td>{c.b_code} ({c.b_section})<br /><span className="muted">{fmtTime(c.b_start)}-{fmtTime(c.b_end)}, {c.b_room}</span></td>
                  <td><a className="btn small ghost" href={`/offerings/${c.b_offering}/schedule`}>Fix</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card table-wrap">
        <h2>Room capacity <Badge kind={overCapacity.length ? 'bad' : 'ok'}>{overCapacity.length}</Badge></h2>
        {overCapacity.length === 0 ? <p>Every class fits its room.</p> : (
          <table><tbody>
            {overCapacity.map(([cls, text, oid], i) => (
              <tr key={i}><td>{cls}</td><td>{text}</td><td><a className="btn small ghost" href={`/offerings/${oid}/schedule`}>Fix</a></td></tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="card table-wrap">
        <h2>Warnings <Badge kind={warnings.length || over.length ? 'warn' : 'ok'}>{warnings.length + over.length}</Badge></h2>
        {warnings.length === 0 && over.length === 0 ? <p>No room type, availability, or load problems.</p> : (
          <table><tbody>
            {over.map((ov, i) => (
              <tr key={`o${i}`}><td>{ov.full_name}</td><td>Overloaded: {num(ov.units)} units assigned, maximum is {num(ov.max_units)}.</td><td /></tr>
            ))}
            {warnings.map(([cls, text, oid], i) => (
              <tr key={i}><td>{cls}</td><td>{text}</td><td><a className="btn small ghost" href={`/offerings/${oid}/schedule`}>Open</a></td></tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="card table-wrap">
        <h2>Incomplete classes <Badge kind={incomplete.length ? 'warn' : 'ok'}>{incomplete.length}</Badge></h2>
        {incomplete.length === 0 ? <p>Every class has a faculty member and all its weekly hours.</p> : (
          <table>
            <thead><tr><th>Class</th><th>Faculty</th><th>Hours scheduled</th><th /></tr></thead>
            <tbody>
              {incomplete.map((r) => (
                <tr key={r.id}>
                  <td>{r.code} ({r.section_name})</td>
                  <td>{r.faculty_id ? <Badge kind="ok">Assigned</Badge> : <Badge kind="warn">Unassigned</Badge>}</td>
                  <td>{num(r.hours_set)} of {num(r.hours_per_week)}</td>
                  <td><div className="actions">
                    <a className="btn small ghost" href={`/offerings/${r.id}/match`}>Match</a>
                    <a className="btn small ghost" href={`/offerings/${r.id}/schedule`}>Schedule</a>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
