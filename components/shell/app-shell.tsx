"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Radar, Crosshair, Map as MapIcon, MessageSquare, LogOut } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useNetwork } from "./network-provider";
import { LocaleSwitcher } from "./locale-switcher";

const NAV_ITEMS = [
  { href: "/operation", key: "operation", icon: Radar },
  { href: "/drone-sentinel", key: "sentinel", icon: Crosshair },
  { href: "/map-vision", key: "map", icon: MapIcon },
  { href: "/ghost-signal", key: "comms", icon: MessageSquare },
] as const;

function StatusDot() {
  const { online } = useNetwork();
  const t = useTranslations("common.status");
  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-ok status-pulse" : "bg-offline",
        )}
      />
      {online ? t("online") : t("offline")}
    </span>
  );
}

function OfflineBanner() {
  const { online, pending } = useNetwork();
  const t = useTranslations("common.status");
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [online]);

  if (!online) {
    return (
      <div
        role="status"
        className="banner-slide border-t-2 border-t-offline bg-surface px-4 py-2 text-sm text-offline flex items-center justify-between gap-3"
      >
        <span>{t("degraded")}</span>
        <span className="tabular text-fg-muted">
          {t("pendingItems", { count: pending })}
        </span>
      </div>
    );
  }
  if (showRestored) {
    return (
      <div
        role="status"
        className="banner-slide border-t-2 border-t-ok bg-surface px-4 py-2 text-sm text-ok"
      >
        {t("reconnected")}
      </div>
    );
  }
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await getSupabaseBrowser().auth.signOut();
    } catch {
      // even if the call fails, send the user back to login
    }
    router.push("/login");
  }

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-5 py-5 border-b border-line">
          <Link href="/operation" className="font-bold text-lg tracking-wide">
            {t("appName")}
          </Link>
        </div>
        <nav className="flex-1 py-3" aria-label="Main">
          {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 text-sm transition-colors duration-150 border-l-2",
                  active
                    ? "border-l-accent text-fg bg-raised"
                    : "border-l-transparent text-fg-muted hover:text-fg hover:bg-raised",
                )}
              >
                <Icon size={18} aria-hidden />
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-line flex flex-col gap-3">
          <StatusDot />
          <div className="flex items-center justify-between gap-2">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label={t("cta.signOut")}
              className="text-fg-muted hover:text-fg transition-colors duration-150 min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer"
            >
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3 sticky top-0 z-[1100]">
          <span className="font-bold tracking-wide">{t("appName")}</span>
          <div className="flex items-center gap-3">
            <StatusDot />
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-label={t("cta.signOut")}
              className="text-fg-muted min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer"
            >
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </header>

        <OfflineBanner />

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom navigation — thumb-reachable (§2.5 responsive) */}
        <nav
          aria-label="Main"
          className="md:hidden fixed bottom-0 inset-x-0 z-[1100] grid grid-cols-4 border-t border-line bg-surface"
        >
          {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 min-h-14 text-[11px] transition-colors duration-150",
                  active ? "text-accent" : "text-fg-muted",
                )}
              >
                <Icon size={20} aria-hidden />
                {t(`nav.${key}`)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
