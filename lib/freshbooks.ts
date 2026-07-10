import { createServiceRoleClient } from '@/lib/supabase/server';

// FreshBooks API client — OAuth2 with stored refresh token (service-role-only
// integration_tokens row), auto-refresh, and typed-ish fetchers per resource.
// Field extraction is defensive: `raw` jsonb on every mirror row keeps the
// full payload so wrong assumptions never lose data.

const AUTH_BASE = 'https://auth.freshbooks.com/oauth/authorize';
const TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token';
const API = 'https://api.freshbooks.com';

export function authorizeUrl(): string {
  const clientId = process.env.FRESHBOOKS_CLIENT_ID;
  if (!clientId) throw new Error('FRESHBOOKS_CLIENT_ID is not set');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
  });
  return `${AUTH_BASE}?${params}`;
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/api/freshbooks/callback`;
}

type TokenRow = {
  provider: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_id: string | null;
  business_id: string | null;
};

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.FRESHBOOKS_CLIENT_ID,
      client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FreshBooks token request failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

// One-time exchange after the consent redirect; discovers account/business
// ids and persists everything.
export async function exchangeCode(code: string): Promise<void> {
  const tok = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });

  // Identity → accounting account_id + business_id
  const meRes = await fetch(`${API}/auth/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!meRes.ok) throw new Error(`FreshBooks /users/me failed: HTTP ${meRes.status}`);
  const me = await meRes.json();
  const membership = me?.response?.business_memberships?.[0];
  const accountId: string | null = membership?.business?.account_id ?? null;
  const businessId: string | null = membership?.business?.id != null ? String(membership.business.id) : null;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('integration_tokens').upsert({
    provider: 'freshbooks',
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    account_id: accountId,
    business_id: businessId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`token store failed: ${error.message}`);
}

// Returns a valid access token + ids, refreshing (and persisting) if needed.
export async function getFreshbooksAuth(): Promise<{
  accessToken: string;
  accountId: string;
  businessId: string;
}> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('provider', 'freshbooks')
    .single();
  const row = data as TokenRow | null;
  if (!row) throw new Error('FreshBooks is not connected — use Settings → Connect FreshBooks');
  if (!row.account_id || !row.business_id) {
    throw new Error('FreshBooks connection missing account/business id — reconnect in Settings');
  }

  let accessToken = row.access_token;
  const expiresSoon = new Date(row.expires_at).getTime() - Date.now() < 5 * 60_000;
  if (expiresSoon) {
    const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
    accessToken = tok.access_token;
    await supabase
      .from('integration_tokens')
      .update({
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('provider', 'freshbooks');
  }

  return { accessToken, accountId: row.account_id, businessId: row.business_id };
}

export async function isFreshbooksConnected(): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('integration_tokens')
    .select('provider')
    .eq('provider', 'freshbooks')
    .maybeSingle();
  return !!data;
}

// Paginated GET over an accounting-style list endpoint. FreshBooks wraps
// accounting responses as {response:{result:{<key>: [...], page, pages}}}
// and timetracking as {<key>: [...], meta:{page, pages}}.
export async function fbListAll(
  accessToken: string,
  path: string,
  key: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${API}${path}${sep}page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GET ${path} page ${page} → HTTP ${res.status}`);
    const body = await res.json();
    const result = body?.response?.result ?? body;
    const items = (result?.[key] ?? []) as Record<string, unknown>[];
    all.push(...items);
    const pages = Number(result?.pages ?? result?.meta?.pages ?? 1);
    if (page >= pages || items.length === 0) break;
    page++;
  }
  return all;
}

// Money amounts arrive as {amount: "123.00", code: "USD"} — extract safely.
export function amt(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || null;
  if (typeof v === 'object' && 'amount' in (v as object)) {
    return Number((v as { amount: unknown }).amount) || null;
  }
  return null;
}
