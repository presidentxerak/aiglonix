import { z } from "zod";
import { UNIT_TYPES, type UnitType, type Faction } from "@/lib/tactical/units";

/**
 * Voice-to-Map pipeline (challenge "Voice-to-Map: Real-Time Positional
 * Tracking"): spoken update → transcript (Deepgram / Web Speech) → structured
 * place + action (Mistral, heuristic fallback) → coordinates (Nominatim) →
 * live map marker. Every boundary is Zod-validated like the rest of the app.
 */

export const VOICE_ACTIONS = [
  "sighting",
  "move",
  "hold",
  "contact",
  "mark",
] as const;
export type VoiceAction = (typeof VOICE_ACTIONS)[number];

// client → POST /api/voice/extract
export const VoiceExtractInputSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
});
export type VoiceExtractInput = z.infer<typeof VoiceExtractInputSchema>;

// /api/voice/extract → client (also the exact shape Mistral must return)
export const ExtractedPlaceSchema = z.object({
  /** the geocodable place / landmark phrase pulled from the sentence */
  landmark: z.string().trim().min(1).max(160),
  action: z.enum(VOICE_ACTIONS),
  /** detected military unit type (drives the animated map icon) */
  unit: z.enum(UNIT_TYPES).default("unknown"),
  /** short human label for the marker */
  label: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1),
});
export type ExtractedPlace = z.infer<typeof ExtractedPlaceSchema>;

// client → POST /api/voice/geocode
export const GeocodeInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  /** optional bias toward the current map centre */
  near: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});
export type GeocodeInput = z.infer<typeof GeocodeInputSchema>;

export const GeocodeResultSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  display_name: z.string(),
  /** the recognised place name (e.g. "Stade de France") */
  name: z.string().optional(),
  /** OSM-derived category (e.g. "Stadium", "Monument", "Attraction") */
  category: z.string().optional(),
});
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

/** A marker produced by the voice pipeline (client session state). */
export interface VoicePin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  action: VoiceAction;
  unit: UnitType;
  faction: Faction;
  transcript: string;
  display_name: string;
  /** recognised place category (e.g. "Stadium") when known */
  category?: string;
  at: number;
}
