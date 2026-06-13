import { VOICE_ACTIONS, type ExtractedPlace, type VoiceAction } from "./types";
import { UNIT_TYPES, unitFromText } from "@/lib/tactical/units";

/**
 * Deterministic extractor used as the fallback when MISTRAL_API_KEY is not
 * configured (the app must keep working with zero external keys — same
 * philosophy as the in-memory rate-limit fallback). Pure and side-effect free.
 */

const ACTION_HINTS: Record<VoiceAction, readonly string[]> = {
  sighting: [
    "spotted", "sighted", "seen", "see ", "detected", "drone", "uav",
    "aperçu", "repéré", "vu ", "détecté", "drone",
  ],
  contact: [
    "contact", "enemy", "hostile", "engaged", "engaging", "taking fire",
    "ennemi", "hostile", "engagé", "tir",
  ],
  move: [
    "moving", "move", "heading", "en route", "advancing", "go to", "proceed",
    "vers", "se dirige", "avance", "déplace", "route",
  ],
  hold: [
    "hold", "holding", "stay", "secure", "securing", "position",
    "tiens", "maintien", "sécurise", "tenir",
  ],
  mark: ["mark", "waypoint", "note", "marque", "repère", "point"],
};

// Capture whatever follows a locative preposition — that's the place phrase.
// Anchored on whitespace/start (not \b) so accented FR prepositions (à, près
// de) match — \b forms no boundary before non-ASCII letters.
const NEAR_RE =
  /(?:^|\s)(?:near|next to|at|by|around|on|in|over|outside|toward|towards|à|au|aux|près de|proche de|sur|dans|vers|devant|derrière)\s+(.+)$/i;

const LEADING_FILLER_RE =
  /^(?:the|a|an|le|la|les|l'|un|une|des|du)\s+/i;

function pickAction(lower: string): VoiceAction {
  for (const action of VOICE_ACTIONS) {
    if (ACTION_HINTS[action].some((h) => lower.includes(h))) return action;
  }
  return "mark";
}

function cleanPlace(raw: string): string {
  return raw
    .replace(/[.,;!?]+$/g, "")
    .replace(/\b(?:over|out|copy|please|now)\b\.?$/i, "")
    .trim();
}

export function heuristicExtract(transcript: string): ExtractedPlace {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const action = pickAction(lower);

  const m = text.match(NEAR_RE);
  const captured = m?.[1];
  let landmark = captured ? cleanPlace(captured) : "";

  // No locative preposition: fall back to the tail after the filler words.
  if (!landmark) landmark = cleanPlace(text.replace(LEADING_FILLER_RE, ""));
  if (!landmark) landmark = text;

  return {
    landmark,
    action,
    unit: unitFromText(text),
    label: text.length <= 80 ? text : `${text.slice(0, 77)}…`,
    confidence: m ? 0.6 : 0.4,
  };
}

/** System prompt for the Mistral path — kept next to the fallback it mirrors. */
export const EXTRACT_SYSTEM_PROMPT = [
  "You extract a single geocodable location from a short spoken radio update.",
  "Return ONLY a JSON object with keys:",
  '"landmark" (the place/landmark to geocode, no leading article),',
  `"action" (one of: ${VOICE_ACTIONS.join(", ")}),`,
  `"unit" (the military unit mentioned, one of: ${UNIT_TYPES.join(", ")}; use "unknown" if none),`,
  '"label" (a concise marker label, <= 80 chars),',
  '"confidence" (0..1, how sure you are about the landmark).',
  "If no place is mentioned, set landmark to the most location-like noun phrase.",
  "Do not add commentary.",
].join(" ");
