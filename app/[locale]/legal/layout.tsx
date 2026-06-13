import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/landing/site-footer";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://aiglonix.vercel.app";

export default async function LegalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const officialDomain = APP_URL.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line/60 bg-base/90 px-4 md:px-8 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-wide"
        >
          <Logo size={28} />
          AIGLONIX
          <span className="border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
            Beta
          </span>
        </Link>
        <Link href="/" className="text-sm text-fg-muted hover:text-fg">
          ← Home
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter officialDomain={officialDomain} />
    </div>
  );
}
