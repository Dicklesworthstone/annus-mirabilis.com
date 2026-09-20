import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEntranceRecord } from "../src/content/entrances/entranceRecord.ts";
import { prepareMassEnergyScenario } from "../src/reader/entrances/massEnergyExample.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function generateMassEnergyEntrance() {
  const seen = new Map();
  async function visit(path) {
    if (seen.has(path)) return;
    const text = await readFile(resolve(root, path), "utf8");
    seen.set(path, text);
    for (const match of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
      const target = relative(root, resolve(root, dirname(path), match[1]))
        .split("\\")
        .join("/");
      if (!target.startsWith("../") && /\.(ts|mjs)$/.test(target)) await visit(target);
    }
  }
  await visit("src/reader/entrances/massEnergyExample.ts");
  await visit("scripts/generate-mass-energy-entrance.mjs");
  const recordPath = "content/arguments/mass-energy/entrance-mass-energy.json";
  const recordText = await readFile(resolve(root, recordPath), "utf8");
  seen.set(recordPath, recordText);
  const record = validateEntranceRecord(JSON.parse(recordText), recordPath);
  const hash = createHash("sha256");
  for (const [path, text] of [...seen].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
  const sourceDigest = `source:sha256:${hash.digest("hex")}`;
  const prepared = {
    schemaVersion: 1,
    sourceDigest,
    execution: "prepared-reference-example",
    constantSetId: "modern-si-2019",
    unit: "J",
    record,
    scenarios: [prepareMassEnergyScenario("fast"), prepareMassEnergyScenario("slow")],
  };
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(
    resolve(root, "src/generated/mass-energy-entrance.json"),
    `${JSON.stringify(prepared, null, 2)}\n`,
  );
  return prepared;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prepared = await generateMassEnergyEntrance();
  console.log(
    JSON.stringify({
      event: "mass-energy-entrance-generated",
      sourceDigest: prepared.sourceDigest,
      scenarios: prepared.scenarios.length,
    }),
  );
}
