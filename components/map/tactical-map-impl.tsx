"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import type { DetectionRow, JammerReportRow } from "@/lib/schemas";
import type { EstimatedEmitter } from "@/lib/triangulation";
import type { VoicePin } from "@/lib/voice/types";
import {
  UNIT_GLYPH,
  FACTION_COLOR,
  type TacticalUnit,
  type UnitType,
  type Faction,
} from "@/lib/tactical/units";
import { formatAge } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export interface MapFocus {
  lat: number;
  lng: number;
  /** change this value to re-trigger the flyTo */
  ts: number;
}

export interface TacticalMapProps {
  center: [number, number];
  zoom?: number;
  className?: string;
  jammers?: JammerReportRow[];
  detections?: DetectionRow[];
  /** triangulated jammer emitters (flagship EW feature) */
  emitters?: EstimatedEmitter[];
  focus?: MapFocus | null;
  /** long-press on touch devices (Leaflet maps it to `contextmenu`) or double-click */
  onLongPress?: (lat: number, lng: number) => void;
  /** simple tap/click picker (manual positioning in Drone Sentinel) */
  onPick?: (lat: number, lng: number) => void;
  picked?: [number, number] | null;
  /** markers dropped by the Voice-to-Map pipeline */
  pins?: VoicePin[];
  /** animated tactical units (live demo layer) */
  units?: TacticalUnit[];
}

function strengthColor(strength: number): string {
  if (strength <= 3) return "#FACC15";
  if (strength <= 7) return "#FB923C";
  return "#F43F5E";
}

function droneIcon(recent: boolean): L.DivIcon {
  const ring = recent
    ? '<span class="absolute -inset-2 rounded-full bg-critical/50 pulse-ring-continuous"></span>'
    : "";
  return L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<span class="relative block h-4 w-4">${ring}<span class="absolute inset-0 rounded-full border-2 border-critical grad-magenta"></span></span>`,
  });
}

function emitterIcon(recent: boolean): L.DivIcon {
  const ring = recent
    ? '<span class="absolute -inset-2 rounded-full bg-critical/40 pulse-ring"></span>'
    : "";
  // crosshair reticle - "the jamming zone becomes a target"
  const reticle =
    '<svg viewBox="0 0 24 24" class="absolute inset-0" fill="none" stroke="#F43F5E" stroke-width="2">' +
    '<circle cx="12" cy="12" r="7"/>' +
    '<line x1="12" y1="1" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="23"/>' +
    '<line x1="1" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="23" y2="12"/>' +
    '<circle cx="12" cy="12" r="1.5" fill="#F43F5E"/></svg>';
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<span class="relative block h-6 w-6">${ring}<span class="absolute inset-1 rounded-full grad-magenta" style="opacity:0.4"></span>${reticle}</span>`,
  });
}

const pickIcon = L.divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<span class="block h-4 w-4 rounded-full border-2 border-accent bg-accent/40"></span>',
});

// Animated, faction-coloured tactical unit marker (voice-dropped or live).
function unitIcon(
  type: UnitType,
  faction: Faction,
  opts: { recent: boolean },
): L.DivIcon {
  const color = FACTION_COLOR[faction];
  const glyph = UNIT_GLYPH[type];
  const threat =
    faction === "hostile"
      ? `<span class="absolute -inset-1 rounded-full unit-threat" style="background:${color}55"></span>`
      : "";
  const drop = opts.recent ? "unit-drop" : "";
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
    html:
      `<span class="relative block h-[30px] w-[30px] ${drop}">${threat}` +
      `<span class="absolute inset-0 unit-bob">` +
      `<span class="absolute inset-0 rounded-full unit-fill" style="border:2px solid ${color}"></span>` +
      `<svg viewBox="0 0 24 24" class="absolute inset-[5px] h-5 w-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>` +
      `</span></span>`,
  });
}

