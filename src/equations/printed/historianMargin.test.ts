/**
 * A LOST READING LEVEL IS NAMED, PROVED BY REMOVING ONE (am-8gbg).
 *
 * The bead's fourth acceptance item: a gate fails when a record that had a reading level loses it,
 * proved by planting the removal. Two levels behave differently and both are planted here, against
 * the REAL corpus rather than a crafted record, because the question is whether the real path from
 * the real files reaches the refusal.
 *
 * - A required level (r0, r1, r2) was already refused by `readRecord`. What was NOT proved is that
 *   the refusal survives the real loader: every existing plant builds a record in memory for
 *   mass-energy's first display, so a loader that dropped a level on the way in would look clean.
 *   Here a real record is loaded from disk, one level is emptied, and the real check is run.
 * - An optional level (r3) was refused by nothing at all. 71 of 200 records carry a historian's
 *   margin and any of them could lose it in silence. historianMargin.ts records the 71 by id; this
 *   file holds the inventory to the corpus and the corpus to the inventory.
 *
 * WHICH HALF IS WATCHING WHICH. The count lives in the gate lane
 * (`scripts/check-equation-explanations.ts` refuses a paper below its floor); the identity lives
 * here, in the bun lane. A swap -- one record losing a margin while another gains one -- is
 * invisible to the count and caught here. A bun lane that will not start is invisible here and
 * caught there. The plants below prove this half reaches its predicate; `marginCountRefusal` is
 * driven directly for the other, so neither verdict is taken on trust.
 */
import { describe, expect, test } from "bun:test";
import {
  checkPaperExplanations,
  type ExplanationSource,
  loadExplanationSources,
} from "./equationExplanations.ts";
import {
  BASELINE_FILE,
  baselinedPapers,
  driftIsClean,
  MARGIN_BASELINE,
  marginCountRefusal,
  marginDrift,
  marginFloor,
  recordedMargins,
} from "./historianMargin.ts";

const ROOT = process.cwd();

/** One paper's compiled records: which exist, and which carry a historian's margin. */
async function inventory(paper: string, sources?: readonly ExplanationSource[]) {
  const checked = await checkPaperExplanations(ROOT, paper, sources ? { sources } : {});
  return {
    problems: checked.problems,
    all: checked.explanations.map((e) => e.display),
    withMargin: checked.explanations.filter((e) => e.r3 !== undefined).map((e) => e.display),
  };
}

/** The real files of a paper, with one record's field replaced; the plant's only synthetic part. */
function realSourcesWithout(
  paper: string,
  display: string,
  field: "r3" | "r2" | "r0",
): ExplanationSource[] {
  const sources = loadExplanationSources(ROOT, paper);
  const target = sources.find((s) => (s.raw as { display?: unknown } | null)?.display === display);
  if (!target)
    throw new Error(`${paper} has no record for ${display}; the plant cannot be placed.`);
  const raw = { ...(target.raw as Record<string, unknown>) };
  // Removed for r3, which is optional; emptied for a required level, because an absent r0 and an
  // empty r0 are the same refusal and the empty form proves the field was read rather than skipped.
  if (field === "r3") delete raw.r3;
  else if (field === "r2") raw.r2 = [];
  else raw.r0 = "";
  return sources.map((s) => (s === target ? { file: s.file, raw } : s));
}

const live = new Map<string, Awaited<ReturnType<typeof inventory>>>();
for (const paper of baselinedPapers()) live.set(paper, await inventory(paper));

describe("the historian's-margin inventory matches the corpus", () => {
  test("it examines every record of every baselined paper, and 0 is a failure", () => {
    const all = [...live.values()].flatMap((i) => i.all);
    const margins = [...live.values()].flatMap((i) => i.withMargin);
    console.log(
      `[historian's margin] ${all.length} record(s) across ${live.size} paper(s); ` +
        `${margins.length} carry a margin, ${MARGIN_BASELINE.withMargin} recorded on ` +
        `${MARGIN_BASELINE.measuredAt}: ` +
        baselinedPapers()
          .map((p) => `${p} ${live.get(p)?.withMargin.length}/${live.get(p)?.all.length}`)
          .join(", "),
    );
    // Non-vacuity in both directions. With no papers, or no records, every verdict below is an
    // empty-set comparison and true, which reads exactly like a clean inventory.
    expect(live.size).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(0);
    expect(margins.length).toBeGreaterThan(0);
    // And the baseline's own denominator is a measurement, not a guess: it says 200 records were
    // compiled when the inventory was taken, so a corpus that shrank is a fact worth reading.
    expect(MARGIN_BASELINE.examined).toBe(all.length);
    expect(MARGIN_BASELINE.withMargin).toBe(margins.length);
  });

  test("no record has lost its margin, and none carries one unrecorded", () => {
    const drift: string[] = [];
    for (const paper of baselinedPapers()) {
      const i = live.get(paper);
      if (!i) continue;
      const d = marginDrift(paper, i.withMargin, i.all);
      for (const id of d.lost)
        drift.push(`${paper} ${id}: its r3 is gone; a historian's margin that was authored stays.`);
      for (const id of d.unrecorded)
        drift.push(`${paper} ${id}: carries an r3 that ${BASELINE_FILE} does not record; add it.`);
      for (const id of d.ghosts)
        drift.push(`${paper} ${id}: recorded, but there is no such record; drop the row.`);
    }
    expect(drift).toEqual([]);
  });

  test("every paper the census checks has a row, so none is gated against nothing", () => {
    // The gate script walks four papers. A fifth with displays and no row would pass the drift check
    // above by never being looked at, which is the stale-inventory failure this bead describes.
    for (const paper of ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"]) {
      expect(recordedMargins(paper), `${paper} has no row in ${BASELINE_FILE}`).toBeDefined();
      expect(marginCountRefusal(paper, live.get(paper)?.withMargin.length ?? 0)).toBeUndefined();
    }
  });
});

