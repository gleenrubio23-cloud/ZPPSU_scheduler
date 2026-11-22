import { DAYS } from './constants';

/** "13:30:00" or "13:30" -> "1:30 PM" */
export function fmtTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "13:30:00" -> "13:30" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** 3 -> "3", 2.5 -> "2.5" */
export function num(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(Math.round(Number(value) * 100 + 1e-9) / 100);
}

export function dayTime(day: number, start: string, end: string): string {
  return `${DAYS[day]} ${fmtTime(start)}-${fmtTime(end)}`;
}

export function termLabel(term: { semester: string; school_year: string } | null): string {
  return term ? `${term.semester}, SY ${term.school_year}` : 'No active term';
}

// ---------- Reading form fields ----------
export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function int(form: FormData, key: string): number {
  const n = parseInt(str(form, key), 10);
  return Number.isFinite(n) ? n : 0;
}

export function float(form: FormData, key: string): number {
  const n = parseFloat(str(form, key));
  return Number.isFinite(n) ? n : 0;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** First value of a URL search parameter. */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}
