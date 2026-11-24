/**
 * Text printed on the Faculty Teaching Load form: the campus lines in the header and the four signatories.
 * Stored in the settings table (names starting with print_ or sign_) and edited on the Settings page.
 */
import { db, sql } from './db';

export const SIGNERS = [
  ['prepared', 'Prepared by'],
  ['concurred', 'Concurred by'],
  ['recommending', 'Recommending Approval'],
  ['approved', 'Approved by'],
] as const;

export const PRINT_DEFAULTS: Record<string, string> = {
  print_unit: 'BAYOG EXTENSION PROGRAM DELIVERING UNIT',
  print_address: 'Bayog, Zamboanga del Sur',
  sign_prepared_name: 'PROF. ARLENE H. SORIANO',
  sign_prepared_title: 'Administrator, ZPPSU-Bayog EPDU',
  sign_concurred_name: 'KIER P. DELA CALZADA, Ed.D',
  sign_concurred_title: 'Dean, Extension Program Delivering Units',
  sign_recommending_name: 'MA. CHRISTINA G. WEE, Ed.D.',
  sign_recommending_title: 'Vice President for Academic Affairs',
  sign_approved_name: 'NELSON P. CABRAL, Ed.D',
  sign_approved_title: 'President',
};

export const PRINT_KEYS = Object.keys(PRINT_DEFAULTS);

export type PrintSettings = Record<string, string>;

export async function printSettings(): Promise<PrintSettings> {
  const stored = new Map((await db.rows<{ name: string; value: string }>(sql`
    SELECT name, value FROM settings WHERE name LIKE 'print\_%' OR name LIKE 'sign\_%'`)).map((r) => [r.name, r.value]));
  return Object.fromEntries(PRINT_KEYS.map((k) => [k, stored.get(k) ?? PRINT_DEFAULTS[k]]));
}
