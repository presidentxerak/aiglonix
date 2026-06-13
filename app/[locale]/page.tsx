import {
  LocateFixed,
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
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Radar } from "@/components/landing/radar";
import { Reveal } from "@/components/landing/reveal";
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
    { image: "/image-drone-sentinel.png", name: t("solution.sentinelName"), body: t("solution.sentinelBody") },
    { image: "/image-map-vision.png", name: t("solution.mapName"), body: t("solution.mapBody") },
    { image: "/image-operation.png", name: t("solution.operationName"), body: t("solution.operationBody") },
    { image: "/image-ghost-signal.png", name: t("solution.ghostName"), body: t("solution.ghostBody") },
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
          <span className="border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
            Beta
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-none btn-gradient text-white px-4 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(244,63,94,0.55)]"
          >
            {t("header.signIn")}
          </Link>
        </div>
      </header>

      {/* 1. Hero - full-bleed background video + overlay */}
      <section className="relative overflow-hidden border-b border-line/60">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        >
          <source src="/aiglonix-hero-video1.mp4" type="video/mp4" />
        </video>
        {/* keep text readable on the left, let the video breathe on the right,
            fade to the page colour at the bottom */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-base via-base/65 to-base/20"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-base via-base/15 to-transparent"
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
                className="inline-flex min-h-12 items-center justify-center rounded-none btn-gradient text-white px-6 font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.55)]"
              >
                {t("hero.ctaPrimary")}
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-12 items-center justify-center rounded-none border border-line bg-surface/40 px-6 text-fg transition-all duration-200 hover:-translate-y-0.5 hover:border-line-active"
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

        {/* 3. Solution - the 4 modules */}
        <section className="py-16 md:py-28">
          <Reveal>
            <h2 className="text-2xl md:text-4xl font-bold mb-10">
              {t("solution.title")}
            </h2>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map(({ image, name, body }, i) => (
              <Reveal key={name} delay={i * 80}>
                <div className="card h-full overflow-hidden">
                  <div className="relative h-48 w-full">
                    <Image
                      src={image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-2">{name}</h3>
                    <p className="text-sm text-fg-muted">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 3.5 The challenge - flagship feature (EDTH: operating under jamming) */}
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

        {/* 9. Final CTA */}
        <section className="py-16 md:py-28">
          <Reveal>
            <div className="card p-10 md:p-16 text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                {t("finalCta.title")}
              </h2>
              <Link
                href="/login"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-none btn-gradient text-white px-8 font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.55)]"
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
