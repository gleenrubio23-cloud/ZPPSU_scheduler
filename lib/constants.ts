export const APP_NAME = 'Class Schedule Management System';
export const SCHOOL_NAME = 'Zamboanga Peninsula Polytechnic State University';

/** Earliest and latest time a class may be scheduled. */
export const DAY_START = '07:00';
export const DAY_END = '21:00';

export const DAYS: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

export const LEVELS: Record<string, string> = {
  bachelor: "Bachelor's", master: "Master's", doctorate: 'Doctorate',
};

export type Role = 'admin' | 'chair' | 'faculty';

export const ROLES: Record<Role, string> = {
  admin: 'Administrator', chair: 'Program Chair', faculty: 'Faculty',
};

export const ROOM_TYPES: Record<string, string> = { lecture: 'Lecture', laboratory: 'Laboratory' };

export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'] as const;

export const PROFICIENCY: Record<number, string> = {
  1: '1 - Basic', 2: '2 - Fair', 3: '3 - Competent', 4: '4 - Advanced', 5: '5 - Expert',
};
