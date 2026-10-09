/**
 * THE FOUR REAL DISCOVERY JOURNEYS ARE MEASURED (am-4k0m).
 *
 * am-4k0m's finding: `checkJourney` has 38 call sites and every one passes a FIXTURE, `JOURNEY_MAP`
 * holds one entry and it is the fixture, there is no `content/journeys/` directory and no record with
 * `kind: journey`. So the epistemic gates AGENTS.md calls build gates -- the post-1904 shelf refusal,
 * the fork contract, the mockery guard, the move-summary guard -- run over an empty population, while
 * the four journeys a reader is actually served are hand-authored JSX of 453, 395, 398 and 391 lines.
 * The bead's words: "nobody knows that, because they never ran on it."
 *
 * THIS FILE IS NOT THE MIGRATION, and says so plainly. The bead's first acceptance item asks for each
 * journey to exist as a record the compiler reads, with the JSX rendering from it and a diff showing
 * no reader-facing text lost. That is a content-model migration of 1,637 lines of authored prose, and
 * doing it carelessly would lose reader-facing writing, which is worse than the drift it fixes.
 *
 * What this DOES is end the silence, which is the bead's actual complaint. The four journeys' skeleton
 * is measured from the modules that declare it, so drift is reported instead of discovered months
 * later. Measured 2026-10-05, and three of the bead's four drift items have been fixed since it was
 * filed on 2026-09-27 while nothing reported that either:
 *
 *   - special-relativity was said to have no NAGGING_FACT, FIRST_HONEST_QUESTION, MOVE or SOURCE_JUMPS.
 *     journeyIII.ts exports all four.
 *   - brownian-motion was said to have no DOORS. journeyII.ts exports DOORS.
 *   - 9 of 40 shelf cards were said to carry no `limits`. All 46 cards now do, the nine named among
 *     them, and the shelf has grown by six.
 *   - the fourth stands: the move is openable in a derivation chain for 1 of 4 journeys.
 *     content/equations/derivations/ holds one chain with `isMove: true`, bm-variance.yaml, and the
 *     other marked moves are in src/equations/derivations/fixtures.ts, which no page renders.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REAL_JOURNEYS } from "../journeys/realJourneys.ts";

const ROOT = process.cwd();

/** The four journeys, each with the module that declares its skeleton and its shelf. */
const JOURNEYS = [
  {
    paper: "light-quanta",
    module: "src/discovery/lightQuanta/journeyI.ts",
    shelf: "src/content/lightQuantaShelf.ts",
  },
  {
    paper: "brownian-motion",
    module: "src/discovery/brownian/journeyII.ts",
    shelf: "src/content/brownianShelf.ts",
  },
  {
    paper: "special-relativity",
    module: "src/discovery/relativity/journeyIII.ts",
    shelf: "src/content/specialRelativityShelf.ts",
  },
  {
    paper: "mass-energy",
    module: "src/discovery/massEnergy/journeyIV.ts",
    shelf: "src/content/massEnergyShelf.ts",
  },
] as const;

/**
 * The skeleton elements each journey module must declare.
 *
 * These are the ones the plan's skeleton names AND the JSX reads by name, so a missing one is a
 * missing part of the journey rather than a naming preference. `FORK_` is counted separately because
 * the plan asks for two or three forks and each carries its own name.
 */
const REQUIRED_EXPORTS = [
  "NAGGING_FACT",
  "FIRST_HONEST_QUESTION",
  "MOVE",
  "MOVE_HREF",
  "SOURCE_JUMPS",
  "DOORS",
  "WORLD_CHECK",
  "PPE_TASK",
] as const;

const exportsOf = (rel: string): readonly string[] => {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return [];
  return [...readFileSync(path, "utf8").matchAll(/^export const ([A-Z][A-Z_0-9]*)/gm)].map(
    (m) => m[1] ?? "",
  );
};

