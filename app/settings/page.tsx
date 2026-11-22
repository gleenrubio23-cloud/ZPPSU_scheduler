import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';
import { num } from '@/lib/format';
import { matchingWeights, type Weights } from '@/lib/matching';
import { saveWeights } from '@/actions/admin';

export const metadata: Metadata = { title: 'Matching Settings' };

const LABELS: [keyof Weights, string, string][] = [
  ['degree', 'Degree alignment', 'Highest verified degree in a field the subject accepts'],
  ['skills', 'Skills', 'Proficiency in the skills the subject requires'],
  ['cert', 'Certifications', 'Verified credentials that prove a required skill'],
  ['experience', 'Teaching experience', 'Terms the subject was taught before, and years of teaching'],
];

export default async function SettingsPage() {
  const user = await requireRole('admin');
  const weights = await matchingWeights();
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <Shell user={user} active="/settings">
      <h1>Matching Settings</h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="muted">These weights decide how much each part of a faculty profile counts when the system ranks
          faculty for a subject. They do not have to add up to 100; the system uses their proportions.</p>
        <form action={saveWeights}>
          <table>
            <thead><tr><th>Criterion</th><th style={{ width: 110 }}>Weight</th><th className="num">Share</th></tr></thead>
            <tbody>
              {LABELS.map(([key, name, help]) => (
                <tr key={key}>
                  <td><strong>{name}</strong><br /><span className="muted">{help}</span></td>
                  <td><input type="number" name={`w_${key}`} min={0} max={100} step={1} defaultValue={num(weights[key])} /></td>
                  <td className="num">{total > 0 ? Math.round((weights[key] / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 14 }}><button type="submit">Save weights</button></p>
        </form>
      </div>
    </Shell>
  );
}
