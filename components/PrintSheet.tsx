/**
 * The printed timetable, laid out like the university's Faculty Teaching Load form:
 * letterhead, faculty details, a Monday-to-Sunday grid in 30-minute rows with a noon break, and signatories.
 * Hidden on screen; it replaces the page when printed.
 */
import { DAY_START, SCHOOL_NAME } from '@/lib/constants';
import { minutes } from '@/lib/format';
import { SIGNERS, type PrintSettings } from '@/lib/printSettings';

export type PrintMeeting = {
  day: number; start_time: string; end_time: string; code: string; title: string;
  section_name: string; room_name: string; faculty_name: string | null;
};

type Row = { from: number; to: number; noon?: boolean };

const PRINT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NOON = 12 * 60;
/** The grid always runs to at least 8:00 PM, like the paper form. */
const MIN_END = 20 * 60;

/** 780 -> "1:00" (12-hour, no AM/PM, as on the form) */
function clock(total: number): string {
  const h = Math.floor(total / 60) % 12 || 12;
  return `${h}:${String(total % 60).padStart(2, '0')}`;
}

function buildRows(meetings: PrintMeeting[]): Row[] {
  const first = Math.floor(Math.min(minutes(DAY_START), ...meetings.map((m) => minutes(m.start_time))) / 30) * 30;
  const end = Math.min(24 * 60, Math.ceil(Math.max(MIN_END, ...meetings.map((m) => minutes(m.end_time))) / 30) * 30);
  // The noon hour collapses into one "NOON BREAK" row unless a class meets during it.
  const noonFree = !meetings.some((m) => minutes(m.start_time) < NOON + 60 && minutes(m.end_time) > NOON);
  const rows: Row[] = [];
  for (let t = first; t < end; t += 30) {
    if (noonFree && t === NOON) {
      rows.push({ from: NOON, to: NOON + 60, noon: true });
      t += 30;
      continue;
    }
    rows.push({ from: t, to: Math.min(t + 30, end) });
  }
  return rows;
}

export default function PrintSheet({
  title, view, details, meetings, settings,
}: {
  title: string;
  view: 'faculty' | 'room' | 'section';
  /** [left, right] pairs of [label, value, underline?] shown under the title; the first left value is bold. */
  details: [[string, string, boolean?], [string, string, boolean?]][];
  meetings: PrintMeeting[];
  settings: PrintSettings;
}) {
  const rows = buildRows(meetings);

  // cell[day][row] = meeting starting in that row; covered[day] = rows hidden under a taller block.
  const cell: Record<number, Record<number, PrintMeeting & { span: number }>> = {};
  const covered: Record<number, Set<number>> = {};
  for (const m of meetings) {
    const s = minutes(m.start_time), e = minutes(m.end_time);
    const at = rows.findIndex((r) => s >= r.from && s < r.to);
    if (at < 0) continue;
    let span = 0;
    while (at + span < rows.length && rows[at + span].from < e) span++;
    cell[m.day] ??= {};
    covered[m.day] ??= new Set();
    if (cell[m.day][at] || covered[m.day].has(at)) continue; // overlapping class: the conflict report lists it
    cell[m.day][at] = { ...m, span: Math.max(1, span) };
    for (let i = 1; i < span; i++) covered[m.day].add(at + i);
  }

  return (
    <div className="print-sheet">
      <header className="ftl-letterhead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="" />
        <div>
          <div className="serif">Republic of the Philippines</div>
          <div className="serif"><b>{SCHOOL_NAME}</b></div>
          {settings.print_unit && <div><b>{settings.print_unit}</b></div>}
          {settings.print_address && <div>{settings.print_address}</div>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/unit-logo.jpg" alt="" />
      </header>

      <h2 className="ftl-title">{title}</h2>

      <table className="ftl-details">
        <tbody>
          {details.map(([[l1, v1, u1], [l2, v2, u2]], i) => (
            <tr key={i}>
              <td>{l1}{l1 && ': '}{u1 ? <u>{v1}</u> : i === 0 ? <b>{v1}</b> : v1}</td>
              <td>{l2}{l2 && ': '}{u2 ? <u>{v2}</u> : v2}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ftl-courses">Courses:</p>

      <table className="ftl-grid">
        <colgroup><col className="t" />{PRINT_DAYS.map((d) => <col key={d} />)}</colgroup>
        <thead><tr><th>TIME</th>{PRINT_DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.from} className={r.noon ? 'noon' : undefined}>
              <td className="t">{clock(r.from)}-{clock(r.to)}</td>
              {r.noon ? <td colSpan={7} className="noon">NOON BREAK</td>
                : PRINT_DAYS.map((_, d) => {
                  const day = d + 1;
                  if (covered[day]?.has(i)) return null;
                  const m = cell[day]?.[i];
                  if (!m) return <td key={day} />;
                  return (
                    <td key={day} rowSpan={m.span} className="cls">
                      <b>{m.code}</b>
                      <span>({m.title})</span>
                      {view !== 'section' && <b>{m.section_name.toUpperCase()}</b>}
                      {view !== 'room' && <b>{m.room_name.toUpperCase()}</b>}
                      {view !== 'faculty' && <span>{m.faculty_name ?? 'TBA'}</span>}
                    </td>
                  );
                })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ftl-signs">
        {SIGNERS.map(([key, label]) => (
          <div key={key}>
            <p>{label}:</p>
            <b>{settings[`sign_${key}_name`] || ' '}</b>
            <span>{settings[`sign_${key}_title`]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
