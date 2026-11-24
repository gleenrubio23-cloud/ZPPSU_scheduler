import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { ActionButton, Badge, Opts } from '@/components/ui';
import { canManageDept, requireRole } from '@/lib/auth';
import { loadOffering, suggestSlots, type Room } from '@/lib/conflict';
import { DAYS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { clamp, fmtTime, hhmm, minutes, num, param } from '@/lib/format';
import { sectionLimit } from '@/lib/limits';
import { addMeeting, deleteMeeting, setEnrolled } from '@/actions/offerings';

export const metadata: Metadata = { title: 'Schedule' };

export default async function SchedulePage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin', 'chair');
  const o = await loadOffering(Number((await params).id));
  if (!o) redirect('/offerings');
  if (!canManageDept(user, o.department_id)) redirect('/denied');
  const sp = await searchParams;
  const limit = await sectionLimit();

  const meetings = await db.rows(sql`
    SELECT s.*, r.name AS room_name FROM schedules s JOIN rooms r ON r.id = s.room_id
    WHERE s.offering_id = ${o.id} ORDER BY s.day, s.start_time`);
  const hoursSet = meetings.reduce((sum, m) => sum + (minutes(m.end_time) - minutes(m.start_time)) / 60, 0);
  const remaining = Math.max(0, o.hours_per_week - hoursSet);

  // Suggested length of the next meeting: split long subjects into two meetings.
  let defaultMinutes = remaining > 3 ? (remaining / 2) * 60 : remaining > 0 ? remaining * 60 : 60;
  defaultMinutes = Math.ceil(defaultMinutes / 30) * 30;
  const length = param(sp, 'dur') ? clamp(Number(param(sp, 'dur')) || 60, 30, 300) : defaultMinutes;
  const durations: Record<number, string> = { 60: '1 hour', 90: '1.5 hours', 120: '2 hours', 150: '2.5 hours', 180: '3 hours' };
  if (!durations[length]) durations[length] = `${length / 60} hours`;

  const [suggestions, rooms] = await Promise.all([
    suggestSlots(o, length),
    db.rows<Room>(sql`SELECT * FROM rooms ORDER BY (type = ${o.room_type}) DESC, name`),
  ]);
  const roomOptions = rooms.map((r) => [r.id, `${r.name} (${r.type}, ${r.capacity} seats${r.capacity < o.enrolled ? ', TOO SMALL' : ''})`] as [number, string]);

  return (
    <Shell user={user} active="/offerings">
      <div className="head">
        <h1>Schedule: {o.code}, {o.section_name}</h1>
        <a className="btn ghost" href="/offerings">Back to offerings</a>
      </div>

      <div className="card">
        <div className="form-row">
          <div><label>Subject</label>{o.title}</div>
          <div><label>Faculty</label>{o.faculty_id ? o.faculty_name : (
            <><Badge kind="warn">Unassigned</Badge> <a href={`/offerings/${o.id}/match`}>Match faculty</a></>)}</div>
          <div>
            <label>Students enrolled (section has {o.section_size}, max {limit})</label>
            <form action={setEnrolled} className="actions">
              <input type="hidden" name="offering_id" value={o.id} />
              <input type="number" name="enrolled" min={1} max={limit} required defaultValue={o.enrolled} style={{ width: 90 }} />
              <button className="small ghost">Update</button>
            </form>
          </div>
          <div><label>Room type needed</label>{o.room_type === 'laboratory' ? 'Laboratory' : 'Lecture'}</div>
          <div><label>Hours scheduled</label><Badge kind={remaining > 0.001 ? 'warn' : 'ok'}>{num(hoursSet)} of {num(o.hours_per_week)} per week</Badge></div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <h2>Weekly meetings</h2>
          <table>
            <thead><tr><th>Day</th><th>Time</th><th>Room</th><th /></tr></thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td>{DAYS[m.day]}</td><td>{fmtTime(m.start_time)} - {fmtTime(m.end_time)}</td><td>{m.room_name}</td>
                  <td><ActionButton action={deleteMeeting} fields={{ offering_id: o.id, schedule_id: m.id }} label="Remove" className="small danger" confirm="Remove this meeting?" /></td>
                </tr>
              ))}
              {meetings.length === 0 && <tr><td colSpan={4} className="muted">No meetings set yet.</td></tr>}
            </tbody>
          </table>

          <h3>Add a meeting</h3>
          <form action={addMeeting}>
            <input type="hidden" name="offering_id" value={o.id} />
            <div className="form-row">
              <div><label>Day</label><select name="day"><Opts items={DAYS} /></select></div>
              <div><label>Room</label><select name="room_id" required defaultValue=""><Opts items={roomOptions} placeholder="Choose" /></select></div>
            </div>
            <div className="form-row">
              <div><label>Start</label><input type="time" name="start_time" step={1800} required defaultValue="08:00" /></div>
              <div><label>End</label><input type="time" name="end_time" step={1800} required defaultValue="09:30" /></div>
            </div>
            <button type="submit">Check conflicts and save</button>
          </form>
        </div>

        <div className="card">
          <h2>Suggested conflict-free slots</h2>
          <form method="get" className="actions" style={{ marginBottom: 10 }}>
            <select name="dur" defaultValue={String(length)} style={{ width: 'auto' }}>
              <Opts items={Object.entries(durations).sort((a, b) => Number(a[0]) - Number(b[0]))} />
            </select>
            <button className="ghost" type="submit">Find slots</button>
          </form>
          <p className="muted">Times when the room, the section{o.faculty_id ? `, and ${o.faculty_name}` : ''} are all free,
            in a {o.room_type} room that seats at least {o.enrolled}.</p>
          {suggestions.length === 0 ? <p className="muted">No free slot of this length was found. Try a shorter meeting or add rooms.</p> : (
            <table>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr key={i}>
                    <td>{DAYS[s.day]}</td><td>{fmtTime(s.start)} - {fmtTime(s.end)}</td><td>{s.room.name}</td>
                    <td><ActionButton action={addMeeting} label="Use" className="small ok"
                      fields={{ offering_id: o.id, day: s.day, room_id: s.room.id, start_time: hhmm(s.start), end_time: hhmm(s.end) }} /></td>
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
