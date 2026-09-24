/**
 * Source digests for laboratories whose prepared example has no generator of its own
 * (am-inst-execution-labels-5ywv). A lab earns "Static worked example" or "Ideal model, host
 * calculation" only when its example names the host source that produced it; ME-01, ME-03 and SR-01
 * carried a file path in that field, which deriveHostExecution rightly refuses; so did the pages of
 * LQ-03, LQ-05, LQ-07, SR-04, SR-06 and SR-07; the light-thread and Avogadro labs passed none at all.
 *
 * Each digest is computed exactly as generate-radiation-entropy.mjs computes LQ-04's: SHA-256 over
 * the session module's relative import closure, plus this generator, each file prefixed by its path
 * and byte length. The pages pass the digest into the example; no session module imports this file,
 * so no kernel closure changes.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const self = "scripts/generate-lab-digests.mjs";

/** Laboratory id to the session module whose closure computes its prepared example. */
export const LAB_SESSIONS = Object.freeze({
  "avogadro-lab": "src/experiments/avogadro/session.ts",
  "light-thread": "src/experiments/lightThread/session.ts",
  "lq-03": "src/experiments/lq03/session.ts",
  "lq-05": "src/experiments/lq05/session.ts",
  "lq-07": "src/experiments/lq07/session.ts",
  "me-01": "src/experiments/me01/session.ts",
  "me-03": "src/experiments/me03/session.ts",
  "sr-01": "src/experiments/sr01/session.ts",
  "sr-04": "src/experiments/sr04/session.ts",
  "sr-06": "src/experiments/sr06/session.ts",
  "sr-07": "src/experiments/sr07/session.ts",
});

async function closure(entry) {
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
  await visit(entry);
  seen.set(self, await readFile(resolve(root, self), "utf8"));
  return [...seen].sort(([a], [b]) => a.localeCompare(b, "en"));
}

export async function generateLabDigests() {
  const digests = {};
  const files = {};
  for (const [id, entry] of Object.entries(LAB_SESSIONS)) {
    const sources = await closure(entry);
    const hash = createHash("sha256");
    for (const [path, text] of sources)
      hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
    digests[id] = `source:sha256:${hash.digest("hex")}`;
    files[id] = sources.length;
  }
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  await writeFile(
    resolve(root, "src/generated/lab-source-digests.json"),
    `${JSON.stringify(digests, null, 2)}\n`,
  );
  return { labs: Object.keys(digests).length, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await generateLabDigests()));
