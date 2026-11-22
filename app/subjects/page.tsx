import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { ActionButton, Opts } from '@/components/ui';
import { canManageDept, deptScope, requireRole } from '@/lib/auth';
import { LEVELS, ROOM_TYPES } from '@/lib/constants';
import { db, raw, sql } from '@/lib/db';
import { num, param } from '@/lib/format';
import { saveSubject } from '@/actions/subjects';

export const metadata: Metadata = { title: 'Subjects' };

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin', 'chair');
  const dept = deptScope(user);
  const editId = Number(param(await searchParams, 'edit')) || 0;
  let edit = editId ? await db.row(sql`SELECT * FROM subjects WHERE id = ${editId}`) : null;
  if (edit && !canManageDept(user, edit.department_id)) edit = null;

  const [editFields, editSkills, allFields, allSkills, departments, subjects] = await Promise.all([
    edit ? db.rows<{ field_id: number }>(sql`SELECT field_id FROM subject_fields WHERE subject_id = ${edit.id}`) : Promise.resolve([]),
    edit ? db.rows<{ skill_id: number }>(sql`SELECT skill_id FROM subject_skills WHERE subject_id = ${edit.id}`) : Promise.resolve([]),
    db.pairs(sql`SELECT id, name FROM fields ORDER BY name`),
    db.pairs(sql`SELECT id, name FROM skills ORDER BY name`),
    db.pairs(sql`SELECT id, code FROM departments ORDER BY code`),
    db.rows(sql`
      SELECT s.*, d.code AS dept,
             (SELECT string_agg(f.name, ', ' ORDER BY f.name) FROM subject_fields sf JOIN fields f ON f.id = sf.field_id WHERE sf.subject_id = s.id) AS fields,
             (SELECT string_agg(k.name, ', ' ORDER BY k.name) FROM subject_skills ss JOIN skills k ON k.id = ss.skill_id WHERE ss.subject_id = s.id) AS skills
      FROM subjects s JOIN departments d ON d.id = s.department_id
      ${dept ? sql`WHERE s.department_id = ${dept}` : raw('')} ORDER BY s.code`),
  ]);
  const fieldSet = new Set(editFields.map((r) => r.field_id));
  const skillSet = new Set(editSkills.map((r) => r.skill_id));

  return (
    <Shell user={user} active="/subjects">
      <h1>Subjects and Teaching Requirements</h1>
      <div className="card">
        <h2>{edit ? `Edit ${edit.code}` : 'Add a subject'}</h2>
        <form action={saveSubject} key={edit ? `e${edit.id}` : 'add'}>
          <input type="hidden" name="id" value={edit?.id ?? 0} />
          <div className="form-row">
            <div><label>Subject code</label><input type="text" name="code" required defaultValue={edit?.code ?? ''} /></div>
            <div><label>Descriptive title</label><input type="text" name="title" required defaultValue={edit?.title ?? ''} /></div>
            {!dept && (
              <div><label>Department</label><select name="department_id" required defaultValue={String(edit?.department_id ?? '')}>
                <Opts items={departments} /></select></div>
            )}
          </div>
          <div className="form-row">
            <div><label>Units</label><input type="number" name="units" min={0.5} max={12} step={0.5} required defaultValue={num(edit?.units ?? 3)} /></div>
            <div><label>Contact hours per week</label><input type="number" name="hours_per_week" min={0.5} max={20} step={0.5} required defaultValue={num(edit?.hours_per_week ?? 3)} /></div>
            <div><label>Room type needed</label><select name="room_type" defaultValue={edit?.room_type ?? 'lecture'}><Opts items={ROOM_TYPES} /></select></div>
            <div><label>Minimum degree to teach</label><select name="min_degree_level" defaultValue={edit?.min_degree_level ?? 'bachelor'}><Opts items={LEVELS} /></select></div>
          </div>
          <h3>Accepted degree fields</h3>
          <p className="muted">A faculty member&apos;s degree counts as aligned when it is in one of these fields. Tick none to accept any field.</p>
          <div className="checks">
            {allFields.map(([id, name]) => (
              <label key={id}><input type="checkbox" name="fields" value={id} defaultChecked={fieldSet.has(Number(id))} /> {name}</label>
            ))}
          </div>
          <h3>Required skills</h3>
          <div className="checks">
            {allSkills.map(([id, name]) => (
              <label key={id}><input type="checkbox" name="skills" value={id} defaultChecked={skillSet.has(Number(id))} /> {name}</label>
            ))}
          </div>
          <p style={{ marginTop: 14 }}>
            <button type="submit">Save subject</button>{' '}
            {edit && <a className="btn ghost" href="/subjects">Cancel</a>}
          </p>
        </form>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Dept</th><th className="num">Units</th><th className="num">Hrs/wk</th><th>Room</th>
            <th>Minimum degree</th><th>Accepted fields</th><th>Required skills</th><th /></tr></thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.code}</strong><br />{s.title}</td><td>{s.dept}</td>
                <td className="num">{num(s.units)}</td><td className="num">{num(s.hours_per_week)}</td>
                <td>{ROOM_TYPES[s.room_type]}</td><td>{LEVELS[s.min_degree_level]}</td>
                <td>{s.fields || 'Any'}</td><td>{s.skills || 'None'}</td>
                <td><div className="actions">
                  <a className="btn small ghost" href={`/subjects?edit=${s.id}`}>Edit</a>
                  <ActionButton action={saveSubject} fields={{ action: 'delete', id: s.id }} label="Delete" className="small danger" confirm="Delete this subject?" />
                </div></td>
              </tr>
            ))}
            {subjects.length === 0 && <tr><td colSpan={9} className="muted">No subjects yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
