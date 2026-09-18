import assert from "node:assert/strict";
import test from "node:test";
import { newRunIdentity, TestLogger } from "../../testing/log/logger.ts";
import {
  type ArgumentNode,
  ArgumentSchemaError,
  type Bridge,
  checkProofRouteAcyclicity,
  type Foundation,
  validateArgumentNode,
  validateAuthoringContract,
  validateFoundationLink,
  validateFoundationOrBridge,
  validateHistoricalPremise,
  validateMeanings,
  validateMisconception,
  validateObstacleResponses,
  validateProof,
  validateQuantity,
  validateReadingSet,
  validateSemanticEquation,
  validateWorkedExample,
} from "./argument.ts";
import { validateRationalDimension, validateRationalScale } from "./dimensionBasis.ts";

const SUITE = "content-schemas-argument";
const BEAD_ID = "am-cm-schemas-argument-llm";
const logger = new TestLogger(SUITE, newRunIdentity());

const validAuthorship = {
  draftedBy: [{ id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" as const }],
};

test.after(async () => {
  await logger.flush();
});

// ============================================================================
// 1. FOUR MEANINGS TESTS
// ============================================================================

test("Meanings: valid four-meaning record passes", () => {
  const start = Date.now();
  const raw = {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  };
  const meanings = validateMeanings(raw);
  assert.equal(meanings.logicalRole, "derivation");
  assert.equal(meanings.historicalStatus, "pedagogical-reconstruction");
  assert.equal(meanings.modelStatus, "exact-within-model");
  assert.equal(meanings.executionStatus, "static-illustration");

  logger.log({
    testId: "meanings-valid-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: raw,
    actual: meanings,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "four-meanings-discrete-fields" },
  });
});

test("Meanings: Planted Negative - missing any of the four fields fails", () => {
  const start = Date.now();
  const missingExec = {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    // executionStatus missing!
  };
  assert.throws(
    () => validateMeanings(missingExec),
    (err: any) => {
      assert.equal(err.code, "missing-meaning-field");
      return true;
    },
  );

  logger.log({
    testId: "meanings-missing-field-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "missing-meaning-field",
    actual: "missing-meaning-field",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "four-meanings-required" },
  });
});

test("Meanings: Planted Negative - invalid enum value fails", () => {
  const start = Date.now();
  const invalidRole = {
    logicalRole: "magical-inference",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  };
  assert.throws(
    () => validateMeanings(invalidRole),
    (err: any) => {
      assert.equal(err.code, "invalid-logical-role");
      return true;
    },
  );

  logger.log({
    testId: "meanings-invalid-enum-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "invalid-logical-role",
    actual: "invalid-logical-role",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "meanings-enum-closed-vocabulary" },
  });
});

// ============================================================================
// 2. HISTORICAL PREMISE (KNOWLEDGE CARDS) TESTS
// ============================================================================

test("HistoricalPremise: valid available, parallel-work, and later cards pass", () => {
  const start = Date.now();
  const availableCard = {
    id: "rayleigh-1900-radiation-law",
    proposition:
      "Energy density of blackbody radiation scales as T * nu^2 in classical equipartition.",
    status: "available",
    sources: [{ title: "Phil. Mag. 49", locator: "p. 539" }],
    date: {
      earliest: "1900",
      latest: "1900",
      precision: "year",
      latestYear: 1900,
    },
    claimsEinsteinKnew: true,
    einsteinKnowledgeEvidence: ["Letter to Mileva Marić, 1901"],
    authorship: validAuthorship,
    reviewState: "reviewed",
  };
  const card1 = validateHistoricalPremise(availableCard);
  assert.equal(card1.id, "rayleigh-1900-radiation-law");
  assert.equal(card1.status, "available");

  const laterCard = {
    id: "perrin-1909-brownian-measurements",
    proposition:
      "Direct visual confirmation of Avogadro's number from Brownian particle sedimentation.",
    status: "later",
    sources: [{ title: "Ann. Chim. Phys. 18", locator: "pp. 5-114" }],
    date: {
      earliest: "1909",
      latest: "1909",
      precision: "year",
      latestYear: 1909,
    },
    claimsEinsteinKnew: false,
    authorship: validAuthorship,
    reviewState: "reviewed",
  };
  const card2 = validateHistoricalPremise(laterCard);
  assert.equal(card2.status, "later");

  logger.log({
    testId: "historical-premise-available-later-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "available/later",
    actual: `${card1.status}/${card2.status}`,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "knowledge-card-valid" },
  });
});

test("HistoricalPremise: admitted import requires status available and latestYear 1905", () => {
  const start = Date.now();
  const validAdmitted = {
    id: "abraham-1905-electron-dynamics",
    proposition: "Relativistic electrodynamics result for moving electron in §8.",
    status: "available",
    sources: [{ title: "Theorie der Elektrizität", locator: "Vol II" }],
    date: {
      earliest: "1905-01",
      latest: "1905-01",
      precision: "month",
      latestYear: 1905,
    },
    claimsEinsteinKnew: false,
    admittedImport: true,
    authorship: validAuthorship,
    reviewState: "draft",
  };
  const card = validateHistoricalPremise(validAdmitted);
  assert.equal(card.admittedImport, true);
  assert.equal(card.date.latestYear, 1905);

  // Admitted import with status parallel-work fails
  assert.throws(
    () => validateHistoricalPremise({ ...validAdmitted, status: "parallel-work" }),
    (err: any) => {
      assert.equal(err.code, "admitted-import-invalid-status");
      return true;
    },
  );

  // Admitted import with latestYear 1904 fails
  assert.throws(
    () =>
      validateHistoricalPremise({
        ...validAdmitted,
        date: { earliest: "1904", latest: "1904", precision: "year", latestYear: 1904 },
      }),
    (err: any) => {
      assert.equal(err.code, "admitted-import-invalid-year");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-admitted-import-gate",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "admitted-import-enforced",
    actual: "admitted-import-enforced",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "admitted-import-available-1905" },
  });
});

test("HistoricalPremise: verified card requires verifier, date, and evidenceLocator", () => {
  const start = Date.now();
  const verifiedCard = {
    id: "boltzmann-1877-entropy-probability",
    proposition: "Entropy is proportional to the logarithm of state probability.",
    status: "available",
    sources: [{ title: "Wien. Ber. 76", locator: "p. 373" }],
    date: {
      earliest: "1877",
      latest: "1877",
      precision: "year",
      latestYear: 1877,
    },
    claimsEinsteinKnew: true,
    einsteinKnowledgeEvidence: [
      "Einstein 1905 light-quanta §5 cites Boltzmann principle directly.",
    ],
    verifier: "jemanuel",
    dateVerified: "2026-09-15",
    evidenceLocator: "Doc 14, Collected Papers Vol 2",
    authorship: validAuthorship,
    reviewState: "reviewed",
  };
  const card = validateHistoricalPremise(verifiedCard);
  assert.equal(card.verifier, "jemanuel");

  // Missing evidenceLocator fails
  const missingLocator = { ...verifiedCard, evidenceLocator: undefined };
  assert.throws(
    () => validateHistoricalPremise(missingLocator),
    (err: any) => {
      assert.equal(err.code, "verified-premise-missing-locator");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-verified-locator-required",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "verified-premise-missing-locator",
    actual: "verified-premise-missing-locator",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "verified-card-complete-metadata" },
  });
});

test("HistoricalPremise: Planted Negative - claimsEinsteinKnew without evidence fails", () => {
  const start = Date.now();
  const raw = {
    id: "planck-1900-blackbody",
    proposition: "Planck radiation distribution law.",
    status: "available",
    sources: [{ title: "Verh. Dtsch. Phys. Ges. 2", locator: "p. 237" }],
    date: { earliest: "1900", latest: "1900", precision: "year", latestYear: 1900 },
    claimsEinsteinKnew: true,
    // einsteinKnowledgeEvidence missing!
    authorship: validAuthorship,
    reviewState: "draft",
  };
  assert.throws(
    () => validateHistoricalPremise(raw),
    (err: any) => {
      assert.equal(err.code, "missing-einstein-knowledge-evidence");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-einstein-evidence-required",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "missing-einstein-knowledge-evidence",
    actual: "missing-einstein-knowledge-evidence",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "claims-einstein-knew-evidence-binding" },
  });
});

