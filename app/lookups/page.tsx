import type { Metadata } from 'next';
import CrudSection from '@/components/CrudSection';
import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';
import { CRUD } from '@/lib/crud';
import { param } from '@/lib/format';

export const metadata: Metadata = { title: 'Fields of Study' };

export default async function LookupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin', 'chair');
  const sp = await searchParams;
  const editFor = (table: string) => (param(sp, 't') === table ? Number(param(sp, 'edit')) || 0 : 0);
  return (
    <Shell user={user} active="/lookups">
      <h1>Fields of Study</h1>
      <p className="muted">This list is shared by faculty degrees and subject requirements, so the system can compare them.</p>
      <div style={{ maxWidth: 640 }}><CrudSection def={CRUD.fields} user={user} editId={editFor('fields')} /></div>
    </Shell>
  );
}
