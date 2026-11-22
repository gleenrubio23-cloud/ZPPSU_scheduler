import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { requireUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Access denied' };

export default async function DeniedPage() {
  const user = await requireUser();
  return (
    <Shell user={user} active="">
      <div className="card">
        <h2>Access denied</h2>
        <p>Your role ({ROLES[user.role]}) is not allowed to open that page.</p>
        <p><a className="btn" href="/dashboard">Back to the dashboard</a></p>
      </div>
    </Shell>
  );
}
