"use client";

import { useTranslations } from "next-intl";
import type { Detection } from "@/lib/onnx/detector";
import { CountUp } from "@/components/ui/count-up";

/**
 * Target acquisition sequence (§2.5 moment 1): scan line while analyzing,
 * then bounding boxes traced in 300ms + class label + confidence count-up.
 */
export function DetectionOverlay({
  src,
  naturalWidth,
  naturalHeight,
  detections,
  analyzing,
}: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  detections: Detection[];
  analyzing: boolean;
}) {
  const t = useTranslations("sentinel");
  const stroke = Math.max(2, naturalWidth / 320);
  const fontSize = Math.max(12, naturalWidth / 40);

  return (
    <div className="relative overflow-hidden border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
      <img src={src} alt="" className="block w-full h-auto" />

      {analyzing && <span className="scanline" aria-hidden />}

      {detections.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {detections.map((d, i) => (
            <g key={i}>
              <rect
                x={d.x}
                y={d.y}
                width={d.width}
                height={d.height}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={stroke}
                pathLength={100}
                strokeDasharray={100}
                className="box-trace"
                style={{ "--trace-length": 100 } as React.CSSProperties}
              />
              <text
                x={d.x}
                y={Math.max(fontSize + 2, d.y - 6)}
                fill="var(--color-accent)"
                fontSize={fontSize}
                fontWeight={700}
              >
                {d.className}
              </text>
            </g>
          ))}
        </svg>
      )}

      {detections.length > 0 && detections[0] && (
        <div className="absolute bottom-2 right-2 card px-3 py-1.5 text-sm bg-surface/90">
          <span className="font-bold text-accent">
            <CountUp value={Math.round(detections[0].confidence * 100)} />%
          </span>{" "}
          <span className="text-fg-muted text-xs">{t("confidence")}</span>
        </div>
      )}
    </div>
  );
}
