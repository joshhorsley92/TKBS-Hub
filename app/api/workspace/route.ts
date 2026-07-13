import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { mergeProfile } from '@/lib/workspace';
import type { PersonKey } from '@/lib/broadsheet';

// Per-person workspace prefs (theme / nav / Pulse layout).
//
// Both founders share full data access and can customise a workspace on the
// other's behalf, so this doesn't restrict writes to the caller's own row — it
// only validates that the target profile exists. Prefs are cosmetic: nothing
// here can change a figure on the board.
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const profileId = body?.profileId;
  if (typeof profileId !== 'string' || !profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, email, name')
    .eq('id', profileId)
    .single();
  if (!profile) return NextResponse.json({ error: 'No such profile' }, { status: 404 });

  // Normalise against that person's defaults before storing, so a malformed
  // client can't persist a shape that would later break the shell. Mirrors
  // personKeyOf() in lib/board.ts — role first, since Savannah has no email yet.
  const who: PersonKey =
    profile.role === 'owner'
      ? 'josh'
      : profile.role === 'bookkeeper'
        ? 'savannah'
        : profile.email?.startsWith('josh')
          ? 'josh'
          : /savannah/i.test(profile.name ?? '')
            ? 'savannah'
            : 'joe';

  const prefs = mergeProfile(body?.prefs, who);

  const { error } = await supabase
    .from('workspace_prefs')
    .upsert({ profile_id: profileId, prefs, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prefs });
}
