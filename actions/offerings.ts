'use server';
/** Class offerings: adding them, assigning faculty by qualification, and scheduling their meetings. */
import { redirect } from 'next/navigation';
import { canManageDept, deny, deptScope, flash, requireRole, type User } from '@/lib/auth';
import {
  activeTerm, availabilityChecker, capacityError, findConflicts, loadOffering, scheduleWarnings, validateTime,
  type Offering, type Room,
} from '@/lib/conflict';
import { db, raw, sql, transaction } from '@/lib/db';
import { clamp, dayTime, int, str } from '@/lib/format';
import { levelRank, rankCandidates } from '@/lib/matching';

/** Load the offering named in the form and check the user may manage it. */
async function ownOffering(user: User, form: FormData): Promise<Offering> {
  const o = await loadOffering(int(form, 'offering_id'));
  if (!o || !canManageDept(user, o.department_id)) return deny();
  return o;
}

// ---------- Offerings list ----------
export async function addOffering(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const term = await activeTerm();
  if (!term) return deny();
  const subject = await db.row(sql`SELECT * FROM subjects WHERE id = ${int(form, 'subject_id')}`);
  const section = await db.row(sql`SELECT * FROM sections WHERE id = ${int(form, 'section_id')}`);
  if (!subject || !section) {
    await flash('Choose a subject and a section.', 'error');
  } else if (!canManageDept(user, subject.department_id)) {
    return deny();
  } else if (await db.val(sql`SELECT id FROM offerings WHERE term_id = ${term.id} AND subject_id = ${subject.id} AND section_id = ${section.id}`)) {
    await flash(`${subject.code} is already offered to ${section.name} this term.`, 'error');
  } else {
    // Enrolled students default to the section size when the box is left empty.
    const enrolled = str(form, 'enrolled') ? clamp(int(form, 'enrolled'), 1, 1000) : section.size;
    await db.exec(sql`INSERT INTO offerings (term_id, subject_id, section_id, enrolled)
                      VALUES (${term.id}, ${subject.id}, ${section.id}, ${enrolled})`);
    await flash('Class offering added. Next, match a faculty member and set the schedule.');
  }
  redirect('/offerings');
}

export async function deleteOffering(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const o = await ownOffering(user, form);
  await db.exec(sql`DELETE FROM offerings WHERE id = ${o.id}`);
  await flash('Class offering and its schedule removed.');
  redirect('/offerings');
}

/**
 * Give every unassigned class its best eligible faculty member, one class at a time,
 * so the load and time checks see the assignments made earlier in the same run.
 */
export async function autoAssign(): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const term = await activeTerm();
  if (!term) return deny();
  const dept = deptScope(user);
  const open = await db.rows<{ id: number; term_id: number; subject_id: number; min_degree_level: string; code: string }>(sql`
    SELECT o.id, o.term_id, o.subject_id, sub.min_degree_level, sub.code FROM offerings o JOIN subjects sub ON sub.id = o.subject_id
    WHERE o.term_id = ${term.id} AND o.faculty_id IS NULL ${dept ? sql`AND sub.department_id = ${dept}` : raw('')}`);
  // Classes needing the highest degree first: they have the fewest qualified faculty.
  open.sort((a, b) => levelRank(b.min_degree_level) - levelRank(a.min_degree_level) || a.code.localeCompare(b.code));
  let done = 0;
  for (const o of open) {
    const [best] = await rankCandidates(o);
    if (best?.eligible) {
      await db.exec(sql`UPDATE offerings SET faculty_id = ${best.faculty.id}, match_score = ${best.total},
                        assigned_by = ${user.id}, assigned_at = NOW() WHERE id = ${o.id}`);
      done++;
    }
  }
  const left = open.length - done;
  await flash(`Assigned ${done} class(es) to the best-qualified faculty.${left ? ` ${left} had no eligible faculty.` : ''}`,
    left ? 'warning' : 'success');
  redirect('/offerings');
}

