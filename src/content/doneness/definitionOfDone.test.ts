/**
 * THE DEFINITION-OF-DONE REPORT, AND THE THREE PROPERTIES IT EXISTS FOR (am-definition-of-done-as-code-8w1c).
 *
 * Measured over the real corpus and the built site on 2026-10-05: 60 cells, 15 items by 4 papers, of
 * which 29 are met, 3 are short and 28 are unmeasured. The three short cells are all `tour-present`:
 * only mass-energy has a tour record.
 *
 * The properties, in the order they matter:
 *
 * 1. A ZERO DENOMINATOR IS `unmeasured`, NEVER `met`. Asserted in BOTH directions, because one
 *    direction is free: a report that called everything unmeasured would satisfy "no empty population
 *    is met" while measuring nothing.
 * 2. A PLANTED REGRESSION IS REPORTED, AND NAMES THE ITEM. Four plants below, each on a different
 *    item, each driven by removing one real record from a copy of the real corpus rather than by
 *    constructing a fixture that agrees with the predicate.
 * 3. NO AGGREGATE PERCENTAGE. AGENTS.md forbids "a single flattering completeness percentage"; the
 *    formatted report is asserted to contain no per-cent sign at all.
 */

import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DONENESS_PAPERS,
  type DonenessCell,
  formatDoneness,
  paperDoneness,
  siteDoneness,
} from "./definitionOfDone.ts";

const ROOT = process.cwd();
const PAPER = "mass-energy" as const;

const cellOf = (cells: readonly DonenessCell[], item: string): DonenessCell => {
  const found = cells.find((c) => c.item === item);
  if (!found) throw new Error(`no cell named ${item}; the report's item list changed`);
  return found;
};

/**
 * A copy of everything one paper's report reads, in a temp directory, so a plant removes a record
 * without touching the repository. Nothing is deleted from the checkout.
 */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "doneness-"));
  for (const rel of [
    `content/source-blocks/${PAPER}/manifest.yaml`,
    `content/translation-units/${PAPER}`,
    `content/alignments/${PAPER}.yaml`,
    `content/bindings/${PAPER}.yaml`,
    `content/display-terms/${PAPER}.yaml`,
    `content/misconceptions/${PAPER}`,
    "content/tours",
    `out/papers/${PAPER}/view/german/index.html`,
    `out/papers/${PAPER}/view/english/index.html`,
  ]) {
    const to = join(root, rel);
    mkdirSync(join(to, ".."), { recursive: true });
    cpSync(join(ROOT, rel), to, { recursive: true });
  }
  return root;
}

describe("the report over the real corpus", () => {
  const report = siteDoneness(ROOT);

  it("covers every paper and every item, with nothing silent", () => {
    expect(report.map((p) => p.paper)).toEqual([...DONENESS_PAPERS]);
    const widths = new Set(report.map((p) => p.cells.length));
    // One item list for every paper, or the table is not comparable across them.
    expect(widths.size).toBe(1);
    const total = report.reduce((n, p) => n + p.cells.length, 0);
    const met = report.flatMap((p) => p.cells).filter((c) => c.state === "met").length;
    const short = report.flatMap((p) => p.cells).filter((c) => c.state === "short").length;
    const un = report.flatMap((p) => p.cells).filter((c) => c.state === "unmeasured").length;
    // Every cell is exactly one of the three, so no cell is both and none is neither.
    expect(met + short + un).toBe(total);
    console.log(`[doneness] ${total} cells: ${met} met, ${short} short, ${un} unmeasured`);
    // Non-vacuity, as a floor: a run that measured almost nothing would satisfy every identity above.
    expect(met).toBeGreaterThanOrEqual(20);
  });

  it("a zero denominator is unmeasured, and an unmeasured cell has a zero denominator", () => {
    const cells = report.flatMap((p) => p.cells);
    // Both directions. Either alone is satisfiable by a report that never measures anything.
    expect(cells.filter((c) => c.of === 0 && c.state !== "unmeasured")).toEqual([]);
    expect(cells.filter((c) => c.state === "unmeasured" && c.of !== 0)).toEqual([]);
    // And an unmeasured cell never carries a numerator, so it cannot be read as partial credit.
    expect(cells.filter((c) => c.state === "unmeasured" && c.met !== 0)).toEqual([]);
    // Both populations are non-empty, so neither assertion is empty.
    expect(cells.some((c) => c.state === "unmeasured")).toBe(true);
    expect(cells.some((c) => c.of > 0)).toBe(true);
  });

  it("every cell carries a reason, measured or not", () => {
    for (const c of report.flatMap((p) => p.cells)) expect(c.detail.length).toBeGreaterThan(20);
  });

  it("no aggregate percentage is produced", () => {
    const text = formatDoneness(report);
    expect(text).not.toContain("%");
    // And the summary counts CELLS by state, which is a statement about this report's own reach
    // rather than about how finished the papers are.
    expect(text).toMatch(/cells: \d+ met, \d+ short, \d+ unmeasured, of \d+/);
  });
});

