/**
 * THE DEFINITION-OF-DONE CELLS (am-definition-of-done-as-code-8w1c).
 *
 * Two kinds of test, and the split is deliberate. The invariants and the plants run against a
 * FIXTURE root built in the temp directory, so a plant never edits the real corpus and a peer's
 * content change cannot turn a plant green. The agreement tests run against the REAL root, because
 * the one thing a fixture cannot check is whether the measurements agree with the figures this
 * repository already records about itself.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DONE_ITEMS, DoneCellError, doneCell, formatCell, measuredCount } from "./cells.ts";
import {
  allCells,
  cellsForPaper,
  DONE_PAPERS,
  displaysBound,
  paragraphsBound,
  resultsCardsPrinted,
} from "./measure.ts";

const REAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A root holding one paper's records, enough for the three items the plants target. */
function fixtureRoot(options?: {
  readonly dropResultsCard?: boolean;
  readonly dropParagraphBinding?: boolean;
  readonly declaredOnly?: boolean;
}): string {
  const root = mkdtempSync(join(tmpdir(), "am-dod-"));
  const paper = "mass-energy";
  mkdirSync(join(root, "content", "source-blocks", paper), { recursive: true });
  mkdirSync(join(root, "content", "bindings"), { recursive: true });
  mkdirSync(join(root, "content", "results"), { recursive: true });

  const units = [
    { id: "s0-p1", kind: "paragraph" },
    { id: "s0-p2", kind: "paragraph" },
    { id: "eq-1", kind: "display-equation" },
  ];
  writeFileSync(
    join(root, "content", "source-blocks", paper, "manifest.yaml"),
    `paper: ${paper}\nunits:\n${units.map((u) => `  - id: "${u.id}"\n    kind: "${u.kind}"`).join("\n")}\n`,
    "utf8",
  );

  const paragraphs = options?.dropParagraphBinding
    ? [`  - unit: "s0-p1"\n    passages: [arg-a]`]
    : options?.declaredOnly
      ? [
          `  - unit: "s0-p1"\n    passages: [arg-a]`,
          `  - unit: "s0-p2"\n    status: "printed-only"\n    reason: "no passage states this line"`,
        ]
      : [`  - unit: "s0-p1"\n    passages: [arg-a]`, `  - unit: "s0-p2"\n    passages: [arg-b]`];
  const displays = options?.declaredOnly
    ? `  - unit: "eq-1"\n    status: "printed-only"\n    reason: "explained inside a passage"`
    : `  - unit: "eq-1"\n    equations: [eq-me-rest]`;
  writeFileSync(
    join(root, "content", "bindings", `${paper}.yaml`),
    `paper: ${paper}\nparagraphs:\n${paragraphs.join("\n")}\ndisplays:\n${displays}\n`,
    "utf8",
  );

  const cards = options?.dropResultsCard
    ? `  - id: "a"\n    printed: []\n  - id: "b"\n    printed:\n      - anchor: "s0-p1"`
    : `  - id: "a"\n    printed:\n      - anchor: "s0-p1"\n  - id: "b"\n    printed:\n      - anchor: "s0-p2"`;
  writeFileSync(
    join(root, "content", "results", `${paper}.yaml`),
    `paper: ${paper}\ncards:\n${cards}\n`,
    "utf8",
  );
  return root;
}

describe("the cell constructor enforces the rule the first criterion names", () => {
  test("a zero denominator is unmeasured and NEVER met, however the count reads", () => {
    const cell = doneCell("tour-present", "mass-energy", 0, 0, "nothing to read");
    expect(cell.unmeasured).toBe(true);
    expect(cell.met).toBe(false);
    expect(formatCell(cell)).toBe("unmeasured");
  });

  test("a full count over a real denominator is met", () => {
    const cell = doneCell("paragraphs-bound", "mass-energy", 12, 12, "all bound");
    expect(cell.met).toBe(true);
    expect(formatCell(cell)).toBe("12 of 12");
  });

  test("a numerator above its denominator THROWS, because the two are different populations", () => {
    // Not defensive. This is the error the whole report exists to make visible, and it happened
    // while writing it: the bindings cover four footnotes beyond the 94 paragraphs, so a numerator
    // taken from the bindings against a denominator taken from the manifest reads 98 of 94.
    expect(() => doneCell("paragraphs-bound", "x", 98, 94, "")).toThrow(/same population/);
  });

  test("a negative or fractional count throws rather than rounding", () => {
    expect(() => doneCell("tour-present", "x", -1, 3, "")).toThrow(DoneCellError);
    expect(() => doneCell("tour-present", "x", 1.5, 3, "")).toThrow(DoneCellError);
  });

  test("and each refusal carries its code as a CODE, not inside the message", () => {
    // The throw-site census reads a standalone kebab string in the thrown expression. Three bare
    // RangeErrors sat here until the bare-throw ratchet refused them, offering a baseline entry
    // instead; AGENTS.md says a baseline is a debt and not a budget, so they were coded.
    const codes: string[] = [];
    for (const attempt of [
      () => doneCell("tour-present", "x", -1, 3, ""),
      () => doneCell("tour-present", "x", 1, -3, ""),
      () => doneCell("tour-present", "x", 98, 94, ""),
    ]) {
      try {
        attempt();
      } catch (error) {
        codes.push(
          error instanceof DoneCellError ? error.code : `not-a-DoneCellError:${String(error)}`,
        );
      }
    }
    expect(codes).toEqual([
      "done-cell-count",
      "done-cell-denominator",
      "done-cell-population-mismatch",
    ]);
  });
});

