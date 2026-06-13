import { z } from "zod";

/**
 * Two-stage aerial-threat ID: the on-device YOLO gives a fast box ("something
 * is airborne"); this asks Mistral's vision model (Pixtral Large) to identify
 * the EXACT system from the photo and return a matching technical datasheet.
 * Numbers are coerced leniently so a stray string from the model won't fail
 * the whole parse.
 */

export const AIRCRAFT_CATEGORIES = [
  "loitering_munition",
  "fpv_drone",
  "quadcopter_uas",
  "fixed_wing_uav",
  "cruise_missile",
  "helicopter",
  "combat_aircraft",
  "commercial_drone",
  "bird",
  "unknown",
] as const;
export type AircraftCategory = (typeof AIRCRAFT_CATEGORIES)[number];

export const THREAT_LEVELS = ["low", "medium", "high", "critical"] as const;

// client -> POST /api/sentinel/identify
export const IdentifyInputSchema = z.object({
  image: z.string().min(1).max(12_000_000), // data:image/jpeg;base64,...
  hint: z.string().max(64).optional(), // YOLO/COCO class from on-device pass
});

const numOrNull = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

const strOrNull = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
  z.string().max(300).nullable(),
);

export const AircraftIdSchema = z.object({
  identified: z.boolean().default(false),
  name: z.string().min(1).max(120),
  category: z.enum(AIRCRAFT_CATEGORIES).default("unknown"),
  confidence: numOrNull.transform((n) => (n == null ? 0 : Math.max(0, Math.min(1, n)))),
  manufacturer: strOrNull,
  origin: strOrNull,
  role: strOrNull,
  threat_level: z.enum(THREAT_LEVELS).default("medium"),
  specs: z
    .object({
      length_m: numOrNull,
      wingspan_m: numOrNull,
      max_speed_kph: numOrNull,
      range_km: numOrNull,
      endurance_min: numOrNull,
      payload_kg: numOrNull,
      warhead_kg: numOrNull,
      propulsion: strOrNull,
      guidance: strOrNull,
    })
    .default({}),
  visual_cues: z.array(z.string().max(160)).max(10).default([]),
  countermeasures: strOrNull,
  notes: strOrNull,
});
export type AircraftId = z.infer<typeof AircraftIdSchema>;

export const IDENTIFY_SYSTEM_PROMPT = [
  "You are an aerial-threat recognition analyst. From the photograph, identify the",
  "EXACT airborne system - prioritise military UAS, loitering munitions, cruise",
  "missiles, FPV and reconnaissance drones, helicopters and combat aircraft.",
  "Return ONLY a JSON object with these keys: identified (bool), name (specific",
  "designation, e.g. \"Shahed-136 / Geran-2\", \"Bayraktar TB2\", \"Lancet-3\",",
  "\"ZALA Orlan-10\", \"DJI Mavic 3\"; if unsure give the closest class like",
  `"Unidentified fixed-wing UAV"), category (one of: ${AIRCRAFT_CATEGORIES.join(", ")}),`,
  "confidence (0..1), manufacturer, origin (country/operator), role,",
  `threat_level (one of: ${THREAT_LEVELS.join(", ")}),`,
  "specs { length_m, wingspan_m, max_speed_kph, range_km, endurance_min,",
  "payload_kg, warhead_kg, propulsion, guidance },",
  "visual_cues (array of features visible in THIS photo that support the ID),",
  "countermeasures (short), notes. Use real published figures for known systems;",
  "use null for any value you cannot determine. Do not invent a designation you",
  "cannot support from the image - lower the confidence instead.",
].join(" ");
