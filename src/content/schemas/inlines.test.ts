/**
 * Test Plan: src/content/schemas/inlines.test.ts (am-cm-schemas-source-1en).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { codePointLength, codePointSlice, plainText, validateInline } from "./inlines.ts";

test("plainText recovers the exact diplomatic text from an annotated German fixture sentence", () => {
  const inlines = [
    validateInline({ kind: "text", text: "Der Begriff " }),
    validateInline({ kind: "term", text: "Lichtkomplex", termId: "term-lichtkomplex" }),
    validateInline({ kind: "text", text: ", da" }),
    validateInline({ kind: "emphasis", inlines: [{ kind: "text", text: "ß" }] }),
    validateInline({ kind: "text", text: " " }),
    validateInline({ kind: "math", latex: "E = h\\nu", inlineId: "s1-p1-s1-m1" }),
    validateInline({ kind: "footnote-mark", mark: "1)", footnoteId: "s1-fn1" }),
    validateInline({ kind: "text", text: " endet." }),
  ];
  assert.equal(plainText(inlines), "Der Begriff Lichtkomplex, daß E = h\\nu1) endet.");
});

test("a malformed term whose text content differs from the printed characters it claims to wrap fails a fixture comparison", () => {
  const printedDiplomaticText = "Lichtkomplex";
  const term = validateInline({
    kind: "term",
    text: "Light-complex", // wrong: not the printed characters
    termId: "term-lichtkomplex",
  });
  assert.notEqual(plainText([term]), printedDiplomaticText);
});

test("a display math inline and a reference inline leave the surrounding diplomatic text unchanged", () => {
  const inlines = [
    validateInline({ kind: "text", text: "Siehe " }),
    validateInline({ kind: "reference", text: "Gleichung (3)", targetId: "eq-3" }),
    validateInline({ kind: "text", text: ": " }),
    validateInline({ kind: "math", latex: "\\Delta S", display: true, equationId: "eq-3" }),
    validateInline({ kind: "text", text: "." }),
  ];
  // A display math inline contributes no characters of its own (the block it references owns
  // the printed text); everything else survives exactly.
  assert.equal(plainText(inlines), "Siehe Gleichung (3): .");
});

test("a display math inline must not also carry an inlineId", () => {
  assert.throws(
    () => validateInline({ kind: "math", latex: "E=mc^2", display: true, inlineId: "s1-p1-s1-m1" }),
    /must not carry an inlineId/,
  );
});

test("a non-display math inline round-trips its inlineId without a display flag", () => {
  const inline = validateInline({ kind: "math", latex: "E=mc^2", inlineId: "s1-p1-s1-m1" });
  assert.equal(inline.kind, "math");
  if (inline.kind === "math") {
    assert.equal(inline.display, undefined);
    assert.equal(inline.inlineId, "s1-p1-s1-m1");
  }
});

test("codePointLength counts Unicode code points, not UTF-16 code units", () => {
  assert.equal(codePointLength("daß"), 3);
  const astral = "a\u{1D49C}b"; // U+1D49C MATHEMATICAL SCRIPT CAPITAL A, a surrogate pair
  assert.equal(astral.length, 4); // UTF-16 code units: a, high surrogate, low surrogate, b
  assert.equal(codePointLength(astral), 3); // code points: a, the astral character, b
});

test("codePointSlice slices by code point, correctly across a surrogate pair", () => {
  const astral = "a\u{1D49C}b";
  assert.equal(codePointSlice(astral, 0, 1), "a");
  assert.equal(codePointSlice(astral, 1, 2), "\u{1D49C}");
  assert.equal(codePointSlice(astral, 2, 3), "b");
  // String.prototype.slice on the same UTF-16 offsets would split the surrogate pair.
  assert.notEqual(astral.slice(1, 2), "\u{1D49C}");
});

test("inlines: (inlines.ts:254) footnote-mark throws when footnoteId is missing or non-string", () => {
  assert.throws(
    () => validateInline({ kind: "footnote-mark", mark: "1)" }),
    /footnoteId is required/,
  );
  // Accept valid footnote-mark
  const accepted = validateInline({ kind: "footnote-mark", mark: "1)", footnoteId: "s1-fn1" });
  assert.equal(accepted.kind, "footnote-mark");
});

/**
 * THE OTHER HALF OF footnote-mark, WHICH WAS UNCOVERED AND COST THE FIRST HALF ITS CREDIT.
 *
 * `case "footnote-mark"` refuses twice, a missing `mark` and a missing `footnoteId`, and the
 * refusal scanner reads both under the one code it can infer. Its rule is that an uncited site
 * under a repeated code is never credited, so covering only `footnoteId` left BOTH reading as
 * untested and `inlines.ts` over its untested-refusal baseline. One test per site, each citing its
 * own line.
 */
