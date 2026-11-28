'use server';
/** Class lists: saving the students of a class offering. */
import { redirect } from 'next/navigation';
import { canManageDept, deny, flash, requireUser } from '@/lib/auth';
import { loadOffering } from '@/lib/conflict';
import { sql, transaction } from '@/lib/db';
import { int, str } from '@/lib/format';
import { ensureStudentsTable, parseNames } from '@/lib/students';

const MAX_STUDENTS = 300;

export async function saveClassList(form: FormData): Promise<void> {
  const user = await requireUser();
  const o = await loadOffering(int(form, 'offering_id'));
  // Only the admin or the chair of the subject's department may change a class list; faculty can only view it.
  if (!o || !canManageDept(user, o.department_id)) return deny();
  const back = `/offerings/${o.id}/students`;

  let names = parseNames(str(form, 'names'));
  if (names.length > MAX_STUDENTS) {
    await flash(`Not saved: a class list can have at most ${MAX_STUDENTS} names.`, 'error');
    redirect(back);
  }
  if (form.get('sort') === '1') names = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  await ensureStudentsTable();
  await transaction(async (tx) => {
    await tx.exec(sql`DELETE FROM offering_students WHERE offering_id = ${o.id}`);
    await tx.exec(sql`INSERT INTO offering_students (offering_id, position, name)
                      SELECT ${o.id}, t.pos, t.name FROM unnest(${names}::text[]) WITH ORDINALITY AS t(name, pos)`);
  });
  await flash(names.length ? `Class list saved: ${names.length} student(s).` : 'Class list cleared.');
  if (names.length && names.length !== o.enrolled) {
    await flash(`The class list has ${names.length} names but the offering is set to ${o.enrolled} enrolled students.`, 'warning');
  }
  redirect(back);
}
