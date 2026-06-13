import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const supabaseWs = supabaseUrl.replace(/^https/, "wss");

// CSP notes:
// - 'wasm-unsafe-eval' is required by onnxruntime-web (in-browser inference).
// - 'unsafe-inline' on script-src is required by the Next.js App Router
//   bootstrap inline scripts (no nonce infrastructure in 48h scope).
// - challenges.cloudflare.com is Cloudflare Turnstile (anti-bot on auth).
// - basemaps.cartocdn.com serves the dark map tiles.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://*.basemaps.cartocdn.com ${supabaseUrl}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://challenges.cloudflare.com https://api.deepgram.com wss://api.deepgram.com`,
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // No middleware: on this Vercel account, ANY Edge middleware produces
  // MIDDLEWARE_INVOCATION_FAILED at runtime regardless of code simplicity
  // (same root cause and same fix as the nostradameme project). Locale
  // routing is handled by these static redirects; route protection is a
  // client-side guard + RLS + server-side session checks in API routes.
  // "/" is served by a real route (app/page.tsx) because config-level
  // redirects for the root are not honored on this Vercel project. The
  // remaining entries are convenience shortcuts for the unprefixed paths.
  async redirects() {
    return [
      {
        source:
          "/:segment(operation|drone-sentinel|map-vision|voice-map|ghost-signal|login)",
        destination: "/en/:segment",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
