// Copies onnxruntime-web WASM binaries into public/ so they are served
// same-origin (required by our CSP: no third-party CDN for executable code).
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dest = join(root, "public", "ort");

if (!existsSync(src)) {
  console.log("[copy-ort-wasm] onnxruntime-web not installed yet, skipping");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
let copied = 0;
for (const file of readdirSync(src)) {
  if (file.endsWith(".wasm") || file.endsWith(".mjs")) {
    copyFileSync(join(src, file), join(dest, file));
    copied++;
  }
}
console.log(`[copy-ort-wasm] copied ${copied} runtime files to public/ort`);
