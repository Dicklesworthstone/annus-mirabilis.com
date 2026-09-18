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

// ============================================================================
// Group 4: ConcordanceEntry, ModernOnlySymbol, PaperConcordance (16 sites)
// ============================================================================

const VALID_ENTRY = {
  id: "lq.beta.wien-constant",
  paper: "light-quanta",
  scope: ["s1"],
  glyph: { unicode: "β", latex: "\\beta", variant: "plain" as const },
  meaning: "Wien radiation constant in the exponent of Wien's law",
  binding: { quantityId: "wienConstant" },
  operation: {
    kind: "rename" as const,
    target: {
      form: "symbol" as const,
      modernGlyph: { unicode: "b", latex: "b", variant: "plain" as const },
    },
  },
  sources: {
    anchor: "s1-p2-s3",
    facsimilePage: 133,
  },
  verification: {
    printed: true,
    checkedAgainst: "Annalen der Physik (4) 17, p. 133",
    by: "Editor",
    date: "2026-09-18",
  },
};

const VALID_MODERN_ONLY = {
  id: "modern.hbar",
  glyph: { unicode: "ħ", latex: "\\hbar", variant: "plain" as const },
  binding: { quantityId: "reducedPlanckConstant" },
  scope: ["s1"],
  introducedBy: "modern-lens",
  label: "Reduced Planck constant",
};

const VALID_PAPER_CONCORDANCE = {
  paper: "light-quanta",
  entries: [VALID_ENTRY],
  modernOnlySymbols: [VALID_MODERN_ONLY],
};

test("ConcordanceEntry: (concordance.ts:540) invalid-entry rejected when raw is not an object, accepted with valid entry", () => {
  assertConcordanceRefusal(() => validateConcordanceEntry(null), "invalid-entry");
  assertConcordanceRefusal(() => validateConcordanceEntry("not-an-object"), "invalid-entry");

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.id, "lq.beta.wien-constant");
});

test("ConcordanceEntry: (concordance.ts:545) missing-id rejected when id is missing or empty, accepted with id", () => {
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, id: "" }), "missing-id");
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, id: "   " }), "missing-id");

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.id, "lq.beta.wien-constant");
});

test("ConcordanceEntry: (concordance.ts:550) invalid-concordance-id-grammar rejected when id has fewer than 3 parts, accepted with 3 parts", () => {
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, id: "invalid-id" }),
    "invalid-concordance-id-grammar",
  );
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, id: "lq.beta" }),
    "invalid-concordance-id-grammar",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.id, "lq.beta.wien-constant");
});

test("ConcordanceEntry: (concordance.ts:558) missing-paper rejected when paper slug is empty or missing, accepted with paper slug", () => {
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, paper: "" }), "missing-paper");
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, paper: "   " }), "missing-paper");

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.paper, "light-quanta");
});

test("ConcordanceEntry: (concordance.ts:566) missing-scope rejected when scope is empty array or not array, accepted with non-empty array", () => {
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, scope: [] }), "missing-scope");
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, scope: null as any }), "missing-scope");

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.scope.length, 1);
});

test("ConcordanceEntry: (concordance.ts:574) invalid-scope-id rejected when a scope item is empty or non-string, accepted with string ids", () => {
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, scope: ["s1", "   "] }),
    "invalid-scope-id",
  );
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, scope: [123 as any] }),
    "invalid-scope-id",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.deepEqual(accepted.scope, ["s1"]);
});

test("ConcordanceEntry: (concordance.ts:586) missing-meaning rejected when meaning is missing or empty, accepted with plain words", () => {
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, meaning: "" }), "missing-meaning");
  assertConcordanceRefusal(() => validateConcordanceEntry({ ...VALID_ENTRY, meaning: "   " }), "missing-meaning");

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.ok(accepted.meaning.length > 0);
});

test("ConcordanceEntry: (concordance.ts:604) missing-sources-anchor rejected when sources.anchor is missing or empty, accepted with anchor", () => {
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, sources: {} as any }),
    "missing-sources-anchor",
  );
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, sources: { anchor: "   " } }),
    "missing-sources-anchor",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.sources.anchor, "s1-p2-s3");
});

