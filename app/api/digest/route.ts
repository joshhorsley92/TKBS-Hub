import { NextResponse } from 'next/server';
import { requireAuthOrSyncSecret } from '@/lib/api-auth';
import { composeDigest, postToSlack } from '@/lib/digest';

// POST /api/digest — compose the last-24h standup digest and post to Slack.
// ?dry=1 returns the text without posting (preview).
// Auth: logged-in user OR x-sync-secret header (cron caller).
export async function POST(request: Request) {
  const auth = await requireAuthOrSyncSecret(request);
  if (auth instanceof NextResponse) return auth;

  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const { text, hasContent } = await composeDigest();

  if (dry) return NextResponse.json({ ok: true, dry: true, hasContent, text });

  const slack = await postToSlack(text);
  return NextResponse.json({ ok: slack.ok, status: slack.status, hasContent });
}
