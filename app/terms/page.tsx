import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { ActionButton, Badge, Opts } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { SEMESTERS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { saveTerm } from '@/actions/admin';

export const metadata: Metadata = { title: 'Terms' };

export default async function TermsPage() {
  const user = await requireRole('admin');
  const terms = await db.rows(sql`
    SELECT t.*, (SELECT COUNT(*) FROM offerings o WHERE o.term_id = t.id) AS offerings
    FROM terms t ORDER BY school_year DESC, semester DESC`);
  return (
    <Shell user={user} active="/terms">
      <h1>Academic Terms</h1>
      <div className="card">
        <h2>Add a term</h2>
        <form action={saveTerm}>
          <input type="hidden" name="action" value="add" />
          <div className="form-row">
            <div><label>School year</label><input type="text" name="school_year" placeholder="2026-2027" required pattern="\d{4}-\d{4}" /></div>
            <div><label>Semester</label><select name="semester"><Opts items={SEMESTERS.map((s) => [s, s] as [string, string])} /></select></div>
          </div>
          <button type="submit">Add term</button>
        </form>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>School year</th><th>Semester</th><th className="num">Offerings</th><th>Status</th><th /></tr></thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id}>
                <td>{t.school_year}</td><td>{t.semester}</td><td className="num">{t.offerings}</td>
                <td>{t.is_active && <Badge kind="ok">Active</Badge>}</td>
                <td>{!t.is_active && (
                  <div className="actions">
                    <ActionButton action={saveTerm} fields={{ action: 'activate', id: t.id }} label="Set as active" />
                    <ActionButton action={saveTerm} fields={{ action: 'delete', id: t.id }} label="Delete" className="small danger" confirm="Delete this term?" />
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
