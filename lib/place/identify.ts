import { z } from "zod";

/**
 * Recognise a place / landmark from a photo (Mistral vision), then geocode the
 * recognised name precisely. The model identifies WHAT it is; OpenStreetMap
 * gives the exact coordinates.
 */

export const PLACE_CATEGORIES = [
  "stadium",
  "monument",
  "landmark",
  "building",
  "bridge",
  "airport",
  "port",
  "military_site",
  "natural",
  "unknown",
] as const;

// client -> POST /api/place/identify
export const PlaceIdentifyInputSchema = z.object({
  image: z.string().min(1).max(12_000_000),
});

// model output (then enriched with geocoded coordinates by the route)
export const PlaceVisionSchema = z.object({
  identified: z.boolean().default(false),
  name: z.string().trim().min(1).max(160),
  category: z.enum(PLACE_CATEGORIES).default("unknown"),
  city: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().nullable(),
  ),
  country: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().nullable(),
  ),
  confidence: z.preprocess((v) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  }, z.number()),
});
export type PlaceVision = z.infer<typeof PlaceVisionSchema>;

// route response: vision result + precise coordinates (when geocoded)
export const PlaceIdSchema = PlaceVisionSchema.extend({
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  display_name: z.string().nullable(),
});
export type PlaceId = z.infer<typeof PlaceIdSchema>;

export const PLACE_SYSTEM_PROMPT = [
  "You identify the most likely real-world PLACE or LANDMARK shown in the photo",
  "(stadium, monument, famous building, bridge, airport, port, military site,",
  "natural feature). Return ONLY a JSON object with: identified (bool),",
  'name (the specific place name, e.g. "Eiffel Tower", "Stade de France",',
  '"Brooklyn Bridge"; if unsure, the closest description),',
  `category (one of: ${PLACE_CATEGORIES.join(", ")}),`,
  "city, country (best guess or null), confidence (0..1). If you cannot",
  "recognise a specific place, set identified=false and lower the confidence.",
  "Do not invent a name you cannot support from the image.",
].join(" ");
