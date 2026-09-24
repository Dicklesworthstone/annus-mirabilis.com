/**
 * Emits src/generated/lq08-millikan-overlay.json: what LQ-08's stopping-potential plot shows beside
 * the model line, judged from the Millikan 1916 record at prepare time (am-data-millikan-1916-zh2q).
 *
 * The page and the embed import this plain JSON. Reading the record needs the dataset loader, the
 * quantity registry and node:fs, and none of those may enter a route's bundle: 64304809 called the
 * loader from the embed adapter, and `next build` failed on the registry's
 * new URL("../../../content/quantities/", import.meta.url).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMillikanOverlay } from "../src/experiments/lq08/millikanRecord.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/generated/lq08-millikan-overlay.json");

export async function generateLq08Overlay() {
  const overlay = loadMillikanOverlay(root);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(overlay, null, 2)}\n`);
  return overlay;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const overlay = await generateLq08Overlay();
  console.log(JSON.stringify({ event: "lq08-overlay-generated", kind: overlay.kind }));
}
