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
  const d = 0.25; // small box so it's a soft local preference, not an override
  return `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=0`;
}

// Only bias toward the user when the query does NOT name a place explicitly
// (a comma/number usually means an explicit address/city -> trust it globally).
function shouldBias(query: string): boolean {
  return !/[,\d]/.test(query);
}

// OSM top-level classes that represent recognisable places/landmarks.
const POI_CLASSES = new Set([
  "leisure",
  "tourism",
  "historic",
  "amenity",
  "building",
  "man_made",
  "aeroway",
  "military",
  "sport",
  "natural",
  "waterway",
  "railway",
]);

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

interface NomItem {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  importance?: number;
  name?: string;
  namedetails?: { name?: string };
}

// Rank by OSM importance + a bonus for being a named landmark/POI, so
// "Stade de France" lands on the stadium, not a same-named street.
function scoreNom(it: NomItem): number {
  const imp = typeof it.importance === "number" ? it.importance : 0;
  const poi = it.class && POI_CLASSES.has(it.class) ? 0.35 : 0;
  const named = it.name || it.namedetails?.name ? 0.1 : 0;
  return imp + poi + named;
}

async function geocodeNominatim(
  query: string,
  near: Near,
): Promise<GeocodeResult | null> {
  try {
    const url =
      `${NOMINATIM}?format=jsonv2&limit=8&addressdetails=1&namedetails=1&accept-language=en` +
      `&q=${encodeURIComponent(query)}` +
      (near && shouldBias(query) ? biasViewbox(near.lat, near.lng) : "");
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
    if (!Array.isArray(data) || data.length === 0) return null;
    const items = data as NomItem[];
    const best = items.reduce((a, b) => (scoreNom(b) > scoreNom(a) ? b : a));
    if (best.lat == null || best.lon == null) return null;
    const name =
      best.name ||
      best.namedetails?.name ||
      best.display_name?.split(",")[0]?.trim();
    const category = best.type
      ? titleCase(best.type)
      : best.class
        ? titleCase(best.class)
        : undefined;
    const parsed = GeocodeResultSchema.safeParse({
      lat: Number(best.lat),
      lng: Number(best.lon),
      display_name: best.display_name ?? query,
      name,
      category,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

function scorePhoton(f: PhotonFeature): number {
  const p = f.properties ?? {};
  const poi = p.osm_key && POI_CLASSES.has(p.osm_key) ? 0.35 : 0;
  const named = p.name ? 0.1 : 0;
  return poi + named;
}

async function geocodePhoton(
  query: string,
  near: Near,
): Promise<GeocodeResult | null> {
  try {
    const bias =
      near && shouldBias(query) ? `&lat=${near.lat}&lon=${near.lng}` : "";
    const url = `${PHOTON}?limit=8&lang=en&q=${encodeURIComponent(query)}${bias}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const feats = data.features ?? [];
    let best = feats[0];
    if (!best) return null;
    let bestScore = scorePhoton(best);
    for (const f of feats) {
      const s = scorePhoton(f);
      if (s > bestScore) {
        best = f;
        bestScore = s;
      }
    }
    const coords = best.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const p = best.properties ?? {};
    const display = [p.name, p.city, p.state, p.country]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(", ");
    const category = p.osm_value ? titleCase(p.osm_value) : undefined;
    const parsed = GeocodeResultSchema.safeParse({
      lat: coords[1],
      lng: coords[0],
      display_name: display || query,
      name: p.name,
      category,
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
