import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics — booleans only, no secret values ever leave the
 * server. Open /api/health in a browser to check that the deployment is
 * live and which env vars the runtime actually sees.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      supabaseAnonKey: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
      ),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()),
      upstash: Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim() &&
          process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
      ),
    },
  });
}