describe("PLANTS: removing a binding or a card takes its item out of met, naming it", () => {
  test("a results card with an empty printed layer is not met, and the cell says 1 of 2", () => {
    const clean = resultsCardsPrinted(fixtureRoot(), "mass-energy");
    expect(clean.met).toBe(true);
    expect(formatCell(clean)).toBe("2 of 2");

    const planted = resultsCardsPrinted(fixtureRoot({ dropResultsCard: true }), "mass-energy");
    expect(planted.met).toBe(false);
    expect(planted.unmeasured).toBe(false);
    expect(formatCell(planted)).toBe("1 of 2");
    // Named: the item and the paper are on the cell, which is what a gate would report.
    expect(planted.item).toBe("results-cards-printed");
    expect(planted.paper).toBe("mass-energy");
  });

  test("a paragraph whose binding is removed is not met, and the cell says 1 of 2", () => {
    const clean = paragraphsBound(fixtureRoot(), "mass-energy");
    expect(clean.met).toBe(true);
    const planted = paragraphsBound(fixtureRoot({ dropParagraphBinding: true }), "mass-energy");
    expect(planted.met).toBe(false);
    expect(formatCell(planted)).toBe("1 of 2");
  });
});

describe("A DECLARED STATUS IS COVERAGE, which three measurements got wrong first", () => {
  test("a paragraph bound by a declared status counts, and the note says how many", () => {
    // The first version required a non-empty `passages` and reported relativity at 93 of 94,
    // because two of its paragraphs use the declared form. content/bindings' own header says
    // "bound to an equation record OR GIVEN A DECLARED STATUS".
    const cell = paragraphsBound(fixtureRoot({ declaredOnly: true }), "mass-energy");
    expect(cell.met).toBe(true);
    expect(formatCell(cell)).toBe("2 of 2");
    expect(cell.note).toContain("1 by a declaration");
  });

  test("a display bound by a declared status counts too", () => {
    const cell = displaysBound(fixtureRoot({ declaredOnly: true }), "mass-energy");
    expect(cell.met).toBe(true);
    expect(cell.note).toContain("1 by a declaration");
  });
});

describe("against the real corpus, the numbers agree with what this repository records", () => {
  const cells = allCells(REAL_ROOT);

  test("the population is real, and says how much of the table is measured", () => {
    const measured = measuredCount(cells);
    console.log(
      `[census] definition-of-done measured ${measured} of ${cells.length} cells across ${DONE_PAPERS.length} papers`,
    );
    expect(cells.length).toBe(DONE_PAPERS.length * DONE_ITEMS.length);
    // Floors, not equalities: measuring MORE items must not fail this.
    expect(measured).toBeGreaterThanOrEqual(20);
  });

  test("the manifest denominators are the ones AGENTS.md states: 334, 237, 552, 77", () => {
    // AGENTS.md's status block records these after the 2026-10-09 re-measurement. Agreement is the
    // check: a report that disagreed with the figures the repository already publishes about itself
    // would be measuring something else.
    //
    // THESE MOVE ON CORRECT WORK, and that is the intended maintenance rather than a defect in the
    // test. They read 263, 178, 436, 53 until the inline-equation units landed on 2026-10-09 and
    // 270 units were added across the four papers. The pairing is deliberate: this test exists to
    // force the published figure and the measured one to be updated in the SAME change, so a status
    // block cannot drift away from the corpus it describes. A floor would not catch that drift,
    // which is the whole point, so it stays an equality -- but it is an equality between two things
    // in this repository, never a number copied from a bead.
    const expected: Record<string, number> = {
      "light-quanta": 334,
      "brownian-motion": 237,
      "special-relativity": 552,
      "mass-energy": 77,
    };
    for (const [paper, denominator] of Object.entries(expected)) {
      const cell = cells.find((c) => c.paper === paper && c.item === "manifest-units-covered");
      expect(cell?.denominator).toBe(denominator);
      expect(cell?.met).toBe(true);
    }
  });

  test("the sentence denominators are the ones AGENTS.md states: 135, 91, 223, 28", () => {
    const expected: Record<string, number> = {
      "light-quanta": 135,
      "brownian-motion": 91,
      "special-relativity": 223,
      "mass-energy": 28,
    };
    for (const [paper, denominator] of Object.entries(expected)) {
      const cell = cells.find((c) => c.paper === paper && c.item === "english-units-present");
      expect(cell?.denominator).toBe(denominator);
    }
  });

  test("relativity has 98 printed displays, as AGENTS.md records, and all are bound", () => {
    const cell = cells.find((c) => c.paper === "special-relativity" && c.item === "displays-bound");
    expect(cell?.denominator).toBe(98);
    expect(cell?.met).toBe(true);
  });

  test("every unmeasured cell carries a reason, so a gap is a work item and not a silence", () => {
    const unmeasured = cells.filter((c) => c.unmeasured);
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const cell of unmeasured) {
      expect(cell.note.length).toBeGreaterThan(40);
      expect(cell.met).toBe(false);
    }
  });

  test("every paper has a cell for every item, so nothing is omitted rather than flagged", () => {
    for (const paper of DONE_PAPERS) {
      const items = cellsForPaper(REAL_ROOT, paper).map((c) => c.item);
      expect(items.slice().sort()).toEqual([...DONE_ITEMS].sort());
    }
  });
});
