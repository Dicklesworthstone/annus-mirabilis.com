/**
 * A CITATION INSIDE A SKIPPED BODY MUST NOT CREDIT ITS SITE (am-3v8x).
 *
 * refusalScanner's own stated principle, above SKIP_CALL: "Skipped tests are removed for the same
 * reason -- a body that never runs asserts nothing". The code-literal path honoured it and the CITATION
 * path did not: it matched `(file.ts:90)` over the raw file text, so skipping the only test containing a
 * citation left the credit standing. am-3v8x measured it on a two-site code, where only an explicit
 * citation can credit: baseline 120 untested, citation removed 121 (so the citation is load-bearing),
 * citation kept with the test skipped 120 (so the credit survived the skip).
 *
 * The citation path now reads text with skipped bodies removed, and `stripSkippedTests` is that strip.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO, both tested below so neither becomes an accident:
 *
 *  - it leaves COMMENTS alone. Whether a citation in a comment should credit is a different bead
 *    (am-ksl3). Measured over the scan roots: 2012 citations in raw text, 1996 surviving a comment
 *    strip, so routing the citation path through the full strip would withdraw 16 at once.
 *  - it does not strip a skip form inside a STRING LITERAL, which is data rather than a skipped test.
 *    blockCoversCode.test.ts is full of such literals and is the file that would break.
 *
 * am-3v8x ALSO REPORTED A SECOND MECHANISM, and that one is not true: it read SKIP_CALL's `\($` as
 * anchoring to end of LINE, so that biome collapsing a multi-line `test.skip(` would stop the arm
 * matching. The regex is tested against the accumulated output at the moment the paren is appended, so
 * `$` is end-of-string and the paren is always last there. Every skip form is stripped on one line,
 * which the final test here pins so nobody re-derives the same worry.
 */
import { describe, expect, it } from "bun:test";
import { blockCoversCode, stripSkippedTests } from "./refusalScanner.ts";

/** The production citation pattern, so this tests the path rather than a paraphrase of it. */
const CITE = /\(([a-zA-Z0-9_.-]+\.ts):(\d+)\)/g;
const citations = (text: string): string[] =>
  [...text.matchAll(CITE)].map((m) => `${m[1]}:${m[2]}`);

describe("a citation in a body that never runs", () => {
  it("does NOT survive the strip, so it cannot credit its site", () => {
    const skipped =
      'test.skip("drives the digest mismatch (editionContract.ts:776)", () => {\n  expect(run()).toBe("digest-mismatch");\n});\n';
    // Load-bearing before the strip: the citation really is in the raw text.
    expect(citations(skipped)).toEqual(["editionContract.ts:776"]);
    expect(citations(stripSkippedTests(skipped))).toEqual([]);
  });

  it("the SAME citation in a running test does survive, so the strip is not a blanket refusal", () => {
    const running =
      'test("drives the digest mismatch (editionContract.ts:776)", () => {\n  expect(run()).toBe("digest-mismatch");\n});\n';
    expect(citations(stripSkippedTests(running))).toEqual(["editionContract.ts:776"]);
  });

  it("every skip form is covered, and each is checked on ONE line", () => {
    // The one-line form is the one am-3v8x believed the formatter made invisible. It is not.
    for (const form of [
      'test.skip("n (a.ts:1)", () => {});',
      'it.skip("n (a.ts:1)", () => {});',
      'describe.skip("n (a.ts:1)", () => {});',
      'test.todo("n (a.ts:1)", () => {});',
      'test.failing("n (a.ts:1)", () => {});',
      'xit("n (a.ts:1)", () => {});',
      'xtest("n (a.ts:1)", () => {});',
    ])
      expect(citations(stripSkippedTests(form))).toEqual([]);
    // And the multi-line form too, which is what it believed was the only working one.
    expect(citations(stripSkippedTests('test.skip(\n  "n (a.ts:1)",\n  () => {},\n);'))).toEqual(
      [],
    );
  });

  it("only the skipped sibling loses its citation", () => {
    const both =
      'test("runs (a.ts:1)", () => {});\ntest.skip("skipped (b.ts:2)", () => {});\ntest("runs too (c.ts:3)", () => {});\n';
    expect(citations(stripSkippedTests(both))).toEqual(["a.ts:1", "c.ts:3"]);
  });
});

describe("what the strip must leave alone", () => {
  it("a comment is kept, because a citation in one is a different bead", () => {
    const commented = '// drives the mismatch (editionContract.ts:776)\ntest("n", () => {});\n';
    expect(citations(stripSkippedTests(commented))).toEqual(["editionContract.ts:776"]);
  });

  it("a skip form inside a STRING LITERAL is data, not a skipped test", () => {
    // blockCoversCode.test.ts holds exactly this shape, and stripping it would gut that file.
    const data =
      'const sample = \'test.skip("x", () => { "some-code" });\';\ntest("n (a.ts:1)", () => {});\n';
    const stripped = stripSkippedTests(data);
    expect(citations(stripped)).toEqual(["a.ts:1"]);
    expect(stripped).toContain('test.skip("x"');
  });

  it("the code-literal path is unchanged by any of this", () => {
    // stripNonAssertingText already handled skips; this bead only reached the citation path.
    expect(blockCoversCode('test("n", () => { expect(x).toBe("some-code"); });', "some-code")).toBe(
      true,
    );
    expect(
      blockCoversCode('test.skip("n", () => { expect(x).toBe("some-code"); });', "some-code"),
    ).toBe(false);
  });
});
