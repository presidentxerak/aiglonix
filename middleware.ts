import { NextRequest, NextResponse } from "next/server";

/**
 * ZERO-DEPENDENCY middleware. After repeated MIDDLEWARE_INVOCATION_FAILED
 * on the Vercel Edge runtime with library imports (next-intl middleware,
 * @supabase/ssr), this middleware imports nothing but next/server: locale
 * detection and route protection are hand-rolled. There is no module that
 * can fail to load.
 *
 * Trade-offs, all acceptable:
 * - Locale negotiation: NEXT_LOCALE cookie, then Accept-Language, then en
 *   (same behavior next-intl's middleware provided).
 * - Route protection: presence of the Supabase auth cookie. A forged
 *   cookie only reaches an empty shell — every row is protected by RLS
 *   and every API route re-verifies the session server-side.
 * - Session refresh: handled by the Supabase browser client; API routes
 *   read the refreshed cookies.
 */

const LOCALES = ["en", "fr"] as const;
const DEFAULT_LOCALE = "en";
const PROTECTED_SEGMENTS = [
  "operation",
  "drone-sentinel",
  "map-vision",
  "ghost-signal",
];

function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) {
    return cookie;
  }
  const header = request.headers.get("accept-language") ?? "";
  const primary = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("fr")) return "fr";
  return DEFAULT_LOCALE;
}

function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.startsWith("sb-") &&
        c.name.includes("-auth-token") &&
        c.value.length > 0,
    );
}

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const parts = pathname.split("/").filter(Boolean);
    const first = parts[0];
    const hasLocale =
      first !== undefined && (LOCALES as readonly string[]).includes(first);

    // /foo → /en/foo (or /fr/foo) — locale prefix is mandatory
    if (!hasLocale) {
      const locale = detectLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(url);
    }

    // Protected app segments require a Supabase session cookie
    const segment = parts[1];
    if (
      segment !== undefined &&
      PROTECTED_SEGMENTS.includes(segment) &&
      !hasSupabaseSessionCookie(request)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${first}/login`;
      return NextResponse.redirect(url);
    }

    // Remember the visited locale for future negotiations
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", first, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    // Belt and braces: never take the app down from the middleware
    return NextResponse.next();
  }
}

export const config = {
  // Skip API routes, static files and Next internals
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