test("HistoricalPremise: Planted Negative - status 'later-confirmation' is rejected in favor of 'later'", () => {
  const start = Date.now();
  const raw = {
    id: "millikan-1916-photoelectric",
    proposition: "Photoelectric precision measurement.",
    status: "later-confirmation",
    sources: [{ title: "Phys. Rev. 7", locator: "p. 355" }],
    date: { earliest: "1916", latest: "1916", precision: "year", latestYear: 1916 },
    claimsEinsteinKnew: false,
    authorship: validAuthorship,
    reviewState: "draft",
  };
  assert.throws(
    () => validateHistoricalPremise(raw),
    (err: any) => {
      assert.equal(err.code, "invalid-premise-status");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-later-confirmation-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "invalid-premise-status",
    actual: "invalid-premise-status",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "later-status-canonical" },
  });
});

test("HistoricalPremise: Planted Negative - invalid ID grammar journey-i-rayleigh fails", () => {
  const start = Date.now();
  const raw = {
    id: "journey-i-rayleigh",
    proposition: "Test",
    status: "available",
    sources: [{ title: "Book", locator: "p. 1" }],
    date: { earliest: "1900", latest: "1900", precision: "year", latestYear: 1900 },
    claimsEinsteinKnew: false,
    authorship: validAuthorship,
    reviewState: "draft",
  };
  assert.throws(
    () => validateHistoricalPremise(raw),
    (err: any) => {
      assert.equal(err.code, "premise-id-grammar");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-journey-id-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "premise-id-grammar",
    actual: "premise-id-grammar",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "premise-id-grammar" },
  });
});

test("HistoricalPremise: Planted Negative - latestYear mismatch with latest date fails", () => {
  const start = Date.now();
  const raw = {
    id: "wien-1896-radiation-law",
    proposition: "Wien radiation distribution.",
    status: "available",
    sources: [{ title: "Ann. Phys. 58", locator: "p. 662" }],
    date: { earliest: "1896", latest: "1896", precision: "year", latestYear: 1900 },
    claimsEinsteinKnew: false,
    authorship: validAuthorship,
    reviewState: "draft",
  };
  assert.throws(
    () => validateHistoricalPremise(raw),
    (err: any) => {
      assert.equal(err.code, "latest-year-mismatch");
      return true;
    },
  );

  logger.log({
    testId: "historical-premise-latest-year-mismatch",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "latest-year-mismatch",
    actual: "latest-year-mismatch",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "shelf-date-integrity" },
  });
});

// ============================================================================
// 3. ARGUMENT NODE & PROOF TESTS
// ============================================================================

test("ArgumentNode: valid argument node with historical premise, evidence edge, and recap passes", () => {
  const start = Date.now();
  const raw = {
    id: "arg-bm-variance-of-sum",
    paper: "brownian-motion",
    question: "How does the mean-square displacement scale with time across independent steps?",
    conclusion:
      "The variance of a sum of independent displacements equals the sum of their variances: <Delta^2> = 2Dt.",
    logicalRole: "derivation",
    derivationChainId: "dc-bm-diffusion",
    limitations: ["Applies only for time intervals tau long compared to collision times."],
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "host-calculation",
    },
    premises: [
      {
        ref: { kind: "premise", id: "fick-1855-diffusion-law" },
        edgeType: "historical-derivation",
      },
    ],
    evidence: [
      {
        ref: { kind: "dataset", id: "perrin-1909-dataset" },
        relation: "supports",
        dateLabel: "later evidence (1909)",
      },
    ],
    sourceSupport: [{ paper: "brownian-motion", id: "s4-p3" }],
    prerequisites: [
      { foundationId: "found-taylor-series", kind: "proof-edge" },
      { foundationId: "found-gaussian-integral", kind: "cross-link" },
    ],
    coverageObligation: {
      question: "Variance scaling",
      observableResponse: "Linear growth with time",
      mathematicalOwner: "Diffusion equation",
      nonvisualEquivalent: "Table of RMS displacement vs time",
      treatment: {
        kind: "instrument",
        experimentIds: ["bm-01", "bm-05"],
        correspondenceNote:
          "bm-01 visualizes the individual walks; bm-05 computes the ensemble variance.",
      },
    },
    recap:
      "Established that irregular molecular collisions drive macroscopically observable diffusion proportional to elapsed time.",
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  const node = validateArgumentNode(raw);
  assert.equal(node.id, "arg-bm-variance-of-sum");
  assert.equal(node.premises.length, 1);
  assert.equal(node.evidence.length, 1);
  assert.equal(node.prerequisites.length, 2);
  assert.equal(node.recap, raw.recap);

  const rawNoRecap = { ...raw, recap: undefined };
  const nodeNoRecap = validateArgumentNode(rawNoRecap);
  assert.equal(nodeNoRecap.recap, undefined);

  logger.log({
    testId: "argument-node-valid-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "arg-bm-variance-of-sum",
    actual: node.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "argument-node-shape" },
  });
});

test("ArgumentNode: Planted Negative - empty recap string is rejected", () => {
  const start = Date.now();
  const rawEmptyRecap = {
    id: "arg-bm-test",
    paper: "brownian-motion",
    question: "Test question?",
    conclusion: "Test conclusion.",
    logicalRole: "derivation",
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    limitations: [],
    premises: [],
    evidence: [],
    sourceSupport: [],
    prerequisites: [],
    coverageObligation: {
      question: "Q",
      observableResponse: "R",
      mathematicalOwner: "O",
      nonvisualEquivalent: "E",
      treatment: { kind: "static", description: "Static diagram" },
    },
    recap: "   ",
    authorship: validAuthorship,
    reviewState: "draft",
  };

  assert.throws(
    () => validateArgumentNode(rawEmptyRecap),
    (err: any) => {
      assert.equal(err.code, "empty-recap");
      return true;
    },
  );

  logger.log({
    testId: "argument-node-empty-recap-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "empty-recap",
    actual: "empty-recap",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "non-empty-recap-if-present" },
  });
});

