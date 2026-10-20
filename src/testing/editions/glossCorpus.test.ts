/**
 * Rule C.6 against the corpus it governs (am-edn-alignment-tooling-do1).
 *
 * WHY THIS FILE EXISTS. `authoredInputs.ts` opens with a note naming "THE THREE POPULATIONS THE
 * EDITION TOOLING JUDGES, READ FROM DISK" and the reason: "a validator reading an argument
 * nothing passes cannot fail, and cannot pass either." That repair was made for edges and ids and
 * stopped there. Measured 2026-10-19, `bun scripts/align-editions.ts --paper <slug> --layers
 * german,translation,gloss` reported `"outcome": "passed"` for all four papers and wrote a
 * coverage report whose gloss row read `absent | 0`, while 542 authored gloss units sat in
 * content/gloss-units/. The flag was accepted and nothing ran, and the tool called the layer
 * absent rather than unloaded.
 *
 * WHAT THE FIRST REAL RUN FOUND, and why none of it was a content defect. 1238 findings, every
 * one of them an artefact of the loader rather than of the corpus, in three rounds:
 *   - 1162 `gloss-missing-token`, because the tokenizer was handed a unit's text with no math
 *     regions and read `L`, `V`, `\varphi` and a footnote mark as German words. Supplying the
 *     atom offsets took it to 48.
 *   - the last 48, because 8 of the corpus's 17 `misprint` inlines wrap a FORMULA rather than a
 *     word and the loader's walk read only `text`. Handling the nested math took it to 0.
 *   - 28 `gloss-token-collision`, because the check was stricter than the rule it audits. See
 *     `alignment.test.ts`, which carries that finding and the retired shape as a negative.
 * So the corpus was right about all 542 and the instrument was wrong three times, which is why
 * the plants below matter more than the zero.
 *
 * A ZERO HERE MEANS NOTHING ON ITS OWN. Three plants drive the loader's own output back through
 * the validator and require each predicate to fire, because a sweep that cannot fail and a sweep
 * with nothing to find are both green.
 */

import { describe, expect, test } from "bun:test";
import { reportPopulation } from "../../../scripts/gate-census/population.ts";
import {
  type GlossAlignableUnit,
  type ValidateGlossInput,
  validateGloss,
} from "../../content/editions/alignment.ts";
import { loadGlossInput } from "../../content/editions/authoredInputs.ts";
import type { RouteSlug } from "../../content/ids.ts";
import { spanTextDigest } from "../../content/schemas/spans.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** The smallest count that is not vacuous, per paper, well under the measured figures. */
const FLOOR: Readonly<Record<(typeof PAPERS)[number], number>> = {
  "mass-energy": 30,
  "light-quanta": 150,
  "brownian-motion": 95,
  "special-relativity": 230,
};

function loadAll(): { slug: string; input: ValidateGlossInput; alignables: number }[] {
  return PAPERS.map((slug) => {
    const { glossInput, alignableUnitCount, issues } = loadGlossInput(slug as RouteSlug, ROOT);
    expect(issues, `${slug}: the loader could not read a record`).toEqual([]);
    expect(glossInput, `${slug}: no gloss input was loaded`).toBeDefined();
    return {
      slug,
      input: glossInput as ValidateGlossInput,
      alignables: alignableUnitCount,
    };
  });
}

describe("the gloss loader reaches the authored corpus", () => {
  test("every paper loads its units, and each is above a named floor", () => {
    let total = 0;
    for (const { slug, input, alignables } of loadAll()) {
      const floor = FLOOR[slug as (typeof PAPERS)[number]];
      expect(input.glossUnits.length, `${slug}: gloss units below the floor`).toBeGreaterThan(
        floor,
      );
      expect(alignables, `${slug}: alignable units below the floor`).toBeGreaterThan(floor);
      total += input.glossUnits.length;
    }
    const vacuous = reportPopulation({
      gate: "gloss-corpus",
      examined: total,
      noun: "authored gloss units loaded from content/gloss-units",
      minimum: 500,
    });
    expect(vacuous).toBe(false);
  });

  test("all six alignable kinds are addressed, not only paragraph sentences", () => {
    // Building only sentence spans would silently drop 65 of the 542 and the gaps would read as
    // a clean run, so the kinds are named rather than counted in aggregate.
    const addressed = new Set<string>();
    for (const { input } of loadAll()) {
      for (const g of input.glossUnits) {
        if (/^s\d+-p\d+-s\d+[a-z]?$/.test(g.sentenceId)) addressed.add("sentence");
        else if (/^s\d+$/.test(g.sentenceId)) addressed.add("heading");
        else if (/^s\d+-fn\d+$/.test(g.sentenceId)) addressed.add("footnote");
        else if (g.sentenceId.startsWith("closing")) addressed.add("closing");
        else if (g.sentenceId.startsWith("masthead")) addressed.add("masthead");
        else if (g.sentenceId.startsWith("part-")) addressed.add("part-heading");
      }
    }
    expect([...addressed].sort()).toEqual([
      "closing",
      "footnote",
      "heading",
      "masthead",
      "part-heading",
      "sentence",
    ]);
  });
});

