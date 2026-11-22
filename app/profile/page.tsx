import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

/** "My Profile" for faculty: the same page the chair sees, for their own id. */
export default async function MyProfile() {
  const user = await requireUser();
  redirect(user.role === 'faculty' ? `/faculty/${user.id}` : '/dashboard');
}
