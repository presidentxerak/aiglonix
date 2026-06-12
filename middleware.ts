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

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Environment not configured yet — never crash the edge runtime.
    return response;
  }

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

  // Refreshes the session cookie if needed (httpOnly, managed by @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const parts = request.nextUrl.pathname.split("/").filter(Boolean);
    const first = parts[0];
    const locale =
      first !== undefined &&
      (routing.locales as readonly string[]).includes(first)
        ? first
        : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Skip API routes, static files and Next internals
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
