import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ME02_DEFAULTS } from "../src/experiments/me02/definition.ts";
import { packPrintedConversion, snapshotOutputs } from "../src/experiments/me02/session.ts";
import { encodeResult } from "../src/experiments/results/codec.ts";
import { printedMassConversion } from "../src/physics/reference/massEnergy.ts";

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
  await visit("src/experiments/me02/session.ts");
  seen.set(
    "scripts/generate-me02.mjs",
    await readFile(resolve(root, "scripts/generate-me02.mjs"), "utf8"),
  );
  return [...seen].sort(([a], [b]) => a.localeCompare(b, "en"));
}

export async function generateMe02() {
  const sources = await evaluatorSources();
  const hash = createHash("sha256");
  for (const [path, text] of sources)
    hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const at06 = snapshotOutputs(ME02_DEFAULTS);
  const at001 = snapshotOutputs({ ...ME02_DEFAULTS, beta: 0.01 });
  const example = {
    sourceDigest,
    parameters: ME02_DEFAULTS,
    stepIndex: 0,
    simulationTime: 0,
    results: at06.map(encodeResult),
    comparisonResults: at001.map(encodeResult),
    printedConversion: packPrintedConversion(printedMassConversion({ emittedEnergyErg: 9e20 })),
  };
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(
    resolve(root, "src/generated/me02-example.json"),
    `${JSON.stringify(example, null, 2)}\n`,
  );
  return { sourceDigest, files: sources.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await generateMe02()));