test("ArgumentNode: Planted Negative - edgeType 'proof' or bare prerequisite is rejected", () => {
  const start = Date.now();
  const base = {
    id: "arg-bm-test-edges",
    paper: "brownian-motion",
    question: "Test",
    conclusion: "Test",
    logicalRole: "derivation",
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    limitations: [],
    evidence: [],
    sourceSupport: [],
    coverageObligation: {
      question: "Q",
      observableResponse: "R",
      mathematicalOwner: "O",
      nonvisualEquivalent: "E",
      treatment: { kind: "static", description: "D" },
    },
    authorship: validAuthorship,
    reviewState: "draft",
  };

  // edgeType: "proof"
  assert.throws(
    () =>
      validateArgumentNode({
        ...base,
        premises: [{ ref: { kind: "argument", id: "arg-1" }, edgeType: "proof" }],
        prerequisites: [],
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-edge-type");
      return true;
    },
  );

  // Prerequisite as bare string
  assert.throws(
    () =>
      validateArgumentNode({
        ...base,
        premises: [],
        prerequisites: ["found-taylor-series" as any],
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-prerequisite-shape");
      return true;
    },
  );

  // Prerequisite kind: "proof"
  assert.throws(
    () =>
      validateArgumentNode({
        ...base,
        premises: [],
        prerequisites: [{ foundationId: "found-taylor", kind: "proof" as any }],
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-prerequisite-kind");
      return true;
    },
  );

  logger.log({
    testId: "argument-node-edge-types-checked",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "invalid-edge-type",
    actual: "invalid-edge-type",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "typed-prerequisites-and-premises" },
  });
});

test("ArgumentNode: Proof Route Acyclicity checks proof edges and detects cycles", () => {
  const start = Date.now();
  const nodeA: ArgumentNode = {
    id: "arg-bm-a",
    paper: "brownian-motion",
    question: "A?",
    conclusion: "A.",
    logicalRole: "derivation",
    limitations: [],
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    premises: [],
    evidence: [],
    sourceSupport: [],
    prerequisites: [],
    coverageObligation: {
      question: "A",
      observableResponse: "A",
      mathematicalOwner: "A",
      nonvisualEquivalent: "A",
      treatment: { kind: "static", description: "A" },
    },
    authorship: validAuthorship,
    reviewState: "draft",
  };

  const nodeB: ArgumentNode = {
    ...nodeA,
    id: "arg-bm-b",
    premises: [{ ref: { kind: "argument", id: "arg-bm-a" }, edgeType: "historical-derivation" }],
  };

  const nodeC: ArgumentNode = {
    ...nodeA,
    id: "arg-bm-c",
    premises: [{ ref: { kind: "argument", id: "arg-bm-b" }, edgeType: "historical-derivation" }],
  };

  // Acyclic DAG passes
  assert.doesNotThrow(() => checkProofRouteAcyclicity([nodeA, nodeB, nodeC]));

  // Cycle: A -> C (so C -> B -> A -> C)
  const cyclicNodeA: ArgumentNode = {
    ...nodeA,
    premises: [{ ref: { kind: "argument", id: "arg-bm-c" }, edgeType: "historical-derivation" }],
  };

  assert.throws(
    () => checkProofRouteAcyclicity([cyclicNodeA, nodeB, nodeC]),
    (err: any) => {
      assert.equal(err.code, "proof-route-cycle-detected");
      return true;
    },
  );

  // Cross-reference edge does NOT trigger cycle failure
  const crossRefNodeA: ArgumentNode = {
    ...nodeA,
    premises: [{ ref: { kind: "argument", id: "arg-bm-c" }, edgeType: "cross-reference" }],
  };
  assert.doesNotThrow(() => checkProofRouteAcyclicity([crossRefNodeA, nodeB, nodeC]));

  logger.log({
    testId: "proof-route-acyclicity-checked",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "acyclic-proof-routes",
    actual: "acyclic-proof-routes",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "proof-acyclicity-gate" },
  });
});

// ============================================================================
// 4. QUANTITY & DIMENSION TESTS
// ============================================================================

test("Quantity: valid frequencyEnergyDensity, electricField, and dimensionless quantities pass", () => {
  const start = Date.now();
  const freqEnergyDensity = {
    id: "frequencyEnergyDensity",
    name: "Spectral Energy Density (Frequency)",
    description: "Energy per unit volume per unit frequency interval.",
    mathematicalKind: "scalar",
    densityKind: "density",
    densityPer: ["volume", "frequency-interval"],
    spectralBasis: "per-frequency",
    dimension: [
      { num: -1, den: 1 },
      { num: 1, den: 1 },
      { num: -1, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    colorRole: "energy",
  };
  const q1 = validateQuantity(freqEnergyDensity);
  assert.equal(q1.id, "frequencyEnergyDensity");
  assert.equal(q1.densityKind, "density");

  const electricField = {
    id: "electricFieldX",
    name: "Electric Field Component X",
    description: "Stationary frame electric field in X direction.",
    mathematicalKind: "vector-component",
    dimension: [
      { num: 1, den: 1 },
      { num: 1, den: 1 },
      { num: -3, den: 1 },
      { num: 0, den: 1 },
      { num: -1, den: 1 },
      { num: 0, den: 1 },
    ],
    gaussianDimension: [
      { num: -1, den: 2 },
      { num: 1, den: 2 },
      { num: -1, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    colorRole: "field",
  };
  const q2 = validateQuantity(electricField);
  assert.equal(q2.gaussianDimension?.length, 6);

  const angle = {
    id: "propagationAngleStationary",
    name: "Propagation Angle in Stationary System",
    description: "Angle between wave vector and X axis in frame K.",
    mathematicalKind: "scalar",
    dimension: [
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    dimensionlessKind: "angle",
    colorRole: "space-geometry",
  };
  const q3 = validateQuantity(angle);
  assert.equal(q3.dimensionlessKind, "angle");

  logger.log({
    testId: "quantity-valid-schemas-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "valid-quantities",
    actual: "valid-quantities",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "quantity-dimension-contract" },
  });
});

test("Quantity: gramEquivalentCharge with SI, Gaussian, and EMU CGS dimensions passes", () => {
  const start = Date.now();
  const gramCharge = {
    id: "gramEquivalentCharge",
    name: "Gram-Equivalent Charge",
    description: "Charge of a gram-equivalent in electrochemistry.",
    mathematicalKind: "scalar",
    dimension: [
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 1, den: 1 },
      { num: 0, den: 1 },
      { num: 1, den: 1 },
      { num: -1, den: 1 },
    ],
    gaussianDimension: [
      { num: 3, den: 2 },
      { num: 1, den: 2 },
      { num: -1, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: -1, den: 1 },
    ],
    emuDimension: [
      { num: 1, den: 2 },
      { num: 1, den: 2 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: -1, den: 1 },
    ],
  };
  const q = validateQuantity(gramCharge);
  assert.equal(q.emuDimension?.[0]?.num, 1);
  assert.equal(q.emuDimension?.[0]?.den, 2);

  logger.log({
    testId: "quantity-gram-equivalent-charge-cgs",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "1/2",
    actual: `${q.emuDimension?.[0]?.num}/${q.emuDimension?.[0]?.den}`,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "cgs-unit-system-concordance" },
  });
});

test("Quantity: state-dependent dimension requires note and forbids dimension/isConstant", () => {
  const start = Date.now();
  const validStateDep = {
    id: "configurationIntegral",
    name: "Configuration Integral",
    description: "State integral B in paper 2 §2.",
    mathematicalKind: "scalar",
    dimensionStatus: "state-dependent",
    dimensionNote: "Dimension depends on the number and nature of state variables p_nu.",
    isConstant: false,
  };
  const q = validateQuantity(validStateDep);
  assert.equal(q.dimensionStatus, "state-dependent");

  // Declared dimension on state-dependent fails
  assert.throws(
    () =>
      validateQuantity({
        ...validStateDep,
        dimension: [
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
        ],
      }),
    (err: any) => {
      assert.equal(err.code, "state-dependent-dimension-declared");
      return true;
    },
  );

  // isConstant: true on state-dependent fails
  assert.throws(
    () => validateQuantity({ ...validStateDep, isConstant: true }),
    (err: any) => {
      assert.equal(err.code, "state-dependent-cannot-be-constant");
      return true;
    },
  );

  logger.log({
    testId: "quantity-state-dependent-rules-enforced",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "state-dependent-rules",
    actual: "state-dependent-rules",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "state-dependent-no-dimension-vector" },
  });
});

test("Quantity: Planted Negatives - rational reduction, denominator 0, and non-zero CGS current fail", () => {
  const start = Date.now();
  // Denominator 0
  assert.throws(
    () => validateRationalScale({ num: 1, den: 0 }),
    (err: any) => {
      assert.equal(err.code, "invalid-denominator");
      return true;
    },
  );

  // Non-reduced fraction {num: 2, den: 4}
  assert.throws(
    () => validateRationalScale({ num: 2, den: 4 }),
    (err: any) => {
      assert.equal(err.code, "rational-not-reduced");
      return true;
    },
  );

  // Non-zero current in EMU CGS dimension
  const emuWithCurrent = {
    id: "badEmuQuantity",
    name: "Bad EMU",
    description: "Test",
    mathematicalKind: "scalar",
    dimension: [
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 1, den: 1 },
      { num: 0, den: 1 },
    ],
    emuDimension: [
      { num: 1, den: 2 },
      { num: 1, den: 2 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 1, den: 1 },
      { num: 0, den: 1 },
    ],
  };
  assert.throws(
    () => validateQuantity(emuWithCurrent),
    (err: any) => {
      assert.equal(err.code, "cgs-nonzero-current");
      return true;
    },
  );

  // Dimensionless without dimensionlessKind
  const dimlessNoKind = {
    id: "dimlessRatio",
    name: "Ratio",
    description: "Dimensionless ratio",
    mathematicalKind: "scalar",
    dimension: [
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
  };
  assert.throws(
    () => validateQuantity(dimlessNoKind),
    (err: any) => {
      assert.equal(err.code, "missing-dimensionless-kind");
      return true;
    },
  );

  // Invalid frame "rest"
  const badFrame = {
    id: "particleEnergy",
    name: "Energy",
    description: "Body energy",
    mathematicalKind: "scalar",
    dimension: [
      { num: 2, den: 1 },
      { num: 1, den: 1 },
      { num: -2, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    frame: "rest",
  };
  assert.throws(
    () => validateQuantity(badFrame),
    (err: any) => {
      assert.equal(err.code, "invalid-frame");
      return true;
    },
  );

  // Invalid statistic "meanSquare" (camelCase)
  const badStat = {
    id: "diffDisplacement",
    name: "Displacement",
    description: "Mean square",
    mathematicalKind: "scalar",
    dimension: [
      { num: 2, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    statistic: "meanSquare",
  };
  assert.throws(
    () => validateQuantity(badStat),
    (err: any) => {
      assert.equal(err.code, "invalid-statistic");
      return true;
    },
  );

  // Luminous intensity requested
  assert.throws(
    () =>
      validateRationalDimension([
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 1, den: 1 },
      ]),
    (err: any) => {
      assert.equal(err.code, "luminous-intensity-forbidden");
      return true;
    },
  );

  logger.log({
    testId: "quantity-planted-negatives-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "all-rejected",
    actual: "all-rejected",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "quantity-strict-dimensions" },
  });
});

test("Quantity: representationFields validates and shadows check throws planted negative", () => {
  const start = Date.now();
  const baseQuantity = {
    id: "testQuantity",
    name: "Test Quantity",
    description: "Test description for representation fields.",
    mathematicalKind: "scalar" as const,
    dimension: [
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
      { num: 0, den: 1 },
    ],
    dimensionlessKind: "ratio" as const,
  };

  // Valid representationFields
  const valid = validateQuantity({
    ...baseQuantity,
    representationFields: ["logTestQuantity"],
  });
  assert.deepEqual(valid.representationFields, ["logTestQuantity"]);

  // Planted negative: representation field shadows own id
  assert.throws(
    () =>
      validateQuantity({
        ...baseQuantity,
        id: "selfShadowingQuantity",
        representationFields: ["selfShadowingQuantity"],
      }),
    (err: any) => {
      assert.equal(err.code, "representation-field-shadows-id");
      return true;
    },
  );

  // Planted negative: representation field shadows registered quantity id
  assert.throws(
    () =>
      validateQuantity(
        {
          ...baseQuantity,
          id: "shadowingQuantity",
          representationFields: ["frequencyEnergyDensity"],
        },
        "Quantity",
        ["frequencyEnergyDensity"],
      ),
    (err: any) => {
      assert.equal(err.code, "representation-field-shadows-id");
      return true;
    },
  );

  logger.log({
    testId: "quantity-representation-fields-shadowing-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "representation-field-shadows-id",
    actual: "representation-field-shadows-id",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "representation-field-no-id-shadow" },
  });
});

// ============================================================================
// 5. EQUATION & SEMANTIC EQUATION TESTS
// ============================================================================

test("Equation: valid equation with term scale 1/2 for kappa and emu-cgs passes", () => {
  const start = Date.now();
  const raw = {
    id: "eq-bm-s2-1",
    paper: "brownian-motion",
    tree: { op: "equals" },
    notationForms: {
      source: {
        mode: "authored",
        unitSystem: "emu-cgs",
        latex: "2 \\kappa N = R",
        termBindings: ["t1", "t2", "t3"],
      },
      modern: { mode: "generated", unitSystem: "si" },
    },
    terms: [
      {
        termId: "eq-bm-s2-1.t.kappa",
        quantityId: "boltzmannConstant",
        scale: { num: 1, den: 2 },
        role: "constant",
      },
    ],
    operations: [
      { opId: "eq-bm-s2-1.op.mult", kind: "multiplication", explanation: "Multiply gas constant" },
    ],
    spokenForm: "Two kappa times Avogadro's number equals the universal gas constant.",
    readings: "rs-eq-bm-s2-1",
    meanings: {
      logicalRole: "definition",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    authorship: validAuthorship,
  };

  const eq = validateSemanticEquation(raw);
  assert.equal(eq.id, "eq-bm-s2-1");
  assert.equal(eq.terms[0]?.scale?.den, 2);
  assert.equal(eq.spokenForm, raw.spokenForm);

  logger.log({
    testId: "equation-valid-term-scale-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "eq-bm-s2-1",
    actual: eq.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "term-scale-exact-rational" },
  });
});

test("Equation: Planted Negatives - missing spokenForm, zero term scale, and authored notation without bindings fail", () => {
  const start = Date.now();
  const base = {
    id: "eq-sr-s1-1",
    paper: "special-relativity",
    tree: {},
    notationForms: {
      source: { mode: "generated", unitSystem: "si" },
      modern: { mode: "generated", unitSystem: "si" },
    },
    terms: [],
    operations: [],
    readings: "rs-1",
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    authorship: validAuthorship,
  };

  // Missing spokenForm
  assert.throws(
    () => validateSemanticEquation({ ...base, spokenForm: "   " }),
    (err: any) => {
      assert.equal(err.code, "missing-spoken-form");
      return true;
    },
  );

  // Term scale of zero
  assert.throws(
    () =>
      validateSemanticEquation({
        ...base,
        spokenForm: "Valid spoken form.",
        terms: [
          {
            termId: "eq-sr-s1-1.t.v",
            quantityId: "velocity",
            scale: { num: 0, den: 1 },
            role: "variable",
          },
        ],
      }),
    (err: any) => {
      assert.equal(err.code, "zero-scale-forbidden");
      return true;
    },
  );

  // Authored notation form without bindings
  assert.throws(
    () =>
      validateSemanticEquation({
        ...base,
        spokenForm: "Valid spoken form.",
        notationForms: {
          source: { mode: "authored", unitSystem: "si", latex: "E = mc^2" },
          modern: { mode: "generated", unitSystem: "si" },
        },
      }),
    (err: any) => {
      assert.equal(err.code, "authored-notation-missing-bindings");
      return true;
    },
  );

  logger.log({
    testId: "equation-planted-negatives-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "all-rejected",
    actual: "all-rejected",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "equation-required-fields" },
  });
});

// ============================================================================
// 6. READING SET & AUTHORING CONTRACT TESTS
// ============================================================================

test("ReadingSet: valid reading set with footnote targetKind passes", () => {
  const start = Date.now();
  const raw = {
    targetId: "s3-fn1",
    targetKind: "footnote",
    r0: "Footnote overview.",
    r1: "Footnote full explanation.",
    r2: "Footnote step-by-step.",
    r3: "Historical context on the footnote.",
    foundationLinks: [{ foundationId: "found-viscosity", callingAnchor: "s3-fn1" }],
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  const rs = validateReadingSet(raw);
  assert.equal(rs.targetId, "s3-fn1");
  assert.equal(rs.targetKind, "footnote");
  assert.equal(rs.foundationLinks?.length, 1);

  logger.log({
    testId: "reading-set-valid-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "s3-fn1",
    actual: rs.targetId,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "reading-target-ownership" },
  });
});

test("ReadingSet: Planted Negative - targetKind 'caption' or mismatched targetId fails", () => {
  const start = Date.now();
  const rawCaption = {
    targetId: "cap-1",
    targetKind: "caption",
    r0: "Text",
    r1: "Text",
    r2: "Text",
    r3: "Text",
    authorship: validAuthorship,
    reviewState: "draft",
  };

  assert.throws(
    () => validateReadingSet(rawCaption),
    (err: any) => {
      assert.equal(err.code, "invalid-reading-target-kind");
      return true;
    },
  );

  const rawMismatch = {
    targetId: "s3-p1",
    targetKind: "heading",
    r0: "Text",
    r1: "Text",
    r2: "Text",
    r3: "Text",
    authorship: validAuthorship,
    reviewState: "draft",
  };

  assert.throws(
    () => validateReadingSet(rawMismatch),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  logger.log({
    testId: "reading-set-mismatched-target-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "invalid-target-id-for-kind",
    actual: "invalid-target-id-for-kind",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "reading-target-kind-consistency" },
  });
});

test("ReadingSet: validates all 7 targetKinds and rejects mismatched targetIds", () => {
  const start = Date.now();
  const baseReadingSet = {
    r0: "Level 0 reading text.",
    r1: "Level 1 reading text.",
    r2: "Level 2 reading text.",
    r3: "Level 3 reading text.",
    authorship: validAuthorship,
    reviewState: "draft",
  };

  // 1. paragraph: valid s3-p1, rejected s3-fn1
  const rsP = validateReadingSet({ ...baseReadingSet, targetId: "s3-p1", targetKind: "paragraph" });
  assert.equal(rsP.targetKind, "paragraph");
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, targetId: "s3-fn1", targetKind: "paragraph" }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 2. heading: valid s3, rejected s3-p1
  const rsH = validateReadingSet({ ...baseReadingSet, targetId: "s3", targetKind: "heading" });
  assert.equal(rsH.targetKind, "heading");
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, targetId: "s3-p1", targetKind: "heading" }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 3. footnote: valid s3-fn1, rejected s3-p1 (dedicated reject per AC audit)
  const rsFn = validateReadingSet({
    ...baseReadingSet,
    targetId: "s3-fn1",
    targetKind: "footnote",
  });
  assert.equal(rsFn.targetKind, "footnote");
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, targetId: "s3-p1", targetKind: "footnote" }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 4. closing: valid closing-dateline, rejected s3-p1
  const rsCl = validateReadingSet({
    ...baseReadingSet,
    targetId: "closing-dateline",
    targetKind: "closing",
  });
  assert.equal(rsCl.targetKind, "closing");
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, targetId: "s3-p1", targetKind: "closing" }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 5. equation: valid eq-sr-s3-1, rejected s3-p1
  const rsEq = validateReadingSet({
    ...baseReadingSet,
    targetId: "eq-sr-s3-1",
    targetKind: "equation",
  });
  assert.equal(rsEq.targetKind, "equation");
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, targetId: "s3-p1", targetKind: "equation" }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 6. derivation-step: valid chain-1/step-1 and s4-step1, rejected Invalid Step!
  const rsDs1 = validateReadingSet({
    ...baseReadingSet,
    targetId: "chain-1/step-1",
    targetKind: "derivation-step",
  });
  assert.equal(rsDs1.targetKind, "derivation-step");
  const rsDs2 = validateReadingSet({
    ...baseReadingSet,
    targetId: "s4-step1",
    targetKind: "derivation-step",
  });
  assert.equal(rsDs2.targetKind, "derivation-step");
  assert.throws(
    () =>
      validateReadingSet({
        ...baseReadingSet,
        targetId: "Invalid Step!",
        targetKind: "derivation-step",
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  // 7. instrument-caption: valid lq-06-caption, rejected Invalid Caption!
  const rsCap = validateReadingSet({
    ...baseReadingSet,
    targetId: "lq-06-caption",
    targetKind: "instrument-caption",
  });
  assert.equal(rsCap.targetKind, "instrument-caption");
  assert.throws(
    () =>
      validateReadingSet({
        ...baseReadingSet,
        targetId: "Invalid Caption!",
        targetKind: "instrument-caption",
      }),
    (err: any) => {
      assert.equal(err.code, "invalid-target-id-for-kind");
      return true;
    },
  );

  logger.log({
    testId: "reading-set-all-7-target-kinds-validated",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "all-7-kinds-valid",
    actual: "all-7-kinds-valid",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "reading-target-kinds-all-7" },
  });
});

