import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { IngestSchema } from "@/lib/connectors";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Device / external-app ingest endpoint. Authenticated with a team API key
 * (Authorization: Bearer aglx_... or x-api-key). The event is written via the
 * service role, scoped to the key's team. Detections and jammer reports trigger
 * the usual alert + Realtime fan-out, so connected sensors light up the team's
 * tactical picture exactly like in-app reports.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const key = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : (request.headers.get("x-api-key")?.trim() ?? "");
    if (!key) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const hash = createHash("sha256").update(key).digest("hex");
    const admin = getSupabaseAdmin();
    const { data: row, error: keyErr } = await admin
      .from("api_keys")
      .select("id, team_id, created_by, revoked_at")
      .eq("key_hash", hash)
      .maybeSingle();
    if (keyErr || !row || row.revoked_at) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (!(await checkRateLimit(`connector:${row.id as string}`))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = IngestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const p = parsed.data;
    const teamId = row.team_id as string;
    const userId = row.created_by as string | null;

    let id: string | undefined;
    if (p.kind === "detection") {
      const { data, error } = await admin
        .from("detections")
        .insert({
          team_id: teamId,
          user_id: userId,
          lat: p.lat,
          lng: p.lng,
          drone_type: p.drone_type,
          confidence: p.confidence,
          image_url: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      id = data?.id as string;
    } else if (p.kind === "jammer") {
      const { data, error } = await admin
        .from("jammer_reports")
        .insert({
          team_id: teamId,
          user_id: userId,
          lat: p.lat,
          lng: p.lng,
          freq_band: p.freq_band,
          strength: p.strength,
          radius_m: p.radius_m,
        })
        .select("id")
        .single();
      if (error) throw error;
      id = data?.id as string;
    } else {
      const { data, error } = await admin
        .from("alerts")
        .insert({
          team_id: teamId,
          kind: "manual",
          title: p.title,
          severity: p.severity,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      id = data?.id as string;
    }

    void admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id as string);

    return NextResponse.json({ ok: true, id, kind: p.kind }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
