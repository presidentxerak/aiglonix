import { NextResponse } from "next/server";
import {
  GeocodeInputSchema,
  GeocodeResultSchema,
  type GeocodeResult,
} from "@/lib/voice/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Geocode a place phrase via OpenStreetMap Nominatim. Called server-side so we
 * can attach a proper User-Agent (Nominatim policy) and cache results — never
 * from the browser. No API key required.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AIGLONIX/1.0 (voice-to-map tactical tracking)";

// Small in-memory cache (per server instance) — Nominatim asks for restraint.
const cache = new Map<string, GeocodeResult>();

function biasViewbox(lat: number, lng: number): string {
  // ~1.1° box around the centre, bounded, to prefer nearby matches.
  const d = 0.55;
  return `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=0`;
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await checkRateLimit(`voice:${user.id}`);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = GeocodeInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { query, near } = parsed.data;

    const cacheKey = near
      ? `${query}@${near.lat.toFixed(1)},${near.lng.toFixed(1)}`
      : query;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { status: 200 });

    const url =
      `${NOMINATIM}?format=jsonv2&limit=1&accept-language=en` +
      `&q=${encodeURIComponent(query)}` +
      (near ? biasViewbox(near.lat, near.lng) : "");

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Geocoder error" }, { status: 502 });
    }
    const data: unknown = await res.json();
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = first as { lat?: string; lon?: string; display_name?: string };
    const result = GeocodeResultSchema.safeParse({
      lat: Number(row.lat),
      lng: Number(row.lon),
      display_name: row.display_name ?? query,
    });
    if (!result.success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    cache.set(cacheKey, result.data);
    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
