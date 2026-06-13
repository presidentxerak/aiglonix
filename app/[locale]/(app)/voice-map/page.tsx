"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mic, MicOff, Loader2, MapPin, Send } from "lucide-react";
import { TacticalMap, type MapFocus } from "@/components/map/tactical-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SttController, type SttEngine, type SttState } from "@/lib/voice/stt";
import {
  ExtractedPlaceSchema,
  GeocodeResultSchema,
  type VoicePin,
  type VoiceAction,
} from "@/lib/voice/types";
import {
  type TacticalUnit,
  type Faction,
  type UnitType,
} from "@/lib/tactical/units";

const PARIS: [number, number] = [48.8566, 2.3522];

function factionFor(action: VoiceAction, unit: UnitType): Faction {
  if (unit === "jammer" || action === "contact" || action === "sighting")
    return "hostile";
  if (action === "hold" || action === "move") return "friendly";
  return "unknown";
}

// Live demo units so the map reads as a real-time tracking picture.
function seedUnits(center: [number, number]): TacticalUnit[] {
  const [lat, lng] = center;
  const old = Date.now() - 10 * 60 * 1000;
  const mk = (
    id: string,
    type: UnitType,
    faction: Faction,
    dLat: number,
    dLng: number,
    label: string,
    heading: number,
    speedKph: number,
    note: string,
  ): TacticalUnit => ({
    id,
    type,
    faction,
    lat: lat + dLat,
    lng: lng + dLng,
    label,
    heading,
    speedKph,
    note,
    at: old,
  });
  return [
    mk("u-drone", "drone", "hostile", 0.03, -0.02, "Recon drone, low altitude", 135, 65, "Bearing SE"),
    mk("u-tank", "tank", "hostile", -0.028, 0.032, "Armored column · 3 vehicles", 300, 28, "Advancing"),
    mk("u-troops", "troops", "friendly", 0.012, 0.04, "Friendly squad", 0, 0, "Static overwatch"),
    mk("u-sam", "missile", "hostile", -0.04, -0.03, "SAM site", 0, 0, "Air-defence threat"),
    mk("u-recon", "recon", "unknown", 0.045, 0.012, "Unidentified scout", 220, 45, "Track unconfirmed"),
  ];
}

