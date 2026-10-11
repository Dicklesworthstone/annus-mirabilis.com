/**
 * THE JOURNEY FORMULAS' CHECKER, AND THE SHAPES IT MUST REFUSE (am-hk4b).
 *
 * THE DEFECT, as that bead measured it and as the first test below reproduces: 739 lines and 39
 * authored entries with NOTHING READING THEM -- no loader, no renderer, no test, no checker -- so a
 * `quantityId` naming nothing, a `latex` matching no formula on the page, or a `step` naming no
 * derivation step would all have sat there indefinitely. They were reached only by lint-voice, which
 * walks all of `content/` for prose, so their editorial voice was gated and their meaning was not.
 *
 * IN THE BUN LANE, while the gate it proves runs as a registered step over the real corpus, which is
 * the lane independence AGENTS.md asks for: "keep a version of its proof in a DIFFERENT lane from
 * the one it controls."
 *
 * EVERY PLANT WRITES INTO A FRESH TEMPORARY ROOT, so the real records are never edited -- RULE 1
 * forbids it and no reviewer should have to -- and the site map is handed in rather than imported,
 * which is what lets a plant reach the predicate without a page.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkJourneyExplanations,
  type JourneySites,
  journeyExplanationCensusLine,
} from "./journeyExplanations.ts";

const ROOT = process.cwd();

/** The two investigate pages' real derivation steps, as the CLI supplies them. */
function liveSites(): JourneySites {
  // Imported rather than regexed, for the reason the CLI's docblock gives: a source pattern over a
  // `const steps = [...]` array has undercounted a registry in this repository before.
  return new Map<string, string>();
}

/**
 * Block-style YAML, because `strictParse` REFUSES A FLOW MAPPING.
 *
 * The first version of this helper wrote `- ${JSON.stringify(entry)}`, which is valid YAML and
 * which js-yaml accepts; the project's own parser answered
 * `YAML Parse Error at line 3, col 1: Expected key: value mapping but got ""latex":"E=mc^2""` and
 * every plant below came back as `journey-explanation-unreadable` -- eight tests failing for one
 * reason that had nothing to do with what any of them was testing. A fixture written in a dialect
 * the real loader rejects tests the fixture.
 *
 * Scalars are emitted with JSON.stringify, which is a valid YAML double-quoted scalar and is what
 * keeps a latex backslash intact; structure is emitted as blocks.
 */
function yamlOf(value: unknown, indent: string): string {
  if (Array.isArray(value))
    return value
      .map((item) =>
        item !== null && typeof item === "object"
          ? `${indent}- ${yamlOf(item, `${indent}  `).trimStart()}`
          : `${indent}- ${JSON.stringify(item)}`,
      )
      .join("\n");
  if (value !== null && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) =>
        inner !== null && typeof inner === "object"
          ? `${indent}${key}:\n${yamlOf(inner, `${indent}  `)}`
          : `${indent}${key}: ${JSON.stringify(inner)}`,
      )
      .join("\n");
  return `${indent}${JSON.stringify(value)}`;
}

function scratch(page: string, formulas: readonly unknown[]): string {
  const root = mkdtempSync(join(tmpdir(), "am-journey-expl-"));
  mkdirSync(join(root, "content", "journey-explanations"), { recursive: true });
  writeFileSync(
    join(root, "content", "journey-explanations", "probe.yaml"),
    `page: ${JSON.stringify(page)}\nformulas:\n${yamlOf(formulas, "  ")}\n`,
    "utf8",
  );
  return root;
}

const PASS_ALL = {
  sites: new Map([["discover/probe|a-step", "E=mc^2"]]) as JourneySites,
  pageFormulaLatex: new Set(["p=h/\\lambda", "D=kT"]),
  isRegisteredQuantity: (id: string) => id === "restEnergy",
  hasDisplayRecord: (id: string) => id === "eq-s0-d1",
};

const GOOD_STEP = {
  latex: "E=mc^2",
  step: "a-step",
  inWords: [{ text: "the rest energy", quantityId: "restEnergy" }],
  r3: "A cited note.",
};

