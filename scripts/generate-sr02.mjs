import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeResult } from "../src/experiments/results/codec.ts";
import { SR02_DEFAULTS } from "../src/experiments/sr02/definition.ts";
import { snapshotOutputs } from "../src/experiments/sr02/session.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function evaluatorSources() {
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
  await visit("src/experiments/sr02/session.ts");
  seen.set(
    "scripts/generate-sr02.mjs",
    await readFile(resolve(root, "scripts/generate-sr02.mjs"), "utf8"),
  );
  return [...seen].sort(([a], [b]) => a.localeCompare(b, "en"));
}

export async function generateSr02() {
  const sources = await evaluatorSources();
  const hash = createHash("sha256");
  for (const [path, text] of sources)
    hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const at10 = snapshotOutputs(SR02_DEFAULTS);
  const at06 = snapshotOutputs({ ...SR02_DEFAULTS, speed: 0.6 * 299792458 });
  const example = {
    sourceDigest,
    parameters: SR02_DEFAULTS,
    stepIndex: 0,
    simulationTime: 0,
    results: at10.map(encodeResult),
    comparisonResults: at06.map(encodeResult),
  };
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(
    resolve(root, "src/generated/sr02-example.json"),
    `${JSON.stringify(example, null, 2)}\n`,
  );
  return { sourceDigest, files: sources.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await generateSr02()));
