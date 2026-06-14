import { GeocodeResultSchema, type GeocodeResult } from "@/lib/voice/types";

/**
 * Shared, landmark-aware geocoding (server-only). OpenStreetMap via Nominatim
 * then Photon (Komoot) as a fallback. `geocodePlace` returns the single best
 * match; `searchPlaces` returns ranked candidates for autocomplete. No API key.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT = "AIGLONIX/1.0 (tactical place recognition)";
const REFERER = "https://aiglonix.vercel.app";

export type Near = { lat: number; lng: number } | undefined;

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

function biasViewbox(lat: number, lng: number): string {
  const d = 0.25;
  return `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=0`;
}

// Skip the local bias when the query names a place explicitly (comma/number).
function shouldBias(query: string): boolean {
  return !/[,\d]/.test(query);
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

function scoreNom(it: NomItem): number {
  const imp = typeof it.importance === "number" ? it.importance : 0;
  const poi = it.class && POI_CLASSES.has(it.class) ? 0.35 : 0;
  const named = it.name || it.namedetails?.name ? 0.1 : 0;
  return imp + poi + named;
}

function nomToResult(it: NomItem): GeocodeResult | null {
  if (it.lat == null || it.lon == null) return null;
  const parsed = GeocodeResultSchema.safeParse({
    lat: Number(it.lat),
    lng: Number(it.lon),
    display_name: it.display_name ?? "",
    name:
      it.name || it.namedetails?.name || it.display_name?.split(",")[0]?.trim(),
    category: it.type
      ? titleCase(it.type)
      : it.class
        ? titleCase(it.class)
        : undefined,
  });
  return parsed.success ? parsed.data : null;
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

function photonToResult(f: PhotonFeature): GeocodeResult | null {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const p = f.properties ?? {};
  const display = [p.name, p.city, p.state, p.country]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(", ");
  const parsed = GeocodeResultSchema.safeParse({
    lat: coords[1],
    lng: coords[0],
    display_name: display,
    name: p.name,
    category: p.osm_value ? titleCase(p.osm_value) : undefined,
  });
  return parsed.success ? parsed.data : null;
}

async function nominatim(query: string, near: Near): Promise<NomItem[]> {
  const url =
    `${NOMINATIM}?format=jsonv2&limit=8&addressdetails=1&namedetails=1&accept-language=en` +
    `&q=${encodeURIComponent(query)}` +
    (near && shouldBias(query) ? biasViewbox(near.lat, near.lng) : "");
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", Referer: REFERER },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as NomItem[]) : [];
}

async function photon(query: string, near: Near): Promise<PhotonFeature[]> {
  const bias = near && shouldBias(query) ? `&lat=${near.lat}&lon=${near.lng}` : "";
  const url = `${PHOTON}?limit=8&lang=en&q=${encodeURIComponent(query)}${bias}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return data.features ?? [];
}

/** Single best landmark match. */
export async function geocodePlace(
  query: string,
  near?: Near,
): Promise<GeocodeResult | null> {
  try {
    const items = await nominatim(query, near);
    if (items.length > 0) {
      const best = items.reduce((a, b) => (scoreNom(b) > scoreNom(a) ? b : a));
      const r = nomToResult(best);
      if (r) return r;
    }
  } catch {
    /* fall through to Photon */
  }
  try {
    const feats = await photon(query, near);
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
    return photonToResult(best);
  } catch {
    return null;
  }
}

/** Ranked candidates for autocomplete (deduped, capped). */
export async function searchPlaces(
  query: string,
  near: Near,
  limit = 5,
): Promise<GeocodeResult[]> {
  try {
    const feats = await photon(query, near);
    const ranked = feats
      .map((f) => ({ f, s: scorePhoton(f) }))
      .sort((a, b) => b.s - a.s)
      .map(({ f }) => photonToResult(f))
      .filter((r): r is GeocodeResult => r !== null);
    const seen = new Set<string>();
    const out: GeocodeResult[] = [];
    for (const r of ranked) {
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
