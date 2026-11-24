'use server';
import { redirect } from 'next/navigation';
import { canManageDept, deny, deptScope, flash, requireRole } from '@/lib/auth';
import { LEVELS } from '@/lib/constants';
import { db, isConstraintError, sql, transaction } from '@/lib/db';
import { clamp, float, int, str } from '@/lib/format';

/** Add or edit a subject together with its teaching requirements, or delete it. */
export async function saveSubject(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  let id = int(form, 'id');
  const existing = id ? await db.row(sql`SELECT * FROM subjects WHERE id = ${id}`) : null;
  if (id && !existing) return deny();
  if (existing && !canManageDept(user, existing.department_id)) return deny();

  if (str(form, 'action') === 'delete') {
    try {
      await db.exec(sql`DELETE FROM subjects WHERE id = ${id}`);
      await flash('Subject deleted.');
    } catch (err) {
      if (!isConstraintError(err)) throw err;
      await flash('This subject is used by class offerings and cannot be deleted.', 'error');
    }
    redirect('/subjects');
  }

  const departmentId = deptScope(user) ?? int(form, 'department_id');
  const code = str(form, 'code').toUpperCase();
  const title = str(form, 'title');
  const back = id ? `/subjects?edit=${id}` : '/subjects';
  if (!code || !title || !(await db.val(sql`SELECT id FROM departments WHERE id = ${departmentId}`))) {
    await flash('Code, title, and department are required.', 'error');
    redirect(back);
  }
  if (await db.val(sql`SELECT id FROM subjects WHERE code = ${code} AND id <> ${id}`)) {
    await flash('Another subject already uses that code.', 'error');
    redirect(back);
  }
  const level = str(form, 'min_degree_level') in LEVELS ? str(form, 'min_degree_level') : 'bachelor';
  const roomType = str(form, 'room_type') === 'laboratory' ? 'laboratory' : 'lecture';
  const units = clamp(float(form, 'units'), 0.5, 12);
  const hours = clamp(float(form, 'hours_per_week'), 0.5, 20);
  const fieldIds = [...new Set(form.getAll('fields').map((v) => Number(v)).filter(Number.isInteger))];

  await transaction(async (tx) => {
    if (existing) {
      await tx.exec(sql`UPDATE subjects SET code = ${code}, title = ${title}, units = ${units}, hours_per_week = ${hours},
        department_id = ${departmentId}, min_degree_level = ${level}, room_type = ${roomType} WHERE id = ${id}`);
    } else {
      id = (await tx.val<number>(sql`INSERT INTO subjects (code, title, units, hours_per_week, department_id, min_degree_level, room_type)
        VALUES (${code}, ${title}, ${units}, ${hours}, ${departmentId}, ${level}, ${roomType}) RETURNING id`)) ?? 0;
    }
    // Replace the requirement lists with what was ticked on the form.
    await tx.exec(sql`DELETE FROM subject_fields WHERE subject_id = ${id}`);
    await tx.exec(sql`INSERT INTO subject_fields (subject_id, field_id) SELECT ${id}, id FROM fields WHERE id = ANY(${fieldIds})`);
  });
  await flash('Subject and its requirements saved.');
  redirect('/subjects');
}
