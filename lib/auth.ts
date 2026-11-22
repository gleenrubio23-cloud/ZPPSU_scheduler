/**
 * Login sessions, flash messages, and role-based access control.
 *
 * At login the server makes a random token and puts it in an httpOnly cookie. The database keeps
 * only the token's SHA-256 hash, so a copy of the database cannot be used to log in.
 * Sessions expire after 8 hours without activity.
 */
import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, raw, sql } from './db';
import type { Role } from './constants';

const COOKIE = 'classsched_session';
const LIFETIME = "interval '8 hours'";

export type User = {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  role: Role;
  department_id: number | null;
  is_active: boolean;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function sessionId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[0-9a-f]{64}$/.test(token) ? hashToken(token) : null;
}

/** Start a session for a user. Only callable from a server action. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await db.exec(sql`INSERT INTO sessions (id, user_id, expires_at)
                    VALUES (${hashToken(token)}, ${userId}, NOW() + ${raw(LIFETIME)})`);
  // Clean up expired sessions now and then.
  if (Math.random() < 0.05) await db.exec(sql`DELETE FROM sessions WHERE expires_at < NOW()`);
  const secure = (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}

export async function destroySession(): Promise<void> {
  const id = await sessionId();
  if (id) await db.exec(sql`DELETE FROM sessions WHERE id = ${id}`);
  (await cookies()).delete(COOKIE);
}

/** The logged-in user, or null. Each use also extends the session. Cached for one request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const id = await sessionId();
  if (!id) return null;
  return db.row<User>(sql`
    UPDATE sessions s SET expires_at = NOW() + ${raw(LIFETIME)}
    FROM users u
    WHERE s.id = ${id} AND s.expires_at > NOW() AND u.id = s.user_id AND u.is_active
    RETURNING u.*`);
});

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

/** Stop unless the logged-in user has one of the given roles. Used by every page AND every action. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/denied');
  return user;
}

/** A chair is limited to their own department. Admin returns null (no limit). */
export function deptScope(user: User): number | null {
  return user.role === 'chair' ? user.department_id : null;
}

/** True when the user may manage records of the given department. */
export function canManageDept(user: User, departmentId: number | null | undefined): boolean {
  if (user.role === 'admin') return true;
  return user.role === 'chair' && departmentId != null && Number(departmentId) === user.department_id;
}

// ---------- Flash messages (shown once on the next page) ----------
// Kept in a short-lived cookie. The page that shows them clears the cookie (components/FlashClear.tsx).
export type Flash = { message: string; type: 'success' | 'error' | 'warning' };
export const FLASH_COOKIE = 'classsched_flash';

function readFlash(value: string | undefined): Flash[] {
  try {
    const list = JSON.parse(decodeURIComponent(value ?? '[]'));
    return Array.isArray(list) ? list.filter((f) => typeof f?.message === 'string').slice(-10) : [];
  } catch {
    return [];
  }
}

/** Queue a message for the next page. Only callable from a server action. */
export async function flash(message: string, type: Flash['type'] = 'success'): Promise<void> {
  const store = await cookies();
  const list = [...readFlash(store.get(FLASH_COOKIE)?.value), { message, type }];
  store.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(list)), { path: '/', sameSite: 'lax', maxAge: 60 });
}

export async function takeFlash(): Promise<Flash[]> {
  return readFlash((await cookies()).get(FLASH_COOKIE)?.value);
}

/** Flash an error and go back to the dashboard. */
export async function deny(): Promise<never> {
  await flash('You are not allowed to do that.', 'error');
  redirect('/dashboard');
}

