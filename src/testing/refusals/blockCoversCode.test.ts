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
import { blockCoversCode, stripNonAssertingText } from "./refusalScanner.ts";

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

/**
 * A comment cannot cover a refusal code, and a skipped test cannot either (am-p465).
 *
 * WHAT WAS WRONG, AND WHY IT IS WORSE THAN THE FIRST HOLE. The predicate above reasons about
 * string literals and then measures with `includes`, which cannot tell a quoted code in
 * executable source from the same quoted code inside a comment. So a comment SAYING a site is
 * untestable credited that site as tested. The facsimile pane hit it by accident in defcd5d5: its
 * own note explaining why three parse-failure sites could not be driven spelled the codes in
 * quotes, and the gate marked all three covered. A sentence admitting a gap closed the gap.
 *
 * THE SPLIT MAKES IT SHARPER, not milder. Blocks are cut with /(?:test|it)\s*\(/, which has no
 * word boundary and therefore cuts inside ordinary English in a doc comment. A block can begin
 * in the middle of a comment, carrying its closer without its opener, so the naive scan would
 * read the comment's tail as code. That fragment case is the fourth test below.
 *
 * THE PLANT, BOTH ARMS. Restoring
 *
 *     return block.includes('"' + code + '"') || block.includes("'" + code + "'");
 *
 * turns every test in the refusal arm RED and leaves every test in the acceptance arm green.
 * The acceptance arm is not decoration: a strip that swallowed real assertions would close the
 * hole by breaking the gate, and only the second arm can tell those apart.
 *
 * SCOPE, MEASURED. Skipped tests are precautionary: no test file under the scan roots used a skip
 * form when this landed. The comment arm was live. Across the whole tree the strip removes three
 * block credits, in contractAudit.test.ts, lq04/session.test.ts and paperRoutes.test.ts, and
 * flips ZERO sites to untested, because each of those files also asserts the same code for real.
 */
describe("blockCoversCode ignores what cannot assert (am-p465)", () => {
  const CLOSE = `*${"/"}`;

  describe("the refusal arm: none of these may credit a site", () => {
    test("a line comment quoting the code, explaining it cannot be driven", () => {
      expect(blockCoversCode(`// nothing outside can reach "${SHORT}" from here`, SHORT)).toBe(
        false,
      );
    });

    test("a block comment quoting the code", () => {
      expect(blockCoversCode(`/* the "${SHORT}" site is unreachable ${CLOSE}`, SHORT)).toBe(false);
    });

    test("a comment saying the code is deliberately not tested", () => {
      const block = `/*\n * We deliberately do NOT test "${SHORT}"; it needs a corrupt artifact.\n ${CLOSE}`;
      expect(blockCoversCode(block, SHORT)).toBe(false);
    });

    test("a doc-comment tail whose opener the block split cut away", () => {
      // What a block looks like when the split lands inside prose: no opener, closer intact.
      const fragment = ` * the "${SHORT}" refusal, which this suite does not drive\n ${CLOSE}\n`;
      expect(blockCoversCode(fragment, SHORT)).toBe(false);
    });

    test("a skipped test, whose body never runs", () => {
      const body = `("refuses", () => { expect(e.code).toBe("${SHORT}"); })`;
      expect(blockCoversCode(`test.skip${body}`, SHORT)).toBe(false);
      expect(blockCoversCode(`it.skip${body}`, SHORT)).toBe(false);
      expect(blockCoversCode(`xit${body}`, SHORT)).toBe(false);
      expect(blockCoversCode(`test.todo${body}`, SHORT)).toBe(false);
    });
  });

  describe("the acceptance arm: every one of these must still credit", () => {
    test("a plain assertion", () => {
      expect(blockCoversCode(`expect(e.code).toBe("${SHORT}");`, SHORT)).toBe(true);
    });

    test("an assertion standing after a comment that mentions the same code", () => {
      const block = `// the "${SHORT}" path\nexpect(e.code).toBe("${SHORT}");`;
      expect(blockCoversCode(block, SHORT)).toBe(true);
    });

    test("an assertion after a cut doc-comment tail", () => {
      const block = ` * a note about "${SHORT}"\n ${CLOSE}\nexpect(e.code).toBe("${SHORT}");`;
      expect(blockCoversCode(block, SHORT)).toBe(true);
    });

    test("a slash-slash inside a string is not a comment", () => {
      const block = `const u = "https://example.test/x";\nexpect(e.code).toBe("${SHORT}");`;
      expect(blockCoversCode(block, SHORT)).toBe(true);
    });

    test("a comment opener inside a string does not swallow the rest of the block", () => {
      const block = `const s = "/${"*"} not a comment";\nexpect(e.code).toBe("${SHORT}");`;
      expect(blockCoversCode(block, SHORT)).toBe(true);
    });

    test("the hoisted form the analyzer actually runs agrees with this predicate", () => {
      // The analyzer strips ONCE per block and then applies the literal test, because stripping
      // inside the per-code loop re-scanned the same text hundreds of times and pushed the scan
      // past this gate's own timeout. That means the plants above exercise blockCoversCode while
      // the gate runs the hoisted composition, so the two are pinned to each other here: the
      // strip is idempotent, and pre-stripping cannot change the verdict for any fixture.
      const fixtures = [
        `expect(e.code).toBe("${SHORT}");`,
        `// nothing can reach "${SHORT}"`,
        `/* the "${SHORT}" site is unreachable ${CLOSE}`,
        ` * a note about "${SHORT}"\n ${CLOSE}\nexpect(e.code).toBe("${SHORT}");`,
        `test.skip("later", () => { expect(e.code).toBe("${SHORT}"); });`,
        `const u = "https://example.test/x";\nexpect(e.code).toBe("${SHORT}");`,
      ];
      for (const fixture of fixtures) {
        const once = stripNonAssertingText(fixture);
        expect(stripNonAssertingText(once)).toBe(once);
        expect(blockCoversCode(once, SHORT)).toBe(blockCoversCode(fixture, SHORT));
      }
    });

    test("an unskipped test beside a skipped one still counts", () => {
      const block = `test.skip("later", () => { expect(e.code).toBe("${LONG}"); });\nexpect(e.code).toBe("${SHORT}");`;
      expect(blockCoversCode(block, SHORT)).toBe(true);
    });
  });
});
