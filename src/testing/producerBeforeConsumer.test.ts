/**
 * A GATE THAT WRITES AN ARTIFACT MUST RUN BEFORE THE GATE THAT READS IT -- IN THE CHAIN, NOT JUST
 * IN THE REGISTRY ARRAY.
 *
 * THE DEFECT, measured 2026-10-23. `perf-browser-budgets` writes
 * `artifacts/budgets/browser-<tool-run-id>.json` stamped with the build id it measured.
 * `perf-budgets` reads it and reports three rows from it -- visible text and math, interaction
 * latency p75, layout shift -- or refuses it as stale and reports them `not-available`. The registry
 * places the producer immediately before the consumer and its comment called that position
 * "load-bearing", which is true of a single invocation that selects both.
 *
 * No routine chain made that invocation. The producer is `browser` family, the consumer is `fast`,
 * and the only CI path that runs either was
 *
 *     bun run gates = --fail-fast --family fast && --fail-fast --family browser
 *
 * two invocations with fast FIRST. So the consumer ran before the producer every time, the newest
 * artifact always described the previous build, and those three rows were `not-available` in CI BY
 * CONSTRUCTION. On the day this was found there were 7 artifacts on disk and not one for the current
 * build -- which reads exactly like "nobody has run the browser step yet", and is not that.
 *
 * WHY NOTHING CAUGHT IT. Every existing guard was satisfied. The producer is registered,
 * `requiredInCi`, `every-run`, reachable by a dsr check, and passes when run; the consumer is all of
 * those and passes too; the rows it cannot measure are honestly `not-available` rather than invented.
 * The gap is in the RELATION between two steps, and no gate owned the relation. This file does.
 *
 * It asserts the ordering against `package.json`'s own script text rather than against the registry
 * array, because the array was never the thing that was wrong.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALITY_GATE_STEPS } from "../../scripts/quality-gates/registry.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The artifact handoffs this repository has, as (producer, consumer) step ids.
 *
 * Deliberately a short explicit list rather than something derived from the scripts: a derivation
 * would have to guess which reads and writes are a handoff, and a wrong guess here produces either
 * a vacuous test or a false alarm about two unrelated gates. Add a pair when a gate starts reading
 * another gate's artifact.
 */
const HANDOFFS: readonly { producer: string; consumer: string; artifact: string }[] = [
  {
    producer: "perf-browser-budgets",
    consumer: "perf-budgets",
    artifact: "artifacts/budgets/browser-<tool-run-id>.json",
  },
];

function gatesScript(): string {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const gates = pkg.scripts?.gates;
  // Not an optional read: if `gates` is gone, the premise of every assertion below is gone with it,
  // and a test that quietly skipped would be the same failure one level up.
  expect(typeof gates, "package.json has no `gates` script").toBe("string");
  return gates as string;
}

/** Where a step's id first appears in the chain, as an index into the script text, or -1. */
function firstRunPosition(script: string, stepId: string, family: string): number {
  const positions: number[] = [];
  // An `--only <ids>` invocation naming the step runs it wherever that invocation sits.
  for (const m of script.matchAll(/--only\s+([\w,.-]+)/g)) {
    if ((m[1] ?? "").split(",").includes(stepId)) positions.push(m.index ?? 0);
  }
  // A `--family <f>` invocation runs every step of that family.
  for (const m of script.matchAll(/--family\s+(\S+)/g)) {
    if ((m[1] ?? "") === family) positions.push(m.index ?? 0);
  }
  return positions.length === 0 ? -1 : Math.min(...positions);
}

/** Where a step's LAST run sits, which is the one whose result stands. */
function lastRunPosition(script: string, stepId: string, family: string): number {
  const positions: number[] = [];
  for (const m of script.matchAll(/--only\s+([\w,.-]+)/g)) {
    if ((m[1] ?? "").split(",").includes(stepId)) positions.push(m.index ?? 0);
  }
  for (const m of script.matchAll(/--family\s+(\S+)/g)) {
    if ((m[1] ?? "") === family) positions.push(m.index ?? 0);
  }
  return positions.length === 0 ? -1 : Math.max(...positions);
}

describe("every artifact handoff runs its producer before the consumer that reads it", () => {
  test("the handoff list is not empty, so the assertions below quantify over something", () => {
    // An emptied list would make every loop in this file run zero times and read as a clean pass,
    // which is the exact shape this repository refuses elsewhere.
    expect(HANDOFFS.length).toBeGreaterThan(0);
  });

  test("both ends of every handoff are registered steps, so the ids are not stale", () => {
    const ids = new Set(QUALITY_GATE_STEPS.map((s) => s.id));
    for (const h of HANDOFFS) {
      expect(ids.has(h.producer), `${h.producer} is not a registered step`).toBe(true);
      expect(ids.has(h.consumer), `${h.consumer} is not a registered step`).toBe(true);
    }
  });

  test("THE DEFECT: the consumer's last run comes after the producer's first run", () => {
    const script = gatesScript();
    for (const h of HANDOFFS) {
      const producer = QUALITY_GATE_STEPS.find((s) => s.id === h.producer);
      const consumer = QUALITY_GATE_STEPS.find((s) => s.id === h.consumer);
      const producerAt = firstRunPosition(script, h.producer, producer?.family ?? "");
      const consumerAt = lastRunPosition(script, h.consumer, consumer?.family ?? "");

      expect(producerAt, `${h.producer} is run by no invocation in \`gates\``).toBeGreaterThan(-1);
      expect(consumerAt, `${h.consumer} is run by no invocation in \`gates\``).toBeGreaterThan(-1);
      // The whole point. Before the repair, perf-budgets' only run sat at the FIRST invocation and
      // perf-browser-budgets' at the second, so this comparison was 0 > 1 and false.
      expect(
        consumerAt,
        `\`gates\` runs ${h.consumer} before ${h.producer} ever writes ${h.artifact}, so the ` +
          `rows it reads from that artifact can only ever be stale. Append a later invocation ` +
          `(for example \`--only ${h.consumer}\`) after the producer's family, or put both in one ` +
          `invocation. Script: ${script}`,
      ).toBeGreaterThan(producerAt);
    }
  });

  test("a producer in a different family from its consumer needs the explicit later run", () => {
    // The structural reason this can go wrong at all, asserted so that moving either step between
    // families without revisiting `gates` fails here rather than silently.
    const script = gatesScript();
    for (const h of HANDOFFS) {
      const producer = QUALITY_GATE_STEPS.find((s) => s.id === h.producer);
      const consumer = QUALITY_GATE_STEPS.find((s) => s.id === h.consumer);
      if (producer?.family === consumer?.family) continue;
      expect(
        script,
        `${h.producer} (${producer?.family}) and ${h.consumer} (${consumer?.family}) are in ` +
          `different families, so registry order cannot sequence them; \`gates\` must name ` +
          `${h.consumer} in an invocation after the ${producer?.family} family`,
      ).toContain(`--only ${h.consumer}`);
    }
  });
});
