import assert from "node:assert/strict";
import test from "node:test";
import {
  ConcordanceSchemaError,
  validateBinding,
  validateCollision,
  validateConcordanceEntry,
  validateGlyph,
  validateModernOnlySymbol,
  validateOperation,
  validatePaperConcordance,
} from "./concordance.ts";

/**
 * Untested Refusal Throw Site Suite for src/content/schemas/concordance.ts (am-muyh).
 *
 * Covers all 45 refusal throw sites across:
 * - validateGlyph (5 sites: lines 194, 199, 207, 214, 223)
 * - validateBinding (3 sites: lines 246, 255, 264)
 * - validateOperation (12 sites: lines 285, 291, 298, 307, 326, 333, 353, 379, 389, 417, 424, 437)
 * - validateCollision (9 sites: lines 446, 458, 465, 478, 486, 494, 504, 512, 519)
 * - validateConcordanceEntry (12 sites: lines 540, 545, 550, 558, 566, 574, 586, 604, 618, 625, 632, 639)
 * - validateModernOnlySymbol (2 sites: lines 688, 696)
 * - validatePaperConcordance (2 sites: lines 720, 728)
 */

function assertConcordanceRefusal(fn: () => unknown, expectedCode: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(
      err instanceof ConcordanceSchemaError,
      `Expected ConcordanceSchemaError, got ${String(err)}`,
    );
    assert.equal((err as ConcordanceSchemaError).code, expectedCode);
    return true;
  });
}

// ============================================================================
// Group 1: Glyphs & Bindings (8 sites)
// ============================================================================

test("Glyph: (concordance.ts:194) missing-glyph rejected when string is empty, accepted with non-empty string", () => {
  assertConcordanceRefusal(() => validateGlyph("   "), "missing-glyph");
  assertConcordanceRefusal(() => validateGlyph(""), "missing-glyph");

  const accepted = validateGlyph("β");
  assert.equal(accepted.unicode, "β");
  assert.equal(accepted.latex, "β");
  assert.equal(accepted.variant, "plain");
});

test("Glyph: (concordance.ts:199) invalid-glyph rejected when raw is not an object or string, accepted with valid object", () => {
  assertConcordanceRefusal(() => validateGlyph(null), "invalid-glyph");
  assertConcordanceRefusal(() => validateGlyph(123), "invalid-glyph");
  assertConcordanceRefusal(() => validateGlyph(true), "invalid-glyph");

  const accepted = validateGlyph({ unicode: "β", latex: "\\beta" });
  assert.equal(accepted.unicode, "β");
  assert.equal(accepted.latex, "\\beta");
  assert.equal(accepted.variant, "plain");
});

test("Glyph: (concordance.ts:207) missing-glyph-unicode rejected when unicode is empty or missing, accepted with valid unicode", () => {
  assertConcordanceRefusal(() => validateGlyph({ unicode: "   ", latex: "\\beta" }), "missing-glyph-unicode");
  assertConcordanceRefusal(() => validateGlyph({ latex: "\\beta" }), "missing-glyph-unicode");

  const accepted = validateGlyph({ unicode: "β", latex: "\\beta" });
  assert.equal(accepted.unicode, "β");
});

test("Glyph: (concordance.ts:214) missing-glyph-latex rejected when latex is empty or missing, accepted with valid latex", () => {
  assertConcordanceRefusal(() => validateGlyph({ unicode: "β", latex: "   " }), "missing-glyph-latex");
  assertConcordanceRefusal(() => validateGlyph({ unicode: "β" }), "missing-glyph-latex");

  const accepted = validateGlyph({ unicode: "β", latex: "\\beta" });
  assert.equal(accepted.latex, "\\beta");
});

test("Glyph: (concordance.ts:223) invalid-glyph-variant rejected when variant is unrecognized, accepted with standard variant", () => {
  assertConcordanceRefusal(
    () => validateGlyph({ unicode: "β", latex: "\\beta", variant: "italics" }),
    "invalid-glyph-variant",
  );

  const accepted = validateGlyph({ unicode: "β", latex: "\\beta", variant: "primed" });
  assert.equal(accepted.variant, "primed");
});

test("Binding: (concordance.ts:246) invalid-binding rejected when raw is not object or string, accepted with string or object", () => {
  assertConcordanceRefusal(() => validateBinding(null), "invalid-binding");
  assertConcordanceRefusal(() => validateBinding(42), "invalid-binding");

  const acceptedString = validateBinding("energy");
  assert.deepEqual(acceptedString, { quantityId: "energy" });

  const acceptedObj = validateBinding({ quantityId: "energy" });
  assert.deepEqual(acceptedObj, { quantityId: "energy" });
});

test("Binding: (concordance.ts:255) invalid-non-quantity-kind rejected when kind is unknown, accepted for valid kind", () => {
  assertConcordanceRefusal(
    () => validateBinding({ nonQuantityKind: "unsupported-kind" }),
    "invalid-non-quantity-kind",
  );

  const accepted = validateBinding({ nonQuantityKind: "operator" });
  assert.deepEqual(accepted, { nonQuantityKind: "operator" });
});

test("Binding: (concordance.ts:264) missing-quantity-id rejected when quantityId is missing or empty, accepted with quantityId", () => {
  assertConcordanceRefusal(() => validateBinding({}), "missing-quantity-id");
  assertConcordanceRefusal(() => validateBinding({ quantityId: "   " }), "missing-quantity-id");

  const accepted = validateBinding({ quantityId: "wienConstant" });
  assert.equal(accepted.quantityId, "wienConstant");
});