test("essentialForPrint: optional on ReadingSet and Misconception, rejected on all other entities", () => {
  const start = Date.now();

  // ReadingSet: optional, boolean accepted, absent defaults to undefined
  const baseReadingSet = {
    targetId: "s3-p1",
    targetKind: "paragraph" as const,
    r0: "Text 0",
    r1: "Text 1",
    r2: "Text 2",
    r3: "Text 3",
    authorship: validAuthorship,
    reviewState: "draft",
  };
  const rsAbsent = validateReadingSet(baseReadingSet);
  assert.equal(rsAbsent.essentialForPrint, undefined);
  const rsTrue = validateReadingSet({ ...baseReadingSet, essentialForPrint: true });
  assert.equal(rsTrue.essentialForPrint, true);
  const rsFalse = validateReadingSet({ ...baseReadingSet, essentialForPrint: false });
  assert.equal(rsFalse.essentialForPrint, false);
  assert.throws(
    () => validateReadingSet({ ...baseReadingSet, essentialForPrint: "not-a-boolean" as any }),
    (err: any) => {
      assert.equal(err.code, "invalid-essential-for-print");
      return true;
    },
  );

  // Misconception: optional, boolean accepted, absent defaults to undefined
  const baseMisconception = {
    id: "misc-sample",
    paper: "special-relativity",
    temptingClaims: ["First claim."],
    whyTempting: "Because classical intuition suggests it.",
    whereItIsTrue: "At low speeds v << c.",
    whatIsTrue: "In reality, the Lorentz factor applies.",
    staticTreatment: { reason: "Requires full tensor treatment." },
    intervention: {
      defaultsReviewed: {
        model: "standard",
        labels: "clear",
        defaultControls: "nominal",
        feedback: "immediate",
      },
      reviewRecordId: "rev-misc-1",
    },
    authorship: validAuthorship,
  };
  const miscAbsent = validateMisconception(baseMisconception);
  assert.equal(miscAbsent.essentialForPrint, undefined);
  const miscTrue = validateMisconception({ ...baseMisconception, essentialForPrint: true });
  assert.equal(miscTrue.essentialForPrint, true);
  const miscFalse = validateMisconception({ ...baseMisconception, essentialForPrint: false });
  assert.equal(miscFalse.essentialForPrint, false);
  assert.throws(
    () => validateMisconception({ ...baseMisconception, essentialForPrint: 123 as any }),
    (err: any) => {
      assert.equal(err.code, "invalid-essential-for-print");
      return true;
    },
  );

  // Rejection on all other entities:
  // 1. HistoricalPremise
  assert.throws(
    () =>
      validateHistoricalPremise({
        id: "rayleigh-1900-radiation-law",
        authors: ["Lord Rayleigh"],
        year: 1900,
        topic: "radiation-law",
        statement: "Energy density is proportional to frequency squared.",
        status: "available",
        availableBy1905: {
          earliestPublicationYear: 1900,
          latestYear: 1900,
          precision: "exact",
          venue: "Philosophical Magazine",
        },
        paperCitesOrAsserts: "Einstein cites Rayleigh.",
        claimsEinsteinKnew: false,
        authorship: validAuthorship,
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 2. ArgumentNode
  assert.throws(
    () =>
      validateArgumentNode({
        id: "arg-lq-01",
        paper: "light-quanta",
        section: "s1",
        title: "Introduction to quanta",
        thesis: "Radiation has granular structure.",
        claim: "Light consists of localized energy packets.",
        premises: [],
        meanings: {
          logicalRole: "premise",
          epistemicStatus: "settled",
          pedagogicalRole: "core",
          executionStatus: "executable",
        },
        authorship: validAuthorship,
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 3. Proof
  assert.throws(
    () =>
      validateProof({
        id: "proof-1",
        name: "Proof of equivalence",
        claim: "Mass and energy are equivalent.",
        routes: ["historical-main"],
        steps: [
          {
            stepId: "step-1",
            claim: "Start from radiation pressure.",
            justification: "Maxwell electrodynamics.",
          },
        ],
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 4. Quantity
  assert.throws(
    () =>
      validateQuantity({
        id: "testQty",
        name: "Test",
        description: "Desc",
        mathematicalKind: "scalar",
        dimension: [
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
          { num: 0, den: 1 },
        ],
        dimensionlessKind: "ratio",
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 5. SemanticEquation
  assert.throws(
    () =>
      validateSemanticEquation({
        id: "eq-lq-7",
        paper: "light-quanta",
        tree: { op: "equals" },
        notationForms: {
          source: {
            mode: "authored",
            latex: "E = h \\nu",
            unitSystem: "mks",
            termBindings: {
              E: "energy",
              h: "planckConstant",
              nu: "frequency",
            },
          },
        },
        spokenForm: "E equals h nu",
        meanings: {
          logicalRole: "assertion",
          epistemicStatus: "settled",
          pedagogicalRole: "core",
          executionStatus: "executable",
        },
        authorship: validAuthorship,
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 6. FoundationLink
  assert.throws(
    () =>
      validateFoundationLink({
        foundationId: "found-stokes",
        callingAnchor: "s1-p1",
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 7. WorkedExample
  assert.throws(
    () =>
      validateWorkedExample({
        question: "Q",
        given: "G",
        plausibleFirstThought: "P",
        decisiveStep: "D",
        limitation: "L",
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 8. FoundationOrBridge
  assert.throws(
    () =>
      validateFoundationOrBridge({
        id: "found-test",
        kind: "foundation",
        title: "Test Foundation",
        learningObjective: "Learn something.",
        compactExplanation: "Compact.",
        fullExplanation: "Full.",
        authorship: validAuthorship,
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 9. AuthoringContract
  assert.throws(
    () =>
      validateAuthoringContract({
        question: "Q?",
        premisesRetained: ["P1"],
        conclusionSupported: "C",
        approximationsIntroduced: [],
        omissionsAcknowledged: [],
        bridge: "B",
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 10. ObstacleResponses
  assert.throws(
    () =>
      validateObstacleResponses({
        unfamiliarWordOrSymbol: { explanation: "Explains word." },
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  // 11. Meanings
  assert.throws(
    () =>
      validateMeanings({
        logicalRole: "premise",
        epistemicStatus: "settled",
        pedagogicalRole: "core",
        executionStatus: "executable",
        essentialForPrint: true,
      }),
    (err: any) => {
      assert.equal(err.code, "essential-for-print-rejected");
      return true;
    },
  );

  logger.log({
    testId: "essential-for-print-scoping-enforced",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "essential-for-print-scoping-enforced",
    actual: "essential-for-print-scoping-enforced",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "essential-for-print-allowed-entities-only" },
  });
});

test("AuthoringContract: validates scopeCritical qualification records", () => {
  const start = Date.now();
  const raw = {
    question: "How does body inertia change when emitting radiation?",
    premisesRetained: ["Conservation of energy", "Principle of relativity"],
    conclusionSupported: "Mass decreases by L/V^2.",
    approximationsIntroduced: [
      {
        qualificationId: "qual-first-order-v-c",
        statement: "Neglects terms of order (v/c)^4.",
        restricts: "Valid for slow translational motion.",
        scopeCritical: false,
      },
      {
        qualificationId: "qual-additive-constant",
        statement: "Assumes body energy is independent of absolute potential constant.",
        restricts: "Required for unique inertia attribution.",
        scopeCritical: true,
      },
    ],
    omissionsAcknowledged: [],
    bridge: "Bridge to rest-frame relativistic dynamics.",
  };

  const contract = validateAuthoringContract(raw);
  assert.equal(contract.approximationsIntroduced.length, 2);
  assert.equal(contract.approximationsIntroduced[0]?.scopeCritical, false);
  assert.equal(contract.approximationsIntroduced[1]?.scopeCritical, true);
  assert.equal(contract.approximationsIntroduced[1]?.qualificationId, "qual-additive-constant");

  logger.log({
    testId: "authoring-contract-scope-critical-preserved",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "scopeCritical: true",
    actual: `scopeCritical: ${contract.approximationsIntroduced[1]?.scopeCritical}`,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "authoring-contract-qualification" },
  });
});

// ============================================================================
// 7. FOUNDATION & BRIDGE TESTS
// ============================================================================

test("Foundation: valid foundation with 5-part workedExample and returnCaptions passes", () => {
  const start = Date.now();
  const raw = {
    id: "found-stokes-viscosity",
    kind: "foundation",
    title: "Stokes Law and Viscous Friction",
    learningObjective:
      "Understand how drag force scales with particle radius and dynamic viscosity.",
    compactExplanation: "A sphere moving in fluid experiences resistive drag F = 6*pi*eta*r*v.",
    fullExplanation: "Full hydrodynamic derivation under zero-Reynolds laminar flow conditions.",
    workedExample: {
      question:
        "How does the RMS displacement of a suspended particle change if fluid viscosity doubles?",
      given: "Stokes drag coefficient 6*pi*eta*r; temperature T and radius r held fixed.",
      plausibleFirstThought: "Doubling the viscosity halves the displacement.",
      decisiveStep:
        "Because <x^2> is proportional to D = kT/(6*pi*eta*r), the RMS displacement scales as sqrt(D) = 1/sqrt(2) approx 0.70711.",
      limitation: "Applies only for spherical particles in laminar Newtonian fluid regime.",
    },
    textualEquivalent: "Linear drag scaling explanation without vectors.",
    prerequisites: [{ foundationId: "found-viscosity", kind: "proof-edge" }],
    stoppingPoint: "Limits of Stokes law when particle size approaches mean free path.",
    returnCaptions: [
      { callingAnchor: "bm-s3-p1", caption: "Stokes drag applied to suspended pollen grains" },
    ],
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  const found = validateFoundationOrBridge(raw) as Foundation;
  assert.equal(found.id, "found-stokes-viscosity");
  assert.equal(found.kind, "foundation");
  assert.equal(found.workedExample.plausibleFirstThought, raw.workedExample.plausibleFirstThought);

  logger.log({
    testId: "foundation-worked-example-5-parts-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "found-stokes-viscosity",
    actual: found.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "five-part-worked-example" },
  });
});

test("Bridge: valid entrance bridge with 2 continueWith routes passes", () => {
  const start = Date.now();
  const raw = {
    id: "entrance-brownian-motion",
    kind: "bridge",
    title: "Entering Brownian Motion",
    concreteOperation: "Tracking microscopic fluctuating particles in a stationary droplet.",
    compactExplanation: "Connects visible jittering to invisible molecular kinetic energy.",
    textualEquivalent: "Intuitive account of thermal kicks from molecules.",
    stoppingPoint: "Transition to statistical formulation in §1.",
    readinessSign:
      "Can explain why particles never settle into absolute rest at non-zero temperature.",
    returnCaptions: [{ callingAnchor: "entrance-bm", caption: "Entrance view" }],
    continueWith: [
      { route: "more-guidance", targetId: "found-thermal-equilibrium" },
      { route: "less-guidance", targetId: "bm-01" },
    ],
    newSkill: "Interpreting root-mean-square displacement graphs",
    whyUsefulHere: "Prepares for Einstein's diffusion equation in §4.",
    authorship: validAuthorship,
    reviewState: "draft",
  };

  const bridge = validateFoundationOrBridge(raw) as Bridge;
  assert.equal(bridge.id, "entrance-brownian-motion");
  assert.equal(bridge.kind, "bridge");
  assert.equal(bridge.continueWith?.length, 2);

  logger.log({
    testId: "bridge-entrance-two-routes-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "entrance-brownian-motion",
    actual: bridge.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "entrance-bridge-contract" },
  });
});

test("Foundation/Bridge: Planted Negatives - authored backlinks, string workedExample, empty limitation, and bad continueWith fail", () => {
  const start = Date.now();
  const base = {
    id: "found-test",
    kind: "foundation",
    title: "Test",
    learningObjective: "Test",
    compactExplanation: "Test",
    fullExplanation: "Test",
    workedExample: {
      question: "Q",
      given: "G",
      plausibleFirstThought: "P",
      decisiveStep: "D",
      limitation: "L",
    },
    textualEquivalent: "T",
    prerequisites: [],
    stoppingPoint: "S",
    returnCaptions: [],
    authorship: validAuthorship,
    reviewState: "draft",
  };

  // Authored backlinks forbidden
  assert.throws(
    () => validateFoundationOrBridge({ ...base, backlinks: ["found-other"] }),
    (err: any) => {
      assert.equal(err.code, "authored-backlinks-forbidden");
      return true;
    },
  );

  // workedExample as plain string
  assert.throws(
    () => validateFoundationOrBridge({ ...base, workedExample: "Just a string" as any }),
    (err: any) => {
      assert.equal(err.code, "worked-example-not-object");
      return true;
    },
  );

  // workedExample with empty limitation
  assert.throws(
    () =>
      validateFoundationOrBridge({
        ...base,
        workedExample: {
          question: "Q",
          given: "G",
          plausibleFirstThought: "P",
          decisiveStep: "D",
          limitation: "   ",
        },
      }),
    (err: any) => {
      assert.equal(err.code, "missing-worked-example-part");
      return true;
    },
  );

  // Bridge with only 1 continueWith route
  const bridge1Route = {
    id: "entrance-light-quanta",
    kind: "bridge",
    title: "Light Quanta Entrance",
    concreteOperation: "Photoelectric threshold",
    compactExplanation: "Energy packets",
    textualEquivalent: "Light packets",
    stoppingPoint: "§1",
    readinessSign: "Understands work function",
    returnCaptions: [],
    continueWith: [{ route: "more-guidance", targetId: "found-wave-optics" }],
    authorship: validAuthorship,
    reviewState: "draft",
  };
  assert.throws(
    () => validateFoundationOrBridge(bridge1Route),
    (err: any) => {
      assert.equal(err.code, "invalid-continue-with-routes");
      return true;
    },
  );

  // Bridge with both more-guidance routes
  const bridgeBothMore = {
    ...bridge1Route,
    continueWith: [
      { route: "more-guidance", targetId: "found-1" },
      { route: "more-guidance", targetId: "found-2" },
    ],
  };
  assert.throws(
    () => validateFoundationOrBridge(bridgeBothMore),
    (err: any) => {
      assert.equal(err.code, "invalid-continue-with-routes");
      return true;
    },
  );

  logger.log({
    testId: "foundation-bridge-planted-negatives-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "all-rejected",
    actual: "all-rejected",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "foundation-bridge-strict-validation" },
  });
});

// ============================================================================
// 8. MISCONCEPTION TESTS
// ============================================================================

test("Misconception: valid misconception with two temptingClaims and intervention passes", () => {
  const start = Date.now();
  const raw = {
    id: "misc-bm-continuous-velocity",
    paper: "brownian-motion",
    temptingClaims: [
      "A Brownian particle has an instantaneous physical velocity that can be measured by Delta x / Delta t.",
      "The particle moves on a smooth differentiable trajectory at microscopic time scales.",
    ],
    whyTempting: "Our macro intuition is rooted in differentiable Newtonian paths.",
    whereItIsTrue:
      "Valid only for time intervals much shorter than the momentum relaxation time tau_p = m / (6*pi*eta*r).",
    whatIsTrue:
      "At observable optical time scales, molecular collisions randomize direction millions of times per second.",
    instrumentIds: ["bm-01", "bm-06"],
    anchors: ["bm-s4-p3"],
    resultIds: ["res-diff-scaling"],
    sources: ["Perrin 1909"],
    intervention: {
      instrumentId: "bm-01",
      scenarioId: "sc-short-time",
      defaultsReviewed: {
        model: "Langevin stochastic ballistic-to-diffusive transition",
        labels: "RMS displacement vs elapsed observation interval",
        defaultControls: "Time resolution slider starting at macro regime",
        feedback: "Alerts when reader attempts to compute instantaneous dx/dt",
      },
      reviewRecordId: "rev-misc-bm-01-jemanuel",
    },
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  const misc = validateMisconception(raw);
  assert.equal(misc.temptingClaims.length, 2);
  assert.equal(
    misc.intervention.defaultsReviewed.defaultControls,
    raw.intervention.defaultsReviewed.defaultControls,
  );

  logger.log({
    testId: "misconception-valid-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "misc-bm-continuous-velocity",
    actual: misc.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "misconception-two-claims-intervention" },
  });
});

test("Misconception: valid misconception with whereItIsTrue 'none' and staticTreatment passes", () => {
  const start = Date.now();
  const raw = {
    id: "misc-sr-ether-drag",
    paper: "special-relativity",
    temptingClaims: ["The luminiferous ether is dragged partially by moving dielectric media."],
    whyTempting:
      "Fresnel drag formula was historically interpreted as mechanical medium entrainment.",
    whereItIsTrue:
      "none: in relativistic electrodynamics the speed of light in vacuum is strictly invariant without any medium.",
    whatIsTrue: "Fresnel formula arises purely from relativistic velocity addition.",
    staticTreatment: {
      reason: "Static Minkowski event diagram illustrates frame-independent wavefronts.",
    },
    anchors: ["sr-s0-p2"],
    resultIds: [],
    sources: ["Michelson-Morley 1887"],
    intervention: {
      defaultsReviewed: {
        model: "Minkowski spacetime diagram",
        labels: "Light cone invariants",
        defaultControls: "Static comparative diagram",
        feedback: "Clear non-medium relativistic velocity sum",
      },
      reviewRecordId: "rev-misc-sr-02-jemanuel",
    },
    authorship: validAuthorship,
    reviewState: "reviewed",
  };

  const misc = validateMisconception(raw);
  assert.equal(misc.whereItIsTrue.startsWith("none"), true);
  assert.equal((misc.staticTreatment?.reason.length ?? 0) > 0, true);

  logger.log({
    testId: "misconception-where-true-none-static-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "misc-sr-ether-drag",
    actual: misc.id,
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "misconception-where-true-none-reviewed" },
  });
});

test("Misconception: Planted Negatives - singular temptingClaim, empty claims, 3 claims, and missing intervention judgment fail", () => {
  const start = Date.now();
  const base = {
    id: "misc-test",
    paper: "light-quanta",
    whyTempting: "Intuition",
    whereItIsTrue: "regime",
    whatIsTrue: "truth",
    instrumentIds: ["lq-01"],
    anchors: [],
    resultIds: [],
    sources: [],
    intervention: {
      instrumentId: "lq-01",
      defaultsReviewed: {
        model: "M",
        labels: "L",
        defaultControls: "C",
        feedback: "F",
      },
      reviewRecordId: "rev-1",
    },
    authorship: validAuthorship,
    reviewState: "draft",
  };

  // Singular temptingClaim
  assert.throws(
    () => validateMisconception({ ...base, temptingClaim: "Singular claim" }),
    (err: any) => {
      assert.equal(err.code, "singular-tempting-claim-rejected");
      return true;
    },
  );

  // Empty temptingClaims []
  assert.throws(
    () => validateMisconception({ ...base, temptingClaims: [] }),
    (err: any) => {
      assert.equal(err.code, "invalid-tempting-claims-count");
      return true;
    },
  );

  // Three claims
  assert.throws(
    () => validateMisconception({ ...base, temptingClaims: ["c1", "c2", "c3"] }),
    (err: any) => {
      assert.equal(err.code, "invalid-tempting-claims-count");
      return true;
    },
  );

  // Missing whereItIsTrue
  assert.throws(
    () => validateMisconception({ ...base, temptingClaims: ["c1"], whereItIsTrue: undefined }),
    (err: any) => {
      assert.equal(err.code, "missing-where-it-is-true");
      return true;
    },
  );

  // Missing defaultsReviewed judgment (e.g. feedback)
  assert.throws(
    () =>
      validateMisconception({
        ...base,
        temptingClaims: ["c1"],
        intervention: {
          instrumentId: "lq-01",
          defaultsReviewed: { model: "M", labels: "L", defaultControls: "C" },
          reviewRecordId: "rev-1",
        },
      }),
    (err: any) => {
      assert.equal(err.code, "missing-defaults-reviewed-judgment");
      return true;
    },
  );

  logger.log({
    testId: "misconception-planted-negatives-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "all-rejected",
    actual: "all-rejected",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "misconception-plural-tempting-claims" },
  });
});

// ============================================================================
// 9. OBSTACLE RESPONSES TESTS
// ============================================================================

test("ObstacleResponses: valid camelCase obstacle responses pass", () => {
  const start = Date.now();
  const raw = {
    unfamiliarWordOrSymbol: {
      explanation: "Explains archaic German terminology.",
      foundationLinks: [{ foundationId: "found-notation", callingAnchor: "s1-p1" }],
    },
    algebraicMove: { explanation: "Explains integration by parts." },
    exampleFirst: { workedExampleRef: "found-stokes-viscosity" },
  };

  const resp = validateObstacleResponses(raw);
  assert.equal((resp.unfamiliarWordOrSymbol?.explanation.length ?? 0) > 0, true);
  assert.equal(resp.exampleFirst?.workedExampleRef, "found-stokes-viscosity");

  logger.log({
    testId: "obstacle-responses-valid-pass",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "valid-obstacle-responses",
    actual: "valid-obstacle-responses",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "obstacle-kind-ids-lower-camel-case" },
  });
});

test("ObstacleResponses: Planted Negative - kebab-case key unfamiliar-word-or-symbol fails", () => {
  const start = Date.now();
  const rawKebab = {
    "unfamiliar-word-or-symbol": "Explains word.",
  };

  assert.throws(
    () => validateObstacleResponses(rawKebab),
    (err: any) => {
      assert.equal(err.code, "invalid-obstacle-key");
      return true;
    },
  );

  logger.log({
    testId: "obstacle-responses-kebab-key-rejected",
    beadId: BEAD_ID,
    comparisonKind: "bitwise",
    expected: "invalid-obstacle-key",
    actual: "invalid-obstacle-key",
    outcome: "passed",
    durationMs: Date.now() - start,
    extra: { rule: "obstacle-kind-ids-kebab-rejected" },
  });
});

// ============================================================================
// PROOF, WORKED EXAMPLE, AND FOUNDATION LINK TESTS (am-mhdj)
// ============================================================================

test("Proof: well-formed proof record is accepted", () => {
  const raw = {
    id: "proof-test-1",
    route: "source-order",
    argumentNodeIds: ["arg-1", "arg-2"],
    orderedSteps: ["step-1"],
    entryAssumptions: ["assump-1"],
    moveTypes: ["deduction"],
    sourceMapping: [{ paper: "ap-17-549", id: "p1" }],
  };
  const proof = validateProof(raw);
  assert.equal(proof.id, "proof-test-1");
  assert.equal(proof.route, "source-order");
  assert.deepEqual(proof.argumentNodeIds, ["arg-1", "arg-2"]);
  assert.deepEqual(proof.orderedSteps, ["step-1"]);
});

test("Proof: Planted Negative - non-array argumentNodeIds is refused with typed error", () => {
  const rawString = {
    id: "proof-bad-nodes-1",
    route: "source-order",
    argumentNodeIds: "not-an-array",
  };
  assert.throws(
    () => validateProof(rawString),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-argument-nodes");
      return true;
    },
  );

  const rawNumber = {
    id: "proof-bad-nodes-2",
    route: "source-order",
    argumentNodeIds: 42,
  };
  assert.throws(
    () => validateProof(rawNumber),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-argument-nodes");
      return true;
    },
  );

  const rawMissing = {
    id: "proof-bad-nodes-3",
    route: "source-order",
  };
  assert.throws(
    () => validateProof(rawMissing),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-argument-nodes");
      return true;
    },
  );
});

test("Proof: Planted Negative - argumentNodeIds containing non-string elements is refused", () => {
  const rawMixed = {
    id: "proof-bad-nodes-4",
    route: "source-order",
    argumentNodeIds: ["arg-1", 123, "arg-3"],
  };
  assert.throws(
    () => validateProof(rawMixed),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-argument-nodes");
      return true;
    },
  );

  const rawEmptyString = {
    id: "proof-bad-nodes-5",
    route: "source-order",
    argumentNodeIds: ["arg-1", "   "],
  };
  assert.throws(
    () => validateProof(rawEmptyString),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-argument-nodes");
      return true;
    },
  );
});

test("Proof: Planted Negative - invalid route is refused", () => {
  const raw = {
    id: "proof-bad-route",
    route: "unsupported-route",
    argumentNodeIds: ["arg-1"],
  };
  assert.throws(
    () => validateProof(raw),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "invalid-proof-route");
      return true;
    },
  );
});

test("WorkedExample: well-formed worked example is accepted", () => {
  const raw = {
    question: "How does Brownian motion relate to diffusion?",
    given: "The particle radius and solvent viscosity are known.",
    plausibleFirstThought: "Compute molecular collisions individually.",
    decisiveStep: "Apply the Stokes-Einstein relation and diffusion equation.",
    limitation: "Valid only for spherical particles in Newtonian fluids.",
  };
  const example = validateWorkedExample(raw);
  assert.equal(example.question, raw.question);
  assert.equal(example.given, raw.given);
  assert.equal(example.plausibleFirstThought, raw.plausibleFirstThought);
  assert.equal(example.decisiveStep, raw.decisiveStep);
  assert.equal(example.limitation, raw.limitation);
});

test("WorkedExample: Planted Negative - non-object is refused", () => {
  assert.throws(
    () => validateWorkedExample("string-not-object"),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "worked-example-not-object");
      return true;
    },
  );
});

test("WorkedExample: Planted Negative - missing required part is refused", () => {
  const rawIncomplete = {
    question: "A question?",
    given: "Given data.",
    plausibleFirstThought: "A first thought.",
    // missing decisiveStep
    limitation: "A limitation.",
  };
  assert.throws(
    () => validateWorkedExample(rawIncomplete),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "missing-worked-example-part");
      return true;
    },
  );
});

test("FoundationLink: well-formed foundation link is accepted", () => {
  const raw = {
    foundationId: "diffusion-basics",
    callingAnchor: "arg-bm-01",
    returnCaption: "Return to Brownian motion argument",
  };
  const link = validateFoundationLink(raw);
  assert.equal(link.foundationId, "diffusion-basics");
  assert.equal(link.callingAnchor, "arg-bm-01");
  assert.equal(link.returnCaption, "Return to Brownian motion argument");
});

test("FoundationLink: Planted Negative - missing foundationId is refused", () => {
  const raw = {
    callingAnchor: "arg-bm-01",
  };
  assert.throws(
    () => validateFoundationLink(raw),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "missing-foundation-id");
      return true;
    },
  );
});

test("FoundationLink: Planted Negative - missing callingAnchor is refused", () => {
  const raw = {
    foundationId: "diffusion-basics",
  };
  assert.throws(
    () => validateFoundationLink(raw),
    (err: unknown) => {
      assert.ok(err instanceof ArgumentSchemaError);
      assert.equal(err.code, "missing-calling-anchor");
      return true;
    },
  );
});
