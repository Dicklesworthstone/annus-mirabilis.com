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
 *   - move coverage includes record-backed chains and the code-built owners the reader renders.
 *     A chain counts only when its marked step matches the journey's declared move and link.
 *     Special Relativity's section 1 definition remains distinct from its section 3 derivation.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LowSpeedExplorer } from "../../equations/derivations/LowSpeedExplorer.tsx";
import { lqCoefficientCorrespondence } from "../../equations/derivations/lightQuantaEntropy.ts";
import type { LowSpeedProofView } from "../../equations/derivations/lowSpeedView.ts";
import { srSynchronizationChain } from "../../equations/derivations/srSynchronization.ts";
import generatedLowSpeed from "../../generated/mass-energy-low-speed.json";
import { LightQuantaDerivation } from "../../reader/LightQuantaDerivation.tsx";
import { SRSynchronizationDerivation } from "../../reader/SRSynchronizationDerivation.tsx";
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

/** Resolve the exact link the discover page exports, including native fragment targets. */
function moveHref(paper: string): URL {
  const module = JOURNEYS.find((journey) => journey.paper === paper);
  expect(module, `known journey ${paper}`).toBeDefined();
  const source = readFileSync(join(ROOT, module!.module), "utf8");
  const href = /export const MOVE_HREF\s*=\s*"([^"]+)"/.exec(source)?.[1];
  expect(href, `${paper} exports its move link`).toBeTruthy();
  return new URL(href!, "https://annus-mirabilis.com");
}

function markedListItem(markup: string, id: string): string {
  const targets = (markup.match(/<li\b[^>]*>/g) ?? []).filter((tag) => tag.includes(` id="${id}"`));
  expect(targets, `${id} appears on exactly one rendered step`).toHaveLength(1);
  return targets[0] ?? "";
}

/** These are the actual renderer and proof owners, never fixture chains or duplicate YAML. */
function papersWithCodeBuiltMove(): readonly string[] {
  const lightQuanta = REAL_JOURNEYS.find((journey) => journey.paper === "light-quanta")!;
  const lightHref = moveHref(lightQuanta.paper);
  expect(lightQuanta.move.chainId).toBe(lqCoefficientCorrespondence.id);
  const lightStep = lqCoefficientCorrespondence.steps.find(
    (step) => step.id === lightQuanta.move.stepId,
  );
  expect(lightStep?.isMove).toBe(true);
  expect(lightStep?.moveLabel).toBeTruthy();
  expect(lightHref.pathname).toBe("/papers/light-quanta/s6/");
  expect(lightHref.hash).toBe(`#${lightQuanta.move.stepId}`);
  const lightMarkup = renderToStaticMarkup(createElement(LightQuantaDerivation, { section: "s6" }));
  expect(markedListItem(lightMarkup, lightQuanta.move.stepId)).toContain('data-is-move="true"');
  expect(lightMarkup).toContain(`data-derivation-chain="${lightQuanta.move.chainId}"`);

  const relativity = REAL_JOURNEYS.find((journey) => journey.paper === "special-relativity")!;
  const relativityHref = moveHref(relativity.paper);
  expect(relativity.move.chainId).toBe(srSynchronizationChain.id);
  const definition = srSynchronizationChain.steps.find(
    (step) => step.id === relativity.move.stepId,
  );
  expect(definition?.isMove).toBe(true);
  expect(definition?.reasonKind).toBe("definition");
  expect(definition?.moveLabel).toBeTruthy();
  expect(relativityHref.pathname).toBe("/papers/special-relativity/s1/");
  expect(relativityHref.hash).toBe(`#${relativity.move.stepId}`);
  const relativityMarkup = renderToStaticMarkup(createElement(SRSynchronizationDerivation));
  expect(markedListItem(relativityMarkup, relativity.move.stepId)).toContain('data-is-move="true"');
  expect(relativityMarkup).toContain(`data-derivation-chain="${relativity.move.chainId}"`);

  const massEnergy = REAL_JOURNEYS.find((journey) => journey.paper === "mass-energy")!;
  const massHref = moveHref(massEnergy.paper);
  const proof = generatedLowSpeed as LowSpeedProofView;
  expect(massEnergy.move.chainId).toBe(proof.certificate.id);
  const requirement = proof.certificate.requirements.find(
    (entry) => entry.step === massEnergy.move.stepId,
  );
  expect(requirement?.premises).toContain("inertia");
  expect(massHref.pathname).toBe("/papers/mass-energy/");
  const moveAnchor = massHref.hash.slice(1);
  expect(moveAnchor).toBeTruthy();
  const wrapper = readFileSync(join(ROOT, "src/reader/MassEnergyLowSpeed.tsx"), "utf8");
  expect(wrapper).toContain(`moveAnchor="${moveAnchor}"`);
  const massMarkup = renderToStaticMarkup(
    createElement(LowSpeedExplorer, { proof, moveAnchor, restoreSettings: false }),
  );
  const massTag = markedListItem(massMarkup, moveAnchor);
  expect(massTag).toContain("data-move-step");
  const start = massMarkup.indexOf(massTag);
  const end = massMarkup.indexOf("</li>", start);
  expect(end).toBeGreaterThan(start);
  expect(massMarkup.slice(start, end)).toContain(`data-low-speed-step="${massEnergy.move.stepId}"`);
  return [lightQuanta.paper, relativity.paper, massEnergy.paper];
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
    for (const paper of papersWithCodeBuiltMove()) papers.add(paper);
    return { papers, files: chains.length };
  }

  it("the move-in-a-derivation-chain gap is measured per paper, not by counting files", () => {
    const { papers, files } = papersWithOpenableMove();
    const covered = JOURNEYS.filter((j) => papers.has(j.paper)).map((j) => j.paper);
    const bare = JOURNEYS.filter((j) => !papers.has(j.paper)).map((j) => j.paper);
    console.log(
      `[journey move chains] ${covered.length} of ${JOURNEYS.length} journeys have their move in a derivation chain a reader can open; ` +
        `${files} chain file(s) plus code-built reader owners | openable: ${covered.join(", ") || "none"} | prose only: ${bare.join(", ") || "none"}`,
    );
    // Keep the record-backed owner and all four delivered moves in the measured population.
    expect(files).toBeGreaterThan(0);
    expect(covered.length).toBe(JOURNEYS.length);
    // Every chain's paper is one of the four, so a typo in a chain cannot inflate the coverage.
    expect([...papers].filter((p) => !JOURNEYS.some((j) => j.paper === p))).toEqual([]);
  });

  it("a journey without an openable move DECLARES it, and one with an openable move does not", () => {
    // realJourneys.ts cannot inspect the filesystem: discover pages import it. Compare its
    // declarations with the record-backed and code-built production owners here instead.
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
    // All four real moves are delivered. Assert the empty declaration list directly so the old
    // exception cannot outlive its reason; the production-owner checks above hold the denominator.
    const declaring = REAL_JOURNEYS.filter((j) =>
      (j.pendingElements ?? []).some((pe) => pe.element === "move.derivationChain"),
    );
    console.log(
      `[journey move declarations] ${declaring.length} of ${REAL_JOURNEYS.length} declare move.derivationChain pending: ` +
        `${declaring.map((j) => j.paper).join(", ")}`,
    );
    expect(declaring).toEqual([]);
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
