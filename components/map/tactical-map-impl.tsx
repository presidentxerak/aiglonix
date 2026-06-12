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
  focus?: MapFocus | null;
  /** long-press on touch devices (Leaflet maps it to `contextmenu`) or double-click */
  onLongPress?: (lat: number, lng: number) => void;
  /** simple tap/click picker (manual positioning in Drone Sentinel) */
  onPick?: (lat: number, lng: number) => void;
  picked?: [number, number] | null;
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
    html: `<span class="relative block h-4 w-4">${ring}<span class="absolute inset-0 rounded-full border-2 border-critical bg-critical/40"></span></span>`,
  });
}

const pickIcon = L.divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<span class="block h-4 w-4 rounded-full border-2 border-accent bg-accent/40"></span>',
});

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
  focus,
  onLongPress,
  onPick,
  picked,
}: TacticalMapProps) {
  const locale = useLocale();
  const tJam = useTranslations("mapvision.popup");
  const tSentinel = useTranslations("sentinel");
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

      {picked && <Marker position={picked} icon={pickIcon} />}
    </MapContainer>
  );
}
