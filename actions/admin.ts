'use server';
/** Administrator actions: user accounts, academic terms, matching weights, and print settings. */
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { flash, requireRole } from '@/lib/auth';
import { ROLES, SEMESTERS, type Role } from '@/lib/constants';
import { db, isConstraintError, sql, transaction } from '@/lib/db';
import { clamp, float, int, str } from '@/lib/format';
import { SECTION_LIMIT_CEILING, SECTION_LIMIT_KEY } from '@/lib/limits';
import { PRINT_KEYS } from '@/lib/printSettings';

// ---------- Users ----------
export async function saveUser(form: FormData): Promise<void> {
  const me = await requireRole('admin');
  const id = int(form, 'id');
  const username = str(form, 'username');
  const fullName = str(form, 'full_name');
  const email = str(form, 'email') || null;
  const role = str(form, 'role') as Role;
  const departmentId = int(form, 'department_id') || null;
  const password = String(form.get('password') ?? '');
  const back = id ? `/users?edit=${id}` : '/users';

  let error = '';
  if (!username || !fullName || !(role in ROLES)) error = 'Username, full name, and role are required.';
  else if ((role === 'chair' || role === 'faculty') && !departmentId) error = 'A chair or faculty account needs a department.';
  else if (await db.val(sql`SELECT id FROM users WHERE username = ${username} AND id <> ${id}`)) error = 'That username is already taken.';
  else if (!id && password.length < 8) error = 'Set a password of at least 8 characters.';
  else if (id === me.id && role !== 'admin') error = 'You cannot remove your own administrator role.';
  else if (departmentId && !(await db.val(sql`SELECT id FROM departments WHERE id = ${departmentId}`))) error = 'Choose a valid department.';
  if (error) {
    await flash(error, 'error');
    redirect(back);
  }

  let userId = id;
  if (id) {
    await db.exec(sql`UPDATE users SET username = ${username}, full_name = ${fullName}, email = ${email},
                      role = ${role}, department_id = ${departmentId} WHERE id = ${id}`);
    if (password !== '') {
      if (password.length < 8) await flash('Password not changed: it must be at least 8 characters.', 'error');
      else await db.exec(sql`UPDATE users SET password_hash = ${await bcrypt.hash(password, 10)} WHERE id = ${id}`);
    }
  } else {
    userId = (await db.val<number>(sql`
      INSERT INTO users (username, full_name, email, role, department_id, password_hash)
      VALUES (${username}, ${fullName}, ${email}, ${role}, ${departmentId}, ${await bcrypt.hash(password, 10)})
      RETURNING id`)) ?? 0;
  }
  if (role === 'faculty') {
    await db.exec(sql`INSERT INTO faculty_profiles (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
  }
  await flash('User saved.');
  redirect('/users');
}

export async function toggleUser(form: FormData): Promise<void> {
  const me = await requireRole('admin');
  const id = int(form, 'id');
  if (id !== me.id) {
    await db.exec(sql`UPDATE users SET is_active = NOT is_active WHERE id = ${id}`);
    await db.exec(sql`DELETE FROM sessions WHERE user_id = ${id}`); // a disabled user is logged out at once
    await flash('Account status changed.');
  }
  redirect('/users');
}

// ---------- Terms ----------
export async function saveTerm(form: FormData): Promise<void> {
  await requireRole('admin');
  const action = str(form, 'action');
  const id = int(form, 'id');
  try {
    if (action === 'add') {
      const year = str(form, 'school_year');
      const semester = str(form, 'semester');
      if (!/^\d{4}-\d{4}$/.test(year) || !(SEMESTERS as readonly string[]).includes(semester)) {
        await flash('Enter the school year as 2026-2027 and choose a semester.', 'error');
      } else {
        await db.exec(sql`INSERT INTO terms (school_year, semester) VALUES (${year}, ${semester})`);
        await flash('Term added.');
      }
    } else if (action === 'activate') {
      await transaction(async (tx) => {
        await tx.exec(sql`UPDATE terms SET is_active = FALSE`);
        await tx.exec(sql`UPDATE terms SET is_active = TRUE WHERE id = ${id}`);
      });
      await flash('Active term changed.');
    } else if (action === 'delete') {
      if (await db.val<number>(sql`SELECT COUNT(*) FROM offerings WHERE term_id = ${id}`)) {
        await flash('This term has class offerings and cannot be deleted.', 'error');
      } else {
        await db.exec(sql`DELETE FROM terms WHERE id = ${id} AND NOT is_active`);
        await flash('Term deleted.');
      }
    }
  } catch (err) {
    if (!isConstraintError(err)) throw err;
    await flash('That term already exists.', 'error');
  }
  redirect('/terms');
}

// ---------- Matching weights ----------
export async function saveWeights(form: FormData): Promise<void> {
  await requireRole('admin');
  const keys = ['degree', 'cert', 'experience'];
  const values = keys.map((k) => clamp(float(form, `w_${k}`), 0, 100));
  if (values.reduce((a, b) => a + b, 0) <= 0) {
    await flash('At least one weight must be greater than zero.', 'error');
  } else {
    for (let i = 0; i < keys.length; i++) {
      await db.exec(sql`INSERT INTO settings (name, value) VALUES (${`w_${keys[i]}`}, ${String(values[i])})
                        ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`);
    }
    await flash('Matching weights saved.');
  }
  redirect('/settings');
}

// ---------- Class offerings: section size limit ----------
export async function saveSectionLimit(form: FormData): Promise<void> {
  await requireRole('admin');
  const limit = int(form, 'max_section_size');
  if (limit < 1 || limit > SECTION_LIMIT_CEILING) {
    await flash(`Enter a section size limit from 1 to ${SECTION_LIMIT_CEILING}.`, 'error');
  } else {
    await db.exec(sql`INSERT INTO settings (name, value) VALUES (${SECTION_LIMIT_KEY}, ${String(limit)})
                      ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`);
    await flash(`Section size limit set to ${limit} students.`);
  }
  redirect('/settings#section-limit');
}

// ---------- Printed timetable ----------
export async function savePrintSettings(form: FormData): Promise<void> {
  await requireRole('admin');
  for (const key of PRINT_KEYS) {
    const value = str(form, key).slice(0, 255);
    await db.exec(sql`INSERT INTO settings (name, value) VALUES (${key}, ${value})
                      ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`);
  }
  await flash('Print settings saved.');
  redirect('/settings');
}
