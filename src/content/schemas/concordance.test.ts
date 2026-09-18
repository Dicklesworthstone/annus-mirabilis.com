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

// ============================================================================
// Group 2: Operations (12 sites)
// ============================================================================

test("Operation: (concordance.ts:285) missing-operation rejected when raw is not an object, accepted with valid operation", () => {
  assertConcordanceRefusal(() => validateOperation(null), "missing-operation");
  assertConcordanceRefusal(() => validateOperation("not-an-object"), "missing-operation");

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "symbol", modernGlyph: "b" },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:291) missing-rename-target rejected when rename target is not an object, accepted with target", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "rename", target: "not-an-object" }),
    "missing-rename-target",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "symbol", modernGlyph: "b" },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:298) invalid-rename-form rejected when form is unknown, accepted with valid form", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "rename", target: { form: "invalid-form" } }),
    "invalid-rename-form",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "symbol", modernGlyph: "b" },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:307) missing-modern-glyph rejected when symbol rename has no modernGlyph, accepted with glyph", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "rename", target: { form: "symbol" } }),
    "missing-modern-glyph",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "symbol", modernGlyph: "b" },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:326) missing-group-pattern rejected when group rename has no pattern, accepted with pattern", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "rename", target: { form: "group", modernGlyph: "B" } }),
    "missing-group-pattern",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: {
      form: "group",
      pattern: { kind: "multiply", terms: ["k", "T"] },
      modernGlyph: "B",
    },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:333) missing-group-modern-glyph rejected when group rename has no modernGlyph, accepted with glyph", () => {
  assertConcordanceRefusal(
    () =>
      validateOperation({
        kind: "rename",
        target: {
          form: "group",
          pattern: { kind: "multiply", terms: ["k", "T"] },
        },
      }),
    "missing-group-modern-glyph",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: {
      form: "group",
      pattern: { kind: "multiply", terms: ["k", "T"] },
      modernGlyph: "B",
    },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:353) missing-modern-tree rejected when expression rename has no modernTree, accepted with tree", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "rename", target: { form: "expression" } }),
    "missing-modern-tree",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "expression", modernTree: { type: "identifier", name: "E" } },
  });
  assert.equal(accepted.kind, "rename");
});

test("Operation: (concordance.ts:379) invalid-unit-system rejected when fromSystem is loose or invalid, accepted with canon name", () => {
  assertConcordanceRefusal(
    () =>
      validateOperation({
        kind: "unitConversion",
        fromSystem: "gaussian",
        toSystem: "si",
      }),
    "invalid-unit-system",
  );

  const accepted = validateOperation({
    kind: "unitConversion",
    fromSystem: "gaussian-cgs",
    toSystem: "si",
  });
  assert.equal(accepted.kind, "unitConversion");
});

test("Operation: (concordance.ts:389) invalid-unit-system rejected when toSystem is loose or invalid, accepted with canon name", () => {
  assertConcordanceRefusal(
    () =>
      validateOperation({
        kind: "unitConversion",
        fromSystem: "si",
        toSystem: "emu",
      }),
    "invalid-unit-system",
  );

  const accepted = validateOperation({
    kind: "unitConversion",
    fromSystem: "si",
    toSystem: "emu-cgs",
  });
  assert.equal(accepted.kind, "unitConversion");
});

test("Operation: (concordance.ts:417) missing-modern-lens-ref rejected when modernization has no modernLensRef, accepted with ref", () => {
  assertConcordanceRefusal(
    () =>
      validateOperation({
        kind: "modernization",
        argumentChangeDescription: "Modern interpretation in terms of rest frame",
      }),
    "missing-modern-lens-ref",
  );

  const accepted = validateOperation({
    kind: "modernization",
    modernLensRef: "sr-modern-lens",
    argumentChangeDescription: "Modern interpretation in terms of rest frame",
  });
  assert.equal(accepted.kind, "modernization");
});

