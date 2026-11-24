import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';
import { num } from '@/lib/format';
import { matchingWeights, type Weights } from '@/lib/matching';
import { savePrintSettings, saveWeights } from '@/actions/admin';
import { printSettings, SIGNERS } from '@/lib/printSettings';

export const metadata: Metadata = { title: 'Settings' };

const LABELS: [keyof Weights, string, string][] = [
  ['degree', 'Degree alignment', 'Highest verified degree in a field the subject accepts'],
  ['skills', 'Skills', 'Proficiency in the skills the subject requires'],
  ['cert', 'Certifications', 'Verified credentials that prove a required skill'],
  ['experience', 'Teaching experience', 'Terms the subject was taught before, and years of teaching'],
];

export default async function SettingsPage() {
  const user = await requireRole('admin');
  const weights = await matchingWeights();
  const print = await printSettings();
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

      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Printed Timetable</h2>
        <p className="muted">Shown on the printed Faculty Teaching Load: the campus lines under the university name,
          and the four signatories at the bottom.</p>
        <form action={savePrintSettings}>
          <div className="form-row">
            <div><label>Campus or unit</label><input type="text" name="print_unit" maxLength={255} defaultValue={print.print_unit} /></div>
            <div><label>Address</label><input type="text" name="print_address" maxLength={255} defaultValue={print.print_address} /></div>
          </div>
          {SIGNERS.map(([key, label]) => (
            <div className="form-row" key={key}>
              <div><label>{label}: name</label>
                <input type="text" name={`sign_${key}_name`} maxLength={255} defaultValue={print[`sign_${key}_name`]} /></div>
              <div><label>{label}: position</label>
                <input type="text" name={`sign_${key}_title`} maxLength={255} defaultValue={print[`sign_${key}_title`]} /></div>
            </div>
          ))}
          <button type="submit">Save print settings</button>
        </form>
      </div>
    </Shell>
  );
}
