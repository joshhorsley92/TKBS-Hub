-- ============================================================================
-- TKBS-Hub — 0006: Savannah, and a third seat on the board
--
-- Savannah (Josh's wife) is the primary bookkeeper and owns FreshBooks. She
-- needs to see status and be assignable work — but she has NO LOGIN YET, and
-- authorization is deliberately a later piece of work.
--
-- That exposes a design flaw the two-person model was hiding: `profiles.id` was
-- a foreign key onto `auth.users(id)`, so a person could not exist on the board
-- until they had an account. Identity and authentication were the same column.
-- They aren't the same thing. This migration separates them:
--
--   profiles.id            a person. Stable, owns work, never changes.
--   profiles.auth_user_id  how that person logs in. NULL until they can.
--
-- Every existing FK (initiatives.owner_id, work_items.profile_id, decisions.
-- proposed_by, workspace_prefs.profile_id …) points at profiles.id and is
-- untouched. Joe and Josh keep their current ids, so nothing re-points.
--
-- Her email is NOT invented. It's NULL — which is the honest value for "we
-- haven't been told yet" — and the column is now nullable to allow that.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A bookkeeper is a role the company has. The check constraint didn't know it.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'engineer', 'bookkeeper'));

-- ---------------------------------------------------------------------------
-- Identity ≠ authentication.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists auth_user_id uuid
  references auth.users(id) on delete set null;

-- Joe and Josh's profile ids ARE their auth ids today — carry that across so
-- their sessions keep resolving.
update public.profiles set auth_user_id = id where auth_user_id is null;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

create unique index if not exists profiles_auth_user_uq
  on public.profiles (auth_user_id) where auth_user_id is not null;

-- A person on the board may not have an email on file yet. NULL = unknown.
alter table public.profiles alter column email drop not null;

comment on column public.profiles.auth_user_id is
  'The Supabase auth user this person signs in as. NULL = on the board, but cannot log in yet.';

-- ---------------------------------------------------------------------------
-- RLS + defaults now resolve a person through auth_user_id, not through id.
-- ---------------------------------------------------------------------------
create or replace function public.is_hub_user()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where auth_user_id = auth.uid()) $$;

-- The profile id of the caller. money_lines.created_by defaulted to auth.uid(),
-- which only worked while the two were the same column. Any profile created
-- from now on gets a fresh id, so that default would have written an auth id
-- into a profiles FK and failed. It resolves properly now.
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as
$$ select id from public.profiles where auth_user_id = auth.uid() $$;

alter table public.money_lines alter column created_by set default public.current_profile_id();

-- Users may only update their OWN profile row.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Signup now LINKS to an existing person where one is waiting, instead of
-- creating a duplicate. That's the path for Savannah: put her real email on her
-- profile, then create her auth user — the trigger claims the existing row and
-- she keeps every initiative and task already assigned to her.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
begin
  update public.profiles
     set auth_user_id = new.id
   where auth_user_id is null
     and email is not null
     and lower(email) = lower(new.email);

  if not found then
    insert into public.profiles (name, email, role, auth_user_id)
    values (
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'role', 'engineer'),
      new.id
    );
  end if;

  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Savannah. No email, no login — a real person on the board who can own work.
-- ---------------------------------------------------------------------------
insert into public.profiles (name, role, email, auth_user_id)
select 'Savannah', 'bookkeeper', null, null
where not exists (select 1 from public.profiles where role = 'bookkeeper');
