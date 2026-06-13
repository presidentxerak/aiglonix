import { NextResponse } from "next/server";
import { ManualAlertInputSchema } from "@/lib/schemas";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Manual alert creation. The alerts table has NO client insert policy:
 * this route is the only write path, after session check + rate limit +
 * Zod validation. Error responses are generic on purpose - internals are
 * never leaked.
 */
export async function POST(request: Request) {
  try {
    // 1. Session verified server-side BEFORE any logic
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit per user - anti feed-poisoning
    const allowed = await checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 3. Validation - nothing from the client is trusted
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = ManualAlertInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 4. Scope the alert to the caller's team (no-op until migration 002)
    let teamId: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      const tid = (prof as Record<string, unknown> | null)?.team_id;
      if (typeof tid === "string") teamId = tid;
    } catch {
      // teams migration not applied -> shared mode
    }

    // 5. Insert via service role (server only)
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("alerts").insert({
      kind: "manual",
      title: parsed.data.title,
      severity: parsed.data.severity,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      ...(teamId ? { team_id: teamId } : {}),
    });
    if (error) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
