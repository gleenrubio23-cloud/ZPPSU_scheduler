// Creates the tables and loads the sample data:  npm run db:setup
// Reads DATABASE_URL from the environment or from .env.local / .env.
// WARNING: this deletes all existing data in the system's tables.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (!process.env.DATABASE_URL && existsSync(full)) {
    for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"]+?)"?\s*$/);
      if (m) process.env.DATABASE_URL = m[1];
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Put it in a .env.local file (see README.md).');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  for (const file of ['schema.sql', 'seed.sql']) {
    console.log(`Running db/${file} ...`);
    await client.query(readFileSync(path.join(root, 'db', file), 'utf8'));
  }
  console.log('Done. Log in with admin / admin123.');
} catch (err) {
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
