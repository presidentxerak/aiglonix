import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_SEGMENTS = [
  "operation",
  "drone-sentinel",
  "map-vision",
  "ghost-signal",
];

function isProtected(pathname: string): boolean {
  // pathname is /<locale>/<segment>/... or /<segment>/...
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  const segment =
    first !== undefined && (routing.locales as readonly string[]).includes(first)
      ? parts[1]
      : first;
  return segment !== undefined && PROTECTED_SEGMENTS.includes(segment);
}

function localeOf(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return first !== undefined &&
    (routing.locales as readonly string[]).includes(first)
    ? first
    : routing.defaultLocale;
}

function isValidHttpUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith("http");
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // The middleware must NEVER take the whole app down with a 500
  // (MIDDLEWARE_INVOCATION_FAILED): every step fails open, and the pages
  // themselves degrade properly when auth is unavailable.
  let response: NextResponse;
  try {
    response = intlMiddleware(request);
  } catch {
    response = NextResponse.next();
  }

  // trim() guards against stray whitespace/newlines pasted into the
  // Vercel env var form — a malformed URL here must not crash the edge
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !isValidHttpUrl(url)) {
    return response;
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refreshes the session cookie if needed (httpOnly, via @supabase/ssr)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtected(request.nextUrl.pathname)) {
      const locale = localeOf(request.nextUrl.pathname);
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
  } catch {
    // Auth backend unreachable/misconfigured → serve the page anyway;
    // RLS still protects every row server-side.
    return response;
  }

  return response;
}

export const config = {
  // Skip API routes, static files and Next internals
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
