'use server';
import { redirect } from 'next/navigation';
import { deny, flash, requireUser } from '@/lib/auth';
import { CRUD, resolveOptions } from '@/lib/crud';
import { db, isConstraintError, join, raw, sql } from '@/lib/db';
import { int, str } from '@/lib/format';

/** Add, edit, or delete a row of one of the simple tables in lib/crud.ts. */
export async function saveCrud(form: FormData): Promise<void> {
  const def = CRUD[str(form, 'crud')];
  if (!def) return deny();
  const user = await requireUser();
  if (!def.roles.includes(user.role)) return deny();

  const id = int(form, 'id');
  // Columns forced to a value (a chair's own department).
  const scope: Record<string, number | null> =
    def.scopedToDepartment && user.role === 'chair' ? { department_id: user.department_id } : {};
  const scopeSql = join(Object.entries(scope).map(([col, v]) => sql` AND ${raw(col)} = ${v}`), '');
  const label = def.single.charAt(0).toUpperCase() + def.single.slice(1);
  const editUrl = id ? `${def.page}?t=${def.table}&edit=${id}` : def.page;

  let message = '';
  let error = '';
  try {
    if (str(form, 'action') === 'delete') {
      await db.exec(sql`DELETE FROM ${raw(def.table)} WHERE id = ${id} ${scopeSql}`);
      message = `${label} deleted.`;
    } else {
      const values: Record<string, unknown> = {};
      for (const [col, field] of Object.entries(def.fields)) {
        let v: string = col in scope ? String(scope[col] ?? '') : str(form, col);
        if (v === '' && field.required) {
          error = `${field.label} is required.`;
          break;
        }
        if (field.type === 'select' && v !== '' && !(await resolveOptions(field)).some(([k]) => k === v)) {
          error = `Invalid choice for ${field.label}.`;
          break;
        }
        if (field.type === 'number' && v !== '') {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) {
            error = `${field.label} must be a number of 0 or more.`;
            break;
          }
          v = String(Math.round(n));
        }
        values[col] = v === '' ? null : v;
      }
      if (!error) {
        const cols = Object.keys(values);
        if (id) {
          await db.exec(sql`UPDATE ${raw(def.table)} SET ${join(cols.map((c) => sql`${raw(c)} = ${values[c]}`))}
                            WHERE id = ${id} ${scopeSql}`);
        } else {
          await db.exec(sql`INSERT INTO ${raw(def.table)} (${raw(cols.join(', '))})
                            VALUES (${join(cols.map((c) => sql`${values[c]}`))})`);
        }
        message = `${label} saved.`;
      }
    }
  } catch (err) {
    if (!isConstraintError(err)) throw err;
    error = `That could not be done: the ${def.single} is a duplicate or is still in use by other records.`;
  }

  if (error) {
    await flash(error, 'error');
    redirect(str(form, 'action') === 'delete' ? def.page : editUrl);
  }
  await flash(message);
  redirect(def.page);
}
