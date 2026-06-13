"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mic, MicOff, Loader2, MapPin } from "lucide-react";
import { TacticalMap, type MapFocus } from "@/components/map/tactical-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SttController, type SttEngine, type SttState } from "@/lib/voice/stt";
import {
  ExtractedPlaceSchema,
  GeocodeResultSchema,
  type VoicePin,
} from "@/lib/voice/types";

const PARIS: [number, number] = [48.8566, 2.3522];

export default function VoiceMapPage() {
  const t = useTranslations("voicemap");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [pins, setPins] = useState<VoicePin[]>([]);
  const [interim, setInterim] = useState("");
  const [sttState, setSttState] = useState<SttState>("idle");
  const [engine, setEngine] = useState<SttEngine | null>(null);
  const [processing, setProcessing] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const controllerRef = useRef<SttController | null>(null);
  const userPosRef = useRef<[number, number] | null>(null);
  userPosRef.current = userPos;

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
          toast.error(
            message === "unsupported"
              ? t("unsupported")
              : tCommon("errors.generic"),
          );
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
      </div>

      <div className="relative flex-1 min-h-[45vh]">
        <TacticalMap
          center={userPos ?? PARIS}
          zoom={12}
          pins={pins}
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
