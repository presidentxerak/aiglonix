import type { ReactNode } from "react";
import { NetworkProvider } from "@/components/shell/network-provider";
import { AuthGuard } from "@/components/shell/auth-guard";
import { AppShell } from "@/components/shell/app-shell";

// No middleware in this project (see CLAUDE.md): the session gate is the
// client-side AuthGuard; real security = RLS + API-route session checks.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </NetworkProvider>
  );
}
