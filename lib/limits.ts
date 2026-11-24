/**
 * Class-size limit set by the administrator on the Settings page.
 * It caps the number of students in a section and in each class offering.
 */
import { db, sql } from './db';

export const SECTION_LIMIT_KEY = 'max_section_size';
export const SECTION_LIMIT_DEFAULT = 50;
/** The highest value the administrator may set. */
export const SECTION_LIMIT_CEILING = 1000;

export async function sectionLimit(): Promise<number> {
  const v = Number(await db.val<string>(sql`SELECT value FROM settings WHERE name = ${SECTION_LIMIT_KEY}`));
  return Number.isFinite(v) && v >= 1 ? Math.min(Math.round(v), SECTION_LIMIT_CEILING) : SECTION_LIMIT_DEFAULT;
}