describe("rule C.6 over every authored gloss unit", () => {
  test("no finding on any paper", () => {
    const perPaper: string[] = [];
    const findings: string[] = [];
    let total = 0;
    for (const { slug, input } of loadAll()) {
      const issues = validateGloss(input);
      total += input.glossUnits.length;
      perPaper.push(`${slug} ${input.glossUnits.length}`);
      for (const i of issues) findings.push(`${slug}/${i.sourceId}: ${i.code}: ${i.message}`);
    }
    expect(findings).toEqual([]);
    expect(perPaper).toHaveLength(4);
    const vacuous = reportPopulation({
      gate: "gloss-rule-c6",
      examined: total,
      noun: "gloss units validated against their alignable unit",
      minimum: 500,
    });
    expect(vacuous).toBe(false);
  });

  test("CONTROL: a changed German sentence makes its real gloss stale", () => {
    const { input } = loadAll()[2] as { input: ValidateGlossInput }; // brownian-motion
    const target = input.glossUnits[0];
    expect(target).toBeDefined();
    const edited = input.alignableUnits.map((u) =>
      u.id === target?.sentenceId ? { ...u, text: `${u.text} Ein zusätzliches Wort.` } : u,
    );
    const issues = validateGloss({ ...input, alignableUnits: edited });
    const stale = issues.filter((i) => i.code === "gloss-stale");
    expect(stale).toHaveLength(1);
    expect(stale[0]?.sourceId).toBe(target?.sentenceId as string);
  });

  test("CONTROL: dropping a token's gloss makes the real unit incomplete", () => {
    const { input } = loadAll()[0] as { input: ValidateGlossInput }; // mass-energy
    const target = input.glossUnits.find((g) => (g.glosses ?? []).length > 2);
    expect(target).toBeDefined();
    const dropped = input.glossUnits.map((g) =>
      g === target ? { ...g, glosses: (g.glosses ?? []).slice(1) } : g,
    );
    const issues = validateGloss({ ...input, glossUnits: dropped });
    expect(issues.some((i) => i.code === "gloss-missing-token")).toBe(true);
  });

  test("CONTROL: without the atom offsets, the real corpus reads as broken", () => {
    /*
     * This is the plant that matters most, because it is the defect the first run actually had
     * and the one a future refactor is likeliest to reintroduce. Strip `mathRegions` and
     * `footnoteMarks` from the loaded alignable units -- changing no text and no gloss -- and the
     * same corpus must go red, because the tokenizer then counts printed symbols as German
     * words. If this ever passes, the regions have stopped reaching the tokenizer and the green
     * run above is measuring something else.
     */
    const { input } = loadAll()[1] as { input: ValidateGlossInput }; // light-quanta
    const stripped: GlossAlignableUnit[] = input.alignableUnits.map((u) => ({
      id: u.id,
      text: u.text,
    }));
    const issues = validateGloss({ ...input, alignableUnits: stripped });
    expect(issues.length).toBeGreaterThan(50);
    expect(issues.every((i) => i.code === "gloss-missing-token")).toBe(true);
  });

  test("the stored digest is the SENTENCE's, which is what makes the green above real", () => {
    // Every unit's `sourceTextDigest` equals spanTextDigest of the alignable text the loader
    // built. A loader that sliced the wrong range, or passed a block digest, would report all
    // 477 sentence glosses stale rather than quietly agreeing.
    let checked = 0;
    for (const { input } of loadAll()) {
      const byId = new Map(input.alignableUnits.map((u) => [u.id, u]));
      for (const g of input.glossUnits) {
        const unit = byId.get(g.sentenceId);
        if (!unit || !g.sourceTextDigest) continue;
        expect(spanTextDigest(unit.text), `digest mismatch on ${g.sentenceId}`).toBe(
          g.sourceTextDigest,
        );
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});
