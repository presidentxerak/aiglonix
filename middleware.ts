import { NextRequest, NextResponse } from "next/server";

/**
 * This middleware is structurally unable to throw: every dependency is
 * loaded via dynamic import INSIDE a try/catch (a module-init failure in a
 * library would otherwise produce MIDDLEWARE_INVOCATION_FAILED and take
 * down every route). Each step fails open — data is protected by RLS on
 * Supabase regardless, the middleware only provides locale routing and a
 * login redirect.
 */

const PROTECTED_SEGMENTS = [
  "operation",
  "drone-sentinel",
  "map-vision",
  "ghost-signal",
];

// Kept in sync with i18n/routing.ts (not imported here so that the
// middleware has zero static dependency that could fail at module init)
const LOCALES = ["en", "fr"];
const DEFAULT_LOCALE = "en";

type IntlHandler = (
  request: NextRequest,
) => NextResponse | Promise<NextResponse>;

let intlHandler: IntlHandler | null = null;

function isProtected(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  const segment =
    first !== undefined && LOCALES.includes(first) ? parts[1] : first;
  return segment !== undefined && PROTECTED_SEGMENTS.includes(segment);
}

function localeOf(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return first !== undefined && LOCALES.includes(first)
    ? first
    : DEFAULT_LOCALE;
}

function isValidHttpUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith("http");
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // 1. Locale routing (next-intl)
  let response: NextResponse | null = null;
  try {
    if (!intlHandler) {
      const [{ default: createMiddleware }, { routing }] = await Promise.all([
        import("next-intl/middleware"),
        import("./i18n/routing"),
      ]);
      intlHandler = createMiddleware(routing) as IntlHandler;
    }
    response = await intlHandler(request);
  } catch {
    response = null;
  }
  if (!response) response = NextResponse.next();

  // 2. Session refresh + route protection (Supabase) — optional layer
  // trim() guards against stray whitespace pasted into the Vercel env form
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !isValidHttpUrl(url)) {
    return response;
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response!.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtected(request.nextUrl.pathname)) {
      const locale = localeOf(request.nextUrl.pathname);
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
  } catch {
    // Auth backend unreachable/misconfigured → serve the page anyway
    return response;
  }

  return response;
}

export const config = {
  // Skip API routes, static files and Next internals
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
