import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { LEGAL, LEGAL_SLUGS, type LegalSlug } from "@/lib/legal/content";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    LEGAL_SLUGS.map((slug) => ({ locale, slug })),
  );
}

function isSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  return { title: `${LEGAL[slug].title} — AIGLONIX` };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!isSlug(slug)) notFound();
  const doc = LEGAL[slug];

  return (
    <article className="mx-auto max-w-3xl px-4 md:px-8 py-12 md:py-16">
      <p className="text-xs text-fg-muted uppercase tracking-widest mb-2">
        Legal
      </p>
      <h1 className="text-2xl md:text-4xl font-bold">{doc.title}</h1>
      <p className="text-xs text-fg-muted mt-2 tabular">
        Last updated: {doc.updated}
      </p>
      <p className="mt-6 text-fg-muted">{doc.intro}</p>

      <div className="mt-10 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-bold mb-2">{s.heading}</h2>
            <div className="space-y-2">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-fg-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