/** Shelf cards, split at each `id:` so a `limits:` key is attributed to the card it is inside. */
function shelfCards(rel: string): readonly { id: string; hasLimits: boolean }[] {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const cards: { id: string; hasLimits: boolean }[] = [];
  for (const block of text.split(/(?=^\s+id: ")/m)) {
    const id = /id: "([^"]+)"/.exec(block)?.[1];
    if (id === undefined) continue;
    // `limits:` holds its value on the following line, so the key is matched without a value.
    cards.push({ id, hasLimits: /^\s+limits:/m.test(block) });
  }
  return cards;
}

describe("the four journeys' skeleton, measured from what declares it", () => {
  it("all four modules are present, which is the denominator for everything below", () => {
    const present = JOURNEYS.filter((j) => existsSync(join(ROOT, j.module)));
    // A count of 0 fails, as the bead's second acceptance item requires of any journey check.
    expect(present.length).toBe(JOURNEYS.length);
    expect(present.length).toBeGreaterThan(0);
  });

  it("every journey declares every skeleton element, and at least two forks", () => {
    const gaps: string[] = [];
    const report: string[] = [];
    for (const journey of JOURNEYS) {
      const declared = new Set(exportsOf(journey.module));
      // Non-vacuity per journey: a module that exported nothing would otherwise pass every
      // "missing" check below by having no exports to contradict them.
      expect(declared.size).toBeGreaterThan(5);
      const missing = REQUIRED_EXPORTS.filter((name) => !declared.has(name));
      const forks = [...declared].filter((name) => name.startsWith("FORK_"));
      for (const name of missing) gaps.push(`${journey.paper}: no ${name}`);
      if (forks.length < 2)
        gaps.push(`${journey.paper}: ${forks.length} fork(s), the plan asks 2-3`);
      report.push(`${journey.paper}: ${declared.size} exports, ${forks.length} forks`);
    }
    console.log(`[journey skeleton] ${report.join(" | ")}`);
    expect(gaps).toEqual([]);
  });

  it("every shelf card carries its limits", () => {
    const without: string[] = [];
    let examined = 0;
    const report: string[] = [];
    for (const journey of JOURNEYS) {
      const cards = shelfCards(journey.shelf);
      // Non-vacuity: an empty shelf would pass "none is missing limits".
      expect(cards.length).toBeGreaterThan(5);
      examined += cards.length;
      const bare = cards.filter((c) => !c.hasLimits).map((c) => `${journey.paper}/${c.id}`);
      without.push(...bare);
      report.push(`${journey.paper}: ${cards.length - bare.length}/${cards.length}`);
    }
    console.log(`[journey shelf limits] ${examined} cards examined | ${report.join(" | ")}`);
    expect(examined).toBeGreaterThanOrEqual(40);
    expect(without).toEqual([]);
  });

  /**
   * The papers whose move is openable, keyed by the chain's OWN `paper` field rather than by
   * counting files. The earlier version of this counted files with `isMove: true` and printed the
   * number as "N of 4 journeys", which is a different population: two chains for one paper would
   * have read as two journeys covered, and a chain naming no paper would have been credited to
   * whichever journey a reader assumed.
   */
  function papersWithOpenableMove(): {
    readonly papers: ReadonlySet<string>;
    readonly files: number;
  } {
    const dir = join(ROOT, "content/equations/derivations");
    const chains = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(ya?ml|json)$/.test(f)) : [];
    const papers = new Set<string>();
    for (const file of chains) {
      const text = readFileSync(join(dir, file), "utf8");
      if (!/isMove:\s*true|"isMove":\s*true/.test(text)) continue;
      const match = /"paper"\s*:\s*"([^"]+)"|^paper:\s*"?([\w-]+)"?/m.exec(text);
      const paper = match?.[1] ?? match?.[2];
      // A chain with a move and no paper is a finding, not something to attribute by guesswork.
      expect(paper, `chain ${file} marks a move but names no paper`).toBeDefined();
      if (paper !== undefined) papers.add(paper);
    }
    return { papers, files: chains.length };
  }

  it("the move-in-a-derivation-chain gap is measured per paper, not by counting files", () => {
    const { papers, files } = papersWithOpenableMove();
    const covered = JOURNEYS.filter((j) => papers.has(j.paper)).map((j) => j.paper);
    const bare = JOURNEYS.filter((j) => !papers.has(j.paper)).map((j) => j.paper);
    console.log(
      `[journey move chains] ${covered.length} of ${JOURNEYS.length} journeys have their move in a derivation chain a reader can open; ` +
        `${files} chain file(s) on disk | openable: ${covered.join(", ") || "none"} | prose only: ${bare.join(", ") || "none"}`,
    );
    // Floors, not equalities: freezing this at 1 of 4 would turn correct work red, and asserting
    // 4 of 4 would assert the fix rather than measure the state.
    expect(files).toBeGreaterThan(0);
    expect(covered.length).toBeGreaterThanOrEqual(1);
    // Every chain's paper is one of the four, so a typo in a chain cannot inflate the coverage.
    expect([...papers].filter((p) => !JOURNEYS.some((j) => j.paper === p))).toEqual([]);
  });

  it("a journey without an openable move DECLARES it, and one with an openable move does not", () => {
    // This is what makes the hardcoded MOVE_CHAIN_MISSING set in realJourneys.ts safe. That module
    // cannot read the filesystem -- it is reachable from the discover pages, where a node: import
    // is the defect am-t84m gates against -- so the agreement between the set and the chains on
    // disk is checked here instead. Author a chain and this test names the paper to remove.
    const { papers } = papersWithOpenableMove();
    const wrong: string[] = [];
    for (const journey of REAL_JOURNEYS) {
      const declares = (journey.pendingElements ?? []).some(
        (pe) => pe.element === "move.derivationChain",
      );
      const openable = papers.has(journey.paper);
      if (openable && declares) {
        wrong.push(`${journey.paper}: has an openable move chain but still declares it pending`);
      }
      if (!openable && !declares) {
        wrong.push(`${journey.paper}: move is prose only and nothing declares it pending`);
      }
    }
    expect(wrong).toEqual([]);
    // Non-vacuity in both directions: the corpus really does hold one of each case, so neither
    // branch above is unreachable and a run that passes has exercised both.
    const declaring = REAL_JOURNEYS.filter((j) =>
      (j.pendingElements ?? []).some((pe) => pe.element === "move.derivationChain"),
    );
    console.log(
      `[journey move declarations] ${declaring.length} of ${REAL_JOURNEYS.length} declare move.derivationChain pending: ` +
        `${declaring.map((j) => j.paper).join(", ")}`,
    );
    expect(declaring.length).toBeGreaterThan(0);
    expect(declaring.length).toBeLessThan(REAL_JOURNEYS.length);
    // And every declaration carries the two fields that make it a declaration rather than a label.
    for (const journey of declaring) {
      const entry = (journey.pendingElements ?? []).find(
        (pe) => pe.element === "move.derivationChain",
      );
      expect(entry?.reason?.length ?? 0).toBeGreaterThan(80);
      expect(entry?.ownerBead).toBeTruthy();
    }
  });

  it("the four records now exist, and the gates run on them", () => {
    // THIS TRIPWIRE HAS FIRED, AS DESIGNED. It asserted content/journeys/ was EMPTY, so that this file
    // could not be mistaken for the migration am-4k0m asks for. The records now exist, emitted from the
    // same typed modules by scripts/emit-journey-records.ts, and realJourneys.test.ts proves each one
    // parses back to exactly the journey the page renders. So the assertion flips from "no population
    // yet" to "the population is these four".
    //
    // What is still outstanding is the DIRECTION of the dependency: the pages render from the modules
    // and the records are emitted FROM them. Pointing the pages at the records is the remaining step,
    // and the equality proof is what will make it safe.
    const dir = join(ROOT, "content/journeys");
    const records = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => /\.ya?ml$/.test(f))
          .map((f) => f.replace(/\.ya?ml$/, ""))
          .sort()
      : [];
    expect(records).toEqual(JOURNEYS.map((j) => j.paper).sort());
  });
});
