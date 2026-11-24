import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import { ActionButton, Badge, Bar } from '@/components/ui';
import { canManageDept, requireRole } from '@/lib/auth';
import { loadOffering } from '@/lib/conflict';
import { LEVELS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { num } from '@/lib/format';
import { matchingWeights, rankCandidates, round } from '@/lib/matching';
import { assignFaculty } from '@/actions/offerings';

export const metadata: Metadata = { title: 'Match Faculty' };

const PART_LABELS = { degree: 'Degree', cert: 'Certs', experience: 'Experience' } as const;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('admin', 'chair');
  const o = await loadOffering(Number((await params).id));
  if (!o) redirect('/offerings');
  if (!canManageDept(user, o.department_id)) redirect('/denied');

  const [candidates, weights, fields] = await Promise.all([
    rankCandidates(o),
    matchingWeights(),
    db.rows<{ name: string }>(sql`SELECT f.name FROM subject_fields sf JOIN fields f ON f.id = sf.field_id WHERE sf.subject_id = ${o.subject_id} ORDER BY f.name`),
  ]);

  return (
    <Shell user={user} active="/offerings">
      <div className="head">
        <h1>Match Faculty: {o.code}, {o.section_name}</h1>
        <a className="btn ghost" href="/offerings">Back to offerings</a>
      </div>

      <div className="card">
        <h2>{o.title}</h2>
        <div className="form-row">
          <div><label>Minimum degree</label>{LEVELS[o.min_degree_level]}</div>
          <div><label>Accepted degree fields</label>{fields.length ? fields.map((f) => f.name).join(', ') : 'Any field'}</div>
          <div><label>Units</label>{num(o.units)}</div>
        </div>
        <p className="muted">Score weights: degree {num(weights.degree)},
          certifications {num(weights.cert)}, experience {num(weights.experience)}.
          Only verified degrees and certifications are counted.</p>
        {o.faculty_id && (
          <div className="actions" style={{ alignItems: 'center' }}>
            <span>Currently assigned: <strong>{o.faculty_name}</strong> (match {num(o.match_score)}%)</span>
            <ActionButton action={assignFaculty} fields={{ offering_id: o.id, action: 'unassign' }} label="Remove assignment" className="small ghost" />
          </div>
        )}
      </div>

      <div className="card table-wrap">
        <h2>Ranked faculty</h2>
        <table>
          <thead><tr><th>#</th><th>Faculty</th><th className="num">Match</th><th>Score breakdown</th><th>Why</th><th className="num">Load</th><th /></tr></thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr key={c.faculty.id} className={c.eligible ? '' : 'dim'}>
                <td>{i + 1}</td>
                <td><a href={`/faculty/${c.faculty.id}`}><strong>{c.faculty.full_name}</strong></a><br />
                  <span className="muted">{c.faculty.dept_code ?? ''} &middot; {c.faculty.academic_rank || 'No rank'}</span>
                  {i === 0 && c.eligible && (<><br /><Badge kind="ok">Recommended</Badge></>)}</td>
                <td className="num"><span className="score">{round(c.total, 1).toFixed(1)}%</span></td>
                <td style={{ minWidth: 170 }}>
                  {(Object.keys(PART_LABELS) as (keyof typeof PART_LABELS)[]).map((key) => {
                    const score = c.parts[key];
                    return (
                      <div key={key}>
                        <div className="muted">{PART_LABELS[key]}: {num(score)}</div>
                        <Bar percent={score} />
                      </div>
                    );
                  })}
                </td>
                <td>
                  {c.notes.map((n, j) => <div key={j}>{n}</div>)}
                  {c.reasons.map((r, j) => <div key={`r${j}`}><Badge kind="bad">Not eligible</Badge> {r}</div>)}
                </td>
                <td className="num">{num(c.load)} / {num(c.max)}</td>
                <td>{o.faculty_id === c.faculty.id ? <Badge kind="info">Assigned</Badge>
                  : c.eligible && <ActionButton action={assignFaculty} fields={{ offering_id: o.id, faculty_id: c.faculty.id }} label="Assign" className="small ok" />}</td>
              </tr>
            ))}
            {candidates.length === 0 && <tr><td colSpan={7} className="muted">There are no active faculty accounts.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
