/**
 * THE ONLY VALIDATOR OF content/lesson-formulas/ RAN IN NO LANE AND NO GATE, AND ITS RECORDS ARE
 * NOW READER-FACING.
 *
 * `scripts/check-lesson-formulas.ts` was the sole consumer of `checkLessonFormulas`, and measured
 * 2026-10-12 the string `check-lesson-formulas` appears 0 times in `bunfig.toml` and 0 times in
 * `scripts/quality-gates/registry.ts`: it is one of the ten scripts am-7mw9 reports as running in
 * neither test lane nor any gate.
 *
 * That mattered less while these records were read only by that script. Since the lesson pages
 * render each `usedAt` edge as a link to the printed display it names (bf06087af), an edge naming a
 * display no paper prints is a DEAD LINK ON A READING PAGE. That is the same defect, in the same
 * shape, as the offline chapter's dangling `#foundation-logarithms` repaired in 049420fac on the
 * same day: a record that resolves for its author and not for a reader.
 *
 * So the validator is lit here rather than left to a script nobody runs. Its census is asserted
 * non-vacuous, because a corpus that lost its files would otherwise report zero problems and read
 * exactly like a clean one.
 *
 * WHY THE PLANTS USE A FIXTURE ROOT. `checkLessonFormulas` takes `root`, so each negative is built
 * as a four-file corpus under a temp directory rather than by editing the shared tree. The fixture
 * is proved in BOTH directions: a well-formed corpus reports no problems, so a plant's verdict is
 * about the plant and not about the fixture being malformed. That control is the half that was
 * missing when eight earlier plants of mine all returned the same parse error, because they were
 * written as inline JSON, which is valid YAML that this repository's parser refuses.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLessonFormulas } from "./lessonFormulas.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** A four-file corpus: the lesson's formula blocks, a paper's displays, and the record under test. */
function fixtureRoot(record: string): string {
  const root = mkdtempSync(join(tmpdir(), "am-lesson-formulas-"));
  mkdirSync(join(root, "content/lesson-formulas"), { recursive: true });
  mkdirSync(join(root, "content/foundations"), { recursive: true });
  mkdirSync(join(root, "content/display-terms"), { recursive: true });
  writeFileSync(
    join(root, "content/foundations/widgets.json"),
    JSON.stringify({ id: "widgets", explanation: [{ kind: "formula", latex: "a = b" }] }),
  );
  writeFileSync(
    join(root, "content/display-terms/light-quanta.yaml"),
    'displays:\n  - display: eq-s1-d1\n    latex: "a = b"\n',
  );
  writeFileSync(join(root, "content/lesson-formulas/widgets.yaml"), record);
  return root;
}

/** Block YAML, never inline JSON: the repository's parser refuses the latter. */
const WELL_FORMED = `lesson: widgets
formulas:
  - latex: "a = b"
    usedAt:
      - paper: light-quanta
        display: eq-s1-d1
        note: "What the paper does with the shape at this display."
`;

function codes(record: string): string[] {
  return checkLessonFormulas(fixtureRoot(record)).problems.map((problem) => problem.code);
}

describe("content/lesson-formulas is validated in a lane, now that a reader sees it", () => {
  const result = checkLessonFormulas(ROOT);

  test("the committed corpus has no problems", () => {
    // Names them rather than counting, because a count says nothing about which record to open.
    expect(result.problems.map((p) => `${p.code} ${p.where}`)).toEqual([]);
  });

  test("the census is non-vacuous, so the clean result above is a measurement", () => {
    // A corpus whose files went missing reports zero problems. These floors are what make the
    // assertion above mean that records were judged rather than that none were found.
    expect(result.census.lessons).toBeGreaterThan(0);
    expect(result.census.blocks).toBeGreaterThan(0);
    expect(result.census.edges).toBeGreaterThan(0);
    // Every covered formula block carries a judgement: it names displays, or it records that no
    // paper prints the shape. Asserted as a partition rather than as two counts.
    expect(result.census.used + result.census.notUsed).toBe(result.census.blocks);
  });

  test("the fixture itself is valid (the control that makes the plants below readable)", () => {
    expect(codes(WELL_FORMED)).toEqual([]);
  });

  test("plant: an edge naming a display no paper prints is reported", () => {
    // The reader-facing one. This is what would render a dead link on the lesson page.
    expect(codes(WELL_FORMED.replace("eq-s1-d1", "eq-s9-d9"))).toContain(
      "lesson-formula-unknown-display",
    );
  });

  test("plant: an edge with no note is reported", () => {
    // The note is the link's text on the lesson page, so an edge without one would render a link
    // with nothing to read.
    const noNote = `lesson: widgets
formulas:
  - latex: "a = b"
    usedAt:
      - paper: light-quanta
        display: eq-s1-d1
`;
    expect(codes(noNote)).toContain("lesson-formula-note-missing");
  });

  test("plant: a formula that neither names a display nor says why not is reported", () => {
    const silent = `lesson: widgets
formulas:
  - latex: "a = b"
`;
    expect(codes(silent)).toContain("lesson-formula-neither-used-nor-not");
  });

  test("plant: a note citing a display no paper prints is reported", () => {
    // The gap this closed on 2026-10-13. `display:` was validated against the paper's printed
    // displays; a note saying "see eq-s9-d9" was not, so a note could send a reader to a display
    // that does not exist and ship. The corpus had 10 such citations at the time, all real, which
    // is the moment to add a guard rather than after the first wrong one.
    const citing = WELL_FORMED.replace(
      "What the paper does with the shape at this display.",
      "The same move as eq-s9-d9, which no paper prints.",
    );
    expect(codes(citing)).toContain("lesson-formula-note-cites-unknown-display");
  });

  test("a note citing a display that IS printed is accepted (positive control)", () => {
    // Without this the plant above would pass against a check that rejected every citation, and
    // the two readings are indistinguishable from a red result alone.
    const citing = WELL_FORMED.replace(
      "What the paper does with the shape at this display.",
      "The same move as eq-s1-d1, which this fixture's paper prints.",
    );
    expect(codes(citing)).toEqual([]);
  });

  test("plant: an entry naming a formula the lesson does not write is reported", () => {
    expect(codes(WELL_FORMED.replace('latex: "a = b"', 'latex: "c = d"'))).toContain(
      "lesson-formula-unknown-formula",
    );
  });
});
