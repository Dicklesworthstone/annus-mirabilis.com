/**
 * EVERY paper's result cards resolve, derived from the slug registry rather than named.
 *
 * WHY THIS FILE EXISTS. On 2026-10-19 a segmentation repair moved two cards' sentence ordinals.
 * One was caught, by `dodBrownian.test.ts`, which checks brownian-motion. The other sat in
 * `content/results/light-quanta.yaml`, which NO test read: mass-energy and special-relativity
 * have their own result-card tests, brownian-motion is covered by its definition-of-done file,
 * and light-quanta had nothing. The checker reported it as "8 cards, 1 problem" where the true
 * figure is 9, because `loadResultCards` stops collecting a card's printed excerpts at the first
 * unresolved one.
 *
 * Three papers covered by three differently-shaped tests is how the fourth goes unwatched, so
 * this asks the one question of all of them at once, over `PAPER_SLUGS` rather than a hand-typed
 * list: a paper added later is covered the day its slug is registered, without anyone
 * remembering this file.
 *
 * It does NOT duplicate the per-paper tests. Those assert what their paper's cards SAY --
 * anchors, arguments, probes, decoders, the ledger links. This asserts only that every card in
 * every file resolves against its German face, which is the property the segmentation repair
 * broke and the one no single-paper test can hold.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import { PAPER_SLUGS } from "../schemas/source.pure.ts";
import { checkResultCards, hasResultCards, loadResultCards, resultContext } from "./resultCards.ts";

const ROOT = process.cwd();

describe("every paper's result cards resolve against its German face", () => {
  test("no card in any file names a sentence, anchor or argument the face lacks", () => {
    const problems: string[] = [];
    const counts: string[] = [];
    let cards = 0;
    let papersWithCards = 0;

    for (const slug of PAPER_SLUGS) {
      if (!hasResultCards(ROOT, slug)) continue;
      papersWithCards += 1;
      const loaded = loadResultCards(ROOT, slug);
      expect(
        loaded,
        `${slug}: has a results file but loadResultCards returned null`,
      ).not.toBeNull();
      if (!loaded) continue;
      cards += loaded.cards.length;
      counts.push(`${slug} ${loaded.cards.length}`);
      for (const problem of loaded.problems) problems.push(problem);
    }

    expect(problems).toEqual([]);
    // Named denominators beside the verdict: a run that found no results file at all would
    // otherwise report zero problems and read exactly like this one.
    expect(papersWithCards).toBeGreaterThanOrEqual(4);
    expect(cards).toBeGreaterThanOrEqual(30);
    const vacuous = reportPopulation({
      gate: "every-paper-result-cards",
      examined: cards,
      noun: `result cards checked against their German face (${counts.join(", ")})`,
      minimum: 30,
    });
    expect(vacuous).toBe(false);
  });

  test("the registry is what decides which papers are checked, not a list in this file", () => {
    // The guard against the defect this file exists for: a hand-typed list of papers is how
    // light-quanta came to be unwatched while three of its siblings were covered.
    expect(PAPER_SLUGS.length).toBeGreaterThanOrEqual(4);
    for (const slug of PAPER_SLUGS) {
      const file = join(ROOT, "content", "results", `${slug}.yaml`);
      expect(hasResultCards(ROOT, slug), `${slug}: hasResultCards disagrees with the file`).toBe(
        existsSync(file),
      );
    }
  });

  test("CONTROL: an ordinal past the end of a block is reported", () => {
    /*
     * The exact defect, driven through the real checker against the real German face. Without it
     * a `checkResultCards` that returned `problems: []` unconditionally would pass everything
     * above, and that is indistinguishable from a corpus with nothing wrong.
     *
     * The card is synthetic and the file on disk is not touched: `checkResultCards` takes the
     * parsed YAML as an argument, so the plant is a literal.
     */
    const context = resultContext(ROOT, "brownian-motion");
    expect(context, "brownian-motion has no German face to check against").not.toBeUndefined();
    if (!context) return;

    const good = {
      cards: [
        {
          id: "planted-card",
          title: "A planted card",
          section: "s4",
          printed: [{ anchor: "s4-p6", sentences: [5] }],
          oneSentence: "A planted card quoting a sentence the face publishes.",
        },
      ],
    };
    const bad = {
      cards: [
        {
          ...good.cards[0],
          printed: [{ anchor: "s4-p6", sentences: [999] }],
        },
      ],
    };

    // The ordinal is the only difference, so whatever else the checker says about this card it
    // says about both, and the extra problem below is the ordinal's.
    const goodProblems = checkResultCards(good, context).problems;
    const badProblems = checkResultCards(bad, context).problems;
    expect(badProblems.length).toBeGreaterThan(goodProblems.length);
    expect(badProblems.some((p) => /s4-p6 has \d+ sentences, not 999/.test(p))).toBe(true);
    expect(goodProblems.some((p) => /sentences, not/.test(p))).toBe(false);
  });
});
