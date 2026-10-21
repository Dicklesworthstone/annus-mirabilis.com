/**
 * NO PREPARE STEP READS A GENERATED MODULE THAT A LATER STEP WRITES.
 *
 * This class has broken a clean checkout twice in three weeks, at two different sites, and
 * survived its own repair both times:
 *
 *   2026-10-01   `build-equations.ts` -> `printedExplanations.ts` imported the
 *                `equation-explanations.json` that `build-equations.ts` itself writes.
 *   2026-10-20   `build-content.ts` (prepare:content step 2) needed
 *                `src/generated/not-modeled.ts`, written by `generate-not-modeled.mjs`, the first
 *                step of the LATER `prepare:lab`.
 *
 * Each was fixed and the chain then failed one step earlier on a different generated module. What
 * let the class survive is that nothing asserted the invariant: no gate ran the chain against a
 * tree with no `src/generated/`, and running the real 48-generator chain in a test is far too slow
 * to be one.
 *
 * So this asserts the ORDER statically, which is the property that actually matters: a generated
 * module may only be read by a step at or after the step that writes it. A clean checkout has no
 * `src/generated/` at all, so any earlier read is a guaranteed failure on a fresh clone, whatever
 * the developer's own tree happens to contain.
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS. It reads the dependency ORDER, statically. It does NOT
 * prove the chain runs -- a generator can fail for its own reasons, and only running it shows
 * that. The end-to-end proof is a clean-tree run of `scripts/prepare-lane.ts`, recorded in
 * `8cb3c80d4`: 48 of 48 generators clean on a `git archive HEAD` tree with no `src/generated/`.
 * This file is what keeps that true without paying for the run.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(new URL("../", import.meta.url).pathname);
const PHASES = ["prepare:content", "prepare:lab", "prepare:offline"] as const;

/** Every generator command, in the order the prepare lane runs them. */
function chainSteps(): readonly string[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const steps: string[] = [];
  for (const phase of PHASES) {
    const script = pkg.scripts[phase];
    if (script === undefined) continue;
    for (const part of script.split("&&")) {
      const file = part.trim().match(/(scripts\/[A-Za-z0-9._/-]+\.(?:ts|mjs))/)?.[1];
      if (file) steps.push(file);
    }
  }
  return steps;
}

/** Generated modules a script names as its own output, read from the script's text. */
const WRITES = /["'`](?:\.\/)?(?:src\/)?generated\/([A-Za-z0-9._/-]+)["'`]/g;
function writesOf(file: string): Set<string> {
  const out = new Set<string>();
  const path = join(ROOT, file);
  if (!existsSync(path)) return out;
  const text = readFileSync(path, "utf8");
  for (const m of text.matchAll(WRITES)) {
    const name = m[1];
    // Only a write when the script hands the path to a writer. A generator that merely imports a
    // sibling's output is a READER of it, and is caught on the other side of this test.
    if (
      name !== undefined &&
      /writeFile|mkdir|createWriteStream|outFile|writeFileSync/.test(text)
    ) {
      out.add(name.replace(/\.(ts|json|mjs)$/, ""));
    }
  }
  return out;
}

const LOCAL_IMPORT = /(?:from|import)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;
const MAX_DEPTH = 8;

/** Generated modules this file reads, directly or through its local imports. */
function readsOf(file: string, seen = new Set<string>(), depth = 0): Set<string> {
  const found = new Set<string>();
  const path = file.startsWith("/") ? file : join(ROOT, file);
  if (depth > MAX_DEPTH || seen.has(path) || !existsSync(path)) return found;
  seen.add(path);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return found;
  }
  for (const m of text.matchAll(LOCAL_IMPORT)) {
    const spec = m[1];
    if (spec === undefined) continue;
    const resolved = resolve(dirname(path), spec);
    const rel = resolved.startsWith(ROOT) ? resolved.slice(ROOT.length + 1) : resolved;
    const generated = rel.match(/^(?:src\/)?generated\/(.+)$/)?.[1];
    if (generated !== undefined) {
      found.add(generated.replace(/\.(ts|json|mjs)$/, ""));
      continue;
    }
    for (const candidate of [resolved, `${resolved}.ts`, `${resolved}.mjs`, `${resolved}.tsx`]) {
      if (!existsSync(candidate)) continue;
      for (const nested of readsOf(candidate, seen, depth + 1)) found.add(nested);
      break;
    }
  }
  return found;
}

/** Any (step, generated module) pair where the module is written only later in the chain. */
function orderViolations(steps: readonly string[]): string[] {
  const firstWriter = new Map<string, number>();
  steps.forEach((step, i) => {
    for (const name of writesOf(step)) if (!firstWriter.has(name)) firstWriter.set(name, i);
  });
  const bad: string[] = [];
  steps.forEach((step, i) => {
    for (const name of readsOf(step)) {
      const writer = firstWriter.get(name);
      if (writer !== undefined && writer > i) {
        bad.push(
          `${step} (step ${i + 1}) reads generated/${name}, written by ${steps[writer]} (step ${writer + 1})`,
        );
      }
    }
  });
  return bad;
}

const STEPS = chainSteps();

describe("the prepare chain's generated modules are written before they are read", () => {
  test("the chain and both maps are non-vacuous", () => {
    const writers = STEPS.filter((s) => writesOf(s).size > 0);
    const readers = STEPS.filter((s) => readsOf(s).size > 0);
    console.log(
      `[census] prepare chain: ${STEPS.length} step(s); ${writers.length} write a generated module, ${readers.length} read one`,
    );
    // A walk that resolved nothing would report zero violations and pass. These floors are what
    // stop that: measured 2026-10-20, 48 steps, with writers and readers in the dozens.
    expect(STEPS.length).toBeGreaterThanOrEqual(40);
    expect(writers.length).toBeGreaterThanOrEqual(20);
    expect(readers.length).toBeGreaterThanOrEqual(5);
  });

  test("no step reads a generated module a later step writes", () => {
    const violations = orderViolations(STEPS);
    console.log(`[census] prepare chain order: ${violations.length} violation(s)`);
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("PLANTED: moving a generator after its consumer is caught, and named", () => {
    /*
     * The real defect of 2026-10-20, reconstructed by reordering the step list in memory:
     * `generate-not-modeled.mjs` after `build-content.ts` is exactly where it sat, and is what
     * killed a fresh clone at step 2 of 48.
     */
    const producer = "scripts/generate-not-modeled.mjs";
    const consumer = "scripts/build-content.ts";
    expect(STEPS, "the chain no longer holds the step this plant moves").toContain(producer);
    expect(STEPS).toContain(consumer);
    expect(
      writesOf(producer).size,
      `${producer} is not detected as writing anything`,
    ).toBeGreaterThan(0);

    const planted = STEPS.filter((s) => s !== producer);
    planted.splice(planted.indexOf(consumer) + 1, 0, producer);
    // What landed, before the verdict is read.
    expect(planted.indexOf(producer)).toBeGreaterThan(planted.indexOf(consumer));

    const found = orderViolations(planted);
    expect(found.length, "the planted reordering was not caught").toBeGreaterThan(0);
    expect(found.join("\n")).toContain(consumer);
    expect(found.join("\n")).toContain("not-modeled");

    // The control: the real order produces nothing, so the red above is the plant.
    expect(orderViolations(STEPS)).toEqual([]);
  });
});
