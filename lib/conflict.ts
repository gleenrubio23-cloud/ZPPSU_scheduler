/**
 * Automated conflict detection.
 *
 * Two meetings overlap when they fall on the same day and
 *     startA < endB  AND  endA > startB
 * A new meeting is blocked when an overlapping meeting in the same term uses
 * the same ROOM, the same FACULTY member, or the same SECTION.
 *
 * A meeting is also blocked when the students enrolled in the class do not
 * fit the room (enrolled > room capacity).
 */
import { db, sql, type Db, type Row } from './db';
import { DAYS, DAY_END, DAY_START } from './constants';
import { dayTime, fmtTime, fromMinutes, hhmm, minutes } from './format';

export type Offering = {
  id: number; term_id: number; subject_id: number; section_id: number; faculty_id: number | null;
  enrolled: number; match_score: number | null;
  code: string; title: string; units: number; hours_per_week: number; room_type: string; department_id: number;
  min_degree_level: string; section_name: string; section_size: number; faculty_name: string | null;
  school_year: string; semester: string;
};

export type Room = { id: number; name: string; building: string | null; capacity: number; type: string };

/** Load one offering with everything the scheduling pages need. */
export async function loadOffering(id: number): Promise<Offering | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.row<Offering>(sql`
    SELECT o.*, sub.code, sub.title, sub.units, sub.hours_per_week, sub.room_type, sub.department_id,
           sub.min_degree_level, sec.name AS section_name, sec.size AS section_size,
           u.full_name AS faculty_name, t.school_year, t.semester
    FROM offerings o
    JOIN subjects sub ON sub.id = o.subject_id
    JOIN sections sec ON sec.id = o.section_id
    JOIN terms t ON t.id = o.term_id
    LEFT JOIN users u ON u.id = o.faculty_id
    WHERE o.id = ${id}`);
}

/** Room capacity rule. Returns an error message, or null when the class fits. */
export function capacityError(room: { name: string; capacity: number }, enrolled: number): string | null {
  if (enrolled > room.capacity) {
    return `Capacity conflict: ${room.name} seats ${room.capacity} but ${enrolled} students are enrolled in this class.`;
  }
  return null;
}

/** Hard conflicts for a proposed meeting. Returns a list of messages (empty = no conflict). */
export async function findConflicts(
  termId: number, day: number, start: string, end: string, roomId: number,
  facultyId: number | null, sectionId: number, excludeScheduleId = 0, q: Db = db,
): Promise<string[]> {
  const found = await q.rows(sql`
    SELECT s.*, o.faculty_id, o.section_id, sub.code, sec.name AS section_name,
           r.name AS room_name, u.full_name AS faculty_name
    FROM schedules s
    JOIN offerings o ON o.id = s.offering_id
    JOIN subjects sub ON sub.id = o.subject_id
    JOIN sections sec ON sec.id = o.section_id
    JOIN rooms r ON r.id = s.room_id
    LEFT JOIN users u ON u.id = o.faculty_id
    WHERE o.term_id = ${termId} AND s.day = ${day} AND s.start_time < ${end}::time AND s.end_time > ${start}::time
      AND s.id <> ${excludeScheduleId}
      AND (s.room_id = ${roomId} OR o.section_id = ${sectionId} OR (o.faculty_id IS NOT NULL AND o.faculty_id = ${facultyId ?? 0}))
    ORDER BY s.start_time`);

  const messages: string[] = [];
  for (const c of found) {
    const when = dayTime(c.day, c.start_time, c.end_time);
    const cls = `${c.code} (${c.section_name})`;
    if (c.room_id === roomId) messages.push(`Room conflict: ${c.room_name} is used by ${cls}, ${when}.`);
    if (facultyId && c.faculty_id === facultyId) messages.push(`Faculty conflict: ${c.faculty_name} teaches ${cls}, ${when}.`);
    if (c.section_id === sectionId) messages.push(`Section conflict: ${c.section_name} has ${cls}, ${when}.`);
  }
  return messages;
}

/**
 * Returns a checker for faculty availability. A faculty member with no availability
 * rows is available at any time; otherwise one block must cover the whole meeting.
 */
export async function availabilityChecker(): Promise<(facultyId: number | null, day: number, start: string, end: string) => boolean> {
  const blocks = await db.rows<{ faculty_id: number; day: number; start_time: string; end_time: string }>(sql`
    SELECT faculty_id, day, start_time, end_time FROM faculty_availability`);
  return (facultyId, day, start, end) => {
    if (!facultyId) return true;
    const mine = blocks.filter((b) => b.faculty_id === facultyId);
    if (!mine.length) return true;
    return mine.some((b) => b.day === day && hhmm(b.start_time) <= start && hhmm(b.end_time) >= end);
  };
}

/** Soft problems: the meeting can be saved, but the user is told. */
export function scheduleWarnings(
  offering: { room_type: string; faculty_id: number | null; faculty_name: string | null },
  room: { name: string; type: string },
  available: boolean,
): string[] {
  const warnings: string[] = [];
  if (room.type !== offering.room_type) {
    warnings.push(`The subject needs a ${offering.room_type} room; ${room.name} is a ${room.type} room.`);
  }
  if (!available) warnings.push(`The time is outside the stated availability of ${offering.faculty_name}.`);
  return warnings;
}

