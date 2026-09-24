/**
 * THE R2 RATCHET (am-r2-contains-r1-gate-wxf5): "Show every step" contains every display formula of
 * the full explanation and at least as many words (src/content/readings/stepsCoverage.ts).
 *
 * Today no passage meets it: 42 of 42 are baselined in r2ContainsR1.baseline.json, each row naming
 * its passage, the R1 formulas its R2 lacks and how many words short it is. The per-paper rewrite
 * beads burn the baseline down. This test holds three things:
 * - no passage outside the baseline violates the contract;
 * - no baselined passage gets worse: no new missing formula, no wider word gap;
 * - no baseline row is slack: a passage that improved must have its row tightened or removed in the
 *   same change, so the baseline only shrinks.
 * The comparison's own tests run in the node lane (src/testing/stepsCoverage.test.mjs), outside the
 * lane this gate controls.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadReadingFiles } from "../../../scripts/build-content.ts";
import { compileReadingContent } from "../../content/compiler/compile.ts";
import { stepsCoverage, violates } from "../../content/readings/stepsCoverage.ts";

type Row = Readonly<{ paper: string; missing: readonly string[]; wordGap: number }>;
const BASELINE = JSON.parse(
  readFileSync(new URL("./r2ContainsR1.baseline.json", import.meta.url), "utf8"),
) as { violators: Record<string, Row> };

const result = compileReadingContent(await loadReadingFiles());
if (!result.ok) throw new Error("The reading content does not compile; the R2 gate cannot run.");
const passages = result.papers.flatMap((p) =>
  p.arguments.map((a) => ({
    paper: p.paper.id,
    id: a.id,
    ...stepsCoverage(a.readings.full, a.readings.steps),
  })),
);

describe("R2 contains R1: the ratchet", () => {
  test("it examines every argument passage (0 examined is a failure)", () => {
    console.log(
      `[r2 ⊇ r1] examined ${passages.length} passages; baselined ${Object.keys(BASELINE.violators).length}`,
    );
    expect(passages.length).toBeGreaterThan(0);
  });

  test("no passage outside the baseline violates it", () => {
    const fresh = passages
      .filter((p) => violates(p) && !BASELINE.violators[p.id])
      .map(
        (p) =>
          `${p.id}: R2 lacks ${p.missing.length} R1 formula(s) [${p.missing.join(", ")}], words R1 ${p.r1Words} R2 ${p.r2Words}`,
      );
    expect(fresh).toEqual([]);
  });

  test("no baselined passage gets worse", () => {
    const worse: string[] = [];
    for (const p of passages) {
      const row = BASELINE.violators[p.id];
      if (!row) continue;
      const added = p.missing.filter((f) => !row.missing.includes(f));
      if (added.length > 0) worse.push(`${p.id}: R2 now also lacks ${added.join(", ")}`);
      const gap = Math.max(0, p.r1Words - p.r2Words);
      if (gap > row.wordGap)
        worse.push(`${p.id}: R2 is ${gap} words short of R1, baseline ${row.wordGap}`);
    }
    expect(worse).toEqual([]);
  });

  test("no baseline row is slack: an improvement tightens the baseline in the same change", () => {
    const byId = new Map(passages.map((p) => [p.id, p]));
    const slack: string[] = [];
    for (const [id, row] of Object.entries(BASELINE.violators)) {
      const p = byId.get(id);
      if (!p) {
        slack.push(`${id}: no such passage; remove its row`);
        continue;
      }
      const fixed = row.missing.filter((f) => !p.missing.includes(f));
      if (fixed.length > 0)
        slack.push(`${id}: R2 now shows ${fixed.join(", ")}; drop them from its row`);
      const gap = Math.max(0, p.r1Words - p.r2Words);
      if (gap < row.wordGap) slack.push(`${id}: word gap is ${gap}, baseline ${row.wordGap}`);
    }
    expect(slack).toEqual([]);
  });
});