describe("the three declared shapes are read, and anything else is refused", () => {
  test("a well-formed entry of each kind passes, so no plant below passes by accident", () => {
    const root = scratch("discover/probe", [
      GOOD_STEP,
      { latex: "p=h/\\lambda", display: "eq-s0-d1" },
      {
        latex: "D=kT",
        own: {
          inWords: [{ text: "the rest energy", quantityId: "restEnergy" }],
          r0: "one breath",
          r1: "the full explanation",
          r2: [{ latex: "D=kT", why: "because" }],
          r3: "the margin",
        },
      },
    ]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems).toEqual([]);
    expect(report.census.step).toBe(1);
    expect(report.census.display).toBe(1);
    expect(report.census.own).toBe(1);
    expect(report.census.stepsMatched).toBe(1);
  });

  test("PLANTED: an entry matching no declared shape is REFUSED, not dropped", () => {
    // Criterion 2, and the reason it matters here more than usually: 28 of the 39 real entries match
    // no shape the records' own headers describe, so a loader that silently skipped the
    // unrecognised would have reported 11 of 11 clean and the bead would have stayed invisible.
    const root = scratch("discover/probe", [{ latex: "E=mc^2", note: "no kind at all" }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-kind"]);
    expect(report.problems[0]?.message).toContain('"latex"');
    expect(report.problems[0]?.message).toContain('"note"');
    // Refused rather than dropped: it is not counted as an entry either.
    expect(report.census.entries).toBe(0);
  });

  test("PLANTED: a step naming no derivation step is reported by name", () => {
    const root = scratch("discover/probe", [{ ...GOOD_STEP, step: "no-such-step" }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-unknown-step"]);
    expect(report.problems[0]?.message).toContain("no-such-step");
  });

  test("PLANTED: a step whose latex disagrees with the step's own formula is caught", () => {
    // The join is the formula, not only the id. Without this an entry could gloss the wrong formula
    // while naming a real step, which the id alone cannot see.
    const root = scratch("discover/probe", [{ ...GOOD_STEP, latex: "E=mc^3" }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual([
      "journey-explanation-step-latex-disagrees",
    ]);
    expect(report.problems[0]?.message).toContain("E=mc^2");
    expect(report.problems[0]?.message).toContain("E=mc^3");
  });

  test("PLANTED: a quantityId that is not canonical is named", () => {
    const root = scratch("discover/probe", [
      { ...GOOD_STEP, inWords: [{ text: "something", quantityId: "notAQuantity" }] },
    ]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-unknown-quantity"]);
    expect(report.problems[0]?.message).toContain("notAQuantity");
  });

  test("PLANTED: a display pointing at no equation-explanations record is named", () => {
    // The latex is one the page DOES draw, so this plant isolates the missing record. Its first
    // version used "x", which also failed the page-formula check and produced two problems -- a
    // plant that trips two predicates says nothing about either.
    const root = scratch("discover/probe", [{ latex: "p=h/\\lambda", display: "eq-s9-d9" }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual([
      "journey-explanation-missing-display-record",
    ]);
    expect(report.problems[0]?.message).toContain("eq-s9-d9");
  });

  test("PLANTED: a non-step entry naming a formula no page draws is named", () => {
    const root = scratch("discover/probe", [{ latex: "E=mc^4", display: "eq-s0-d1" }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-unknown-formula"]);
    expect(report.problems[0]?.message).toContain("E=mc^4");
  });

  test("PLANTED: an `own` entry short of a reading level is named, and r2 is a STEP LIST", () => {
    /*
     * r2 is "show every step", a list of { latex, why }, not prose: equationExplanations.ts:14 says
     * so. A first version of the checker asked `typeof === "string"` for all four levels and
     * reported all 8 real `own` entries as missing r2, which was the instrument and not the corpus.
     * So both directions are asserted: a well-formed step list counts as present (the first test
     * above), and prose in r2's place does not.
     */
    const base = {
      inWords: [{ text: "the rest energy", quantityId: "restEnergy" }],
      r0: "a",
      r1: "b",
      r3: "d",
    };
    const proseR2 = scratch("discover/probe", [
      { latex: "D=kT", own: { ...base, r2: "every step, as prose" } },
    ]);
    const missingWhy = scratch("discover/probe", [
      { latex: "D=kT", own: { ...base, r2: [{ latex: "D=kT" }] } },
    ]);
    const emptyR2 = scratch("discover/probe", [{ latex: "D=kT", own: { ...base, r2: [] } }]);
    for (const [label, root] of [
      ["prose in r2's place", proseR2],
      ["a step with no why", missingWhy],
      ["an empty step list", emptyR2],
    ] as const) {
      const report = checkJourneyExplanations(root, PASS_ALL);
      expect(
        report.problems.map((p) => p.code),
        label,
      ).toEqual(["journey-explanation-missing-level"]);
      expect(report.problems[0]?.message, label).toContain("r2");
    }
  });

  test("PLANTED: two entries on one page naming the same latex are refused", () => {
    const root = scratch("discover/probe", [GOOD_STEP, { ...GOOD_STEP, r3: "a second note." }]);
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-duplicate"]);
    expect(report.census.entries).toBe(1);
  });

  test("PLANTED: a file with no page declares nothing placeable", () => {
    const root = mkdtempSync(join(tmpdir(), "am-journey-expl-"));
    mkdirSync(join(root, "content", "journey-explanations"), { recursive: true });
    writeFileSync(
      join(root, "content", "journey-explanations", "probe.yaml"),
      "formulas:\n  - latex: x\n    step: a-step\n",
      "utf8",
    );
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.problems.map((p) => p.code)).toEqual(["journey-explanation-no-page"]);
  });

  test("an empty family reads as 0 of its declared steps glossed, not as clean", () => {
    // The vacuity direction: a run that read nothing must not look like a run that found nothing.
    const root = mkdtempSync(join(tmpdir(), "am-journey-expl-"));
    const report = checkJourneyExplanations(root, PASS_ALL);
    expect(report.census.entries).toBe(0);
    expect(report.census.stepsMatched).toBe(0);
    expect(report.census.stepsDeclared).toBe(1);
    expect(report.census.pageFormulasMatched).toBe(0);
    expect(report.census.pageFormulasDeclared).toBe(2);
    // Both halves of the population appear in `missing`, so a reader of an empty run is told which
    // sites went unglossed rather than only how many.
    expect(report.missing).toEqual(["D=kT", "discover/probe|a-step", "p=h/\\lambda"]);
    expect(journeyExplanationCensusLine(report.census)).toContain(
      "0 of 1 declared derivation steps and 0 of 2 declared page formulas glossed",
    );
  });
});

describe("the live family", () => {
  test("[census] 39 entries, and the step glosses cover every declared step", () => {
    // The real site map is not imported here, for lane independence: this file judges the checker,
    // and the CLI judges the corpus. What is asserted is the part that needs no site map.
    const report = checkJourneyExplanations(ROOT, {
      sites: liveSites(),
      pageFormulaLatex: new Set<string>(),
      isRegisteredQuantity: () => true,
      hasDisplayRecord: () => true,
    });
    console.log(`[journey-explanations] ${journeyExplanationCensusLine(report.census)}`);
    expect(report.census.files).toBe(6);
    expect(report.census.entries).toBe(39);
    expect(report.census.step).toBe(28);
    expect(report.census.own).toBe(8);
    expect(report.census.display).toBe(3);
    expect(report.census.boundPhrases).toBe(128);
    // Every `own` entry carries all four levels, which is what makes the shape decision in
    // journeyExplanations.ts load-bearing: the 28 step glosses carry r3 alone and cannot be
    // migrated to this shape without inventing r0, r1 and r2 for each.
    for (const entry of report.entries.filter((e) => e.kind === "own"))
      expect(entry.levels, entry.latex).toEqual(["r0", "r1", "r2", "r3"]);
    for (const entry of report.entries.filter((e) => e.kind === "step"))
      expect(entry.levels, entry.latex).toEqual(["r3"]);
  });
});