/** Basic checks on the time range itself. */
export function validateTime(day: number, start: string, end: string): string[] {
  const errors: string[] = [];
  if (!DAYS[day]) errors.push('Choose a day.');
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) errors.push('Enter a start and end time.');
  else if (start >= end) errors.push('The end time must be later than the start time.');
  else if (start < DAY_START || end > DAY_END) {
    errors.push(`Classes must fall between ${fmtTime(DAY_START)} and ${fmtTime(DAY_END)}.`);
  }
  return errors;
}

export type Slot = { day: number; start: string; end: string; room: Room };

/**
 * Suggest conflict-free slots for an offering: a day, a time, and a room of the right type,
 * with enough seats for the enrolled students, where the room, the faculty member,
 * and the section are all free.
 */
export async function suggestSlots(offering: Offering, length: number, limit = 6): Promise<Slot[]> {
  const rooms = await db.rows<Room>(sql`
    SELECT * FROM rooms WHERE type = ${offering.room_type} AND capacity >= ${offering.enrolled} ORDER BY capacity, name`);
  if (!rooms.length || length < 30) return [];

  // Every meeting already set this term, checked in memory.
  const busy = await db.rows<{ offering_id: number; day: number; start_time: string; end_time: string; room_id: number; faculty_id: number | null; section_id: number }>(sql`
    SELECT s.offering_id, s.day, s.start_time, s.end_time, s.room_id, o.faculty_id, o.section_id
    FROM schedules s JOIN offerings o ON o.id = s.offering_id WHERE o.term_id = ${offering.term_id}`);
  const isAvailable = await availabilityChecker();
  const facultyId = offering.faculty_id;

  const clashes = (day: number, start: string, end: string, roomId: number) => busy.some((b) =>
    b.day === day && hhmm(b.start_time) < end && hhmm(b.end_time) > start &&
    (b.room_id === roomId || b.section_id === offering.section_id || (facultyId !== null && b.faculty_id === facultyId)));

  // Start the search on days this class does not meet yet, so meetings spread across the week.
  const taken = new Set(busy.filter((b) => b.offering_id === offering.id).map((b) => b.day));
  const days = Object.keys(DAYS).map(Number).sort((a, b) => Number(taken.has(a)) - Number(taken.has(b)) || a - b);

  const first = minutes(DAY_START);
  const last = minutes(DAY_END) - length;
  const slots: Slot[] = [];
  for (const day of days) {
    let perDay = 0;
    for (let t = first; t <= last; t += 30) {
      const start = fromMinutes(t);
      const end = fromMinutes(t + length);
      if (!isAvailable(facultyId, day, start, end)) continue;
      const room = rooms.find((r) => !clashes(day, start, end, r.id));
      if (room) {
        slots.push({ day, start, end, room });
        perDay++;
        t += length - 30; // the next suggestion starts after this one ends
      }
      if (perDay >= 2 || slots.length >= limit) break;
    }
    if (slots.length >= limit) break;
  }
  return slots;
}

/** Every pair of meetings in a term that collide (used by the Conflict Report). */
export async function scanConflicts(termId: number): Promise<Row[]> {
  return db.rows(sql`
    SELECT a.day, a.start_time AS a_start, a.end_time AS a_end, b.start_time AS b_start, b.end_time AS b_end,
           sa.code AS a_code, ca.name AS a_section, sb.code AS b_code, cb.name AS b_section,
           ra.name AS a_room, rb.name AS b_room, ua.full_name AS a_faculty,
           oa.id AS a_offering, ob.id AS b_offering,
           (a.room_id = b.room_id) AS same_room,
           (oa.faculty_id IS NOT NULL AND oa.faculty_id = ob.faculty_id) AS same_faculty,
           (oa.section_id = ob.section_id) AS same_section
    FROM schedules a
    JOIN schedules b ON b.id > a.id AND b.day = a.day AND b.start_time < a.end_time AND b.end_time > a.start_time
    JOIN offerings oa ON oa.id = a.offering_id
    JOIN offerings ob ON ob.id = b.offering_id
    JOIN subjects sa ON sa.id = oa.subject_id
    JOIN subjects sb ON sb.id = ob.subject_id
    JOIN sections ca ON ca.id = oa.section_id
    JOIN sections cb ON cb.id = ob.section_id
    JOIN rooms ra ON ra.id = a.room_id
    JOIN rooms rb ON rb.id = b.room_id
    LEFT JOIN users ua ON ua.id = oa.faculty_id
    WHERE oa.term_id = ${termId} AND ob.term_id = ${termId}
      AND (a.room_id = b.room_id OR oa.section_id = ob.section_id
           OR (oa.faculty_id IS NOT NULL AND oa.faculty_id = ob.faculty_id))
    ORDER BY a.day, a.start_time`);
}

export async function activeTerm(): Promise<{ id: number; school_year: string; semester: string } | null> {
  return db.row(sql`SELECT * FROM terms WHERE is_active LIMIT 1`);
}
