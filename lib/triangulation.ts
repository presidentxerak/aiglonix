import { distanceMeters } from "@/lib/utils";
import type { JammerReportRow } from "@/lib/schemas";

/**
 * Flagship feature - EDTH challenge "operating under jamming" (EW).
 *
 * Collaborative jammer triangulation: every operator report is a noisy
 * range/power observation of the same emitter. With 3+ active reports of
 * the same band clustered in the same area, we estimate the emitter
 * position as the strength-weighted centroid (perceived strength grows
 * with proximity, so stronger reports pull the fix toward themselves) and
 * derive an honest uncertainty radius from the geometric spread.
 *
 * Deliberately pure and client-side: it runs identically on every device
 * from the same Realtime-shared rows, so the whole team sees the same fix
 * with zero extra backend - and it keeps working offline on cached data.
 * True RSSI multilateration with real RF sensors is the roadmap; the
 * operator-as-sensor model is what 48h of production code can prove.
 */

export const MIN_REPORTS_FOR_FIX = 3;
export const EMITTER_ACTIVE_WINDOW_MS = 30 * 60 * 1000;
const CLUSTER_RADIUS_M = 5000;
const MIN_UNCERTAINTY_M = 150;
const MAX_UNCERTAINTY_M = 4000;

export interface EstimatedEmitter {
  id: string;
  freq_band: JammerReportRow["freq_band"];
  lat: number;
  lng: number;
  uncertainty_m: number;
  /** 0..1 - grows with report count, shrinks with geometric dispersion */
  confidence: number;
  report_count: number;
  last_report_at: string;
}

interface Centroid {
  lat: number;
  lng: number;
}

function weightedCentroid(reports: JammerReportRow[]): Centroid {
  let sumW = 0;
  let lat = 0;
  let lng = 0;
  for (const r of reports) {
    // strength² : perceived power falls off sharply with distance, so a
    // strength-9 report is a much better proximity hint than a strength-3
    const w = r.strength * r.strength;
    sumW += w;
    lat += r.lat * w;
    lng += r.lng * w;
  }
  return { lat: lat / sumW, lng: lng / sumW };
}

export function estimateEmitters(
  reports: JammerReportRow[],
  now = Date.now(),
): EstimatedEmitter[] {
  const cutoff = now - EMITTER_ACTIVE_WINDOW_MS;
  const active = reports.filter(
    (r) => new Date(r.created_at).getTime() >= cutoff,
  );

  const byBand = new Map<JammerReportRow["freq_band"], JammerReportRow[]>();
  for (const r of active) {
    const group = byBand.get(r.freq_band);
    if (group) group.push(r);
    else byBand.set(r.freq_band, [r]);
  }

  const emitters: EstimatedEmitter[] = [];
  for (const [band, group] of byBand) {
    // greedy proximity clustering - areas of operation are small enough
    const clusters: JammerReportRow[][] = [];
    for (const report of group) {
      const host = clusters.find((cluster) => {
        const c = weightedCentroid(cluster);
        return (
          distanceMeters(c.lat, c.lng, report.lat, report.lng) <=
          CLUSTER_RADIUS_M
        );
      });
      if (host) host.push(report);
      else clusters.push([report]);
    }

    clusters.forEach((cluster, index) => {
      if (cluster.length < MIN_REPORTS_FOR_FIX) return;
      const center = weightedCentroid(cluster);

      // weighted RMS distance to the fix = honest uncertainty radius
      let sumW = 0;
      let sumSq = 0;
      for (const r of cluster) {
        const w = r.strength * r.strength;
        const d = distanceMeters(center.lat, center.lng, r.lat, r.lng);
        sumW += w;
        sumSq += w * d * d;
      }
      const rms = Math.sqrt(sumSq / sumW);
      const uncertainty = Math.min(
        MAX_UNCERTAINTY_M,
        Math.max(MIN_UNCERTAINTY_M, Math.round(rms)),
      );

      const countFactor = Math.min(1, cluster.length / 6);
      const tightness = Math.max(0.3, 1 - rms / MAX_UNCERTAINTY_M);
      const confidence = Math.min(
        0.95,
        Math.round((0.4 + 0.55 * countFactor * tightness) * 100) / 100,
      );

      const lastReportAt = cluster
        .map((r) => r.created_at)
        .sort()
        .at(-1);

      emitters.push({
        id: `${band}:${index}`,
        freq_band: band,
        lat: center.lat,
        lng: center.lng,
        uncertainty_m: uncertainty,
        confidence,
        report_count: cluster.length,
        last_report_at: lastReportAt ?? new Date(now).toISOString(),
      });
    });
  }

  return emitters.sort((a, b) => b.confidence - a.confidence);
}
