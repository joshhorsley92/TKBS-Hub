// Applies supabase/migrations/*.sql in order over the direct Postgres
// connection (SUPABASE_DB_URL from .env.local). DDL can't go through the
// PostgREST API, so this needs the connection string, not the service key.
//
// Usage: node scripts/apply-migrations.mjs [--verify-only]

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env.local loader
try {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* rely on shell env */ }

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
  console.error('SUPABASE_DB_URL missing or still has the [YOUR-PASSWORD] placeholder in .env.local');
  process.exit(1);
}

// pg is a devDependency; install on first use
let pg;
try {
  pg = await import('pg');
} catch {
  console.error("The 'pg' package is required: npm install -D pg");
  process.exit(1);
}

const client = new pg.default.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const verifyOnly = process.argv.includes('--verify-only');

if (!verifyOnly) {
  const dir = join(root, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    process.stdout.write(`applying ${f} … `);
    try {
      await client.query(readFileSync(join(dir, f), 'utf8'));
      console.log('ok');
    } catch (e) {
      console.log('FAILED');
      console.error(`  ${e.message}`);
      await client.end();
      process.exit(1);
    }
  }
}

// Verify
const tables = await client.query(
  "select tablename from pg_tables where schemaname = 'public' order by tablename",
);
console.log(`\npublic tables (${tables.rows.length}):`, tables.rows.map((r) => r.tablename).join(', '));
for (const [q, label] of [
  ['select count(*)::int as n from public.repos', 'repos'],
  ['select count(*)::int as n from public.clients', 'clients'],
  ['select count(*)::int as n from public.ventures', 'ventures'],
  ['select count(*)::int as n from public.assumptions', 'assumptions'],
]) {
  const { rows } = await client.query(q);
  console.log(`${label}: ${rows[0].n}`);
}
await client.end();
console.log('\nDone.');
