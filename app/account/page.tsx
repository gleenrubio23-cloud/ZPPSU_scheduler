import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { changePassword } from '@/actions/auth';

export const metadata: Metadata = { title: 'My Account' };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Shell user={user} active="/account">
      <h1>My Account</h1>
      <div className="card" style={{ maxWidth: 460 }}>
        <p><strong>{user.full_name}</strong><br />
          <span className="muted">Username: {user.username} &middot; Role: {ROLES[user.role]}</span></p>
        <h2>Change password</h2>
        <form action={changePassword}>
          <div style={{ marginBottom: 12 }}><label>Current password</label><input type="password" name="current_password" required /></div>
          <div style={{ marginBottom: 12 }}><label>New password (at least 8 characters)</label><input type="password" name="new_password" required minLength={8} /></div>
          <div style={{ marginBottom: 16 }}><label>Repeat new password</label><input type="password" name="confirm_password" required /></div>
          <button type="submit">Change password</button>
        </form>
      </div>
    </Shell>
  );
}
