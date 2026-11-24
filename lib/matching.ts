/**
 * Qualification-based faculty matching.
 *
 * For one class offering, every active faculty member is scored against the
 * subject's requirements. The score has three parts, each from 0 to 100:
 *
 *   Degree      - best VERIFIED degree in a field accepted by the subject
 *                 (bachelor's 70, master's 85, doctorate 100, none 0)
 *   Credentials - VERIFIED certifications, licenses and trainings
 *                 (none = 0, one = 70, two or more = 100)
 *   Experience  - terms the subject was taught before (70%) and years of teaching (30%)
 *
 * The parts are combined using the weights in Matching Settings.
 *
 * Hard rules make a faculty member ineligible regardless of score:
 *   1. no verified degree at the subject's minimum level
 *   2. the subject would push them over their maximum teaching load
 *   3. they already teach another class at the time this class meets
 */
import { db, sql, type Db } from './db';
import { DAYS, LEVELS } from './constants';
import { fmtTime, num } from './format';

export function levelRank(level: string | null | undefined): number {
  return ({ bachelor: 1, master: 2, doctorate: 3 } as Record<string, number>)[level ?? ''] ?? 0;
}

/** Round half up like PHP's round(); the tiny nudge fixes binary cases such as 4.05. */
export const round = (n: number, places: number) => Math.round(n * 10 ** places + 1e-9) / 10 ** places;

/** Units already assigned to a faculty member in a term. */
export async function facultyLoad(facultyId: number, termId: number, excludeOffering = 0): Promise<number> {
  return (await db.val<number>(sql`
    SELECT COALESCE(SUM(s.units), 0) FROM offerings o JOIN subjects s ON s.id = o.subject_id
    WHERE o.faculty_id = ${facultyId} AND o.term_id = ${termId} AND o.id <> ${excludeOffering}`)) ?? 0;
}

export type Weights = { degree: number; cert: number; experience: number };

export async function matchingWeights(): Promise<Weights> {
  const s = new Map((await db.rows<{ name: string; value: string }>(sql`SELECT name, value FROM settings`))
    .map((r) => [r.name, Number(r.value)]));
  return {
    degree: s.get('w_degree') ?? 40,
    cert: s.get('w_cert') ?? 15,
    experience: s.get('w_experience') ?? 15,
  };
}

export type FacultyRow = {
  id: number; full_name: string; department_id: number | null; dept_code: string | null;
  max_units: number; years_teaching: number; employment_status: string; academic_rank: string | null;
};

export type Candidate = {
  faculty: FacultyRow;
  eligible: boolean;
  reasons: string[];   // why the person is ineligible
  notes: string[];     // plain-language explanation of the score
  parts: { degree: number; cert: number; experience: number };
  total: number;
  load: number;
  max: number;
};

type OfferingRef = { id: number; term_id: number; subject_id: number };

