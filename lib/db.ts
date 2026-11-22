/**
 * PostgreSQL access.
 *
 * Queries are written with the `sql` tag:   db.rows(sql`SELECT * FROM users WHERE id = ${id}`)
 * Every ${value} becomes a numbered parameter ($1, $2, ...), never pasted into the text,
 * so user input cannot change the query (no SQL injection).
 */
import { Pool, types, type PoolClient } from 'pg';

// Return NUMERIC and COUNT(*) results as JavaScript numbers instead of strings.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------- Query builder ----------
export class Sql {
  constructor(readonly strings: readonly string[], readonly values: readonly unknown[]) {}
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
  return new Sql(strings, values);
}

/** Trusted SQL text (never user input), for example a fixed column name. */
export function raw(text: string): Sql {
  return new Sql([text], []);
}

export function join(parts: Sql[], separator = ', '): Sql {
  if (parts.length === 0) return raw('');
  return new Sql(['', ...Array(parts.length - 1).fill(separator), ''], parts);
}

function compile(q: Sql, values: unknown[]): string {
  let text = q.strings[0];
  q.values.forEach((value, i) => {
    if (value instanceof Sql) {
      text += compile(value, values);
    } else {
      values.push(value);
      text += '$' + values.length;
    }
    text += q.strings[i + 1];
  });
  return text;
}

// ---------- Connection pool ----------
const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg.pgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Add it to .env.local, or to the Environment Variables of your Vercel project.');
    }
    globalForPg.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForPg.pgPool;
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

function makeDb(getClient: () => Queryable) {
  async function rows<T = Row>(q: Sql): Promise<T[]> {
    const values: unknown[] = [];
    const text = compile(q, values);
    const result = await getClient().query(text, values);
    return result.rows as T[];
  }
  async function row<T = Row>(q: Sql): Promise<T | null> {
    return (await rows<T>(q))[0] ?? null;
  }
  async function val<T = unknown>(q: Sql): Promise<T | null> {
    const r = await row<Row>(q);
    return r ? (Object.values(r)[0] as T) : null;
  }
  async function exec(q: Sql): Promise<number> {
    const values: unknown[] = [];
    const text = compile(q, values);
    const result = await getClient().query(text, values);
    return result.rowCount ?? 0;
  }
  /** Rows as { id: label } pairs, for <select> lists. */
  async function pairs(q: Sql): Promise<[number | string, string][]> {
    return (await rows<Row>(q)).map((r) => {
      const [k, v] = Object.values(r);
      return [k as number | string, String(v)];
    });
  }
  return { rows, row, val, exec, pairs };
}

export type Db = ReturnType<typeof makeDb>;

export const db: Db = makeDb(getPool);

/** Run several queries as one unit: all are saved, or none are. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(makeDb(() => client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** True when a database error is a duplicate value (23505) or a record still in use (23503). */
export function isConstraintError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === '23505' || code === '23503';
}
