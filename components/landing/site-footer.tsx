import { getTranslations } from "next-intl/server";
import { ShieldCheck, Lock, FileText, Globe2 } from "lucide-react";
import { Brand } from "@/components/brand/logo";

/**
 * Landing footer - legal, privacy, security and defence-sector (NATO/EU)
 * compliance posture. Honest by design: links are placeholders for a
 * prototype and the classification banner makes the demo status explicit.
 */
export async function SiteFooter({ officialDomain }: { officialDomain: string }) {
  const t = await getTranslations("footer");

  const columns: {
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    links: { label: string; href: string }[];
  }[] = [
    {
      title: t("col.platform"),
      icon: Globe2,
      links: [
        { label: t("links.features"), href: "/#how" },
        { label: t("links.voice"), href: "/login" },
        { label: t("links.security"), href: "/#security" },
        { label: t("links.signin"), href: "/login" },
      ],
    },
    {
      title: t("col.legal"),
      icon: FileText,
      links: [
        { label: t("legal.privacy"), href: "#" },
        { label: t("legal.terms"), href: "#" },
        { label: t("legal.aup"), href: "#" },
        { label: t("legal.cookies"), href: "#" },
      ],
    },
    {
      title: t("col.security"),
      icon: Lock,
      links: [
        { label: t("security.policy"), href: "#" },
        { label: t("security.disclosure"), href: "#" },
        { label: t("security.txt"), href: "/.well-known/security.txt" },
        { label: t("security.status"), href: "#" },
      ],
    },
    {
      title: t("col.compliance"),
      icon: ShieldCheck,
      links: [
        { label: t("compliance.nato"), href: "#" },
        { label: t("compliance.stanag"), href: "#" },
        { label: t("compliance.gdpr"), href: "#" },
        { label: t("compliance.export"), href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-surface/40">
      {/* classification banner */}
      <div className="border-b border-line/60 bg-base/60 py-1.5 text-center text-[11px] font-bold tracking-[0.2em] text-fg-muted">
        {t("classification")}
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Brand logoSize={30} className="text-lg" />
            <p className="mt-4 max-w-xs text-sm text-fg-muted">
              {t("tagline")}
            </p>
            <p className="mt-4 text-xs text-fg-muted">{t("builtNote")}</p>
          </div>

          {columns.map(({ title, icon: Icon, links }) => (
            <nav key={title} aria-label={title}>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg">
                <Icon size={14} className="text-accent" />
                {title}
              </h3>
              <ul className="mt-3 space-y-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-fg-muted hover:text-fg transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-10 rounded-[4px] border border-line bg-base/40 px-4 py-3 text-xs text-fg-muted">
          {t("antiPhishing", { domain: officialDomain })}
        </p>

        <div className="mt-8 flex flex-col gap-2 border-t border-line/60 pt-6 text-xs text-fg-muted md:flex-row md:items-center md:justify-between">
          <span>© 2026 AIGLONIX - {t("rights")}</span>
          <span>{t("edth")}</span>
          <span className="tabular">
            {t("official")}: {officialDomain}
          </span>
        </div>
      </div>
    </footer>
  );
}
