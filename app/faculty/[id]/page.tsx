import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { ActionButton, Badge, Opts } from '@/components/ui';
import { canManageDept, requireUser } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { DAYS, LEVELS } from '@/lib/constants';
import { db, sql, type Row } from '@/lib/db';
import { fmtTime, num } from '@/lib/format';
import { facultyLoad } from '@/lib/matching';
import { updateProfile } from '@/actions/profile';

export const metadata: Metadata = { title: 'Faculty Profile' };

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id) || 0;
  const f = await db.row(sql`
    SELECT u.*, d.code AS dept_code, d.name AS dept_name FROM users u
    LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ${id} AND u.role = 'faculty'`);
  if (!f) redirect('/dashboard');

  // The faculty member themself, or the admin / the chair of their department.
  const isOwner = me.id === id;
  const canVerify = canManageDept(me, f.department_id);
  if (!isOwner && !canVerify) redirect('/denied');

  await db.exec(sql`INSERT INTO faculty_profiles (user_id) VALUES (${id}) ON CONFLICT DO NOTHING`);
  const term = await activeTerm();
  const [p, degrees, certs, taught, avail, allFields, allSubjects, load] = await Promise.all([
    db.row(sql`SELECT * FROM faculty_profiles WHERE user_id = ${id}`),
    db.rows(sql`SELECT d.*, fl.name AS field FROM faculty_degrees d JOIN fields fl ON fl.id = d.field_id
                WHERE d.faculty_id = ${id} ORDER BY array_position(ARRAY['doctorate', 'master', 'bachelor']::varchar[], d.level)`),
    db.rows(sql`SELECT c.* FROM faculty_certifications c
                WHERE c.faculty_id = ${id} ORDER BY c.year_obtained DESC NULLS LAST`),
    db.rows(sql`SELECT s.id, s.code, s.title, t.terms_taught FROM faculty_subjects_taught t JOIN subjects s ON s.id = t.subject_id
                WHERE t.faculty_id = ${id} ORDER BY s.code`),
    db.rows(sql`SELECT * FROM faculty_availability WHERE faculty_id = ${id} ORDER BY day, start_time`),
    db.pairs(sql`SELECT id, name FROM fields ORDER BY name`),
    db.pairs(sql`SELECT id, code || ' - ' || title FROM subjects ORDER BY code`),
    term ? facultyLoad(id, term.id) : Promise.resolve(0),
  ]);
  if (!p) redirect('/dashboard');

  const hidden = { faculty_id: id };
  const Hidden = ({ action }: { action: string }) => (
    <><input type="hidden" name="faculty_id" value={id} /><input type="hidden" name="action" value={action} /></>
  );
  const remove = (action: string, rowId: number, confirm?: string) => (
    <ActionButton action={updateProfile} fields={{ ...hidden, action, row_id: rowId }} label="Remove" className="small danger" confirm={confirm} />
  );
  const credentialActions = (type: 'degree' | 'cert', r: Row) => (
    <div className="actions">
      {canVerify && r.status !== 'verified' && (
        <ActionButton action={updateProfile} fields={{ ...hidden, action: 'verify', type, row_id: r.id, status: 'verified' }} label="Verify" className="small ok" />
      )}
      {canVerify && r.status !== 'rejected' && (
        <ActionButton action={updateProfile} fields={{ ...hidden, action: 'verify', type, row_id: r.id, status: 'rejected' }} label="Reject" className="small ghost" />
      )}
      {remove(type === 'cert' ? 'del_cert' : 'del_degree', r.id, 'Remove this entry?')}
    </div>
  );

  return (
    <Shell user={me} active={isOwner ? '/profile' : '/faculty'}>
      <div className="head">
        <div>
          <h1>{f.full_name}</h1>
          <span className="muted">{f.dept_name ?? 'No department'} &middot; {p.academic_rank || 'No rank set'} &middot; {p.employment_status === 'part_time' ? 'Part-time' : 'Full-time'}</span>
        </div>
        <div className="actions">
          <a className="btn ghost" href={`/timetable?view=faculty&id=${id}`}>Weekly schedule</a>
          {!isOwner && <a className="btn ghost" href="/faculty">Back to list</a>}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{num(load)} / {num(p.max_units)}</b><span>Units this term / maximum</span></div>
        <div className="stat"><b>{p.years_teaching}</b><span>Years of teaching</span></div>
        <div className="stat"><b>{p.industry_years}</b><span>Years of industry experience</span></div>
      </div>

      {canVerify && (
        <div className="card">
          <h2>Employment details</h2>
          <form action={updateProfile}>
            <Hidden action="employment" />
            <div className="form-row">
              <div><label>Employee number</label><input type="text" name="employee_no" defaultValue={p.employee_no ?? ''} /></div>
              <div><label>Status</label><select name="employment_status" defaultValue={p.employment_status}>
                <Opts items={{ full_time: 'Full-time', part_time: 'Part-time' }} /></select></div>
              <div><label>Academic rank</label><input type="text" name="academic_rank" defaultValue={p.academic_rank ?? ''} /></div>
            </div>
            <div className="form-row">
              <div><label>Maximum teaching load (units)</label><input type="number" name="max_units" min={0} max={40} step={0.5} defaultValue={num(p.max_units)} /></div>
              <div><label>Years of teaching</label><input type="number" name="years_teaching" min={0} defaultValue={p.years_teaching} /></div>
              <div><label>Years of industry experience</label><input type="number" name="industry_years" min={0} defaultValue={p.industry_years} /></div>
            </div>
            <button type="submit">Save details</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>Degrees</h2>
        {!canVerify && <p className="muted">Only degrees verified by your program chair count in subject matching.</p>}
        <div className="table-wrap"><table>
          <thead><tr><th>Level</th><th>Degree</th><th>Field</th><th>School</th><th>Year</th><th>Status</th><th /></tr></thead>
          <tbody>
            {degrees.map((d) => (
              <tr key={d.id}>
                <td>{LEVELS[d.level]}</td><td>{d.title}</td><td>{d.field}</td><td>{d.institution}</td><td>{d.year_graduated}</td>
                <td><Badge kind={d.status}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</Badge></td>
                <td>{credentialActions('degree', d)}</td>
              </tr>
            ))}
            {degrees.length === 0 && <tr><td colSpan={7} className="muted">No degrees listed yet.</td></tr>}
          </tbody>
        </table></div>
        <h3>Add a degree</h3>
        <form action={updateProfile}>
          <Hidden action="add_degree" />
          <div className="form-row">
            <div><label>Level</label><select name="level" required><Opts items={LEVELS} /></select></div>
            <div><label>Degree title</label><input type="text" name="title" required placeholder="MS Computer Science" /></div>
            <div><label>Field of study</label><select name="field_id" required><Opts items={allFields} placeholder="Choose" /></select></div>
            <div><label>School</label><input type="text" name="institution" required /></div>
            <div><label>Year graduated</label><input type="number" name="year" min={1950} max={2100} /></div>
          </div>
          <button type="submit">Add degree</button>
        </form>
      </div>

      <div>
        <div className="card">
          <h2>Certifications, licenses, and trainings</h2>
          <table>
            <thead><tr><th>Credential</th><th>Status</th><th /></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong><br />
                    <span className="muted">{c.issuer} {c.year_obtained}</span></td>
                  <td><Badge kind={c.status}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Badge></td>
                  <td>{credentialActions('cert', c)}</td>
                </tr>
              ))}
              {certs.length === 0 && <tr><td colSpan={3} className="muted">No certifications listed yet.</td></tr>}
            </tbody>
          </table>
          <h3>Add a certification</h3>
          <form action={updateProfile}>
            <Hidden action="add_cert" />
            <div className="form-row">
              <div><label>Name</label><input type="text" name="name" required /></div>
              <div><label>Issued by</label><input type="text" name="issuer" /></div>
            </div>
            <div className="form-row">
              <div><label>Year obtained</label><input type="number" name="year" min={1950} max={2100} /></div>
            </div>
            <button type="submit">Add certification</button>
          </form>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <h2>Subjects taught before</h2>
          <table>
            <thead><tr><th>Subject</th><th className="num">Terms</th><th /></tr></thead>
            <tbody>
              {taught.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.code}</strong> {t.title}</td><td className="num">{t.terms_taught}</td>
                  <td>{remove('del_taught', t.id)}</td>
                </tr>
              ))}
              {taught.length === 0 && <tr><td colSpan={3} className="muted">No teaching history listed yet.</td></tr>}
            </tbody>
          </table>
          <h3>Add or update</h3>
          <form action={updateProfile}>
            <Hidden action="save_taught" />
            <div className="form-row">
              <div><label>Subject</label><select name="subject_id" required><Opts items={allSubjects} placeholder="Choose" /></select></div>
              <div><label>Number of terms taught</label><input type="number" name="terms_taught" min={1} max={60} defaultValue={1} /></div>
            </div>
            <button type="submit">Save</button>
          </form>
        </div>

        <div className="card">
          <h2>Availability</h2>
          <p className="muted">Leave this empty if available at any time. Otherwise list every time block when classes can be scheduled.</p>
          <table>
            <thead><tr><th>Day</th><th>From</th><th>To</th><th /></tr></thead>
            <tbody>
              {avail.map((a) => (
                <tr key={a.id}>
                  <td>{DAYS[a.day]}</td><td>{fmtTime(a.start_time)}</td><td>{fmtTime(a.end_time)}</td>
                  <td>{remove('del_avail', a.id)}</td>
                </tr>
              ))}
              {avail.length === 0 && <tr><td colSpan={4} className="muted">Available at any time.</td></tr>}
            </tbody>
          </table>
          <h3>Add a time block</h3>
          <form action={updateProfile}>
            <Hidden action="add_avail" />
            <div className="form-row">
              <div><label>Day</label><select name="day"><Opts items={DAYS} /></select></div>
              <div><label>From</label><input type="time" name="start_time" required defaultValue="07:00" /></div>
              <div><label>To</label><input type="time" name="end_time" required defaultValue="17:00" /></div>
            </div>
            <button type="submit">Add</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
