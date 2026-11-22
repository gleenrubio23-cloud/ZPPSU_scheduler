import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { Badge } from '@/components/ui';
import { deptScope, requireRole } from '@/lib/auth';
import { activeTerm } from '@/lib/conflict';
import { db, raw, sql } from '@/lib/db';
import { num, param } from '@/lib/format';

export const metadata: Metadata = { title: 'Faculty Profiles' };

export default async function FacultyListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole('admin', 'chair');
  const search = param(await searchParams, 'q').trim();
  const termId = (await activeTerm())?.id ?? 0;
  const dept = deptScope(user);

  const faculty = await db.rows(sql`
    SELECT u.id, u.full_name, u.is_active, d.code AS dept, p.academic_rank, p.employment_status,
           COALESCE(p.max_units, 21) AS max_units,
           (SELECT fd.title FROM faculty_degrees fd WHERE fd.faculty_id = u.id AND fd.status = 'verified'
            ORDER BY array_position(ARRAY['doctorate', 'master', 'bachelor']::varchar[], fd.level) LIMIT 1) AS top_degree,
           (SELECT COUNT(*) FROM faculty_skills fs WHERE fs.faculty_id = u.id) AS skills,
           (SELECT COUNT(*) FROM faculty_certifications fc WHERE fc.faculty_id = u.id AND fc.status = 'verified') AS certs,
           (SELECT COUNT(*) FROM faculty_degrees fd WHERE fd.faculty_id = u.id AND fd.status = 'pending')
         + (SELECT COUNT(*) FROM faculty_certifications fc WHERE fc.faculty_id = u.id AND fc.status = 'pending') AS pending,
           COALESCE((SELECT SUM(s.units) FROM offerings o JOIN subjects s ON s.id = o.subject_id
                     WHERE o.faculty_id = u.id AND o.term_id = ${termId}), 0) AS units
    FROM users u
    LEFT JOIN faculty_profiles p ON p.user_id = u.id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.role = 'faculty'
      ${dept ? sql`AND u.department_id = ${dept}` : raw('')}
      ${search ? sql`AND (u.full_name ILIKE ${`%${search}%`} OR EXISTS (
          SELECT 1 FROM faculty_skills fs JOIN skills k ON k.id = fs.skill_id
          WHERE fs.faculty_id = u.id AND k.name ILIKE ${`%${search}%`}))` : raw('')}
    ORDER BY u.full_name`);

  return (
    <Shell user={user} active="/faculty">
      <div className="head">
        <h1>Faculty Profiles</h1>
        <form method="get" className="actions">
          <input type="text" name="q" placeholder="Search name or skill" defaultValue={search} style={{ width: 220 }} />
          <button type="submit">Search</button>
        </form>
      </div>
      <div className="card table-wrap">
        {faculty.length === 0 ? (
          <p className="muted">No faculty found.{user.role === 'admin' ? ' Add faculty accounts under Users.' : ''}</p>
        ) : (
          <table>
            <thead><tr><th>Faculty</th><th>Dept</th><th>Highest verified degree</th><th className="num">Skills</th>
              <th className="num">Certs</th><th className="num">Load</th><th>To verify</th><th /></tr></thead>
            <tbody>
              {faculty.map((f) => (
                <tr key={f.id} className={f.is_active ? '' : 'dim'}>
                  <td><strong>{f.full_name}</strong><br />
                    <span className="muted">{f.academic_rank || 'No rank set'} &middot; {f.employment_status === 'part_time' ? 'Part-time' : 'Full-time'}</span></td>
                  <td>{f.dept ?? '-'}</td>
                  <td>{f.top_degree ?? <Badge kind="warn">None verified</Badge>}</td>
                  <td className="num">{f.skills}</td>
                  <td className="num">{f.certs}</td>
                  <td className="num">{num(f.units)} / {num(f.max_units)}</td>
                  <td>{f.pending > 0 && <Badge kind="pending">{f.pending} pending</Badge>}</td>
                  <td><a className="btn small" href={`/faculty/${f.id}`}>Open profile</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
