/**
 * A test block covers a refusal code only when it quotes it (am-he9s).
 *
 * WHAT WAS WRONG. The predicate read
 *
 *     block.includes(`"${code}"`) || block.includes(`'${code}'`) || block.includes(code)
 *
 * and the third disjunct made the first two redundant. The count it feeds is a per-site
 * budget - `additionalTested = min(unCitedSites.length, blockCount)` - so every fragment
 * match bought another throw site the right to be reported as covered. The direction is
 * fail-open on a coverage measurement: it reported more refusals covered than were.
 *
 * WHY THE PAIR BELOW IS REAL. `artifact-mismatch` and `tape-artifact-mismatch` are both
 * live codes in this repository, verified present in the scanner's own population rather
 * than invented for the fixture. The bead's headline example, `absorption-efficiency`
 * inside `invalid-absorption-efficiency`, does not exist here; using it would have made
 * a planted negative that could never describe a real regression.
 *
 * THE PLANT. Restoring the third disjunct turns the first test here RED and nothing else,
 * which is what makes it evidence rather than decoration.
 */
import { describe, expect, test } from "bun:test";
import { blockCoversCode } from "./refusalScanner.ts";

const SHORT = "artifact-mismatch";
const LONG = "tape-artifact-mismatch";

describe("blockCoversCode (am-he9s)", () => {
  test("a block asserting the longer code does not cover the shorter one inside it", () => {
    const block = `("refuses a stale tape", () => {
      expect(result.code).toBe("${LONG}");
    })`;
    // The fixture can reach the state it tests: the longer code IS covered by this block,
    // so a failure below is the containment rule and not a broken fixture.
    expect(blockCoversCode(block, LONG)).toBe(true);
    expect(blockCoversCode(block, SHORT)).toBe(false);
  });

  test("the same containment holds for single quotes and for a prefix relation", () => {
    expect(blockCoversCode(`expect(e.code).toBe('${LONG}')`, SHORT)).toBe(false);
    // A prefix relation, which is the larger of the two classes: 84 codes prefix another.
    expect(blockCoversCode(`code: "invalid-paper-concordance"`, "invalid-paper")).toBe(false);
    expect(blockCoversCode(`code: "invalid-paper"`, "invalid-paper")).toBe(true);
  });

  test("both quoted forms still count, which is the coverage the fix must not lose", () => {
    expect(blockCoversCode(`expect(r.code).toBe("${SHORT}")`, SHORT)).toBe(true);
    expect(blockCoversCode(`expect(r.code).toBe('${SHORT}')`, SHORT)).toBe(true);
  });

  test("an unquoted mention does not count, including one in a comment", () => {
    expect(blockCoversCode(`// see ${SHORT} for the refusal path`, SHORT)).toBe(false);
    expect(blockCoversCode(`const code = ${SHORT};`, SHORT)).toBe(false);
  });

  test("a backtick form does not count, and nothing in this repository needs it to", () => {
    // Checked across all 1156 test files the scanner reads: no code appears only in a
    // template-literal form. Admitting backticks would widen the rule for no coverage.
    expect(blockCoversCode("expect(r.code).toBe(`" + SHORT + "`)", SHORT)).toBe(false);
  });
});
