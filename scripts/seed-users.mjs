// Seeds the two hub users (Joe + Josh) via the Supabase admin API and maps
// their verified git author emails in `identities`.
//
// Usage:  node scripts/seed-users.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Idempotent: existing users/identities are left alone.
//
// Git identities verified from actual repo logs (2026-07-10):
//   Joe  → joseph.zolinski57@gmail.com
//   Josh → joshhorsley92@gmail.com

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Minimal .env.local loader (no dotenv dependency needed)
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* rely on shell env */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: 'joe@tkbsmarketing.com',
    name: 'Joe Zolinski',
    role: 'engineer',
    gitEmails: ['joseph.zolinski57@gmail.com'],
  },
  {
    email: 'josh@tkbsmarketing.com',
    name: 'Josh Horsley',
    role: 'owner',
    gitEmails: ['joshhorsley92@gmail.com'],
  },
];

for (const u of USERS) {
  // Find-or-create the auth user; send a recovery link so they set a password.
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((x) => x.email === u.email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role },
    });
    if (error) {
      console.error(`createUser(${u.email}) failed:`, error.message);
      process.exit(1);
    }
    user = data.user;
    console.log(`created auth user ${u.email}`);

    const { data: linkData, error: linkErr } =
      await supabase.auth.admin.generateLink({ type: 'recovery', email: u.email });
    if (linkErr) {
      console.warn(`  recovery link failed (${linkErr.message}) — set a password in the Supabase dashboard instead`);
    } else {
      console.log(`  set-password link: ${linkData.properties.action_link}`);
    }
  } else {
    console.log(`auth user ${u.email} already exists`);
  }

  // The on_auth_user_created trigger created the profile; make sure the role
  // is right (trigger defaults to metadata, but be explicit).
  await supabase
    .from('profiles')
    .update({ name: u.name, role: u.role })
    .eq('id', user.id);

  // Map git author emails → this person (idempotent).
  for (const gitEmail of u.gitEmails) {
    const { error } = await supabase.from('identities').upsert(
      { profile_id: user.id, kind: 'git_email', value: gitEmail },
      { onConflict: 'value', ignoreDuplicates: true },
    );
    if (error) console.warn(`  identity ${gitEmail}: ${error.message}`);
    else console.log(`  identity mapped: ${gitEmail} → ${u.name}`);
  }
}

console.log('\nDone. Both users seeded; passwords set via the recovery links above.');
