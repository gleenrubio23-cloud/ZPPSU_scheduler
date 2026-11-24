import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import { requireRole } from '@/lib/auth';
import { num } from '@/lib/format';
import { matchingWeights, type Weights } from '@/lib/matching';
import { savePrintSettings, saveSectionLimit, saveWeights } from '@/actions/admin';
import { db, sql } from '@/lib/db';
import { SECTION_LIMIT_CEILING, sectionLimit } from '@/lib/limits';
import { printSettings, SIGNERS } from '@/lib/printSettings';

export const metadata: Metadata = { title: 'Settings' };

const LABELS: [keyof Weights, string, string][] = [
  ['degree', 'Degree alignment', 'Highest verified degree in a field the subject accepts'],
  ['cert', 'Certifications', 'Verified certifications, licenses, and trainings'],
  ['experience', 'Teaching experience', 'Terms the subject was taught before, and years of teaching'],
];

export default async function SettingsPage() {
  const user = await requireRole('admin');
  const weights = await matchingWeights();
  const print = await printSettings();
  const limit = await sectionLimit();
  const over = await db.val<number>(sql`SELECT COUNT(*) FROM sections WHERE size > ${limit}`) ?? 0;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (
    <Shell user={user} active="/settings">
      <h1>Settings</h1>
      <h2>Faculty Matching</h2>
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
        <h2 id="section-limit">Class Offerings</h2>
        <p className="muted">The most students a section, and each class offered to it, may have. Sections and class
          offerings above this number cannot be saved.</p>
        <form action={saveSectionLimit}>
          <div className="form-row">
            <div><label>Maximum students per section</label>
              <input type="number" name="max_section_size" min={1} max={SECTION_LIMIT_CEILING} step={1} required defaultValue={limit} /></div>
          </div>
          {over > 0 && <div className="alert warning">{over} existing section{over === 1 ? ' is' : 's are'} already above this limit.
            They stay as they are, but must be reduced before they can be edited again.</div>}
          <button type="submit">Save limit</button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <h2 id="signatories">Printed Timetable and Signatories</h2>
        <p className="muted">Shown on the printed Faculty Teaching Load: the campus lines under the university name,
          and the four signatories at the bottom. Only administrators can change these.</p>
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
