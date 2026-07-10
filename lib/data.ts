import { createServerSupabaseClient } from '@/lib/supabase/server';

// Until the Supabase project is provisioned (.env.local placeholders), every
// query throws. The console renders honest "not connected" states instead of
// crashing — this wrapper is what makes that possible. It NEVER fabricates:
// null means "unknown", not zero.
export async function safeQuery<T>(
  fn: (supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await fn(supabase);
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export function isDbConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.length > 0 && !url.includes('placeholder');
}