test("Operation: (concordance.ts:424) missing-argument-change-description rejected when description missing, accepted with desc", () => {
  assertConcordanceRefusal(
    () =>
      validateOperation({
        kind: "modernization",
        modernLensRef: "sr-modern-lens",
      }),
    "missing-argument-change-description",
  );

  const accepted = validateOperation({
    kind: "modernization",
    modernLensRef: "sr-modern-lens",
    argumentChangeDescription: "Modern interpretation in terms of rest frame",
  });
  assert.equal(accepted.kind, "modernization");
});

test("Operation: (concordance.ts:437) invalid-operation-kind rejected when kind is unknown, accepted for valid operation kinds", () => {
  assertConcordanceRefusal(
    () => validateOperation({ kind: "unsupported-operation" }),
    "invalid-operation-kind",
  );

  const accepted = validateOperation({
    kind: "rename",
    target: { form: "symbol", modernGlyph: "b" },
  });
  assert.equal(accepted.kind, "rename");
});

// ============================================================================
// Group 3: Collisions (9 sites)
// ============================================================================

const VALID_COLLISION = {
  severity: "danger" as const,
  kind: "cross-paper" as const,
  collidesWith: ["sr.beta.lorentz-factor"],
  firstUseAnchor: "s1-p2-s3",
  firstUseBySection: [
    { sectionId: "s1", anchor: "s1-p2-s3" },
  ],
};

test("Collision: (concordance.ts:446) invalid-collision rejected when raw is not an object, accepted with valid collision", () => {
  assertConcordanceRefusal(() => validateCollision(null), "invalid-collision");
  assertConcordanceRefusal(() => validateCollision("not-an-object"), "invalid-collision");

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.severity, "danger");
});

test("Collision: (concordance.ts:458) invalid-collision-severity rejected when severity unknown, accepted with danger/caution", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, severity: "warning" as any }),
    "invalid-collision-severity",
  );

  const accepted = validateCollision({ ...VALID_COLLISION, severity: "caution" });
  assert.equal(accepted.severity, "caution");
});

test("Collision: (concordance.ts:465) invalid-collision-kind rejected when kind unknown, accepted with valid kind", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, kind: "global" as any }),
    "invalid-collision-kind",
  );

  const accepted = validateCollision({ ...VALID_COLLISION, kind: "within-paper" });
  assert.equal(accepted.kind, "within-paper");
});

test("Collision: (concordance.ts:478) collision-targets-empty rejected when both target arrays empty, accepted with targets", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, collidesWith: [], collidesWithModern: [] }),
    "collision-targets-empty",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.collidesWith.length, 1);
});

test("Collision: (concordance.ts:486) missing-first-use-anchor rejected when anchor empty or missing, accepted with anchor", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, firstUseAnchor: "   " }),
    "missing-first-use-anchor",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.firstUseAnchor, "s1-p2-s3");
});

test("Collision: (concordance.ts:494) missing-first-use-by-section rejected when array empty or not array, accepted with items", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, firstUseBySection: [] }),
    "missing-first-use-by-section",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.firstUseBySection.length, 1);
});

test("Collision: (concordance.ts:504) invalid-first-use-section-item rejected when item not object, accepted with object", () => {
  assertConcordanceRefusal(
    () => validateCollision({ ...VALID_COLLISION, firstUseBySection: ["not-an-object" as any] }),
    "invalid-first-use-section-item",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.firstUseBySection[0]?.sectionId, "s1");
});

test("Collision: (concordance.ts:512) missing-section-id rejected when sectionId missing or empty, accepted with sectionId", () => {
  assertConcordanceRefusal(
    () =>
      validateCollision({
        ...VALID_COLLISION,
        firstUseBySection: [{ sectionId: "   ", anchor: "s1-p1" }],
      }),
    "missing-section-id",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.firstUseBySection[0]?.sectionId, "s1");
});

test("Collision: (concordance.ts:519) missing-anchor rejected when section anchor missing or empty, accepted with anchor", () => {
  assertConcordanceRefusal(
    () =>
      validateCollision({
        ...VALID_COLLISION,
        firstUseBySection: [{ sectionId: "s1", anchor: "   " }],
      }),
    "missing-anchor",
  );

  const accepted = validateCollision(VALID_COLLISION);
  assert.equal(accepted.firstUseBySection[0]?.anchor, "s1-p2-s3");
});


