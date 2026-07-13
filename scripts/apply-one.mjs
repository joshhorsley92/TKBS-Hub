// Applies a SINGLE migration file over the direct Postgres connection.
// The migrations are not idempotent as a set, so apply-migrations.mjs (which
// replays all of them) can't be used to add one. Usage:
//   node scripts/apply-one.mjs 0005_broadsheet.sql

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* rely on shell env */
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/apply-one.mjs <migration.sql>');
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error('SUPABASE_DB_URL missing or still has the [YOUR-PASSWORD] placeholder in .env.local');
  process.exit(1);
}

const pg = await import('pg');
const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

process.stdout.write(`applying ${file} … `);
try {
  await client.query(readFileSync(join(root, 'supabase', 'migrations', file), 'utf8'));
  console.log('ok');
} catch (e) {
  console.log('FAILED');
  console.error(`  ${e.message}`);
  await client.end();
  process.exit(1);
}

const { rows } = await client.query(
  "select tablename from pg_tables where schemaname = 'public' order by tablename",
);
console.log(`\npublic tables (${rows.length}): ${rows.map((r) => r.tablename).join(', ')}`);

await client.end();
console.log('\nDone.');
