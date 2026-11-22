'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db, sql } from '@/lib/db';
import { createSession, destroySession, flash, requireUser, type User } from '@/lib/auth';
import { str } from '@/lib/format';

// Compared against when the username does not exist, so both cases take the same time.
const DUMMY_HASH = '$2b$10$qgTrp.C.Rc/KKQVVsxjlD.rAOYSd1uPChPCBTKdeVrbjJ6Iz243iu';

export async function login(_prev: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const username = str(form, 'username');
  const password = String(form.get('password') ?? '');

  // Slow down password guessing: 5 failed tries lock the account for a minute.
  const recent = (await db.val<number>(sql`
    SELECT COUNT(*) FROM login_attempts WHERE username = ${username} AND attempted_at > NOW() - interval '1 minute'`)) ?? 0;
  if (recent >= 5) return { error: 'Too many failed attempts. Try again in a minute.' };

  const user = await db.row<User>(sql`SELECT * FROM users WHERE username = ${username} AND is_active`);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    await db.exec(sql`INSERT INTO login_attempts (username) VALUES (${username})`);
    await db.exec(sql`DELETE FROM login_attempts WHERE attempted_at < NOW() - interval '1 day'`);
    return { error: 'Incorrect username or password.' };
  }

  await db.exec(sql`DELETE FROM login_attempts WHERE username = ${username}`);
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}

export async function changePassword(form: FormData): Promise<void> {
  const user = await requireUser();
  const current = String(form.get('current_password') ?? '');
  const next = String(form.get('new_password') ?? '');
  if (!(await bcrypt.compare(current, user.password_hash))) {
    await flash('Your current password is incorrect.', 'error');
  } else if (next.length < 8) {
    await flash('The new password must be at least 8 characters.', 'error');
  } else if (next !== String(form.get('confirm_password') ?? '')) {
    await flash('The new passwords do not match.', 'error');
  } else {
    await db.exec(sql`UPDATE users SET password_hash = ${await bcrypt.hash(next, 10)} WHERE id = ${user.id}`);
    await flash('Password changed.');
  }
  redirect('/account');
}
