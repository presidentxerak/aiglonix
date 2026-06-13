import { NextResponse } from "next/server";
import {
  GeocodeInputSchema,
  GeocodeResultSchema,
  type GeocodeResult,
} from "@/lib/voice/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Geocode a place phrase via OpenStreetMap. Called server-side so we can set a
 * proper User-Agent and cache. Two providers, tried in order: Nominatim, then
 * Photon (Komoot) - Nominatim frequently blocks cloud/datacenter IPs, so the
 * Photon fallback keeps geocoding working in production. No API key required.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT = "AIGLONIX/1.0 (voice-to-map tactical tracking)";
const REFERER = "https://aiglonix.vercel.app";

type Near = { lat: number; lng: number } | undefined;

// Small in-memory cache (per server instance) - the providers ask for restraint.
const cache = new Map<string, GeocodeResult>();

function biasViewbox(lat: number, lng: number): string {
  const d = 0.55; // ~1.1° box around the centre to prefer nearby matches
  return `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=0`;
}

async function geocodeNominatim(
  query: string,
  near: Near,
): Promise<GeocodeResult | null> {
  try {
    const url =
      `${NOMINATIM}?format=jsonv2&limit=1&accept-language=en` +
      `&q=${encodeURIComponent(query)}` +
      (near ? biasViewbox(near.lat, near.lng) : "");
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: REFERER,
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first) return null;
    const row = first as { lat?: string; lon?: string; display_name?: string };
    const parsed = GeocodeResultSchema.safeParse({
      lat: Number(row.lat),
      lng: Number(row.lon),
      display_name: row.display_name ?? query,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function geocodePhoton(
  query: string,
  near: Near,
): Promise<GeocodeResult | null> {
  try {
    const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : "";
    const url = `${PHOTON}?limit=1&lang=en&q=${encodeURIComponent(query)}${bias}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: number[] };
        properties?: Record<string, unknown>;
      }[];
    };
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const p = f?.properties ?? {};
    const name = [p.name, p.city, p.state, p.country]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(", ");
    const parsed = GeocodeResultSchema.safeParse({
      lat: coords[1],
      lng: coords[0],
      display_name: name || query,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function geocode(query: string, near: Near): Promise<GeocodeResult | null> {
  return (
    (await geocodeNominatim(query, near)) ?? (await geocodePhoton(query, near))
  );
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

    const result = await geocode(query, near);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    cache.set(cacheKey, result);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