describe("the planted regressions", () => {
  it("the fixture copy reproduces the real verdicts, or a plant proves nothing", () => {
    const root = fixtureRoot();
    const planted = paperDoneness(root, PAPER);
    const real = paperDoneness(ROOT, PAPER);
    // Same items, same states: the plants below change one thing each from this baseline.
    expect(planted.cells.map((c) => `${c.item}:${c.state}`)).toEqual(
      real.cells.map((c) => `${c.item}:${c.state}`),
    );
  });

  it("removing one paragraph binding turns paragraphs-bound short, and names the count", () => {
    const root = fixtureRoot();
    const path = join(root, `content/bindings/${PAPER}.yaml`);
    const before = cellOf(paperDoneness(root, PAPER).cells, "paragraphs-bound");
    expect(before.state).toBe("met");
    // Drop the first paragraph binding's unit line, which is what an unbound paragraph looks like.
    const text = readFileSync(path, "utf8");
    writeFileSync(path, text.replace(/^ {2}- unit: s0-p1$/m, "  - unit: s0-p1-REMOVED"));
    const after = cellOf(paperDoneness(root, PAPER).cells, "paragraphs-bound");
    expect(after.state).toBe("short");
    expect(after.met).toBe(before.met - 1);
    expect(after.of).toBe(before.of);
    expect(after.detail).toContain(`${after.met} of ${after.of}`);
  });

  it("removing one display's terms record turns printed-displays-bound short", () => {
    const root = fixtureRoot();
    const path = join(root, `content/display-terms/${PAPER}.yaml`);
    const before = cellOf(paperDoneness(root, PAPER).cells, "printed-displays-bound");
    expect(before.state).toBe("met");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(/^ {2}- display: eq-s0-d1$/m, "  - display: eq-s0-dGONE"),
    );
    const after = cellOf(paperDoneness(root, PAPER).cells, "printed-displays-bound");
    expect(after.state).toBe("short");
    expect(after.met).toBe(before.met - 1);
  });

  it("an absent built face is unmeasured, NOT met and NOT short", () => {
    // The distinction the whole report turns on: a missing input is not a verdict about the paper.
    const root = mkdtempSync(join(tmpdir(), "doneness-nobuild-"));
    for (const rel of [
      `content/source-blocks/${PAPER}/manifest.yaml`,
      `content/translation-units/${PAPER}`,
      `content/alignments/${PAPER}.yaml`,
      `content/bindings/${PAPER}.yaml`,
      `content/display-terms/${PAPER}.yaml`,
      `content/misconceptions/${PAPER}`,
      "content/tours",
    ]) {
      const to = join(root, rel);
      mkdirSync(join(to, ".."), { recursive: true });
      cpSync(join(ROOT, rel), to, { recursive: true });
    }
    const cells = paperDoneness(root, PAPER).cells;
    for (const item of ["german-face-sentences", "english-face-units"]) {
      const c = cellOf(cells, item);
      expect(c.state).toBe("unmeasured");
      expect(c.of).toBe(0);
      expect(c.detail).toContain("bun run build");
    }
    // The record-only cells still measure, so the absence is scoped to what actually went missing.
    expect(cellOf(cells, "alignment-edges").state).toBe("met");
  });

  it("dropping an alignment edge turns alignment-edges short", () => {
    const root = fixtureRoot();
    const path = join(root, `content/alignments/${PAPER}.yaml`);
    const before = cellOf(paperDoneness(root, PAPER).cells, "alignment-edges");
    expect(before.state).toBe("met");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        /^ {6}translationUnitId: "masthead-title"$/m,
        '      translationUnitId: "masthead-title-GONE"',
      ),
    );
    const after = cellOf(paperDoneness(root, PAPER).cells, "alignment-edges");
    expect(after.state).toBe("short");
    expect(after.met).toBe(before.met - 1);
  });

  it("a misconception ledger below five is short, and one above five is met rather than over-met", () => {
    const root = fixtureRoot();
    const before = cellOf(paperDoneness(root, PAPER).cells, "misconceptions-at-least-five");
    // mass-energy carries more than the floor, and the cell reports the floor as its denominator.
    expect(before.of).toBe(5);
    expect(before.met).toBe(5);
    expect(before.detail).toMatch(/\d+ typed misconception entries/);
    const empty = mkdtempSync(join(tmpdir(), "doneness-nomisc-"));
    for (const rel of [
      `content/source-blocks/${PAPER}/manifest.yaml`,
      `content/bindings/${PAPER}.yaml`,
      `content/alignments/${PAPER}.yaml`,
      `content/display-terms/${PAPER}.yaml`,
    ]) {
      const to = join(empty, rel);
      mkdirSync(join(to, ".."), { recursive: true });
      cpSync(join(ROOT, rel), to, { recursive: true });
    }
    const after = cellOf(paperDoneness(empty, PAPER).cells, "misconceptions-at-least-five");
    expect(after.state).toBe("short");
    expect(after.met).toBe(0);
    expect(after.of).toBe(5);
  });
});
