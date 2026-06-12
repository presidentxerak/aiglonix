"use client";

import dynamic from "next/dynamic";

// Leaflet crashes under SSR — dynamic import with ssr:false is mandatory.
export const TacticalMap = dynamic(() => import("./tactical-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface border border-line animate-pulse" />
  ),
});

export type { MapFocus, TacticalMapProps } from "./tactical-map-impl";
