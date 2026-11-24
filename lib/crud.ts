/**
 * Definitions for the simple add / edit / delete screens.
 * Table and column names come only from this file, never from the browser.
 */
import { db, sql } from './db';
import type { Role } from './constants';
import { ROOM_TYPES } from './constants';
import { sectionLimit } from './limits';

export type FieldDef = {
  label: string;
  type?: 'text' | 'number' | 'select';
  required?: boolean;
  default?: string | number;
  /** Highest allowed number (number fields), read when the form is shown and when it is saved. */
  max?: () => Promise<number>;
  /** Choices for a select: fixed pairs, or a query run when needed. */
  options?: Record<string, string> | (() => Promise<[number | string, string][]>);
};

export type CrudDef = {
  table: string;
  page: string;
  single: string;
  order: string;
  roles: Role[];
  fields: Record<string, FieldDef>;
  /** A chair only sees and edits rows of their own department (department_id). */
  scopedToDepartment?: boolean;
};

const departmentOptions = () => db.pairs(sql`SELECT id, code FROM departments ORDER BY code`);

export const CRUD: Record<string, CrudDef> = {
  departments: {
    table: 'departments', page: '/departments', single: 'department', order: 'code', roles: ['admin'],
    fields: {
      code: { label: 'Code', required: true },
      name: { label: 'Name', required: true },
    },
  },
  rooms: {
    table: 'rooms', page: '/rooms', single: 'room', order: 'name', roles: ['admin'],
    fields: {
      name: { label: 'Room name', required: true },
      building: { label: 'Building' },
      capacity: { label: 'Capacity', type: 'number', required: true, default: 40 },
      type: { label: 'Type', type: 'select', required: true, options: ROOM_TYPES },
    },
  },
  sections: {
    table: 'sections', page: '/sections', single: 'section', order: 'name', roles: ['admin', 'chair'],
    scopedToDepartment: true,
    fields: {
      name: { label: 'Section name', required: true },
      program: { label: 'Program', required: true },
      year_level: { label: 'Year level', type: 'number', required: true, default: 1 },
      size: { label: 'Number of students', type: 'number', required: true, default: 40, max: sectionLimit },
      department_id: { label: 'Department', type: 'select', required: true, options: departmentOptions },
    },
  },
  fields: {
    table: 'fields', page: '/lookups', single: 'field of study', order: 'name', roles: ['admin', 'chair'],
    fields: { name: { label: 'Field of study', required: true } },
  },
};

export async function resolveOptions(field: FieldDef): Promise<[string, string][]> {
  if (!field.options) return [];
  const list = typeof field.options === 'function' ? await field.options() : Object.entries(field.options);
  return list.map(([k, v]) => [String(k), v]);
}
