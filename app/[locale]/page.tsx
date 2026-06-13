import {
  Crosshair,
  LocateFixed,
  Map as MapIcon,
  MessageSquare,
  Radar as RadarIcon,
  Radio,
  Share2,
  Target,
  ShieldCheck,
  Lock,
  EyeOff,
  Gauge,
  Fingerprint,
  Globe,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Radar } from "@/components/landing/radar";
import { Reveal } from "@/components/landing/reveal";
import { StatCount } from "@/components/landing/stat-count";
import { SiteFooter } from "@/components/landing/site-footer";
import { Logo } from "@/components/brand/logo";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://aiglonix.vercel.app";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const officialDomain = APP_URL.replace(/^https?:\/\//, "");

  const modules = [
    { icon: Crosshair, name: t("solution.sentinelName"), body: t("solution.sentinelBody") },
    { icon: MapIcon, name: t("solution.mapName"), body: t("solution.mapBody") },
    { icon: RadarIcon, name: t("solution.operationName"), body: t("solution.operationBody") },
    { icon: MessageSquare, name: t("solution.ghostName"), body: t("solution.ghostBody") },
  ];

  const problems = [
    { title: t("problem.c1Title"), body: t("problem.c1Body") },
    { title: t("problem.c2Title"), body: t("problem.c2Body") },
    { title: t("problem.c3Title"), body: t("problem.c3Body") },
  ];

  const steps = [
    { icon: Target, title: t("how.s1"), body: t("how.s1Body") },
    { icon: Share2, title: t("how.s2"), body: t("how.s2Body") },
    { icon: Radio, title: t("how.s3"), body: t("how.s3Body") },
  ];

  const securityPoints = [
    { icon: Lock, title: t("security.p1Title"), body: t("security.p1Body") },
    { icon: ShieldCheck, title: t("security.p2Title"), body: t("security.p2Body") },
    { icon: Fingerprint, title: t("security.p3Title"), body: t("security.p3Body") },
    { icon: EyeOff, title: t("security.p4Title"), body: t("security.p4Body") },
    { icon: Gauge, title: t("security.p5Title"), body: t("security.p5Body") },
    { icon: Globe, title: t("security.p6Title"), body: t("security.p6Body") },
  ];

  return (
    <div className="min-h-dvh">
      {/* 0. Fixed header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line/60 bg-base/90 px-4 md:px-8 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-wide"
        >
          <Logo size={28} />
          {tCommon("appName")}
        </Link>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-[4px] bg-accent px-4 text-sm font-bold text-ink hover:bg-accent/85 transition-colors duration-150"
          >
            {t("header.signIn")}
          </Link>
        </div>
      </header>

      {/* 1. Hero — full-bleed background video + overlay */}
      <section className="relative overflow-hidden border-b border-line/60">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src="/aiglonix-hero-video1.mp4" type="video/mp4" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-base/75 via-base/85 to-base"
        />
        <div className="relative mx-auto max-w-6xl px-4 md:px-8 py-20 md:py-32 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1">
            <Logo
              size={64}
              className="mb-6 drop-shadow-[0_0_24px_rgba(56,189,248,0.25)]"
            />
            <span className="inline-block border border-accent/40 bg-surface/70 px-3 py-1.5 text-xs text-accent mb-5">
              {t("hero.voiceTagline")}
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight max-w-2xl">
              {t("hero.baseline")}
            </h1>
            <p className="mt-5 max-w-xl text-fg-muted text-base md:text-lg">
              {t("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-[4px] bg-accent px-6 font-bold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_12px_32px_-8px_rgba(56,189,248,0.55)]"
              >
                {t("hero.ctaPrimary")}
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-12 items-center justify-center rounded-[4px] border border-line bg-surface/40 px-6 text-fg transition-all duration-200 hover:-translate-y-0.5 hover:border-line-active"
              >
                {t("hero.ctaSecondary")}
              </a>
            </div>
          </div>
          <Radar />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="border-b border-line/60 py-2 text-center text-xs text-fg-muted">
          {t("hero.builtAt")}
        </p>

        {/* 2. Problem */}
        <section className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("problem.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {problems.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="card p-5 h-full">
                  <h3 className="font-bold mb-2">{p.title}</h3>
                  <p className="text-sm text-fg-muted">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 3. Solution — the 4 modules */}
        <section className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("solution.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map(({ icon: Icon, name, body }, i) => (
              <Reveal key={name} delay={i * 80}>
                <div className="card p-6 h-full">
                  <Icon className="text-accent mb-3" size={24} aria-hidden />
                  <h3 className="font-bold text-lg mb-2">{name}</h3>
                  <p className="text-sm text-fg-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 3.5 The challenge — flagship feature (EDTH: operating under jamming) */}
        <section className="py-16 md:py-28">
          <Reveal>
            <span className="inline-block border border-accent/40 bg-surface px-3 py-1.5 text-xs text-accent mb-6">
              {t("challenge.badge")}
            </span>
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              {t("challenge.title")}
            </h2>
            <p className="max-w-2xl text-fg-muted mb-10">
              {t("challenge.body")}
            </p>
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-3">
            <Reveal className="lg:col-span-2">
              <div className="card card-critical p-6 md:p-8 h-full">
                <LocateFixed className="text-critical mb-4" size={28} aria-hidden />
                <h3 className="font-bold text-xl mb-3">
                  {t("challenge.featureName")}
                </h3>
                <p className="text-fg-muted">{t("challenge.featureBody")}</p>
              </div>
            </Reveal>
            <div className="flex flex-col gap-4">
              {[t("challenge.s1"), t("challenge.s2"), t("challenge.s3")].map(
                (point, i) => (
                  <Reveal key={point} delay={i * 80} className="flex-1">
                    <div className="card p-5 h-full">
                      <p className="text-sm text-fg">{point}</p>
                    </div>
                  </Reveal>
                ),
              )}
            </div>
          </div>
        </section>

        {/* 4. How it works */}
        <section id="how" className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("how.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="flex items-start gap-4">
                  <span className="card flex h-12 w-12 shrink-0 items-center justify-center">
                    <Icon className="text-accent" size={20} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-bold">
                      <span className="tabular text-fg-muted mr-2">
                        {i + 1}.
                      </span>
                      {title}
                    </h3>
                    <p className="text-sm text-fg-muted mt-1">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 5. Proof */}
        <section className="py-16 md:py-28">
          <Reveal>
            <div className="card p-8 md:p-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-10">
                {t("proof.title")}
              </h2>
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <StatCount value={3} prefix="< " suffix=" s" />
                  <p className="text-sm text-fg-muted mt-2">
                    {t("proof.stat1Label")}
                  </p>
                </div>
                <div>
                  <StatCount value={2} prefix="< " suffix=" s" />
                  <p className="text-sm text-fg-muted mt-2">
                    {t("proof.stat2Label")}
                  </p>
                </div>
                <div>
                  <StatCount value={100} suffix=" %" />
                  <p className="text-sm text-fg-muted mt-2">
                    {t("proof.stat3Label")}
                  </p>
                </div>
              </div>
              <p className="mt-10 text-sm text-accent">{t("proof.note")}</p>
            </div>
          </Reveal>
        </section>

        {/* 6. Security by design */}
        <section id="security" className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("security.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {securityPoints.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="card p-5 h-full">
                  <Icon className="text-ok mb-3" size={20} aria-hidden />
                  <h3 className="font-bold mb-1">{title}</h3>
                  <p className="text-sm text-fg-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-xs text-fg-muted">
            {t("security.securityTxt")}
          </p>
        </section>

        {/* 7. Why */}
        <section className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-8">
              {t("why.title")}
            </h2>
          </Reveal>
          <ul className="space-y-3">
            {[t("why.p1"), t("why.p2"), t("why.p3")].map((point) => (
              <Reveal key={point}>
                <li className="border-l-2 border-accent pl-4 text-fg">
                  {point}
                </li>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* 8. Roadmap */}
        <section className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("roadmap.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {[t("roadmap.m1"), t("roadmap.m2"), t("roadmap.m3")].map(
              (milestone, i) => (
                <Reveal key={milestone} delay={i * 80}>
                  <div className="card p-5 h-full">
                    <span className="tabular text-accent font-bold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-fg mt-2">{milestone}</p>
                  </div>
                </Reveal>
              ),
            )}
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="py-16 md:py-28">
          <Reveal>
            <div className="card p-10 md:p-16 text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                {t("finalCta.title")}
              </h2>
              <Link
                href="/login"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[4px] bg-accent px-8 font-bold text-ink hover:bg-accent/85 transition-colors duration-150"
              >
                {t("finalCta.button")}
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter officialDomain={officialDomain} />
    </div>
  );
}
