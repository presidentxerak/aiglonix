import type { ReactNode } from "react";
import { NetworkProvider } from "@/components/shell/network-provider";
import { AppShell } from "@/components/shell/app-shell";

// Route protection lives in middleware.ts: every segment under this layout
// requires a valid session, otherwise redirect to /login.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <AppShell>{children}</AppShell>
    </NetworkProvider>
  );
}
