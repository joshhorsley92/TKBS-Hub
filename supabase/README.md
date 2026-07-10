# Supabase setup — TKBS-Hub

The Hub gets its **own Supabase project** (NOT the CRM/Dashboard project — that
one is legacy). Same proven setup flow as the CRM, with one improvement: Claude
applies the migrations programmatically over the DB connection string, so the
only human steps are dashboard clicks.

## What's here

```
supabase/
  migrations/
    0001_hub_core.sql    ← schema: clients, ventures, decisions, money_lines,
                            fb_* FreshBooks mirrors, work_log, repos, …
    0002_seed.sql        ← 4 ventures, 4 clients, 11 repos, assumptions
    0003_views_rls.sql   ← money-substrate views + RLS policies
  README.md              ← you are here
scripts/
  seed-users.mjs         ← creates Joe + Josh in Supabase Auth + git-email
                            identity mappings; prints recovery links
  apply-migrations.mjs   ← applies migrations 0001→0003 over SUPABASE_DB_URL
```

## One-time setup

### Joe (dashboard — ~3 minutes)

1. **supabase.com → New project**
   - Organization: TKBS (or personal)
   - Name: `TKBS-Hub`
   - Database password: generate + **save it** (you'll need it in step 3)
   - Region: US East
2. Wait for provisioning (~2 min), then **Settings → API**. Copy into
   `C:\TKBS-Hub\.env.local` (replacing the placeholders):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
   (New projects may label these "Publishable key" and "Secret key" —
   same thing, use those.)
3. **Settings → Database → Connection string → URI** (use the *Session pooler*
   URI if shown), substitute your DB password where it says `[YOUR-PASSWORD]`,
   paste into `.env.local` as `SUPABASE_DB_URL=…`
4. Say "done" to Claude.

### Claude (automated)

5. `node scripts/apply-migrations.mjs` — applies 0001→0003, verifies tables.
6. `node scripts/seed-users.mjs` — creates joe@ + josh@ auth users, maps git
   identities, prints one **password recovery link per person** (single-use,
   time-limited). Joe sets his password; Josh gets his link via Slack DM.
7. Verify: `npm run dev` → log in → cockpit shell renders with seeded data.

## Verifying

```sql
select count(*) from public.repos;      -- 11
select count(*) from public.clients;    -- 4
select count(*) from public.ventures;   -- 4
select email, role from public.profiles order by email;  -- joe engineer, josh owner
```

## Re-running

Migrations are NOT idempotent. To wipe and re-apply (dev only, destroys data):

```sql
drop schema public cascade; create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
drop trigger if exists on_auth_user_created on auth.users;
```
