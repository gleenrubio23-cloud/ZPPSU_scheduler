import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { ActionButton, Badge, Opts } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { ROLES, type Role } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { param } from '@/lib/format';
import { saveUser, toggleUser } from '@/actions/admin';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireRole('admin');
  const editId = Number(param(await searchParams, 'edit')) || 0;
  const edit = editId ? await db.row(sql`SELECT * FROM users WHERE id = ${editId}`) : null;
  const departments = await db.pairs(sql`SELECT id, code || ' - ' || name FROM departments ORDER BY code`);
  const users = await db.rows(sql`
    SELECT u.*, d.code AS dept FROM users u LEFT JOIN departments d ON d.id = u.department_id
    ORDER BY CASE u.role WHEN 'admin' THEN 1 WHEN 'chair' THEN 2 ELSE 3 END, u.full_name`);

  return (
    <Shell user={me} active="/users">
      <h1>Users</h1>
      <div className="card">
        <h2>{edit ? 'Edit user' : 'Add a user'}</h2>
        <form action={saveUser} key={edit ? `e${edit.id}` : 'add'}>
          <input type="hidden" name="id" value={edit?.id ?? 0} />
          <div className="form-row">
            <div><label>Username</label><input type="text" name="username" required defaultValue={edit?.username ?? ''} /></div>
            <div><label>Full name</label><input type="text" name="full_name" required defaultValue={edit?.full_name ?? ''} /></div>
            <div><label>Email</label><input type="email" name="email" defaultValue={edit?.email ?? ''} /></div>
          </div>
          <div className="form-row">
            <div><label>Role</label><select name="role" required defaultValue={edit?.role ?? 'faculty'}><Opts items={ROLES} /></select></div>
            <div><label>Department</label><select name="department_id" defaultValue={String(edit?.department_id ?? '')}><Opts items={departments} placeholder="None" /></select></div>
            <div>
              <label>{edit ? 'New password (leave blank to keep)' : 'Password (at least 8 characters)'}</label>
              <input type="password" name="password" required={!edit} minLength={edit ? undefined : 8} autoComplete="new-password" />
            </div>
          </div>
          <button type="submit">Save user</button>{' '}
          {edit && <a className="btn ghost" href="/users">Cancel</a>}
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Department</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((r) => (
              <tr key={r.id} className={r.is_active ? '' : 'dim'}>
                <td>{r.full_name}</td><td>{r.username}</td><td>{ROLES[r.role as Role]}</td><td>{r.dept ?? '-'}</td>
                <td><Badge kind={r.is_active ? 'ok' : 'bad'}>{r.is_active ? 'Active' : 'Disabled'}</Badge></td>
                <td><div className="actions">
                  <a className="btn small ghost" href={`/users?edit=${r.id}`}>Edit</a>
                  {r.role === 'faculty' && <a className="btn small ghost" href={`/faculty/${r.id}`}>Profile</a>}
                  {r.id !== me.id && (
                    <ActionButton action={toggleUser} fields={{ id: r.id }} label={r.is_active ? 'Disable' : 'Enable'} className="small ghost" />
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
