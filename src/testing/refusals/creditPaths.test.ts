/**
 * EXACTLY WHAT CREDITS A REFUSAL SITE, PINNED ARM BY ARM (am-ksl3).
 *
 * am-ksl3's complaint: the scanner credited sites by COUNTING test blocks that mention a code and then
 * crediting that many sites in line order, so attribution was by quantity rather than identity -- and
 * a comment recording WHY three throws could not be tested dropped that file's untested count from 7 to
 * 6. A note written to make a gap visible made the gate stop reporting it.
 *
 * Measured 2026-10-05 on a fixture tree with two single-site codes, driving the real
 * `analyzeUntestedRefusals`. Seven of the eight paths are now correct, and one is not:
 *
 *   arm                                                          credits   correct
 *   a file-level comment naming the code                            no        yes
 *   a comment INSIDE a running test body                            no        yes
 *   a SKIPPED test body (am-3v8x)                                   no        yes
 *   a running block asserting toThrow("code")                       yes       yes, for a single site
 *   an uncited block under a code with SEVERAL sites                no        yes (am-ksl3's own rule)
 *   a running block holding the code as a BARE LITERAL              YES       NO  <- the residual hole
 *
 * So am-ksl3's acceptance item 2 holds -- a comment changes no count, in or out of a test block -- and
 * item 1 holds for every code with more than one site. What remains is narrower than the bead: a string
 * literal in a running block credits a SINGLE-site code even when nothing asserts on it.
 *
 * THAT HOLE IS PINNED HERE RATHER THAN CLOSED, and the reason is a risk I can measure and a fix I
 * cannot. Closing it means deciding which syntactic shapes count as an assertion -- toThrow, toBe,
 * assert.*, rejects, and whatever a test writes next -- and a rule that guesses wrong withdraws credit
 * from honest tests, which inflates the debt rather than measuring it. The hole is narrow (one site,
 * running block, literal present, nothing asserting) and visible here; the heuristic is the owner's
 * call. Until then this file is what stops the other seven arms drifting back.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeUntestedRefusals } from "./refusalScanner.ts";

/** Two sites, two DIFFERENT codes, so each is single-site and attribution is unambiguous. */
const SOURCE = `export class WidgetError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function a(): never {
  throw new WidgetError("alpha-refused");
}
export function b(): never {
  throw new WidgetError("beta-refused");
}
`;

/** Untested count for the fixture source, given a test file. */
function untested(testBody: string): number {
  const root = mkdtempSync(join(tmpdir(), "credit-paths-"));
  mkdirSync(join(root, "src/thing"), { recursive: true });
  writeFileSync(join(root, "src/thing/widget.ts"), SOURCE);
  writeFileSync(join(root, "src/thing/widget.test.ts"), testBody);
  return analyzeUntestedRefusals(root).totalUntested;
}

const IMPORT = 'import { a, b } from "./widget.ts";\n';

describe("what does NOT credit a refusal site", () => {
  it("nothing at all: the denominator, so every arm below is read against it", () => {
    // Both sites untested with no test present. If this were not 2, no arm below would mean anything.
    expect(untested(IMPORT)).toBe(2);
  });

  it("a FILE-LEVEL comment naming the code changes no count", () => {
    // am-ksl3's acceptance item 2, and the 21.8 case that prompted the bead.
    expect(untested(`// the "alpha-refused" throw cannot be driven here\n${IMPORT}`)).toBe(2);
  });

  it("a comment INSIDE a running test body changes no count", () => {
    expect(
      untested(
        `${IMPORT}test("unrelated", () => { /* "alpha-refused" cannot be driven */ expect(1).toBe(1); });\n`,
      ),
    ).toBe(2);
  });

  it("a SKIPPED body changes no count, however it asserts", () => {
    // The arm am-3v8x completed on the citation path. A body that never runs asserts nothing.
    expect(
      untested(
        `${IMPORT}test.skip("drives it", () => { expect(() => a()).toThrow("alpha-refused"); });\n`,
      ),
    ).toBe(2);
  });
});

describe("what DOES credit a refusal site", () => {
  it("a running block asserting the code credits exactly its one site, not both", () => {
    // Exactly one: crediting both would be the quantity-not-identity defect am-ksl3 names.
    expect(
      untested(
        `${IMPORT}test("drives it", () => { expect(() => a()).toThrow("alpha-refused"); });\n`,
      ),
    ).toBe(1);
  });

  it("two blocks, each asserting its own code, credit both sites", () => {
    expect(
      untested(
        `${IMPORT}test("a", () => { expect(() => a()).toThrow("alpha-refused"); });\n` +
          `test("b", () => { expect(() => b()).toThrow("beta-refused"); });\n`,
      ),
    ).toBe(0);
  });

  it("an explicit site citation credits that site", () => {
    expect(
      untested(
        `${IMPORT}test("drives it (widget.ts:7)", () => { expect(() => a()).toThrow("alpha-refused"); });\n`,
      ),
    ).toBe(1);
  });
});

describe("THE RESIDUAL HOLE, pinned so it cannot widen unnoticed", () => {
  it("a bare literal in a running block credits a single-site code, asserting nothing", () => {
    // NOT an endorsement. This is the one path am-ksl3's item 1 still describes, kept as an executable
    // record of the current behaviour so that closing it is a visible change and widening it is a red
    // test. The literal is in a block that asserts something else entirely.
    expect(
      untested(
        `${IMPORT}test("unrelated", () => { const note = "alpha-refused"; expect(1).toBe(1); });\n`,
      ),
    ).toBe(1);
  });

  it("but it does NOT reach a code with more than one site, which is am-ksl3's own rule", () => {
    // The half of item 1 that is already fixed: with two sites under one code, an uncited mention
    // credits neither. So the hole is bounded to codes thrown exactly once.
    const twoSites = SOURCE.replace('"beta-refused"', '"alpha-refused"');
    const root = mkdtempSync(join(tmpdir(), "credit-paths-multi-"));
    mkdirSync(join(root, "src/thing"), { recursive: true });
    writeFileSync(join(root, "src/thing/widget.ts"), twoSites);
    writeFileSync(
      join(root, "src/thing/widget.test.ts"),
      `${IMPORT}test("mentions it", () => { expect(() => a()).toThrow("alpha-refused"); });\n`,
    );
    expect(analyzeUntestedRefusals(root).totalUntested).toBe(2);
  });
});
