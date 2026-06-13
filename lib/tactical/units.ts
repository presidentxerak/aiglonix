/**
 * Tactical unit taxonomy for the map layer. Pure data (no Leaflet import) so
 * it can be shared by the voice pipeline and the live demo layer; the map impl
 * turns `glyph` into an animated Leaflet divIcon.
 */

export const UNIT_TYPES = [
  "drone",
  "missile",
  "tank",
  "troops",
  "aircraft",
  "jammer",
  "recon",
  "unknown",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const FACTIONS = ["hostile", "friendly", "unknown"] as const;
export type Faction = (typeof FACTIONS)[number];

export const FACTION_COLOR: Record<Faction, string> = {
  hostile: "#F43F5E",
  friendly: "#38BDF8",
  unknown: "#FACC15",
};

// 24×24 inner SVG markup per unit type (stroke/fill use currentColor).
export const UNIT_GLYPH: Record<UnitType, string> = {
  drone:
    '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 8l8 8M16 8l-8 8"/><circle cx="12" cy="12" r="2"/>',
  missile:
    '<path d="M12 2c2 2 3 5 3 9v7l-3 3-3-3v-7c0-4 1-7 3-9z"/><path d="M9 14l-3 4M15 14l3 4"/>',
  tank:
    '<rect x="3" y="13" width="14" height="5" rx="1"/><circle cx="6" cy="20" r="1.4"/><circle cx="10" cy="20" r="1.4"/><circle cx="14" cy="20" r="1.4"/><rect x="7" y="9" width="6" height="4" rx="1"/><path d="M13 11h8"/>',
  troops:
    '<circle cx="8" cy="7" r="2.2"/><circle cx="16" cy="7" r="2.2"/><path d="M4 19v-2a4 4 0 014-4M20 19v-2a4 4 0 00-4-4M12 19v-3a4 4 0 014-4"/>',
  aircraft:
    '<path d="M12 2l2 8 8 4v2l-8-1-1 6 2 2v1l-3-1-3 1v-1l2-2-1-6-8 1v-2l8-4 2-8z"/>',
  jammer:
    '<path d="M12 13v8M9 21h6"/><circle cx="12" cy="10" r="2"/><path d="M7 10a5 5 0 0110 0M4 10a8 8 0 0116 0"/>',
  recon:
    '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  unknown:
    '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5"/><path d="M12 16.5h.01"/>',
};

/** Map a spoken-update keyword to a unit type (heuristic + Mistral share this). */
export function unitFromText(text: string): UnitType {
  const t = text.toLowerCase();
  if (/\b(missile|rocket|rpg|ordnance|strike)\b|missile|roquette|frappe/.test(t))
    return "missile";
  if (/\b(drone|uav|quad|quadcopter)\b|drone/.test(t)) return "drone";
  if (/\b(tank|armou?r|apc|ifv|vehicle)\b|char|blind[ée]/.test(t)) return "tank";
  if (/\b(troops|infantry|soldiers|squad|platoon|dismounts)\b|troupes|infanterie|fantassins/.test(t))
    return "troops";
  if (/\b(jet|aircraft|plane|helicopter|chopper|heli)\b|avion|h[ée]licopt[èe]re/.test(t))
    return "aircraft";
  if (/\b(jammer|jamming|interference|ew)\b|brouill/.test(t)) return "jammer";
  if (/\b(recon|scout|observation|surveillance)\b|reconnaissance/.test(t))
    return "recon";
  return "unknown";
}

/** A unit rendered on the tactical map (voice-dropped or live demo). */
export interface TacticalUnit {
  id: string;
  type: UnitType;
  faction: Faction;
  lat: number;
  lng: number;
  label: string;
  heading?: number;
  speedKph?: number;
  note?: string;
  at: number;
}
