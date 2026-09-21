import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIGHT_INVESTIGATION_DEFAULTS,
  LIGHT_INVESTIGATION_MODEL,
  LIGHT_INVESTIGATION_CONSTANTS,
  evaluateLightInvestigation,
} from "../src/discovery/lightQuanta/investigation.ts";
import { encodeResult } from "../src/experiments/results/codec.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Hash the complete local evaluator import graph, including the generator itself. */
export async function investigationSources() {
  const seen = new Map();
  async function visit(path) {
    if (seen.has(path)) return;
    const source = await readFile(resolve(root, path), "utf8");
    seen.set(path, source);
    for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
      const target = relative(root, resolve(root, dirname(path), match[1]));
      if (target.startsWith("../") || !/\.(ts|mjs)$/.test(target)) continue;
      await visit(target);
    }
  }
  await visit("scripts/generate-light-quanta-investigation.mjs");
  return [...seen].sort(([a], [b]) => a.localeCompare(b, "en"));
}

export async function prepareLightInvestigation() {
  const hash = createHash("sha256");
  for (const [path, text] of await investigationSources())
    hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
  return {
    modelId: LIGHT_INVESTIGATION_MODEL,
    constantSetId: LIGHT_INVESTIGATION_CONSTANTS,
    sourceDigest: `source:sha256:${hash.digest("hex")}`,
    parameters: LIGHT_INVESTIGATION_DEFAULTS,
    results: evaluateLightInvestigation(LIGHT_INVESTIGATION_DEFAULTS).map(encodeResult),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const example = await prepareLightInvestigation();
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(resolve(root, "src/generated/light-quanta-investigation.json"),
    `${JSON.stringify(example, null, 2)}\n`);
  console.log(JSON.stringify({ modelId: example.modelId, sourceDigest: example.sourceDigest }));
}