test("inlines: (inlines.ts:253) footnote-mark throws when mark is missing or non-string", () => {
  assert.throws(
    () => validateInline({ kind: "footnote-mark", footnoteId: "s1-fn1" }),
    /mark is required/,
  );
  // And the accept half, so this is a pair rather than a one-sided refusal check.
  const accepted = validateInline({ kind: "footnote-mark", mark: "*)", footnoteId: "s1-fn2" });
  assert.equal(accepted.kind, "footnote-mark");
});

test("inlines: (inlines.ts:278) citation-ref throws when citationId is missing or non-string", () => {
  assert.throws(() => validateInline({ kind: "citation-ref" }), /citationId is required/);
  // Accept valid citation-ref
  const accepted = validateInline({ kind: "citation-ref", citationId: "cite-1" });
  assert.equal(accepted.kind, "citation-ref");
});

/**
 * THE AUTHORED SPOKEN FORM FOR ONE OCCURRENCE (am-rc1001-bridge-plan-pcjk.29).
 *
 * `speakInlines` already had an `authored` parameter, but it is keyed by `equationId`, and a
 * non-display math inline carries none: measured over the corpus, 1428 of the 1828 non-display
 * inlines have no equationId, which is the 714 per face that bead is about. So the override
 * existed and could not be reached for exactly the population that needed it. `spoken` is that
 * channel, and the first test below is the one that matters -- the field has to SURVIVE
 * validation, because validateInline rebuilds the node from the keys it knows and drops any
 * other in silence.
 */
test("a math inline's authored spoken form survives validation, not dropped as unknown", () => {
  assert.deepEqual(validateInline({ kind: "math", latex: "\\overline{E}", spoken: "E bar" }), {
    kind: "math",
    latex: "\\overline{E}",
    spoken: "E bar",
  });
});

test("an absent spoken form leaves the node exactly as it was, so nothing is invented", () => {
  assert.deepEqual(validateInline({ kind: "math", latex: "x'" }), { kind: "math", latex: "x'" });
});

test("(inlines.ts:229) inline-spoken-empty: an empty spoken form is refused", () => {
  assert.throws(
    () => validateInline({ kind: "math", latex: "x", spoken: "   " }),
    /spoken must be a non-empty string/,
  );
  assert.throws(
    () => validateInline({ kind: "math", latex: "x", spoken: 7 }),
    /spoken must be a non-empty string/,
  );
});

test("(inlines.ts:236) inline-spoken-on-display: a display inline is refused a spoken form", () => {
  assert.throws(
    () =>
      validateInline({
        kind: "math",
        latex: "E = mc^2",
        display: true,
        spoken: "E equals m c squared",
      }),
    /must not carry a spoken form/,
  );
  // The same node without the form is accepted, so the refusal is about the form and not the flag.
  assert.deepEqual(validateInline({ kind: "math", latex: "E = mc^2", display: true }), {
    kind: "math",
    latex: "E = mc^2",
    display: true,
  });
});
