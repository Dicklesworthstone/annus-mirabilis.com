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
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
    `content/journeys/${PAPER}.yaml`,
    "content/tours",
    `out/papers/${PAPER}/view/german/index.html`,
    `out/papers/${PAPER}/view/english/index.html`,
    // The lab-contract cell reads every manifest, because the binding it trusts is each manifest's
    // own sourceRefs rather than the id prefix, and it reads this paper's built laboratory pages,
    // because show-the-code is a claim about what a reader is served.
    "content/experiments",
    `content/editorial-notes/${PAPER}`,
    "out/lab/me-01/index.html",
    "out/lab/me-02/index.html",
    "out/lab/me-03/index.html",
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

  it("the margin cell reports its real count and still refuses a verdict, having no denominator", () => {
    // The reason here used to say margin entries "live in readings-owners r3 text rather than as
    // typed records". They are typed records now, and a stale reason costs a migration that has
    // already happened. The count is reported so a reader sees the state; the cell stays
    // unmeasured because the plan's REQUIRED set is prose and nothing enumerates it.
    const root = fixtureRoot();
    const c = cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries");
    expect(c.state).toBe("unmeasured");
    expect(c.of).toBe(0);
    expect(c.detail).toMatch(/^4 typed historian-margin record\(s\)/);
    expect(c.detail).toContain("no record enumerates it");
    // The count is real, not a constant: it comes from the records, so removing one moves it.
    const dir = join(root, `content/editorial-notes/${PAPER}`);
    const first = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .find((f) => {
        const record = JSON.parse(readFileSync(join(dir, f), "utf8")) as { kind?: unknown };
        return record.kind === "historian-margin";
      });
    expect(first).toBeDefined();
    const path = join(dir, first as string);
    const original = readFileSync(path, "utf8");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(original), kind: "side-note" }));
    expect(cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries").detail).toMatch(
      /^3 typed historian-margin record\(s\)/,
    );
    writeFileSync(path, original);
    // And it is still never met, whatever the count: that is the point of reporting without a verdict.
    expect(cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries").state).toBe(
      "unmeasured",
    );
  });

  it("the lab contract counts five items per instrument, bound by the manifest's own sourceRefs", () => {
    // This cell was `unmeasured` because "mapping an instrument to the paper whose claim it answers
    // needs a declared binding". The binding is declared: every manifest carries sourceRefs[].paper.
    const root = fixtureRoot();
    const before = cellOf(paperDoneness(root, PAPER).cells, "lab-contract-cells");
    expect(before.state).toBe("met");
    expect(before.of).toBe(15);
    expect(before.met).toBe(15);
    expect(before.detail).toContain("3 instrument(s)");
    // The five items are named in the detail, so "15 of 15" is readable without this file.
    for (const item of ["predict", "show-the-code", "tape", "embed", "notModeled"])
      expect(before.detail).toContain(item);

    // A 165-of-165 sweep across the site needs a control, or a predicate that cannot fail and one
    // with nothing to find look identical. Each of the four manifest items is planted separately.
    const path = join(root, `content/experiments/me-01.yaml`);
    const original = readFileSync(path, "utf8");
    for (const [item, plant] of [
      ["embed", (t: string) => t.replace(/^embeddable: true$/m, "embeddable: false")],
      [
        "notModeled",
        (t: string) => t.replace(/^notModeled:\n(?:[ \t]+.*\n)+/m, "notModeled: []\n"),
      ],
      ["tape", (t: string) => t.replace(/^tapeModel:\n(?:[ \t]+.*\n)+/m, "")],
      [
        "predict",
        (t: string) =>
          t.replace(/^predictMode:\n(?:[ \t]+.*\n)+/m, "predictMode:\n  enabled: false\n"),
      ],
    ] as const) {
      const planted_text = plant(original);
      // The plant has to LAND, or the green below is about nothing.
      expect(planted_text).not.toBe(original);
      writeFileSync(path, planted_text);
      const after = cellOf(paperDoneness(root, PAPER).cells, "lab-contract-cells");
      expect(after.state).toBe("short");
      expect(after.met).toBe(before.met - 1);
      expect(after.detail).toContain(`me-01:${item}`);
      writeFileSync(path, original);
    }
    // Restored, so the last assertion is about the real corpus again.
    expect(cellOf(paperDoneness(root, PAPER).cells, "lab-contract-cells").met).toBe(before.met);

    // show-the-code is the fifth and it comes from the BUILT page, because a manifest cannot make a
    // claim about what a reader is served. Without the page the whole cell is unmeasured, in the
    // words the ratchet's buildAbsent recognises.
    const noBuild = mkdtempSync(join(tmpdir(), "doneness-nolab-"));
    for (const rel of [
      `content/source-blocks/${PAPER}/manifest.yaml`,
      `content/alignments/${PAPER}.yaml`,
      `content/bindings/${PAPER}.yaml`,
      `content/display-terms/${PAPER}.yaml`,
      "content/experiments",
    ]) {
      const to = join(noBuild, rel);
      mkdirSync(join(to, ".."), { recursive: true });
      cpSync(join(ROOT, rel), to, { recursive: true });
    }
    const unbuilt = cellOf(paperDoneness(noBuild, PAPER).cells, "lab-contract-cells");
    expect(unbuilt.state).toBe("unmeasured");
    expect(unbuilt.detail).toContain("bun run build");
  });

  it("the journey skeleton counts thirteen elements, and a missing or invalid record is unmeasured", () => {
    // This cell was `unmeasured` with the reason "the discovery journeys are hand-authored JSX
    // rather than records". The records exist now, so the reason was stale and a stale `unmeasured`
    // reads as "nobody could check" when somebody can.
    const root = fixtureRoot();
    const before = cellOf(paperDoneness(root, PAPER).cells, "journey-skeleton-parts");
    expect(before.of).toBe(13);
    expect(before.met).toBe(11);
    expect(before.state).toBe("short");
    // The two that are absent are absent BY DECLARATION, and the detail says both things, because
    // "11 of 13" without the names is a number nobody can act on.
    expect(before.detail).toContain("absent: exercises.instrumented, stages");
    expect(before.detail).toContain("declared pending: exercises.instrumented, stages");

    // A plant on a real element, chosen so the record STAYS VALID. My first attempt emptied
    // naggingFact, and the schema refuses that, so the cell went unmeasured and the plant measured
    // the schema rather than the count. Emptying worldChecks is tolerated and costs exactly one
    // element.
    const path = join(root, `content/journeys/${PAPER}.yaml`);
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/^worldChecks:\n(?:[ \t]+.*\n)+/m);
    const planted_text = text.replace(/^worldChecks:\n(?:[ \t]+.*\n)+/m, "worldChecks: []\n");
    writeFileSync(path, planted_text);
    // What landed, asserted before the verdict is read: a plant that did not apply produces a green
    // that means nothing.
    expect(readFileSync(path, "utf8")).toContain("worldChecks: []");
    const planted = cellOf(paperDoneness(root, PAPER).cells, "journey-skeleton-parts");
    expect(planted.state).toBe("short");
    expect(planted.met).toBe(before.met - 1);
    expect(planted.detail).toContain("worldChecks");

    // A record that does not validate is UNMEASURED, not 0 of 13: reporting a zero would invite
    // someone to repair thirteen elements that may all be present.
    writeFileSync(path, "kind: not-a-journey\n");
    const broken = cellOf(paperDoneness(root, PAPER).cells, "journey-skeleton-parts");
    expect(broken.state).toBe("unmeasured");
    expect(broken.of).toBe(0);
    expect(broken.detail).toContain("does not validate");

    // And an absent record is unmeasured for its own reason, which names the path. The root below
    // carries every other input and no journey record, rather than being empty: paperDoneness reads
    // the source-block manifest without a guard, so a bare directory throws instead of reporting.
    const noJourney = mkdtempSync(join(tmpdir(), "doneness-nojourney-"));
    for (const rel of [
      `content/source-blocks/${PAPER}/manifest.yaml`,
      `content/translation-units/${PAPER}`,
      `content/alignments/${PAPER}.yaml`,
      `content/bindings/${PAPER}.yaml`,
      `content/display-terms/${PAPER}.yaml`,
      `content/misconceptions/${PAPER}`,
      "content/tours",
    ]) {
      const to = join(noJourney, rel);
      mkdirSync(join(to, ".."), { recursive: true });
      cpSync(join(ROOT, rel), to, { recursive: true });
    }
    const absent = cellOf(paperDoneness(noJourney, PAPER).cells, "journey-skeleton-parts");
    expect(absent.state).toBe("unmeasured");
    expect(absent.detail).toContain(`content/journeys/${PAPER}.yaml`);
    // The neighbouring record-only cell still measures, so the absence is scoped to what went missing.
    expect(cellOf(paperDoneness(noJourney, PAPER).cells, "alignment-edges").state).toBe("met");
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
      `content/journeys/${PAPER}.yaml`,
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
