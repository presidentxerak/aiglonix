import { z } from "zod";
import { FREQ_BANDS, SEVERITIES } from "@/lib/schemas";

/**
 * Payload that an external detection device / app pushes to
 * POST /api/connectors/ingest. One endpoint, three event kinds. The row is
 * scoped to the API key's team; detections and jammer reports also auto-create
 * an alert via the DB triggers, so the whole team sees them in real time.
 */
const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);

export const IngestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("detection"),
    lat: Lat,
    lng: Lng,
    drone_type: z.string().min(1).max(64),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("jammer"),
    lat: Lat,
    lng: Lng,
    freq_band: z.enum(FREQ_BANDS),
    strength: z.number().int().min(1).max(10),
    radius_m: z.number().int().min(50).max(10000).default(500),
  }),
  z.object({
    kind: z.literal("alert"),
    title: z.string().min(1).max(120),
    severity: z.enum(SEVERITIES),
    lat: Lat.optional(),
    lng: Lng.optional(),
  }),
]);
export type IngestPayload = z.infer<typeof IngestSchema>;
