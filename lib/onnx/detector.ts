"use client";

import * as ort from "onnxruntime-web";
import { MODEL_SIZE, type LetterboxInfo, type PreprocessResult } from "./preprocess";

/**
 * In-browser YOLOv8 inference via onnxruntime-web (WASM backend).
 * Architecture decision (§5): zero GPU server, zero inference cost, local
 * latency — and it keeps working in jammed / disconnected areas.
 *
 * The model file is interchangeable: day 1 = YOLOv8n COCO (validates the
 * whole chain), day 2 = a drone-specific model. Only CLASS_NAMES changes.
 */

export const MODEL_URL = "/models/yolov8n.onnx";

// COCO class names — index = class id in the model output.
export const CLASS_NAMES: readonly string[] = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
  "truck", "boat", "traffic light", "fire hydrant", "stop sign",
  "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag",
  "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
  "baseball bat", "baseball glove", "skateboard", "surfboard",
  "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon",
  "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot",
  "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant",
  "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote",
  "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

/** COCO classes considered aerial-threat relevant for the demo chain. */
export const AERIAL_CLASSES = new Set(["airplane", "bird", "kite"]);

const CONFIDENCE_THRESHOLD = 0.35;
const IOU_THRESHOLD = 0.45;

export interface Detection {
  /** box in ORIGINAL image pixel coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  classId: number;
  className: string;
  confidence: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/**
 * Singleton session — the ~12 MB model is fetched and compiled once.
 * Progress is reported so the UI can show a loading bar on first use.
 */
export function loadDetector(
  onProgress?: (loaded: number, total: number) => void,
): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    ort.env.wasm.wasmPaths = "/ort/";
    const response = await fetch(MODEL_URL);
    if (!response.ok || !response.body) {
      throw new Error(`Model unavailable (${response.status})`);
    }
    const total = Number(response.headers.get("content-length") ?? 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total);
    }
    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return ort.InferenceSession.create(buffer, {
      executionProviders: ["wasm"],
    });
  })();
  sessionPromise.catch(() => {
    // allow a retry on next call instead of caching the failure forever
    sessionPromise = null;
  });
  return sessionPromise;
}

export async function runDetection(
  preprocessed: PreprocessResult,
): Promise<Detection[]> {
  const session = await loadDetector();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) throw new Error("Unexpected model signature");

  const tensor = new ort.Tensor("float32", preprocessed.data, [
    1,
    3,
    MODEL_SIZE,
    MODEL_SIZE,
  ]);
  const results = await session.run({ [inputName]: tensor });
  const output = results[outputName];
  if (!output) throw new Error("Model produced no output");

  return decodeYolo(
    output.data as Float32Array,
    output.dims,
    preprocessed.letterbox,
  );
}

/** Decode YOLOv8 output [1, 4+nc, anchors] → thresholded boxes → NMS. */
function decodeYolo(
  data: Float32Array,
  dims: readonly number[],
  letterbox: LetterboxInfo,
): Detection[] {
  const numAttrs = dims[1] ?? 84;
  const numAnchors = dims[2] ?? 8400;
  const numClasses = numAttrs - 4;

  const candidates: Detection[] = [];
  for (let a = 0; a < numAnchors; a++) {
    let bestClass = -1;
    let bestScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numAnchors + a] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestScore < CONFIDENCE_THRESHOLD || bestClass < 0) continue;

    const cx = data[0 * numAnchors + a] ?? 0;
    const cy = data[1 * numAnchors + a] ?? 0;
    const w = data[2 * numAnchors + a] ?? 0;
    const h = data[3 * numAnchors + a] ?? 0;

    // model space → original image space (undo letterbox)
    const x = (cx - w / 2 - letterbox.padX) / letterbox.scale;
    const y = (cy - h / 2 - letterbox.padY) / letterbox.scale;
    candidates.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(w / letterbox.scale, letterbox.originalWidth - x),
      height: Math.min(h / letterbox.scale, letterbox.originalHeight - y),
      classId: bestClass,
      className: CLASS_NAMES[bestClass] ?? `class_${bestClass}`,
      confidence: bestScore,
    });
  }

  return nms(candidates, IOU_THRESHOLD);
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function nms(candidates: Detection[], threshold: number): Detection[] {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];
  for (const candidate of sorted) {
    if (kept.every((k) => iou(candidate, k) < threshold)) {
      kept.push(candidate);
    }
  }
  return kept;
}