function InteractionHandler({
  onLongPress,
  onPick,
}: Pick<TacticalMapProps, "onLongPress" | "onPick">) {
  useMapEvents({
    contextmenu(e) {
      onLongPress?.(e.latlng.lat, e.latlng.lng);
    },
    dblclick(e) {
      onLongPress?.(e.latlng.lat, e.latlng.lng);
    },
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FocusHandler({ focus }: { focus?: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
    }
  }, [focus, map]);
  return null;
}

export default function TacticalMapImpl({
  center,
  zoom = 12,
  className,
  jammers = [],
  detections = [],
  emitters = [],
  focus,
  onLongPress,
  onPick,
  picked,
  pins = [],
  units = [],
}: TacticalMapProps) {
  const locale = useLocale();
  const tJam = useTranslations("mapvision.popup");
  const tEmitter = useTranslations("mapvision.emitter");
  const tSentinel = useTranslations("sentinel");
  const tVoice = useTranslations("voicemap");
  const now = Date.now();

  const recentThreshold = useMemo(() => now - 5 * 60 * 1000, [now]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      doubleClickZoom={!onLongPress}
      className={className ?? "h-full w-full"}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <ZoomControl position="bottomright" />
      <InteractionHandler onLongPress={onLongPress} onPick={onPick} />
      <FocusHandler focus={focus} />

      {jammers.map((j) => (
        <Circle
          key={j.id}
          center={[j.lat, j.lng]}
          radius={j.radius_m}
          pathOptions={{
            color: strengthColor(j.strength),
            fillColor: strengthColor(j.strength),
            fillOpacity: 0.25,
            weight: 1.5,
          }}
        >
          <Popup>
            <div className="text-sm tabular">
              <p className="font-bold">
                {tJam("band")}: {j.freq_band}
              </p>
              <p>
                {tJam("strength")}: {j.strength}/10
              </p>
              <p className="text-fg-muted">
                {tJam("reported")} {formatAge(j.created_at, locale)}
              </p>
            </div>
          </Popup>
        </Circle>
      ))}

      {emitters.map((e) => (
        <Circle
          key={`zone-${e.id}`}
          center={[e.lat, e.lng]}
          radius={e.uncertainty_m}
          pathOptions={{
            color: "#F43F5E",
            dashArray: "6 6",
            weight: 2,
            fillColor: "#F43F5E",
            fillOpacity: 0.06,
          }}
        />
      ))}
      {emitters.map((e) => (
        <Marker
          key={e.id}
          position={[e.lat, e.lng]}
          icon={emitterIcon(
            new Date(e.last_report_at).getTime() > now - 2 * 60 * 1000,
          )}
        >
          <Popup>
            <div className="text-sm tabular">
              <p className="font-bold text-critical">
                ◎ {tEmitter("title")} - {e.freq_band}
              </p>
              <p>{tEmitter("reports", { count: e.report_count })}</p>
              <p>{tEmitter("uncertainty", { m: e.uncertainty_m })}</p>
              <p>
                {tEmitter("confidence")}: {Math.round(e.confidence * 100)}%
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {detections.map((d) => (
        <Marker
          key={d.id}
          position={[d.lat, d.lng]}
          icon={droneIcon(new Date(d.created_at).getTime() > recentThreshold)}
        >
          <Popup>
            <div className="text-sm tabular">
              <p className="font-bold">{d.drone_type}</p>
              <p>
                {tSentinel("confidence")}: {Math.round(d.confidence * 100)}%
              </p>
              <p className="text-fg-muted">{formatAge(d.created_at, locale)}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {units.map((u) => (
        <Marker
          key={u.id}
          position={[u.lat, u.lng]}
          icon={unitIcon(u.type, u.faction, {
            recent: u.at > now - 60 * 1000,
          })}
        >
          <Popup>
            <div className="text-sm tabular space-y-0.5">
              <p
                className="font-bold"
                style={{ color: FACTION_COLOR[u.faction] }}
              >
                {tVoice(`units.${u.type}`)} - {tVoice(`faction.${u.faction}`)}
              </p>
              <p className="text-fg">{u.label}</p>
              {typeof u.speedKph === "number" && (
                <p className="text-fg-muted text-xs">
                  {tVoice("unit.speed")}: {Math.round(u.speedKph)} km/h
                  {typeof u.heading === "number"
                    ? ` · ${tVoice("unit.heading")} ${Math.round(u.heading)}°`
                    : ""}
                </p>
              )}
              {u.note && <p className="text-fg-muted text-xs">{u.note}</p>}
              <p className="text-fg-muted text-xs">
                {u.lat.toFixed(4)}, {u.lng.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={unitIcon(p.unit, p.faction, { recent: p.at > now - 60 * 1000 })}
        >
          <Popup>
            <div className="text-sm">
              <p
                className="font-bold"
                style={{ color: FACTION_COLOR[p.faction] }}
              >
                {tVoice(`units.${p.unit}`)} · {tVoice(`actions.${p.action}`)}
              </p>
              <p>{p.label}</p>
              <p className="text-fg-muted text-xs">{p.display_name}</p>
              <p className="text-fg-muted text-xs italic">
                {tVoice("pin.heard")}: “{p.transcript}”
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {picked && <Marker position={picked} icon={pickIcon} />}
    </MapContainer>
  );
}
