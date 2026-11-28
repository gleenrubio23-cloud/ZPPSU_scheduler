import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import PrintButton from '@/components/PrintButton';
import FormLetterhead from '@/components/FormLetterhead';
import { canManageDept, requireUser } from '@/lib/auth';
import { loadOffering } from '@/lib/conflict';
import { DAYS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { formTime } from '@/lib/format';
import { printSettings } from '@/lib/printSettings';
import { classList, semesterWords } from '@/lib/students';
import { saveClassList } from '@/actions/students';

export const metadata: Metadata = { title: 'Class List' };

/** Rows in each of the two columns of the printed list, as on the paper form. */
const MIN_ROWS = 25;

export default async function ClassListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const o = await loadOffering(Number((await params).id) || 0);
  if (!o) redirect('/dashboard');
  const isStaff = canManageDept(user, o.department_id);
  if (!isStaff && !(o.faculty_id !== null && o.faculty_id === user.id)) redirect('/denied');

  const [names, meetings, settings, rank] = await Promise.all([
    classList(o.id),
    db.rows(sql`SELECT day, start_time, end_time FROM schedules WHERE offering_id = ${o.id} ORDER BY day, start_time`),
    printSettings(),
    o.faculty_id ? db.val<string>(sql`SELECT academic_rank FROM faculty_profiles WHERE user_id = ${o.faculty_id}`) : null,
  ]);

  // "MON/WED 4:00 PM – 8:10 PM", one line per distinct time.
  const byTime = new Map<string, string[]>();
  for (const m of meetings) {
    const t = `${formTime(m.start_time)} – ${formTime(m.end_time)}`;
    byTime.set(t, [...(byTime.get(t) ?? []), DAYS[m.day].slice(0, 3).toUpperCase()]);
  }
  const times = [...byTime].map(([t, days]) => `${days.join('/')} ${t}`);

  // Two side-by-side columns; "NOTHING FOLLOWS" goes in the row after the last name when there is room.
  const entries = names.length ? [...names, '***NOTHING FOLLOWS***'] : [];
  const perColumn = Math.max(MIN_ROWS, Math.ceil(entries.length / 2));
  const columns = [0, 1].map((c) => Array.from({ length: perColumn }, (_, r) => {
    const i = c * perColumn + r;
    return { no: i + 1, name: entries[i] ?? '', isEnd: i === names.length };
  }));

  return (
    <Shell user={user} active={isStaff ? '/offerings' : '/timetable'}>
      <div className="head no-print">
        <div>
          <h1>Class List: {o.code} {o.section_name}</h1>
          <span className="muted">{o.title} &middot; {o.faculty_name ?? 'No faculty yet'} &middot; {o.semester}, SY {o.school_year}</span>
        </div>
        <div className="actions">
          <a className="btn ghost" href={isStaff ? '/offerings' : '/timetable'}>Back</a>
          <PrintButton />
        </div>
      </div>

      {!isStaff ? (
        <div className="card no-print">
          <h2>Students ({names.length})</h2>
          <p className="muted">Only the program chair or the administrator can change this class list.
            {names.length === 0 && ' No students have been entered yet.'}</p>
        </div>
      ) : (
      <div className="card no-print">
        <h2>Students ({names.length})</h2>
        <p className="muted">Type or paste one student per line as <b>SURNAME, First Name MI</b>. Numbers at the start
          of a line are removed, so a list copied from a spreadsheet or an old class list can be pasted as it is.
          Saving replaces the whole list.</p>
        <form action={saveClassList}>
          <input type="hidden" name="offering_id" value={o.id} />
          <textarea name="names" rows={14} defaultValue={names.join('\n')} placeholder={'DELA CRUZ, Juan A.\nSANTOS, Maria B.'} />
          <p><label style={{ display: 'inline' }}><input type="checkbox" name="sort" value="1" defaultChecked /> Sort alphabetically</label></p>
          <button type="submit">Save class list</button>
        </form>
      </div>
      )}

      <div className="paper-wrap">
        <div className="form-sheet cl-sheet">
          <FormLetterhead settings={settings} variant="classlist" />
          <h2 className="cl-title">LIST OF STUDENTS</h2>
          <p className="cl-term">{semesterWords(o.semester)}, A.Y.: {o.school_year}</p>

          <table className="cl-info">
            <tbody>
              <tr>
                <td>CODE/Course No: <u>{o.code}</u></td>
                <td>Time/Day: {times.length ? times.map((t, i) => <u key={i} className="line">{t}{i < times.length - 1 ? ' &' : ''}</u>) : <u>TBA</u>}</td>
              </tr>
              <tr>
                <td>Subject/Description: <u>{o.title.toUpperCase()}</u></td>
                <td>Course/Year/Section: <u>{o.section_name}</u></td>
              </tr>
            </tbody>
          </table>

          <div className="cl-columns">
            {columns.map((col, c) => (
              <table key={c} className="cl-names">
                <thead><tr><th className="no">No.</th><th>Name of Students<small>(Surname, First Name, MI)</small></th></tr></thead>
                <tbody>
                  {col.map((r) => (
                    <tr key={r.no}>
                      <td className="no">{r.no}</td>
                      <td className={r.isEnd ? 'end' : undefined}>{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>

          <div className="cl-signs">
            <div>
              <p>Prepared by:</p>
              <b>{(o.faculty_name ?? '').toUpperCase() || ' '}</b>
              <span>{rank ?? ''}</span>
            </div>
            <div>
              <p>Reviewed by:</p>
              <b>{settings.sign_prepared_name || ' '}</b>
              <span>{settings.sign_prepared_title}</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
