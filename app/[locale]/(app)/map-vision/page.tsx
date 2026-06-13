"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  JammerReportInputSchema,
  JammerReportRowSchema,
  FREQ_BANDS,
  type JammerReportRow,
} from "@/lib/schemas";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { useTeam } from "@/lib/team/context";
import { estimateEmitters } from "@/lib/triangulation";
import { TacticalMap } from "@/components/map/tactical-map";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { distanceMeters } from "@/lib/utils";

const PARIS: [number, number] = [48.8566, 2.3522];
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

interface DraftReport {
  lat: number;
  lng: number;
}

export default function MapVisionPage() {
  const t = useTranslations("mapvision");
  const tCommon = useTranslations("common");
  const { teamId } = useTeam();
  const [jammers, setJammers] = useState<JammerReportRow[]>([]);
  const [draft, setDraft] = useState<DraftReport | null>(null);
  const [band, setBand] = useState<(typeof FREQ_BANDS)[number]>("2.4GHz");
  const [strength, setStrength] = useState(5);
  const [radius, setRadius] = useState(500);
  const [busy, setBusy] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Initial load + Realtime subscription - always in an effect with cleanup
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      toast.error(tCommon("errors.config"));
      return;
    }
    const supabase = getSupabaseBrowser();
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("jammer_reports")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? [])
          .map((row: unknown) => JammerReportRowSchema.safeParse(row))
          .filter((r) => r.success)
          .map((r) => r.data);
        setJammers(rows);
      } catch {
        if (!cancelled) toast.error(tCommon("errors.generic"));
      }
    })();

    const channel = supabase
      .channel("jammer-reports-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jammer_reports" },
        (payload) => {
          const parsed = JammerReportRowSchema.safeParse(payload.new);
          if (parsed.success) {
            setJammers((prev) =>
              prev.some((j) => j.id === parsed.data.id)
                ? prev
                : [parsed.data, ...prev],
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tCommon]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => undefined,
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const handleLongPress = useCallback((lat: number, lng: number) => {
    setDraft({ lat, lng });
  }, []);

  // Flagship EW feature: 3+ active reports of a band → triangulated emitter
  const emitters = useMemo(() => estimateEmitters(jammers), [jammers]);
  const bestFix = emitters[0];

  // Frequency recommendation (§6): active 2.4GHz report near the user
  const showRecommendation = useMemo(() => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    return jammers.some((j) => {
      if (j.freq_band !== "2.4GHz") return false;
      if (new Date(j.created_at).getTime() < cutoff) return false;
      if (!userPos) return true; // no position → warn on any active report
      return (
        distanceMeters(userPos[0], userPos[1], j.lat, j.lng) <
        j.radius_m + 5000
      );
    });
  }, [jammers, userPos]);

  async function publishReport() {
    if (!draft) return;
    const parsed = JammerReportInputSchema.safeParse({
      lat: draft.lat,
      lng: draft.lng,
      freq_band: band,
      strength,
      radius_m: radius,
    });
    if (!parsed.success) {
      toast.error(tCommon("errors.generic"));
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");
      const { error } = await supabase
        .from("jammer_reports")
        .insert({
          ...parsed.data,
          user_id: user.id,
          ...(teamId ? { team_id: teamId } : {}),
        });
      if (error) throw error;
      toast.success(t("published"));
      setDraft(null);
    } catch {
      toast.error(tCommon("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-dvh">
      <div className="px-4 py-3 border-b border-line">
        <h1 className="font-bold text-lg">{t("title")}</h1>
        <p className="text-xs text-fg-muted">{t("hint")}</p>
      </div>

      {bestFix && (
        <div
          role="alert"
          className="banner-slide alert-gradient bg-surface border-y border-critical/40 px-4 py-2 text-sm font-bold text-critical"
        >
          {t("emitter.banner", {
            band: bestFix.freq_band,
            m: bestFix.uncertainty_m,
          })}
        </div>
      )}

      {showRecommendation && (
        <div
          role="alert"
          className="banner-slide bg-surface border-y border-high/40 px-4 py-2 text-sm text-high"
        >
          {t("recommendation")}
        </div>
      )}

      <div className="relative flex-1 min-h-[45vh]">
        <TacticalMap
          center={userPos ?? PARIS}
          jammers={jammers}
          emitters={emitters}
          onLongPress={handleLongPress}
          className="absolute inset-0 z-0"
        />

        {draft && (
          <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 md:p-4 md:max-w-md">
            <div className="card p-4 md:p-5 space-y-3 bg-surface/95 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{t("form.title")}</h2>
                <span className="text-xs text-fg-muted tabular">
                  {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                </span>
              </div>
              <div>
                <Label htmlFor="band">{t("form.band")}</Label>
                <Select
                  id="band"
                  value={band}
                  onChange={(e) =>
                    setBand(e.target.value as (typeof FREQ_BANDS)[number])
                  }
                >
                  {FREQ_BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="strength">
                  {t("form.strength")} -{" "}
                  <span className="tabular text-fg">{strength}</span>
                </Label>
                <input
                  id="strength"
                  type="range"
                  min={1}
                  max={10}
                  value={strength}
                  onChange={(e) => setStrength(Number(e.target.value))}
                  className="w-full accent-(--color-accent) min-h-11"
                />
              </div>
              <div>
                <Label htmlFor="radius">{t("form.radius")}</Label>
                <Input
                  id="radius"
                  type="number"
                  min={50}
                  max={10000}
                  step={50}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setDraft(null)}
                >
                  {tCommon("actions.cancel")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void publishReport()}
                >
                  {t("form.submit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
