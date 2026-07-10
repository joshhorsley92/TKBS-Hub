import { NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/freshbooks';

// GET /api/freshbooks/callback?code= — OAuth redirect target. Exchanges the
// code, stores tokens + account/business ids (service role), sends the user
// back to Settings. Public route (the consent redirect has no session), but
// useless without a valid one-time code from FreshBooks.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const backTo = new URL('/settings', url.origin);

  if (!code) {
    backTo.searchParams.set('fb', 'error');
    backTo.searchParams.set('fb_msg', url.searchParams.get('error') ?? 'no code returned');
    return NextResponse.redirect(backTo);
  }

  try {
    await exchangeCode(code);
    backTo.searchParams.set('fb', 'connected');
  } catch (e) {
    backTo.searchParams.set('fb', 'error');
    backTo.searchParams.set('fb_msg', e instanceof Error ? e.message.slice(0, 200) : 'exchange failed');
  }
  return NextResponse.redirect(backTo);
}