// ---------- Faculty assignment ----------
export async function assignFaculty(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const o = await ownOffering(user, form);
  const back = `/offerings/${o.id}/match`;
  if (str(form, 'action') === 'unassign') {
    await db.exec(sql`UPDATE offerings SET faculty_id = NULL, match_score = NULL, assigned_by = NULL, assigned_at = NULL WHERE id = ${o.id}`);
    await flash('Faculty removed from this class.');
    redirect(back);
  }
  // Re-run the matching on the server so an ineligible person can never be assigned by a forged form.
  const facultyId = int(form, 'faculty_id');
  const c = (await rankCandidates(o)).find((x) => x.faculty.id === facultyId);
  if (!c) {
    await flash('Faculty member not found.', 'error');
    redirect(back);
  }
  if (!c.eligible) {
    await flash(`${c.faculty.full_name} cannot be assigned: ${c.reasons.join('; ')}.`, 'error');
    redirect(back);
  }
  await db.exec(sql`UPDATE offerings SET faculty_id = ${facultyId}, match_score = ${c.total},
                    assigned_by = ${user.id}, assigned_at = NOW() WHERE id = ${o.id}`);
  await flash(`${c.faculty.full_name} assigned to ${o.code} (${o.section_name}).`);
  redirect('/offerings');
}

// ---------- Scheduling ----------
export async function setEnrolled(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const o = await ownOffering(user, form);
  const count = int(form, 'enrolled');
  // Changing the head count must not leave the class in a room that is now too small.
  const tooSmall = await db.row(sql`SELECT r.name, r.capacity FROM schedules s JOIN rooms r ON r.id = s.room_id
                                    WHERE s.offering_id = ${o.id} AND r.capacity < ${count} ORDER BY r.capacity LIMIT 1`);
  if (count < 1 || count > 1000) {
    await flash('Enter the number of enrolled students (1 to 1000).', 'error');
  } else if (tooSmall) {
    await flash(`Not saved: ${tooSmall.name} seats only ${tooSmall.capacity}. Move the class to a bigger room first, then set ${count} students.`, 'error');
  } else {
    await db.exec(sql`UPDATE offerings SET enrolled = ${count} WHERE id = ${o.id}`);
    await flash('Enrolled students updated.');
  }
  redirect(`/offerings/${o.id}/schedule`);
}

export async function addMeeting(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const o = await ownOffering(user, form);
  const back = `/offerings/${o.id}/schedule`;
  const day = int(form, 'day');
  const start = str(form, 'start_time').slice(0, 5);
  const end = str(form, 'end_time').slice(0, 5);
  const room = await db.row<Room>(sql`SELECT * FROM rooms WHERE id = ${int(form, 'room_id')}`);

  let errors = validateTime(day, start, end);
  if (!room) errors.push('Choose a room.');
  else {
    const cap = capacityError(room, o.enrolled);
    if (cap) errors.push(cap);
  }
  if (!errors.length && room) {
    // Locking the term row makes two people saving at the same moment check and insert one after the other.
    errors = await transaction(async (tx) => {
      await tx.exec(sql`SELECT id FROM terms WHERE id = ${o.term_id} FOR UPDATE`);
      const found = await findConflicts(o.term_id, day, start, end, room.id, o.faculty_id, o.section_id, 0, tx);
      if (!found.length) {
        await tx.exec(sql`INSERT INTO schedules (offering_id, room_id, day, start_time, end_time)
                          VALUES (${o.id}, ${room.id}, ${day}, ${start}, ${end})`);
      }
      return found;
    });
  }
  if (errors.length) {
    for (const e of errors) await flash(`Not saved. ${e}`, 'error');
    redirect(back);
  }
  await flash(`Meeting saved with no conflicts: ${dayTime(day, start, end)}, ${room!.name}.`);
  const available = (await availabilityChecker())(o.faculty_id, day, start, end);
  for (const w of scheduleWarnings(o, room!, available)) await flash(`Note: ${w}`, 'warning');
  redirect(back);
}

export async function deleteMeeting(form: FormData): Promise<void> {
  const user = await requireRole('admin', 'chair');
  const o = await ownOffering(user, form);
  await db.exec(sql`DELETE FROM schedules WHERE id = ${int(form, 'schedule_id')} AND offering_id = ${o.id}`);
  await flash('Meeting removed.');
  redirect(`/offerings/${o.id}/schedule`);
}
