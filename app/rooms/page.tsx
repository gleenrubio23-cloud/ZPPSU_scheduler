import type { Metadata } from 'next';
import CrudSection from '@/components/CrudSection';
import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';
import { CRUD } from '@/lib/crud';
import { param } from '@/lib/format';

export const metadata: Metadata = { title: 'Rooms' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin');
  const sp = await searchParams;
  const editId = param(sp, 't') === 'rooms' ? Number(param(sp, 'edit')) || 0 : 0;
  return (
    <Shell user={user} active="/rooms">
      <h1>Rooms</h1>
      <CrudSection def={CRUD.rooms} user={user} editId={editId} />
    </Shell>
  );
}
