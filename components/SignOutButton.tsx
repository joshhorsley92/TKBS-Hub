'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      title="Sign out"
      aria-label="Sign out"
      className="grid h-[34px] w-9 cursor-pointer place-items-center rounded-console text-ink-5 transition hover:text-danger"
    >
      <LogOut size={15} />
    </button>
  );
}