describe("the plants: removing a level is refused, and named", () => {
  test("a real record losing its r3 is named as lost, and the count refuses too", async () => {
    // The plant for the optional level. mass-energy carries a margin on all 7 of its records, so
    // whichever one is taken, the paper drops below its floor.
    const victim = recordedMargins("mass-energy")?.[0];
    expect(victim).toBeDefined();
    const planted = await inventory(
      "mass-energy",
      realSourcesWithout("mass-energy", String(victim), "r3"),
    );
    // The record still compiles: r3 is optional, which is exactly why nothing refused before.
    expect(planted.problems).toEqual([]);
    expect(planted.all).toContain(victim);
    expect(planted.withMargin).not.toContain(victim);

    const drift = marginDrift("mass-energy", planted.withMargin, planted.all);
    expect(driftIsClean(drift)).toBe(false);
    // Named, not merely counted. This is the half a census cannot do.
    expect(drift.lost).toEqual([victim]);
    expect(drift.unrecorded).toEqual([]);
    expect(drift.ghosts).toEqual([]);

    // And the gate lane's coarse half, driven on the same planted count.
    const refusal = marginCountRefusal("mass-energy", planted.withMargin.length);
    expect(refusal).toBeDefined();
    expect(refusal).toContain(String(marginFloor("mass-energy")));
    expect(refusal).toContain("historianMargin.test.ts");
  });

  test("a swap keeps the count and is still named, which is why the inventory holds ids", async () => {
    // The case the floor cannot see. One record loses its margin and another gains one, so
    // `withMargin` is unchanged and marginCountRefusal is silent; the inventory names both.
    const recorded = recordedMargins("special-relativity") ?? [];
    const i = live.get("special-relativity");
    const loser = recorded[0];
    const gainer = i?.all.find((id) => !recorded.includes(id));
    expect(loser).toBeDefined();
    expect(gainer).toBeDefined();
    const swapped = (i?.withMargin ?? []).filter((id) => id !== loser).concat(String(gainer));
    expect(swapped.length).toBe(i?.withMargin.length);

    // The count is content.
    expect(marginCountRefusal("special-relativity", swapped.length)).toBeUndefined();
    // The identity is not.
    const drift = marginDrift("special-relativity", swapped, i?.all ?? []);
    expect(drift.lost).toEqual([loser]);
    expect(drift.unrecorded).toEqual([gainer]);
  });

  test("a real record losing a REQUIRED level is refused by the check itself, by name", async () => {
    // The plant for r2, through the real loader rather than a hand-built record. The refusal exists
    // already; what is proved here is that a real file's path reaches it.
    const victim = String(recordedMargins("mass-energy")?.[0]);
    const planted = await checkPaperExplanations(ROOT, "mass-energy", {
      sources: realSourcesWithout("mass-energy", victim, "r2"),
      enforced: ["mass-energy"],
    });
    const levels = planted.problems.filter((p) => p.code === "explanation-missing-level");
    expect(levels.map((p) => p.display)).toEqual([victim]);
    // An enforced paper then also reports the display as unexplained, so the loss is not absorbed.
    expect(
      planted.problems.some((p) => p.code === "explanation-missing" && p.display === victim),
    ).toBe(true);
  });

  test("and an r0 emptied the same way is refused, so it is not an r2-only path", async () => {
    const victim = String(recordedMargins("brownian-motion")?.[0]);
    const planted = await checkPaperExplanations(ROOT, "brownian-motion", {
      sources: realSourcesWithout("brownian-motion", victim, "r0"),
    });
    expect(
      planted.problems.filter((p) => p.code === "explanation-missing-level").map((p) => p.display),
    ).toEqual([victim]);
  });

  test("the unmodified corpus is clean, so none of the above is a function that always refuses", () => {
    // The positive control for every plant in this file. Without it, a drift that returned every id
    // as lost and a refusal that fired on any input would satisfy all four cases above.
    for (const paper of baselinedPapers()) {
      const i = live.get(paper);
      const d = marginDrift(paper, i?.withMargin ?? [], i?.all ?? []);
      expect(driftIsClean(d), `${paper}: ${JSON.stringify(d)}`).toBe(true);
      expect(i?.problems).toEqual([]);
    }
  });
});
