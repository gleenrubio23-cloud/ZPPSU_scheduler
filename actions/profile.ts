'use server';
/**
 * Faculty profile changes: degrees, skills, certifications, teaching history, availability.
 * A faculty member may edit their own profile; new credentials stay "pending" until verified.
 * The admin, or the chair of the faculty member's department, may edit any of it and verify credentials.
 */
import { redirect } from 'next/navigation';
import { canManageDept, deny, flash, requireUser } from '@/lib/auth';
import { DAYS, LEVELS } from '@/lib/constants';
import { db, sql } from '@/lib/db';
import { clamp, float, int, str } from '@/lib/format';

export async function updateProfile(form: FormData): Promise<void> {
  const me = await requireUser();
  const id = int(form, 'faculty_id');
  const target = await db.row<{ id: number; department_id: number | null }>(sql`
    SELECT id, department_id FROM users WHERE id = ${id} AND role = 'faculty'`);
  if (!target) return deny();
  const isOwner = me.id === id;
  const canVerify = canManageDept(me, target.department_id);
  if (!isOwner && !canVerify) return deny();
  await db.exec(sql`INSERT INTO faculty_profiles (user_id) VALUES (${id}) ON CONFLICT DO NOTHING`);

  const rowId = int(form, 'row_id');
  const year = str(form, 'year') ? int(form, 'year') : null;
  const newStatus = canVerify ? 'verified' : 'pending';
  const verifier = canVerify ? me.id : null;

  switch (str(form, 'action')) {
    case 'employment': {
      if (!canVerify) return deny();
      await db.exec(sql`UPDATE faculty_profiles SET
          employee_no = ${str(form, 'employee_no') || null},
          employment_status = ${str(form, 'employment_status') === 'part_time' ? 'part_time' : 'full_time'},
          academic_rank = ${str(form, 'academic_rank') || null},
          max_units = ${clamp(float(form, 'max_units'), 0, 40)},
          years_teaching = ${Math.max(0, int(form, 'years_teaching'))},
          industry_years = ${Math.max(0, int(form, 'industry_years'))}
        WHERE user_id = ${id}`);
      await flash('Employment details saved.');
      break;
    }
    case 'add_degree': {
      const level = str(form, 'level');
      const fieldId = int(form, 'field_id');
      if (!(level in LEVELS) || !str(form, 'title') || !str(form, 'institution')
          || !(await db.val(sql`SELECT id FROM fields WHERE id = ${fieldId}`))) {
        await flash('Complete the degree level, title, field, and school.', 'error');
        break;
      }
      await db.exec(sql`INSERT INTO faculty_degrees (faculty_id, level, title, field_id, institution, year_graduated, status, verified_by)
        VALUES (${id}, ${level}, ${str(form, 'title')}, ${fieldId}, ${str(form, 'institution')}, ${year}, ${newStatus}, ${verifier})`);
      await flash(canVerify ? 'Degree added.' : 'Degree added. It will count once your chair verifies it.');
      break;
    }
    case 'add_cert': {
      if (!str(form, 'name')) {
        await flash('Enter the name of the certification.', 'error');
        break;
      }
      const skillId = int(form, 'skill_id') || null;
      if (skillId && !(await db.val(sql`SELECT id FROM skills WHERE id = ${skillId}`))) return deny();
      await db.exec(sql`INSERT INTO faculty_certifications (faculty_id, name, issuer, year_obtained, skill_id, status, verified_by)
        VALUES (${id}, ${str(form, 'name')}, ${str(form, 'issuer') || null}, ${year}, ${skillId}, ${newStatus}, ${verifier})`);
      await flash(canVerify ? 'Certification added.' : 'Certification added. It will count once your chair verifies it.');
      break;
    }
    case 'verify': {
      if (!canVerify) return deny();
      const status = str(form, 'status') === 'verified' ? 'verified' : 'rejected';
      if (str(form, 'type') === 'cert') {
        await db.exec(sql`UPDATE faculty_certifications SET status = ${status}, verified_by = ${me.id} WHERE id = ${rowId} AND faculty_id = ${id}`);
      } else {
        await db.exec(sql`UPDATE faculty_degrees SET status = ${status}, verified_by = ${me.id} WHERE id = ${rowId} AND faculty_id = ${id}`);
      }
      await flash(`Credential marked as ${status}.`);
      break;
    }
    case 'del_degree':
      await db.exec(sql`DELETE FROM faculty_degrees WHERE id = ${rowId} AND faculty_id = ${id}`);
      await flash('Degree removed.');
      break;
    case 'del_cert':
      await db.exec(sql`DELETE FROM faculty_certifications WHERE id = ${rowId} AND faculty_id = ${id}`);
      await flash('Certification removed.');
      break;
    case 'save_skill': {
      const skillId = int(form, 'skill_id');
      if (await db.val(sql`SELECT id FROM skills WHERE id = ${skillId}`)) {
        await db.exec(sql`INSERT INTO faculty_skills (faculty_id, skill_id, proficiency)
          VALUES (${id}, ${skillId}, ${clamp(int(form, 'proficiency'), 1, 5)})
          ON CONFLICT (faculty_id, skill_id) DO UPDATE SET proficiency = EXCLUDED.proficiency`);
        await flash('Skill saved.');
      }
      break;
    }
    case 'del_skill':
      await db.exec(sql`DELETE FROM faculty_skills WHERE faculty_id = ${id} AND skill_id = ${rowId}`);
      await flash('Skill removed.');
      break;
    case 'save_taught': {
      const subjectId = int(form, 'subject_id');
      if (await db.val(sql`SELECT id FROM subjects WHERE id = ${subjectId}`)) {
        await db.exec(sql`INSERT INTO faculty_subjects_taught (faculty_id, subject_id, terms_taught)
          VALUES (${id}, ${subjectId}, ${clamp(int(form, 'terms_taught'), 1, 60)})
          ON CONFLICT (faculty_id, subject_id) DO UPDATE SET terms_taught = EXCLUDED.terms_taught`);
        await flash('Teaching history saved.');
      }
      break;
    }
    case 'del_taught':
      await db.exec(sql`DELETE FROM faculty_subjects_taught WHERE faculty_id = ${id} AND subject_id = ${rowId}`);
      await flash('Teaching history entry removed.');
      break;
    case 'add_avail': {
      const day = int(form, 'day');
      const start = str(form, 'start_time').slice(0, 5);
      const end = str(form, 'end_time').slice(0, 5);
      if (!DAYS[day] || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) {
        await flash('Choose a day and a valid time range.', 'error');
        break;
      }
      await db.exec(sql`INSERT INTO faculty_availability (faculty_id, day, start_time, end_time)
                        VALUES (${id}, ${day}, ${start}, ${end})`);
      await flash('Availability added.');
      break;
    }
    case 'del_avail':
      await db.exec(sql`DELETE FROM faculty_availability WHERE id = ${rowId} AND faculty_id = ${id}`);
      await flash('Availability removed.');
      break;
  }
  redirect(`/faculty/${id}`);
}
