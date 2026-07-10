import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Server-side Supabase client (user-scoped, subject to RLS). Use in Server
// Components and route handlers acting on behalf of the logged-in user.
// DEV BYPASS: while DEV_BYPASS_AUTH=1 (see lib/dev-auth.ts), returns the
// service-role client instead so data access needs no session.
export async function createServerSupabaseClient() {
  if (process.env.DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production') {
    return createServiceRoleClient();
  }
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Server Components can't set cookies — middleware refreshes the
            // session before the request reaches them, so this is fine.
          }
        },
      },
    },
  );
}

// Service-role client (bypasses RLS). ONLY for automated ingestion (GitHub /
// FreshBooks sync routes) and OAuth token storage. Never expose to the client.
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for sync/ingestion operations.',
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