/** All active faculty ranked for an offering: eligible first, then by score. */
export async function rankCandidates(offering: OfferingRef, q: Db = db): Promise<Candidate[]> {
  const subject = await q.row(sql`SELECT * FROM subjects WHERE id = ${offering.subject_id}`);
  if (!subject) return [];
  const reqFields = (await q.rows<{ field_id: number }>(sql`SELECT field_id FROM subject_fields WHERE subject_id = ${subject.id}`))
    .map((r) => r.field_id);
  const weights = await matchingWeights();

  const faculty = await q.rows<FacultyRow>(sql`
    SELECT u.id, u.full_name, u.department_id, d.code AS dept_code,
           COALESCE(p.max_units, 21) AS max_units, COALESCE(p.years_teaching, 0) AS years_teaching,
           COALESCE(p.employment_status, 'full_time') AS employment_status, p.academic_rank
    FROM users u
    LEFT JOIN faculty_profiles p ON p.user_id = u.id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.role = 'faculty' AND u.is_active
    ORDER BY u.id`);

  // Load everything needed for all faculty at once (a few queries instead of several per person).
  const degrees = await q.rows<{ faculty_id: number; level: string; title: string; field_id: number }>(sql`
    SELECT faculty_id, level, title, field_id FROM faculty_degrees WHERE status = 'verified'`);
  const certs = new Map((await q.rows<{ faculty_id: number; n: number }>(sql`
    SELECT faculty_id, COUNT(*) AS n FROM faculty_certifications
    WHERE status = 'verified' GROUP BY faculty_id`)).map((r) => [r.faculty_id, r.n]));
  const declared = new Map((await q.rows<{ faculty_id: number; terms_taught: number }>(sql`
    SELECT faculty_id, terms_taught FROM faculty_subjects_taught WHERE subject_id = ${subject.id}`))
    .map((r) => [r.faculty_id, r.terms_taught]));
  const recorded = new Map((await q.rows<{ faculty_id: number; n: number }>(sql`
    SELECT faculty_id, COUNT(DISTINCT term_id) AS n FROM offerings
    WHERE subject_id = ${subject.id} AND term_id <> ${offering.term_id} AND faculty_id IS NOT NULL
    GROUP BY faculty_id`)).map((r) => [r.faculty_id, r.n]));
  const loads = new Map((await q.rows<{ faculty_id: number; units: number }>(sql`
    SELECT o.faculty_id, SUM(s.units) AS units FROM offerings o JOIN subjects s ON s.id = o.subject_id
    WHERE o.term_id = ${offering.term_id} AND o.id <> ${offering.id} AND o.faculty_id IS NOT NULL
    GROUP BY o.faculty_id`)).map((r) => [r.faculty_id, r.units]));
  const clashes = new Map((await q.rows<{ faculty_id: number; code: string; day: number; start_time: string; end_time: string }>(sql`
    SELECT DISTINCT ON (o2.faculty_id) o2.faculty_id, sub.code, s2.day, s2.start_time, s2.end_time
    FROM schedules s1
    JOIN schedules s2 ON s2.day = s1.day AND s2.start_time < s1.end_time AND s2.end_time > s1.start_time
    JOIN offerings o2 ON o2.id = s2.offering_id
    JOIN subjects sub ON sub.id = o2.subject_id
    WHERE s1.offering_id = ${offering.id} AND o2.id <> ${offering.id}
      AND o2.term_id = ${offering.term_id} AND o2.faculty_id IS NOT NULL
    ORDER BY o2.faculty_id, s2.day, s2.start_time`)).map((r) => [r.faculty_id, r]));

  const units = Number(subject.units);
  const results: Candidate[] = faculty.map((f) => {
    const reasons: string[] = [];
    const notes: string[] = [];

    // ----- Degree -----
    let highest = 0;
    let bestAligned = 0;
    let bestTitle = '';
    for (const d of degrees.filter((x) => x.faculty_id === f.id)) {
      const rank = levelRank(d.level);
      highest = Math.max(highest, rank);
      const aligned = reqFields.length === 0 || reqFields.includes(d.field_id);
      if (aligned && rank > bestAligned) {
        bestAligned = rank;
        bestTitle = d.title;
      }
    }
    const degreeScore = [0, 70, 85, 100][bestAligned];
    notes.push(bestAligned ? `Aligned degree: ${bestTitle}` : 'No verified degree in an accepted field');
    if (highest < levelRank(subject.min_degree_level)) {
      reasons.push(`No verified ${LEVELS[subject.min_degree_level].toLowerCase()} degree or higher`);
    }

    // ----- Credentials -----
    const n = certs.get(f.id) ?? 0;
    const certScore = n >= 2 ? 100 : n === 1 ? 70 : 0;
    if (n) notes.push(`${n} verified certification(s)`);

    // ----- Experience -----
    const taught = Math.max(declared.get(f.id) ?? 0, recorded.get(f.id) ?? 0);
    const expScore = round((Math.min(taught, 4) / 4) * 70 + (Math.min(f.years_teaching, 10) / 10) * 30, 1);
    notes.push(taught ? `Taught this subject for ${taught} term(s)` : 'Has not taught this subject yet');

    // ----- Weighted total -----
    const parts = { degree: degreeScore, cert: certScore, experience: expScore };
    let total = 0;
    let weightSum = 0;
    for (const key of Object.keys(parts) as (keyof typeof parts)[]) {
      total += parts[key] * weights[key];
      weightSum += weights[key];
    }
    total = weightSum > 0 ? round(total / weightSum, 2) : 0;

    // ----- Hard rule: teaching load -----
    const load = loads.get(f.id) ?? 0;
    const max = Number(f.max_units);
    if (load + units > max) {
      reasons.push(`Would exceed maximum load (${num(load + units)} of ${num(max)} units)`);
    }

    // ----- Hard rule: no clash with the meetings already set for this class -----
    const clash = clashes.get(f.id);
    if (clash) {
      reasons.push(`Time conflict with ${clash.code} (${DAYS[clash.day]} ${fmtTime(clash.start_time)}-${fmtTime(clash.end_time)})`);
    }

    return { faculty: f, eligible: reasons.length === 0, reasons, notes, parts, total, load, max };
  });

  return results.sort((a, b) => (a.eligible !== b.eligible ? (a.eligible ? -1 : 1) : b.total - a.total));
}
