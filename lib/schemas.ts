import { z } from "zod";

/**
 * Single source of truth for every piece of data that crosses a boundary
 * (forms, API routes, Realtime payloads, IndexedDB outbox).
 * Nothing coming from outside the process is trusted before passing here.
 */

export const FREQ_BANDS = [
  "2.4GHz",
  "5.8GHz",
  "GPS_L1",
  "900MHz",
  "autre",
] as const;

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ALERT_KINDS = ["drone", "jammer", "manual"] as const;
export const DETECTION_STATUSES = [
  "active",
  "resolved",
  "false_positive",
] as const;

const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);

// ---------- Inputs (client → server) ----------

export const JammerReportInputSchema = z.object({
  lat: Lat,
  lng: Lng,
  freq_band: z.enum(FREQ_BANDS),
  strength: z.number().int().min(1).max(10),
  radius_m: z.number().int().min(50).max(10000),
});
export type JammerReportInput = z.infer<typeof JammerReportInputSchema>;

export const DetectionInputSchema = z.object({
  lat: Lat,
  lng: Lng,
  drone_type: z.string().min(1).max(64),
  confidence: z.number().min(0).max(1),
  image_url: z.string().max(512).nullable(),
});
export type DetectionInput = z.infer<typeof DetectionInputSchema>;

export const MessageInputSchema = z.object({
  client_id: z.string().uuid(),
  channel: z.string().min(1).max(64).default("ops"),
  body: z.string().min(1).max(2000),
  sent_at: z.string().datetime({ offset: true }),
});
export type MessageInput = z.infer<typeof MessageInputSchema>;

export const ManualAlertInputSchema = z.object({
  title: z.string().min(1).max(120),
  severity: z.enum(SEVERITIES),
  lat: Lat.optional(),
  lng: Lng.optional(),
});
export type ManualAlertInput = z.infer<typeof ManualAlertInputSchema>;

// ---------- Rows (database / Realtime → client) ----------

export const DetectionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  lat: Lat,
  lng: Lng,
  drone_type: z.string(),
  confidence: z.number(),
  image_url: z.string().nullable(),
  status: z.enum(DETECTION_STATUSES),
  created_at: z.string(),
});
export type DetectionRow = z.infer<typeof DetectionRowSchema>;

export const JammerReportRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  lat: Lat,
  lng: Lng,
  freq_band: z.enum(FREQ_BANDS),
  strength: z.number(),
  radius_m: z.number(),
  created_at: z.string(),
});
export type JammerReportRow = z.infer<typeof JammerReportRowSchema>;

export const MessageRowSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string(),
  user_id: z.string().uuid(),
  channel: z.string(),
  body: z.string(),
  sent_at: z.string(),
  created_at: z.string(),
});
export type MessageRow = z.infer<typeof MessageRowSchema>;

export const AlertRowSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(ALERT_KINDS),
  ref_id: z.string().uuid().nullable(),
  title: z.string(),
  severity: z.enum(SEVERITIES),
  lat: Lat.nullable(),
  lng: Lng.nullable(),
  created_at: z.string(),
});
export type AlertRow = z.infer<typeof AlertRowSchema>;

export const ProfileRowSchema = z.object({
  id: z.string().uuid(),
  callsign: z.string(),
  created_at: z.string(),
});
export type ProfileRow = z.infer<typeof ProfileRowSchema>;

// ---------- Offline outbox ----------

export const OutboxMessageSchema = z.object({
  kind: z.literal("message"),
  id: z.string().uuid(),
  payload: MessageInputSchema,
  /** team scoping (set only when the teams migration is applied) */
  team_id: z.string().uuid().nullable().optional(),
  queued_at: z.string(),
});

export const OutboxDetectionSchema = z.object({
  kind: z.literal("detection"),
  id: z.string().uuid(),
  payload: DetectionInputSchema,
  /** key of the image blob stored in IndexedDB, if any */
  image_key: z.string().nullable(),
  /** team scoping (set only when the teams migration is applied) */
  team_id: z.string().uuid().nullable().optional(),
  queued_at: z.string(),
});

export const OutboxItemSchema = z.discriminatedUnion("kind", [
  OutboxMessageSchema,
  OutboxDetectionSchema,
]);
export type OutboxItem = z.infer<typeof OutboxItemSchema>;
