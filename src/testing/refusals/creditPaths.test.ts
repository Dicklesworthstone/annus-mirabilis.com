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
 *   the code quoted INSIDE a longer string (closed 2026-10-05)      no        yes
 *   a running block asserting toThrow("code")                       yes       yes, for a single site
 *   a real literal in a file that ALSO holds fixture text           yes       yes
 *   an uncited block under a code with SEVERAL sites                no        yes (am-ksl3's own rule)
 *   a running block holding the code as a BARE LITERAL              YES       NO  <- the residual hole
 *
 * So am-ksl3's acceptance item 2 holds -- a comment changes no count, in or out of a test block -- and
 * item 1 holds for every code with more than one site. What remains is narrower than the bead: a string
 * literal in a running block credits a SINGLE-site code even when nothing asserts on it.
 *
 * ONE ARM OF IT WAS CLOSED ON 2026-10-05, after measuring what closing would cost rather than guessing.
 * A candidate rule -- the literal must sit in a call-argument position -- was applied across the whole
 * repository first: 39 (test file, code) credits would have been withdrawn, which is small enough to
 * read one by one, and reading them is what decided the design. Three classes came out of it:
 *
 *   - fixture text, where the code is quoted INSIDE a longer string: a sample of source fed to a
 *     scanner test, an HTML attribute in an announcement test, a code named in a test TITLE. Never an
 *     assertion about the program, so credit is always wrong. CLOSED.
 *   - a census or registry list, `REQUIRED_REFUSAL_CODES = [...]` in leakList.test.ts, which asserts
 *     that a registry NAMES a code and drives no throw site. Credit is wrong. Still open.
 *   - a real expectation held as data, `expectedCodes: ["no-positive-tolerance"]` in tolerance.cases.ts,
 *     consumed by a runner that drives the site. Credit is RIGHT, and the call-position rule would have
 *     withdrawn it.
 *
 * The last two are the same syntax -- a string in an array -- and opposite in meaning, which is why no
 * syntactic rule separates them and why the call-position rule was not adopted. What was adopted is the
 * part that cannot be wrong in either direction: a code must appear as a COMPLETE string literal, read
 * from the file's syntax tree. An honest assertion writes one; characters inside a fixture are not one.
 *
 * COST, MEASURED RATHER THAN ASSUMED: the stricter rule surfaced exactly one previously hidden site,
 * entranceRecord.ts:335 `bridge-routes-not-differentiated`, whose only test asserted a bare `.toThrow()`
 * with the code spelled in its title. That test now asserts the code, so the repository's untested count
 * returned to 84 and no baseline was raised. A gate got stricter and the debt did not grow, because the
 * one thing it caught was worth fixing.
 *
 * THE REST IS STILL PINNED RATHER THAN CLOSED. A bare literal in a running block still credits a
 * single-site code, and a registry census still credits. Both need a decision about which shapes count
 * as an assertion, and a rule that guesses wrong withdraws credit from honest tests, which inflates the
 * debt rather than measuring it. That decision is the owner's. Until then this file is what stops the
 * closed arms drifting back.
 */

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeUntestedRefusals,
  blockCoversCode,
  completeStringLiteralTexts,
} from "./refusalScanner.ts";

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

  it("the code quoted INSIDE a longer string changes no count", () => {
    // CLOSED 2026-10-05, and it was the largest arm of the hole below. A scanner test, a ratchet
    // test or an HTML-announcement test embeds sample source as a string, and that sample quotes a
    // real code. `includes('"code"')` cannot tell that from an assertion, so the fixture credited
    // the real site elsewhere in src/ -- the cross-file laundering this module's header claims to
    // prevent, arriving through the quotes rather than around them. Now the code must be a COMPLETE
    // string literal somewhere in the file, read from its syntax tree.
    //
    // Both quoting directions are exercised, because the substring test accepts either and the
    // single-quote-inside-double-quote form is the one that was live: a test TITLE naming a code in
    // single quotes credited entranceRecord.ts:335 while the body asserted only a bare toThrow().
    expect(
      untested(
        `${IMPORT}test("drives a sample", () => { const sample = 'throw new W("alpha-refused");'; expect(sample.length).toBeGreaterThan(0); });\n`,
      ),
    ).toBe(2);
    expect(
      untested(
        `${IMPORT}test("names it in the title only", () => { const html = "<i data-code='alpha-refused'>"; expect(html.length).toBeGreaterThan(0); });\n`,
      ),
    ).toBe(2);

    // THE ARM CARRIES ITS OWN RED-FIRST EVIDENCE. Asserting the count alone would pass just as well
    // if the fixture never reached the predicate, which is how a green plant indicts the plant rather
    // than the code. So the two rules are shown DISAGREEING on this exact input: the substring test
    // that used to decide credit says yes, and the syntax tree says the code is no literal here. That
    // is the whole mechanism of the fix, measured on the input the arm is about.
    const fixture = `const sample = 'throw new W("alpha-refused");';`;
    expect(blockCoversCode(fixture, "alpha-refused")).toBe(true);
    expect(completeStringLiteralTexts(fixture, "f.ts").has("alpha-refused")).toBe(false);
    // And the control, so the literal set is not simply empty on everything it is handed.
    expect(completeStringLiteralTexts(fixture, "f.ts").size).toBeGreaterThan(0);
    expect(
      completeStringLiteralTexts(`const c = "alpha-refused";`, "f.ts").has("alpha-refused"),
    ).toBe(true);
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

  it("a real literal still credits though the file ALSO holds it as fixture text", () => {
    // The direction that keeps the rule above from being a blunt withdrawal. One block asserts the
    // code properly and another holds it inside a longer string; the honest assertion still earns
    // its site. This is also the residual of the file-scoped check, stated as a test rather than
    // only in a comment: the fixture block is not separately punished, because the rule asks whether
    // the code is a complete literal ANYWHERE in the file, not in that block.
    expect(
      untested(
        `${IMPORT}test("drives it", () => { expect(() => a()).toThrow("alpha-refused"); });\n` +
          `test("sample", () => { const s = 'new W("alpha-refused")'; expect(s.length).toBeGreaterThan(0); });\n`,
      ),
    ).toBe(1);
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
