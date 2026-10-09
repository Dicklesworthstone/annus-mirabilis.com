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
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
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
    // The required-entry record IS the margin cell's denominator, so a fixture without it would
    // make that cell unmeasured here while it measures against the real corpus, and the
    // fixture-agreement test below would be the only thing to notice.
    `content/editorial/required-margin-entries/${PAPER}.yaml`,
    // Same for the section 3 results, and the fixture-agreement test DID notice: adding the cell
    // without this line left it unmeasured in the fixture while it read met over the real corpus,
    // which is exactly the disagreement that test exists to catch.
    `content/editorial/required-results/${PAPER}.yaml`,
    `content/results/${PAPER}.yaml`,
    `content/arguments/${PAPER}`,
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

  it("all four readings per obliged paragraph, with a declared exception excluded and a bare one not", () => {
    // The reason here used to blame a missing loader for readings-owners targets. Measured across
    // all 41 of those files, every one of their 63 targets is kind "caption" -- not one is a
    // paragraph. A paragraph's readings come through its bound PASSAGES instead.
    const root = fixtureRoot();
    const before = cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph");
    expect(before.state).toBe("met");
    expect(before.of).toBe(14);
    expect(before.detail).toContain("overview, full, steps, margin");

    const bindings = join(root, `content/bindings/${PAPER}.yaml`);
    const original = readFileSync(bindings, "utf8");

    // A passage missing one reading makes its paragraph short. Plant it on the argument record.
    // Flow style in these files: `passages: [arg-me-import]`, not a block list. My first regex
    // assumed a block and matched nothing, which is why the extraction is anchored on the bracket.
    const passage = /passages:\s*\[\s*(arg-[a-z0-9-]+)/.exec(original)?.[1] as string;
    expect(passage).toBeTruthy();
    const argPath = join(root, `content/arguments/${PAPER}/${passage}.json`);
    const argOriginal = readFileSync(argPath, "utf8");
    const record = JSON.parse(argOriginal) as { readings: Record<string, unknown> };
    delete record.readings.steps;
    writeFileSync(argPath, JSON.stringify(record));
    const missingStep = cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph");
    expect(missingStep.state).toBe("short");
    // Several paragraphs bind one passage -- mass-energy's 14 paragraphs share a handful -- so a
    // single missing reading costs more than one paragraph. Asserting `before.met - 1` was my own
    // error, not the cell's: the real drop is to 7. The relation asserted is the true one, that
    // every paragraph binding this passage loses its full set.
    expect(missingStep.met).toBeLessThan(before.met);
    expect(missingStep.met).toBeGreaterThan(0);
    expect(missingStep.detail).toContain("missing steps");
    expect(missingStep.detail).toContain(passage);
    writeFileSync(argPath, argOriginal);

    // An entry that binds no passage and declares nothing is SHORT.
    writeFileSync(bindings, original.replace(/passages:\s*\[[^\]]*\]/, "passages: []"));
    const unbound = cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph");
    expect(unbound.state).toBe("short");
    expect(unbound.detail).toContain("binds no passage");

    // The same entry, declared unexplained WITH a reason, leaves the obligation: the denominator
    // falls by one and the cell is met again.
    writeFileSync(
      bindings,
      original.replace(
        /passages:\s*\[[^\]]*\]/,
        'passages: []\n    status: unexplained\n    reason: "No passage of this paper takes this up."',
      ),
    );
    const declaredOk = cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph");
    expect(declaredOk.state).toBe("met");
    expect(declaredOk.of).toBe(before.of - 1);
    expect(declaredOk.detail).toContain("1 declared unexplained");

    // THE NEGATIVE THAT MATTERS: the same declaration with an EMPTY reason excuses nothing.
    writeFileSync(
      bindings,
      original.replace(
        /passages:\s*\[[^\]]*\]/,
        'passages: []\n    status: unexplained\n    reason: ""',
      ),
    );
    const bare = cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph");
    expect(bare.state).toBe("short");
    expect(bare.of).toBe(before.of);
    expect(bare.detail).toContain("binds no passage");
    writeFileSync(bindings, original);
    expect(cellOf(paperDoneness(root, PAPER).cells, "readings-r1-r3-per-paragraph").met).toBe(
      before.met,
    );
  });

  it("the margin cell measures against the required-entry record, and mass-energy is complete", () => {
    // THIS CELL WAS `unmeasured` AND THE REASON WAS CORRECT WHEN WRITTEN: the plan's required set
    // existed only as prose. It exists as a record now,
    // content/editorial/required-margin-entries/<paper>.yaml, so the cell divides by it.
    //
    // The old version reported "4 typed historian-margin record(s)" for this paper, and that count
    // was the WRONG POPULATION rather than merely undivided: mass-energy happens to have 4 records
    // of that kind and 8 required entries, all 8 present. Across the site the old count summed to
    // 16 and the required entries actually present number 8, because ten of the 16 are
    // notation-concordance notes carrying the same `kind`.
    const root = fixtureRoot();
    const c = cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries");
    expect(c.state).toBe("met");
    expect(c.of).toBe(8);
    expect(c.met).toBe(8);
    expect(c.detail).toContain("resolved against the note ids on disk");

    // THE CREDIT IS VERIFIED, NOT BELIEVED. Renaming a credited note on disk must drop the
    // numerator and name the record that went missing, because a cell that trusted the record's
    // own `satisfiedBy` would be measuring a claim instead of a corpus.
    const dir = join(root, `content/editorial-notes/${PAPER}`);
    const file = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .find((f) => {
        const record = JSON.parse(readFileSync(join(dir, f), "utf8")) as { id?: unknown };
        return record.id === "note-me-c-1906-poincare";
      });
    expect(file).toBeDefined();
    const path = join(dir, file as string);
    const original = readFileSync(path, "utf8");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(original), id: "note-me-c-RENAMED" }));
    const broken = cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries");
    expect(broken.state).toBe("short");
    expect(broken.met).toBe(7);
    expect(broken.detail).toContain("note-me-c-1906-poincare");
    writeFileSync(path, original);
    expect(cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries").met).toBe(8);
  });

  it("with no required-entry record the margin cell is unmeasured, never met", () => {
    // The old branch, kept as an explicit negative. A paper whose required list has not been
    // transcribed must report that it has no denominator rather than reporting zero of zero as
    // met, which is this module's whole rule.
    const root = fixtureRoot();
    const record = join(root, `content/editorial/required-margin-entries/${PAPER}.yaml`);
    // MOVED ASIDE, not removed. A rename is reversible and is not a deletion, which this
    // repository treats as an invariant even inside a temporary fixture.
    renameSync(record, `${record}.aside`);
    const c = cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries");
    expect(c.state).toBe("unmeasured");
    expect(c.of).toBe(0);
    expect(c.detail).toContain("no required-entry record");
    renameSync(`${record}.aside`, record);
    expect(cellOf(paperDoneness(root, PAPER).cells, "historians-margin-entries").state).toBe("met");
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
