"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  AlertRowSchema,
  DetectionRowSchema,
  JammerReportRowSchema,
  SEVERITIES,
  type AlertRow,
  type DetectionRow,
  type JammerReportRow,
} from "@/lib/schemas";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { estimateEmitters } from "@/lib/triangulation";
import { TacticalMap, type MapFocus } from "@/components/map/tactical-map";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { CountUp } from "@/components/ui/count-up";
import { cn, formatTime } from "@/lib/utils";

const PARIS: [number, number] = [48.8566, 2.3522];
const JAMMER_ACTIVE_MS = 30 * 60 * 1000;

export default function OperationPage() {
  const t = useTranslations("operation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [freshAlertIds, setFreshAlertIds] = useState<Set<string>>(new Set());
  const [detections, setDetections] = useState<DetectionRow[]>([]);
  const [jammers, setJammers] = useState<JammerReportRow[]>([]);
  const [operatorCount, setOperatorCount] = useState(1);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] =
    useState<(typeof SEVERITIES)[number]>("medium");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      toast.error(tCommon("errors.config"));
      return;
    }
    const supabase = getSupabaseBrowser();
    let cancelled = false;

    (async () => {
      try {
        const [alertsRes, detectionsRes, jammersRes] = await Promise.all([
          supabase
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("detections")
            .select("*")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("jammer_reports")
            .select("*")
            .gte(
              "created_at",
              new Date(Date.now() - JAMMER_ACTIVE_MS).toISOString(),
            )
            .limit(100),
        ]);
        if (cancelled) return;
        if (alertsRes.error || detectionsRes.error || jammersRes.error) {
          throw new Error("load failed");
        }
        setAlerts(parseRows(alertsRes.data, AlertRowSchema));
        setDetections(parseRows(detectionsRes.data, DetectionRowSchema));
        setJammers(parseRows(jammersRes.data, JammerReportRowSchema));
      } catch {
        if (!cancelled) toast.error(tCommon("errors.generic"));
      }
    })();

    const changes = supabase
      .channel("operation-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const parsed = AlertRowSchema.safeParse(payload.new);
          if (!parsed.success) return;
          const alert = parsed.data;
          setAlerts((prev) =>
            prev.some((a) => a.id === alert.id) ? prev : [alert, ...prev],
          );
          // Critical arrival sequence (§2.5 moment 2): flash once, then calm
          setFreshAlertIds((prev) => new Set(prev).add(alert.id));
          setTimeout(() => {
            setFreshAlertIds((prev) => {
              const next = new Set(prev);
              next.delete(alert.id);
              return next;
            });
          }, 1500);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "detections" },
        (payload) => {
          const parsed = DetectionRowSchema.safeParse(payload.new);
          if (parsed.success) {
            const d = parsed.data;
            setDetections((prev) =>
              prev.some((x) => x.id === d.id) ? prev : [d, ...prev],
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jammer_reports" },
        (payload) => {
          const parsed = JammerReportRowSchema.safeParse(payload.new);
          if (parsed.success) {
            const j = parsed.data;
            setJammers((prev) =>
              prev.some((x) => x.id === j.id) ? prev : [j, ...prev],
            );
          }
        },
      )
      .subscribe();

    // Operators online — Supabase Presence on the ops-room channel
    const presence = supabase.channel("ops-room", {
      config: { presence: { key: crypto.randomUUID() } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        setOperatorCount(Object.keys(presence.presenceState()).length || 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void presence.track({ at: Date.now() });
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(changes);
      void supabase.removeChannel(presence);
    };
  }, [tCommon]);

  const activeJammers = useMemo(() => {
    const cutoff = Date.now() - JAMMER_ACTIVE_MS;
    return jammers.filter((j) => new Date(j.created_at).getTime() >= cutoff);
  }, [jammers]);

  // Flagship EW feature: triangulated emitters from the active reports
  const emitters = useMemo(() => estimateEmitters(jammers), [jammers]);

  async function submitManualAlert() {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, severity }),
      });
      if (response.status === 429) {
        toast.error(t("manualAlert.rateLimited"));
        return;
      }
      if (!response.ok) throw new Error("failed");
      toast.success(t("manualAlert.success"));
      setTitle("");
      setFormOpen(false);
    } catch {
      toast.error(tCommon("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const counters = [
    { key: "drones", value: detections.length },
    { key: "jammers", value: activeJammers.length },
    { key: "emitters", value: emitters.length },
    { key: "operators", value: operatorCount },
  ] as const;

  return (
    <div className="flex flex-col lg:flex-row lg:h-dvh">
      {/* Map — 2/3 on desktop, 45vh on mobile */}
      <div className="relative h-[45vh] lg:h-auto lg:flex-[2] min-w-0">
        <TacticalMap
          center={PARIS}
          detections={detections}
          jammers={activeJammers}
          emitters={emitters}
          focus={focus}
          className="absolute inset-0 z-0"
        />
      </div>

      {/* Right column — counters + feed */}
      <div className="lg:flex-1 lg:max-w-md flex flex-col border-l border-line min-h-0">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
          <h1 className="font-bold text-lg">{t("title")}</h1>
          <Button size="sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={16} aria-hidden />
            {t("manualAlert.button")}
          </Button>
        </div>

        {formOpen && (
          <div className="card m-3 p-4 space-y-3">
            <div>
              <Label htmlFor="alert-title">{t("manualAlert.title")}</Label>
              <Input
                id="alert-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alert-severity">
                {t("manualAlert.severity")}
              </Label>
              <Select
                id="alert-severity"
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as (typeof SEVERITIES)[number])
                }
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {tCommon(`severity.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={busy || title.trim().length === 0}
              onClick={() => void submitManualAlert()}
            >
              {t("manualAlert.submit")}
            </Button>
          </div>
        )}

        {/* Counters — horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto px-3 py-3">
          {counters.map(({ key, value }) => (
            <div key={key} className="card px-4 py-3 min-w-32 flex-1">
              <CountUp
                value={value}
                className="block text-3xl md:text-4xl font-bold tabular"
              />
              <span className="text-xs text-fg-muted">
                {t(`counters.${key}`)}
              </span>
            </div>
          ))}
        </div>

        {/* Alert feed */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-48">
          <p className="text-xs text-fg-muted px-1">
            {t("feed.title")} — {t("feed.centerHint")}
          </p>
          {alerts.length === 0 && (
            <p className="text-sm text-fg-muted text-center py-10">
              {t("feed.empty")}
            </p>
          )}
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => {
                if (alert.lat !== null && alert.lng !== null) {
                  setFocus({ lat: alert.lat, lng: alert.lng, ts: Date.now() });
                }
              }}
              className={cn(
                "card w-full text-left px-3 py-2.5 cursor-pointer",
                alert.severity === "critical" && "card-critical",
                freshAlertIds.has(alert.id) && "feed-flash",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <SeverityBadge severity={alert.severity} />
                <span className="text-xs text-fg-disabled tabular">
                  {formatTime(alert.created_at, locale)}
                </span>
              </div>
              <p className="text-sm text-fg">{alert.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseRows<T>(
  rows: unknown[] | null,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T[] {
  return (rows ?? [])
    .map((row) => schema.safeParse(row))
    .filter(
      (r): r is { success: true; data: T } => r.success && r.data !== undefined,
    )
    .map((r) => r.data);
}
