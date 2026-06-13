"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import type { AircraftId } from "@/lib/sentinel/identify";
import { cn } from "@/lib/utils";

const THREAT_COLOR: Record<string, string> = {
  low: "text-medium border-medium/40",
  medium: "text-high border-high/40",
  high: "text-high border-high/50",
  critical: "text-critical border-critical/50",
};

/** Technical datasheet for the photographed aircraft (vision-model output). */
export function AircraftDatasheet({ data }: { data: AircraftId }) {
  const t = useTranslations("sentinel.datasheet");
  const s = data.specs;
  const rows: [string, string | null][] = [
    [t("manufacturer"), data.manufacturer],
    [t("origin"), data.origin],
    [t("role"), data.role],
    [t("length"), s.length_m != null ? `${s.length_m} m` : null],
    [t("wingspan"), s.wingspan_m != null ? `${s.wingspan_m} m` : null],
    [t("speed"), s.max_speed_kph != null ? `${s.max_speed_kph} km/h` : null],
    [t("range"), s.range_km != null ? `${s.range_km} km` : null],
    [t("endurance"), s.endurance_min != null ? `${s.endurance_min} min` : null],
    [t("payload"), s.payload_kg != null ? `${s.payload_kg} kg` : null],
    [t("warhead"), s.warhead_kg != null ? `${s.warhead_kg} kg` : null],
    [t("propulsion"), s.propulsion],
    [t("guidance"), s.guidance],
  ];
  const visible = rows.filter(([, v]) => v);

  return (
    <div
      className={cn(
        "card p-4 space-y-3",
        data.threat_level === "critical" && "card-critical",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-lg truncate">{data.name}</h2>
          <p className="text-xs text-fg-muted">
            {t("confidence")}: {Math.round(data.confidence * 100)}%
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-wide border px-2 py-1 inline-flex items-center gap-1",
            THREAT_COLOR[data.threat_level],
          )}
        >
          <ShieldAlert size={12} aria-hidden />
          {t(`threat.${data.threat_level}`)}
        </span>
      </div>

      {visible.length > 0 && (
        <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
          {visible.map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between gap-2 border-b border-line/40 pb-1"
            >
              <dt className="text-fg-muted">{k}</dt>
              <dd className="text-fg tabular text-right">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {data.visual_cues.length > 0 && (
        <div>
          <p className="text-xs font-bold text-fg-muted mb-1">{t("cues")}</p>
          <ul className="text-sm text-fg list-disc list-inside space-y-0.5">
            {data.visual_cues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {data.countermeasures && (
        <div>
          <p className="text-xs font-bold text-fg-muted mb-1">
            {t("countermeasures")}
          </p>
          <p className="text-sm text-fg">{data.countermeasures}</p>
        </div>
      )}

      {data.notes && <p className="text-xs text-fg-muted">{data.notes}</p>}
      <p className="text-[11px] text-fg-disabled">{t("disclaimer")}</p>
    </div>
  );
}