test("ConcordanceEntry: (concordance.ts:618) missing-verification rejected when verification is not an object, accepted with object", () => {
  assertConcordanceRefusal(
    () => validateConcordanceEntry({ ...VALID_ENTRY, verification: "not-an-object" as any }),
    "missing-verification",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.verification.checkedAgainst, "Annalen der Physik (4) 17, p. 133");
});

test("ConcordanceEntry: (concordance.ts:625) missing-verification-checked-against rejected when checkedAgainst empty, accepted with source", () => {
  assertConcordanceRefusal(
    () =>
      validateConcordanceEntry({
        ...VALID_ENTRY,
        verification: { ...VALID_ENTRY.verification, checkedAgainst: "   " },
      }),
    "missing-verification-checked-against",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.ok(accepted.verification.checkedAgainst.length > 0);
});

test("ConcordanceEntry: (concordance.ts:632) missing-verification-by rejected when verification by is missing or empty, accepted with author", () => {
  assertConcordanceRefusal(
    () =>
      validateConcordanceEntry({
        ...VALID_ENTRY,
        verification: { ...VALID_ENTRY.verification, by: "   " },
      }),
    "missing-verification-by",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.verification.by, "Editor");
});

test("ConcordanceEntry: (concordance.ts:639) missing-verification-date rejected when verification date is missing or empty, accepted with date", () => {
  assertConcordanceRefusal(
    () =>
      validateConcordanceEntry({
        ...VALID_ENTRY,
        verification: { ...VALID_ENTRY.verification, date: "   " },
      }),
    "missing-verification-date",
  );

  const accepted = validateConcordanceEntry(VALID_ENTRY);
  assert.equal(accepted.verification.date, "2026-09-18");
});

test("ModernOnlySymbol: (concordance.ts:688) invalid-modern-only-symbol rejected when raw is not an object, accepted with valid object", () => {
  assertConcordanceRefusal(() => validateModernOnlySymbol(null), "invalid-modern-only-symbol");
  assertConcordanceRefusal(() => validateModernOnlySymbol("not-an-object"), "invalid-modern-only-symbol");

  const accepted = validateModernOnlySymbol(VALID_MODERN_ONLY);
  assert.equal(accepted.id, "modern.hbar");
});

test("ModernOnlySymbol: (concordance.ts:696) missing-modern-only-id rejected when id is missing or empty, accepted with id", () => {
  assertConcordanceRefusal(
    () => validateModernOnlySymbol({ ...VALID_MODERN_ONLY, id: "" }),
    "missing-modern-only-id",
  );
  assertConcordanceRefusal(
    () => validateModernOnlySymbol({ ...VALID_MODERN_ONLY, id: "   " }),
    "missing-modern-only-id",
  );

  const accepted = validateModernOnlySymbol(VALID_MODERN_ONLY);
  assert.equal(accepted.id, "modern.hbar");
});

test("PaperConcordance: (concordance.ts:720) invalid-paper-concordance rejected when raw is not an object, accepted with valid object", () => {
  assertConcordanceRefusal(() => validatePaperConcordance(null), "invalid-paper-concordance");
  assertConcordanceRefusal(() => validatePaperConcordance("not-an-object"), "invalid-paper-concordance");

  const accepted = validatePaperConcordance(VALID_PAPER_CONCORDANCE);
  assert.equal(accepted.paper, "light-quanta");
});

test("PaperConcordance: (concordance.ts:728) missing-paper rejected when paper slug is empty or missing, accepted with paper slug", () => {
  assertConcordanceRefusal(
    () => validatePaperConcordance({ ...VALID_PAPER_CONCORDANCE, paper: "" }),
    "missing-paper",
  );
  assertConcordanceRefusal(
    () => validatePaperConcordance({ ...VALID_PAPER_CONCORDANCE, paper: "   " }),
    "missing-paper",
  );

  const accepted = validatePaperConcordance(VALID_PAPER_CONCORDANCE);
  assert.equal(accepted.paper, "light-quanta");
});