export default function VoiceMapPage() {
  const t = useTranslations("voicemap");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [pins, setPins] = useState<VoicePin[]>([]);
  const [interim, setInterim] = useState("");
  const [sttState, setSttState] = useState<SttState>("idle");
  const [engine, setEngine] = useState<SttEngine | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manual, setManual] = useState("");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [units, setUnits] = useState<TacticalUnit[]>([]);
  const [showDemo, setShowDemo] = useState(true);

  const controllerRef = useRef<SttController | null>(null);
  const userPosRef = useRef<[number, number] | null>(null);
  userPosRef.current = userPos;

  // Live demo layer: seed tactical units and step their positions so the map
  // animates like a real tracking picture (radar-style position updates).
  useEffect(() => {
    if (!showDemo) {
      setUnits([]);
      return;
    }
    const c = userPosRef.current ?? PARIS;
    let arr = seedUnits(c);
    setUnits(arr);
    const id = window.setInterval(() => {
      arr = arr.map((u) => {
        if (!u.speedKph) return u;
        const stepKm = (u.speedKph * 1.5) / 3600;
        const h = ((u.heading ?? 0) * Math.PI) / 180;
        const nlat = u.lat + (stepKm / 111) * Math.cos(h);
        const nlng =
          u.lng + (stepKm / (111 * Math.cos((u.lat * Math.PI) / 180))) * Math.sin(h);
        let heading = u.heading ?? 0;
        if (Math.abs(nlat - c[0]) > 0.07) heading = (540 - heading) % 360;
        if (Math.abs(nlng - c[1]) > 0.07) heading = (360 - heading) % 360;
        return { ...u, lat: nlat, lng: nlng, heading };
      });
      setUnits(arr);
    }, 1500);
    return () => window.clearInterval(id);
  }, [showDemo, userPos]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => undefined,
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  // transcript → place (Mistral) → coordinates (Nominatim) → live marker
  const handleFinal = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;
      setProcessing(true);
      try {
        const exRes = await fetch("/api/voice/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });
        if (!exRes.ok) throw new Error("extract");
        const place = ExtractedPlaceSchema.parse(await exRes.json());

        const near = userPosRef.current;
        const geoRes = await fetch("/api/voice/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: place.landmark,
            near: near ? { lat: near[0], lng: near[1] } : undefined,
          }),
        });
        if (geoRes.status === 404) {
          toast.error(t("notFound", { place: place.landmark }));
          return;
        }
        if (!geoRes.ok) throw new Error("geocode");
        const geo = GeocodeResultSchema.parse(await geoRes.json());

        const pin: VoicePin = {
          id: crypto.randomUUID(),
          lat: geo.lat,
          lng: geo.lng,
          label: place.label,
          action: place.action,
          unit: place.unit,
          faction: factionFor(place.action, place.unit),
          transcript: text,
          display_name: geo.display_name,
          at: Date.now(),
        };
        setPins((prev) => [pin, ...prev].slice(0, 50));
        setFocus({ lat: pin.lat, lng: pin.lng, ts: pin.at });
        toast.success(t("dropped", { place: place.landmark }));
      } catch {
        toast.error(tCommon("errors.generic"));
      } finally {
        setProcessing(false);
      }
    },
    [t, tCommon],
  );

  const handleFinalRef = useRef(handleFinal);
  handleFinalRef.current = handleFinal;

  const startListening = useCallback(async () => {
    if (!controllerRef.current) {
      controllerRef.current = new SttController({
        onInterim: (text) => setInterim(text),
        onFinal: (text) => {
          setInterim("");
          void handleFinalRef.current(text);
        },
        onState: (state, eng) => {
          setSttState(state);
          setEngine(eng);
        },
        onError: (message) => {
          const messages: Record<string, string> = {
            unsupported: t("unsupported"),
            permission: t("micDenied"),
            network: t("sttNetwork"),
          };
          toast.error(messages[message] ?? tCommon("errors.generic"));
        },
      });
    }
    await controllerRef.current.start(locale);
  }, [locale, t, tCommon]);

  const stopListening = useCallback(() => {
    controllerRef.current?.stop();
    setInterim("");
  }, []);

  useEffect(() => () => controllerRef.current?.stop(), []);

  const listening = sttState === "listening" || sttState === "starting";

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-dvh">
      <div className="px-4 py-3 border-b border-line">
        <h1 className="font-bold text-lg">{t("title")}</h1>
        <p className="text-xs text-fg-muted">{t("hint")}</p>
        <p className="mt-1 text-xs text-accent">{t("tagline")}</p>
      </div>

      <div className="relative flex-1 min-h-[45vh]">
        <TacticalMap
          center={userPos ?? PARIS}
          zoom={12}
          pins={pins}
          units={units}
          focus={focus}
          className="absolute inset-0 z-0"
        />

        {/* Control panel overlay */}
        <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 md:inset-x-auto md:top-3 md:left-3 md:bottom-auto md:w-80">
          <div className="card p-4 space-y-3 bg-surface/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Button
                onClick={() =>
                  listening ? stopListening() : void startListening()
                }
                aria-pressed={listening}
                className={cn(
                  "flex-1 gap-2",
                  listening && "bg-critical hover:bg-critical/90",
                )}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
                {listening ? t("stop") : t("start")}
              </Button>
              {processing && (
                <Loader2
                  size={20}
                  className="animate-spin text-accent shrink-0"
                  aria-label={t("processing")}
                />
              )}
            </div>

            <div className="text-xs text-fg-muted flex items-center gap-2 min-h-4">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full",
                  listening ? "bg-critical status-pulse" : "bg-fg-muted/40",
                )}
              />
              {listening
                ? engine === "deepgram"
                  ? t("engine.deepgram")
                  : engine === "webspeech"
                    ? t("engine.webspeech")
                    : t("engine.starting")
                : t("idle")}
            </div>

            {(interim || listening) && (
              <p className="text-sm italic text-fg min-h-5">
                {interim || t("speakNow")}
              </p>
            )}

            {/* Type fallback - works even if the mic/STT is unavailable */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = manual.trim();
                if (!v) return;
                void handleFinal(v);
                setManual("");
              }}
              className="flex gap-2"
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={t("typePlaceholder")}
                aria-label={t("typePlaceholder")}
                className="flex-1 min-w-0 bg-raised border border-line rounded-[4px] px-2.5 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus:outline-none focus:border-line-active"
              />
              <Button
                type="submit"
                size="sm"
                disabled={processing || !manual.trim()}
                aria-label={t("send")}
                className="shrink-0"
              >
                <Send size={16} />
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              aria-pressed={showDemo}
              className="text-xs text-fg-muted hover:text-fg transition-colors cursor-pointer flex items-center gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full",
                  showDemo ? "bg-critical" : "bg-fg-muted/40",
                )}
              />
              {showDemo ? t("demo.on") : t("demo.off")}
            </button>

            {pins.length === 0 ? (
              <p className="text-xs text-fg-muted leading-relaxed">
                {t("example")}
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {pins.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setFocus({ lat: p.lat, lng: p.lng, ts: Date.now() })
                      }
                      className="w-full text-left flex items-start gap-2 text-xs hover:bg-raised rounded px-1.5 py-1 transition-colors cursor-pointer"
                    >
                      <MapPin
                        size={14}
                        className="text-accent mt-0.5 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-fg">
                          {p.label}
                        </span>
                        <span className="block truncate text-fg-muted">
                          {p.display_name}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
