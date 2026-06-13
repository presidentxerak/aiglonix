"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, MapPin, Upload } from "lucide-react";
import { loadDetector, runDetection, type Detection } from "@/lib/onnx/detector";
import {
  preprocessImage,
  recompressForUpload,
  sniffImageType,
} from "@/lib/onnx/preprocess";
import { DetectionInputSchema } from "@/lib/schemas";
import { syncManager } from "@/lib/offline/sync";
import { saveBlob } from "@/lib/offline/queue";
import { TacticalMap } from "@/components/map/tactical-map";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/components/shell/network-provider";
import { useTeam } from "@/lib/team/context";
import { DetectionOverlay } from "@/components/detection/detection-overlay";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const PARIS: [number, number] = [48.8566, 2.3522];

type ModelState =
  | { status: "loading"; progress: number }
  | { status: "ready" }
  | { status: "error" };

type Phase = "idle" | "ready" | "analyzing" | "done";

export default function DroneSentinelPage() {
  const t = useTranslations("sentinel");
  const tCommon = useTranslations("common");
  const { online } = useNetwork();
  const { teamId } = useTeam();
  const [model, setModel] = useState<ModelState>({
    status: "loading",
    progress: 0,
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDetector((loaded, total) => {
      if (!cancelled && total > 0) {
        setModel({ status: "loading", progress: loaded / total });
      }
    })
      .then(() => {
        if (!cancelled) setModel({ status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setModel({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t("fileErrors.tooLarge"));
      return;
    }
    // Real type via magic bytes - the extension is never trusted (§2.7.6)
    const type = await sniffImageType(file);
    if (!type) {
      toast.error(t("fileErrors.badType"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setDetections([]);
      setPosition(null);
      setPhase("ready");
      void analyze(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error(t("fileErrors.badType"));
    };
    image.src = url;
  }

  async function analyze(image: HTMLImageElement) {
    setPhase("analyzing");
    try {
      const preprocessed = preprocessImage(image);
      const results = await runDetection(preprocessed);
      setDetections(results);
      setPhase("done");
    } catch {
      setPhase("ready");
      toast.error(
        model.status === "error" ? t("modelError") : tCommon("errors.generic"),
      );
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setShowPicker(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setShowPicker(false);
      },
      // GPS denied/unavailable → always a fallback: manual map pick
      () => setShowPicker(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function publish() {
    const image = imageRef.current;
    const best = detections[0];
    if (!image || !best || !position) return;

    const payload = DetectionInputSchema.safeParse({
      lat: position[0],
      lng: position[1],
      drone_type: best.className,
      confidence: best.confidence,
      image_url: null,
    });
    if (!payload.success) {
      toast.error(tCommon("errors.generic"));
      return;
    }

    setPublishing(true);
    try {
      const id = crypto.randomUUID();
      // Canvas re-encode destroys EXIF (incl. GPS) before anything leaves
      // the device - OPSEC requirement §2.7.6
      const blob = await recompressForUpload(image);
      const imageKey = `img:${id}`;
      await saveBlob(imageKey, blob);
      await syncManager.submit({
        kind: "detection",
        id,
        payload: payload.data,
        image_key: imageKey,
        team_id: teamId,
        queued_at: new Date().toISOString(),
      });
      toast.success(online ? t("published") : t("queued"));
      setPhase("idle");
      setImageSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setDetections([]);
      setPosition(null);
      setShowPicker(false);
    } catch {
      toast.error(tCommon("errors.generic"));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
      <div>
        <h1 className="font-bold text-lg">{t("title")}</h1>
        <p className="text-xs text-fg-muted">{t("subtitle")}</p>
      </div>

      {/* Model status */}
      {model.status === "loading" && (
        <div className="card p-4">
          <p className="text-sm text-fg-muted mb-2">{t("modelLoading")}</p>
          <div className="h-1.5 bg-raised overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-150"
              style={{ width: `${Math.round(model.progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      {model.status === "error" && (
        <div className="card card-critical p-4 text-sm text-critical">
          {t("modelError")}
        </div>
      )}

      {/* Capture / dropzone */}
      {phase === "idle" && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter") fileInputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          className="card flex flex-col items-center justify-center gap-3 p-10 text-center cursor-pointer border-dashed"
        >
          <Upload className="text-fg-muted" aria-hidden />
          <p className="text-sm text-fg-muted">{t("dropzone")}</p>
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
          >
            <Camera size={16} aria-hidden />
            {t("takePhoto")}
          </Button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Image + acquisition overlay */}
      {imageSrc && imageRef.current && (
        <DetectionPreview
          src={imageSrc}
          image={imageRef.current}
          detections={detections}
          analyzing={phase === "analyzing"}
        />
      )}

      {phase === "done" && (
        <p className="text-sm text-fg-muted tabular">
          {t("detections", { count: detections.length })}
        </p>
      )}

      {/* Position confirmation - explicit, never silent (§2.7.6) */}
      {phase === "done" && detections.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-bold">{t("position.title")}</h2>
          <p className="text-xs text-fg-muted">{t("position.hint")}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" className="flex-1" onClick={useGps}>
              <MapPin size={16} aria-hidden />
              {t("position.gps")}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowPicker((v) => !v)}
            >
              {t("position.manual")}
            </Button>
          </div>
          {showPicker && (
            <div className="h-64 relative">
              <TacticalMap
                center={position ?? PARIS}
                onPick={(lat, lng) => setPosition([lat, lng])}
                picked={position}
                className="absolute inset-0 z-0"
              />
            </div>
          )}
          {position && (
            <p className="text-sm tabular text-fg">
              {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </p>
          )}
          <p className="text-xs text-fg-muted">{t("opsec")}</p>
          <Button
            className="w-full"
            disabled={!position || publishing}
            onClick={() => void publish()}
          >
            {t("publish")}
          </Button>
        </div>
      )}
    </div>
  );
}

function DetectionPreview({
  src,
  image,
  detections,
  analyzing,
}: {
  src: string;
  image: HTMLImageElement;
  detections: Detection[];
  analyzing: boolean;
}) {
  return (
    <DetectionOverlay
      src={src}
      naturalWidth={image.naturalWidth}
      naturalHeight={image.naturalHeight}
      detections={detections}
      analyzing={analyzing}
    />
  );
}
