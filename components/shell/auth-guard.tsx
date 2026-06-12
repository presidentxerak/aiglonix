"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Client-side route guard. There is deliberately NO middleware in this
 * project (Edge middleware crashes at runtime on this Vercel account —
 * see CLAUDE.md). The guard is a UX gate only: the actual security
 * boundary is RLS on every table and the server-side session check in
 * every API route. Reads the LOCAL session (no network call) so an
 * operator who reopens the app offline keeps access — offline-first.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured()) {
        // No backend configured (local dev) — show the shell
        setAllowed(true);
        return;
      }
      try {
        const {
          data: { session },
        } = await getSupabaseBrowser().auth.getSession();
        if (cancelled) return;
        if (session) {
          setAllowed(true);
        } else {
          router.replace("/login");
        }
      } catch {
        // A guard failure must never lock an operator out in the field
        if (!cancelled) setAllowed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return <div className="min-h-dvh bg-base" aria-busy="true" />;
  }
  return <>{children}</>;
}
