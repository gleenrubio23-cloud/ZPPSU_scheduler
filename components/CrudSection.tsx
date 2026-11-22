/** The add / edit form and the list for one simple table (see lib/crud.ts). */
import type { User } from '@/lib/auth';
import { resolveOptions, type CrudDef } from '@/lib/crud';
import { db, join, raw, sql } from '@/lib/db';
import { saveCrud } from '@/actions/crud';
import { ActionButton, Opts } from './ui';

export default async function CrudSection({
  def, user, editId,
}: { def: CrudDef; user: User; editId: number }) {
  const scope: Record<string, number | null> =
    def.scopedToDepartment && user.role === 'chair' ? { department_id: user.department_id } : {};
  const where = join([sql`TRUE`, ...Object.entries(scope).map(([col, v]) => sql`${raw(col)} = ${v}`)], ' AND ');

  const items = await db.rows(sql`SELECT * FROM ${raw(def.table)} WHERE ${where} ORDER BY ${raw(def.order)}`);
  const edit = editId ? await db.row(sql`SELECT * FROM ${raw(def.table)} WHERE id = ${editId} AND ${where}`) : null;
  const options: Record<string, [string, string][]> = {};
  for (const [col, f] of Object.entries(def.fields)) {
    if (f.type === 'select') options[col] = await resolveOptions(f);
  }
  const shown = Object.entries(def.fields);
  const formFields = shown.filter(([col]) => !(col in scope));
  const display = (col: string, value: unknown) => {
    if (def.fields[col].type === 'select') return options[col].find(([k]) => k === String(value))?.[1] ?? '-';
    return value === null || value === undefined ? '' : String(value);
  };

  return (
    <>
      <div className="card">
        <h2>{edit ? `Edit ${def.single}` : `Add a ${def.single}`}</h2>
        {/* key makes React rebuild the form when switching between add and edit */}
        <form action={saveCrud} key={edit ? `edit-${edit.id}` : 'add'}>
          <input type="hidden" name="crud" value={def.table} />
          <input type="hidden" name="id" value={edit?.id ?? 0} />
          <div className="form-row">
            {formFields.map(([col, f]) => {
              const value = String(edit?.[col] ?? f.default ?? '');
              return (
                <div key={col}>
                  <label>{f.label}</label>
                  {f.type === 'select' ? (
                    <select name={col} required={f.required} defaultValue={value}>
                      <Opts items={options[col]} placeholder={f.required ? undefined : 'None'} />
                    </select>
                  ) : (
                    <input type={f.type ?? 'text'} name={col} defaultValue={value} required={f.required}
                      {...(f.type === 'number' ? { min: 0, step: 'any' } : {})} />
                  )}
                </div>
              );
            })}
          </div>
          <button type="submit">Save</button>{' '}
          {edit && <a className="btn ghost" href={def.page}>Cancel</a>}
        </form>
      </div>
      <div className="card table-wrap">
        {items.length === 0 ? <p className="muted">Nothing here yet.</p> : (
          <table>
            <thead><tr>{shown.map(([col, f]) => <th key={col}>{f.label}</th>)}<th /></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  {shown.map(([col]) => <td key={col}>{display(col, it[col])}</td>)}
                  <td><div className="actions">
                    <a className="btn small ghost" href={`${def.page}?t=${def.table}&edit=${it.id}`}>Edit</a>
                    <ActionButton action={saveCrud} fields={{ crud: def.table, action: 'delete', id: it.id }}
                      label="Delete" className="small danger" confirm={`Delete this ${def.single}?`} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
