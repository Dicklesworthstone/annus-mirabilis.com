import assert from "node:assert/strict";
import test from "node:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { computeFlagFingerprint } from "../../compiler/reviewQueue.ts";
import {
  runApproximationUnlabeled,
  runCircularMolecularCount,
  runCircularRestEnergy,
  runCoverageWithoutOwner,
  runFlags,
  runLaterEvidenceUnlabeled,
  runMisconceptionMinimum,
  runMissingAccessibility,
  runMissingNotModeled,
  runOracleInHistoricalRoute,
  runProofCycle,
  runShelfDate,
  runSimulationAsEvidence,
} from "./run.ts";

/**
 * Untested Refusal Throw Site Suite for src/content/checks/epistemic/run.ts (am-muyh).
 *
 * Covers all 30 refusal throw sites:
 * - runProofCycle (1 site: line 79)
 * - runOracleInHistoricalRoute (1 site: line 97)
 * - runShelfDate (1 site: line 168)
 * - runLaterEvidenceUnlabeled (4 sites: lines 229, 247, 257, 269)
 * - runMissingAccessibility (3 sites: lines 288, 300, 316)
 * - runMissingNotModeled (1 site: line 333)
 * - runCoverageWithoutOwner (4 sites: lines 358, 370, 383, 409)
 * - runMisconceptionMinimum (1 site: line 451)
 * - runApproximationUnlabeled (2 sites: lines 473, 481)
 * - runCircularMolecularCount (2 sites: lines 525, 533)
 * - runCircularRestEnergy (1 site: line 555)
 * - runSimulationAsEvidence (1 site: line 582)
 * - runFlags (8 sites: lines 601, 606, 625, 630, 646, 651, 665, 670)
 *
 * Each test cites its explicit throw site (run.ts:<line>) and provides both an accept
 * path and a reject path exercising the exact epistemic boundary condition.
 */

function createMockContext(records: Record<string, unknown> = {}): {
  context: CheckContext;
  reports: CheckReportItem[];
} {
  const reports: CheckReportItem[] = [];
  const map = new Map<string, unknown>(Object.entries(records));
  const context: CheckContext = {
    records: map,
    files: [],
    indexes: {},
    report: (item) => reports.push(item),
  };
  return { context, reports };
}

// ============================================================================
// 1. PROOF CYCLE REFUSALS (1 SITE)
// ============================================================================

test("runProofCycle: (run.ts:79) proof-cycle reports derivation cycles, accepts acyclic proofs", () => {
  // Reject: circular derivation A -> B -> A
  const rejectCtx = createMockContext({
    a: {
      kind: "argument-node",
      id: "a",
      logicalRole: "derivation",
      premises: [{ ref: { kind: "argument", id: "b" }, edgeType: "historical-derivation" }],
    },
    b: {
      kind: "argument-node",
      id: "b",
      logicalRole: "derivation",
      premises: [{ ref: { kind: "argument", id: "a" }, edgeType: "historical-derivation" }],
    },
    p1: { kind: "proof", id: "p1", route: "source-order", argumentNodeIds: ["a", "b"] },
  });
  runProofCycle(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "proof-cycle");
  assert.equal(rejectCtx.reports[0]?.recordId, "p1");

  // Accept: acyclic derivation A -> B
  const acceptCtx = createMockContext({
    a: {
      kind: "argument-node",
      id: "a",
      logicalRole: "derivation",
      premises: [{ ref: { kind: "argument", id: "b" }, edgeType: "historical-derivation" }],
    },
    b: {
      kind: "argument-node",
      id: "b",
      logicalRole: "derivation",
      premises: [],
    },
    p1: { kind: "proof", id: "p1", route: "source-order", argumentNodeIds: ["a", "b"] },
  });
  runProofCycle(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 2. ORACLE IN HISTORICAL ROUTE REFUSALS (1 SITE)
// ============================================================================

test("runOracleInHistoricalRoute: (run.ts:97) oracle-in-historical-route reports oracle premise on source-order proof, accepts historical derivation", () => {
  // Reject: source-order proof using modern-verification-oracle
  const rejectCtx = createMockContext({
    a: {
      kind: "argument-node",
      id: "a",
      logicalRole: "derivation",
      premises: [
        { ref: { kind: "oracle", id: "oracle-1" }, edgeType: "modern-verification-oracle" },
      ],
    },
    p1: { kind: "proof", id: "p1", route: "source-order", argumentNodeIds: ["a"] },
  });
  runOracleInHistoricalRoute(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "oracle-in-historical-route");
  assert.equal(rejectCtx.reports[0]?.flaggedText, "oracle-1");

  // Accept: source-order proof using historical-derivation
  const acceptCtx = createMockContext({
    a: {
      kind: "argument-node",
      id: "a",
      logicalRole: "derivation",
      premises: [{ ref: { kind: "argument", id: "prem-1" }, edgeType: "historical-derivation" }],
    },
    p1: { kind: "proof", id: "p1", route: "source-order", argumentNodeIds: ["a"] },
  });
  runOracleInHistoricalRoute(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 3. SHELF DATE VIOLATION REFUSALS (1 SITE)
// ============================================================================

test("runShelfDate: (run.ts:168) shelf-date-violation reports later card cited on journey shelf, accepts available card", () => {
  // Reject: later card (year 1908) cited on shelf of journey
  const rejectCtx = createMockContext({
    "card-perrin-1908": {
      kind: "knowledge-card",
      id: "card-perrin-1908",
      status: "later",
      latestYear: 1908,
    },
    "j-brownian": {
      kind: "journey",
      id: "j-brownian",
      stages: [],
      shelf: ["card-perrin-1908"],
    },
  });
  runShelfDate(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "shelf-date-violation");
  assert.equal(rejectCtx.reports[0]?.recordId, "card-perrin-1908");

  // Accept: available card (year 1850) cited on shelf
  const acceptCtx = createMockContext({
    "card-stokes-1850": {
      kind: "knowledge-card",
      id: "card-stokes-1850",
      status: "available",
      latestYear: 1850,
    },
    "j-brownian": {
      kind: "journey",
      id: "j-brownian",
      stages: [],
      shelf: ["card-stokes-1850"],
    },
  });
  runShelfDate(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 4. LATER EVIDENCE UNLABELED REFUSALS (4 SITES)
// ============================================================================

test("runLaterEvidenceUnlabeled: (run.ts:229) later-evidence-unlabeled reports unformatted later evidence on argument node, accepts valid label", () => {
  // Reject: argument node with post-1904 evidence without "later evidence (YEAR)" label
  const rejectCtx = createMockContext({
    "node-ev": {
      kind: "argument-node",
      id: "node-ev",
      evidence: [{ ref: { id: "ev-1" }, latestYear: 1908, dateLabel: "1908 measurement" }],
    },
  });
  runLaterEvidenceUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "later-evidence-unlabeled");
  assert.equal(rejectCtx.reports[0]?.recordId, "node-ev");

  // Accept: argument node with correct "later evidence (1908)" label
  const acceptCtx = createMockContext({
    "node-ev": {
      kind: "argument-node",
      id: "node-ev",
      evidence: [{ ref: { id: "ev-1" }, latestYear: 1908, dateLabel: "later evidence (1908)" }],
    },
  });
  runLaterEvidenceUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runLaterEvidenceUnlabeled: (run.ts:247) later-evidence-unlabeled reports world-check with missing quantity id, accepts bound quantity", () => {
  // Reject: world-check with empty quantityId
  const rejectCtx = createMockContext({
    "j-wc1": {
      kind: "journey",
      id: "j-wc1",
      stages: [],
      worldChecks: [{ id: "wc-1", quantityId: "" }],
    },
  });
  runLaterEvidenceUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "later-evidence-unlabeled");
  assert.equal(rejectCtx.reports[0]?.recordId, "wc-1");
  assert.ok(rejectCtx.reports[0]?.message.includes("binds no quantity id"));

  // Accept: world-check with non-empty quantityId
  const acceptCtx = createMockContext({
    "j-wc1": {
      kind: "journey",
      id: "j-wc1",
      stages: [],
      worldChecks: [
        {
          id: "wc-1",
          quantityId: "drift-rate",
          laterEvidence: { year: 1908, description: "later evidence (1908)" },
        },
      ],
    },
  });
  runLaterEvidenceUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runLaterEvidenceUnlabeled: (run.ts:257) later-evidence-unlabeled reports measured-fact world-check without laterEvidence, accepts dated evidence", () => {
  // Reject: comparisonKind measured-fact with no laterEvidence
  const rejectCtx = createMockContext({
    "j-wc2": {
      kind: "journey",
      id: "j-wc2",
      stages: [],
      worldChecks: [{ id: "wc-2", quantityId: "drift-velocity", comparisonKind: "measured-fact" }],
    },
  });
  runLaterEvidenceUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "later-evidence-unlabeled");
  assert.equal(rejectCtx.reports[0]?.recordId, "wc-2");
  assert.ok(rejectCtx.reports[0]?.message.includes("has no dated comparison"));

  // Accept: measured-fact world-check with laterEvidence
  const acceptCtx = createMockContext({
    "j-wc2": {
      kind: "journey",
      id: "j-wc2",
      stages: [],
      worldChecks: [
        {
          id: "wc-2",
          quantityId: "drift-velocity",
          comparisonKind: "measured-fact",
          laterEvidence: { year: 1908, description: "later evidence (1908)" },
        },
      ],
    },
  });
  runLaterEvidenceUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runLaterEvidenceUnlabeled: (run.ts:269) later-evidence-unlabeled reports post-1904 laterEvidence without proper label format, accepts correct label", () => {
  // Reject: laterEvidence with post-1904 year but non-matching description
  const rejectCtx = createMockContext({
    "j-wc3": {
      kind: "journey",
      id: "j-wc3",
      stages: [],
      worldChecks: [
        {
          id: "wc-3",
          quantityId: "displacement",
          laterEvidence: { year: 1909, description: "Perrin emulsion tracks" },
        },
      ],
    },
  });
  runLaterEvidenceUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "later-evidence-unlabeled");
  assert.equal(rejectCtx.reports[0]?.recordId, "wc-3");
  assert.ok(rejectCtx.reports[0]?.message.includes("without the label"));

  // Accept: laterEvidence with matching "later evidence (1909)" description
  const acceptCtx = createMockContext({
    "j-wc3": {
      kind: "journey",
      id: "j-wc3",
      stages: [],
      worldChecks: [
        {
          id: "wc-3",
          quantityId: "displacement",
          laterEvidence: { year: 1909, description: "later evidence (1909)" },
        },
      ],
    },
  });
  runLaterEvidenceUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 5. MISSING ACCESSIBILITY ALTERNATIVE REFUSALS (3 SITES)
// ============================================================================

test("runMissingAccessibility: (run.ts:288) missing-accessibility-alternative reports experiment with controls but no actions, accepts keyboard actions", () => {
  // Reject: experiment with parameters but empty actions
  const rejectCtx = createMockContext({
    "exp-controls": {
      kind: "experiment",
      id: "exp-controls",
      parameters: [{ id: "temperature" }],
      actions: [],
    },
  });
  runMissingAccessibility(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "missing-accessibility-alternative");
  assert.ok(rejectCtx.reports[0]?.message.includes("without action-contract equivalents"));

  // Accept: experiment with actions providing keyboard affordances
  const acceptCtx = createMockContext({
    "exp-controls": {
      kind: "experiment",
      id: "exp-controls",
      parameters: [{ id: "temperature" }],
      actions: [{ id: "adjust-temp", equivalentAffordance: "keyboard" }],
      views: [{ kind: "table" }],
    },
  });
  runMissingAccessibility(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runMissingAccessibility: (run.ts:300) missing-accessibility-alternative reports canvas view without text alternative or description, accepts description", () => {
  // Reject: canvas view without table/text view or textualDescription
  const rejectCtx = createMockContext({
    "exp-canvas": {
      kind: "experiment",
      id: "exp-canvas",
      actions: [{ id: "step" }],
      views: [{ kind: "canvas" }],
    },
  });
  runMissingAccessibility(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "missing-accessibility-alternative");
  assert.ok(
    rejectCtx.reports[0]?.message.includes("without a table/text view or textual description"),
  );

  // Accept: canvas view with textualDescription
  const acceptCtx = createMockContext({
    "exp-canvas": {
      kind: "experiment",
      id: "exp-canvas",
      actions: [{ id: "step" }],
      views: [{ kind: "canvas" }],
      textualDescription: "Visual particle track simulation displaying Brownian diffusion.",
    },
  });
  runMissingAccessibility(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runMissingAccessibility: (run.ts:316) missing-accessibility-alternative reports foundation without textual equivalent, accepts textual prose", () => {
  // Reject: foundation without textual prose
  const rejectCtx = createMockContext({
    "found-1": {
      kind: "foundation",
      id: "found-1",
    },
  });
  runMissingAccessibility(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "missing-accessibility-alternative");
  assert.ok(rejectCtx.reports[0]?.message.includes("has no textual equivalent"));

  // Accept: foundation with textualEquivalent
  const acceptCtx = createMockContext({
    "found-1": {
      kind: "foundation",
      id: "found-1",
      textualEquivalent: "Mathematical derivation of Stokes law for spherical particle drag.",
    },
  });
  runMissingAccessibility(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 6. MISSING NOT MODELED REFUSALS (1 SITE)
// ============================================================================

test("runMissingNotModeled: (run.ts:333) missing-not-modeled reports experiment with empty notModeled list, accepts declared limitations", () => {
  // Reject: experiment with empty notModeled list
  const rejectCtx = createMockContext({
    "exp-nm": {
      kind: "experiment",
      id: "exp-nm",
      notModeled: [],
    },
  });
  runMissingNotModeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "missing-not-modeled");
  assert.equal(rejectCtx.reports[0]?.recordId, "exp-nm");

  // Accept: experiment with declared limitations
  const acceptCtx = createMockContext({
    "exp-nm": {
      kind: "experiment",
      id: "exp-nm",
      notModeled: ["Rotational Brownian motion", "Wall interactions"],
    },
  });
  runMissingNotModeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 7. COVERAGE WITHOUT OWNER REFUSALS (4 SITES)
// ============================================================================

test("runCoverageWithoutOwner: (run.ts:358) coverage-without-owner reports omitted treatment without reason, accepts written reason", () => {
  // Reject: omitted treatment without reason
  const rejectCtx = createMockContext({
    "node-omit": {
      kind: "argument-node",
      id: "node-omit",
      coverageObligation: { treatment: { kind: "omitted" } },
    },
  });
  runCoverageWithoutOwner(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "coverage-without-owner");
  assert.ok(
    rejectCtx.reports[0]?.message.includes("omits instrument treatment without a written reason"),
  );

  // Accept: omitted treatment with written reason
  const acceptCtx = createMockContext({
    "node-omit": {
      kind: "argument-node",
      id: "node-omit",
      coverageObligation: {
        treatment: { kind: "omitted", reason: "Pure mathematical identity with no simulation." },
      },
    },
  });
  runCoverageWithoutOwner(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runCoverageWithoutOwner: (run.ts:370) coverage-without-owner reports instrument treatment without experimentIds, accepts valid experiment id", () => {
  // Reject: instrument treatment with empty experimentIds array
  const rejectCtx = createMockContext({
    "node-no-exp": {
      kind: "argument-node",
      id: "node-no-exp",
      coverageObligation: { treatment: { kind: "instrument", experimentIds: [] } },
    },
  });
  runCoverageWithoutOwner(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "coverage-without-owner");
  assert.ok(rejectCtx.reports[0]?.message.includes("without a resolvable experiment id"));

  // Accept: instrument treatment with registered experiment id and owner
  const acceptCtx = createMockContext({
    "exp-1": { kind: "experiment", id: "exp-1", owner: "physics-team" },
    "node-no-exp": {
      kind: "argument-node",
      id: "node-no-exp",
      coverageObligation: { treatment: { kind: "instrument", experimentIds: ["exp-1"] } },
    },
  });
  runCoverageWithoutOwner(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runCoverageWithoutOwner: (run.ts:383) coverage-without-owner reports instrument with unregistered experiment or missing owner, accepts registered owner", () => {
  // Reject: instrument treatment naming experiment without owner
  const rejectCtx = createMockContext({
    "exp-no-owner": { kind: "experiment", id: "exp-no-owner" },
    "node-unreg": {
      kind: "argument-node",
      id: "node-unreg",
      coverageObligation: { treatment: { kind: "instrument", experimentIds: ["exp-no-owner"] } },
    },
  });
  runCoverageWithoutOwner(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "coverage-without-owner");
  assert.ok(rejectCtx.reports[0]?.message.includes("without a resolvable owner"));

  // Accept: experiment with registered owner
  const acceptCtx = createMockContext({
    "exp-no-owner": {
      kind: "experiment",
      id: "exp-no-owner",
      owner: { package: "fs-drift" },
    },
    "node-unreg": {
      kind: "argument-node",
      id: "node-unreg",
      coverageObligation: { treatment: { kind: "instrument", experimentIds: ["exp-no-owner"] } },
    },
  });
  runCoverageWithoutOwner(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runCoverageWithoutOwner: (run.ts:409) coverage-without-owner reports shared instrument without correspondence note, accepts documented note", () => {
  // Reject: shared instrument where one node lacks correspondenceNote
  const rejectCtx = createMockContext({
    "exp-shared": { kind: "experiment", id: "exp-shared", owner: "sim-team" },
    "node-a": {
      kind: "argument-node",
      id: "node-a",
      coverageObligation: { treatment: { kind: "instrument", experimentIds: ["exp-shared"] } },
    },
    "node-b": {
      kind: "argument-node",
      id: "node-b",
      coverageObligation: {
        treatment: {
          kind: "instrument",
          experimentIds: ["exp-shared"],
          correspondenceNote: "Visualizes drift velocity.",
        },
      },
    },
  });
  runCoverageWithoutOwner(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "coverage-without-owner");
  assert.equal(rejectCtx.reports[0]?.recordId, "node-a");
  assert.ok(rejectCtx.reports[0]?.message.includes("without a correspondence note"));

  // Accept: all sharing nodes carry a correspondenceNote
  const acceptCtx = createMockContext({
    "exp-shared": { kind: "experiment", id: "exp-shared", owner: "sim-team" },
    "node-a": {
      kind: "argument-node",
      id: "node-a",
      coverageObligation: {
        treatment: {
          kind: "instrument",
          experimentIds: ["exp-shared"],
          correspondenceNote: "Shows random walk distribution.",
        },
      },
    },
    "node-b": {
      kind: "argument-node",
      id: "node-b",
      coverageObligation: {
        treatment: {
          kind: "instrument",
          experimentIds: ["exp-shared"],
          correspondenceNote: "Visualizes drift velocity.",
        },
      },
    },
  });
  runCoverageWithoutOwner(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 8. MISCONCEPTION MINIMUM REFUSALS (1 SITE)
// ============================================================================

test("runMisconceptionMinimum: (run.ts:451) misconception-minimum reports complete paper with fewer than 5 misconceptions, accepts 5 entries", () => {
  // Reject: paper complete with only 2 misconceptions
  const rejectCtx = createMockContext({
    "paper-brownian": { kind: "paper", id: "paper-brownian", status: "complete" },
    "m-1": { kind: "misconception", id: "m-1", paper: "paper-brownian" },
    "m-2": { kind: "misconception", id: "m-2", paper: "paper-brownian" },
  });
  runMisconceptionMinimum(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "misconception-minimum");
  assert.equal(rejectCtx.reports[0]?.recordId, "paper-brownian");

  // Accept: paper with 5 misconceptions
  const acceptCtx = createMockContext({
    "paper-brownian": { kind: "paper", id: "paper-brownian", status: "complete" },
    "m-1": { kind: "misconception", id: "m-1", paper: "paper-brownian" },
    "m-2": { kind: "misconception", id: "m-2", paper: "paper-brownian" },
    "m-3": { kind: "misconception", id: "m-3", paper: "paper-brownian" },
    "m-4": { kind: "misconception", id: "m-4", paper: "paper-brownian" },
    "m-5": { kind: "misconception", id: "m-5", paper: "paper-brownian" },
  });
  runMisconceptionMinimum(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 9. APPROXIMATION UNLABELED REFUSALS (2 SITES)
// ============================================================================

test("runApproximationUnlabeled: (run.ts:473) approximation-unlabeled reports equation listing approximation but claimed exact-within-model, accepts approximation status", () => {
  // Reject: contract lists approximation but modelStatus claims exact-within-model
  const rejectCtx = createMockContext({
    "eq-approx-exact": {
      id: "eq-approx-exact",
      authoringContract: { approximationsIntroduced: ["Taylor series expansion"] },
      meanings: { modelStatus: "exact-within-model" },
    },
  });
  runApproximationUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "approximation-unlabeled");
  assert.ok(rejectCtx.reports[0]?.message.includes("presents the equation as exact-within-model"));

  // Accept: modelStatus labeled as approximation
  const acceptCtx = createMockContext({
    "eq-approx-exact": {
      id: "eq-approx-exact",
      authoringContract: { approximationsIntroduced: ["Taylor series expansion"] },
      meanings: { modelStatus: "approximation" },
    },
  });
  runApproximationUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runApproximationUnlabeled: (run.ts:481) approximation-unlabeled reports approximation modelStatus without contract approximationsIntroduced, accepts declared list", () => {
  // Reject: modelStatus approximation with empty approximationsIntroduced
  const rejectCtx = createMockContext({
    "eq-unnamed-approx": {
      id: "eq-unnamed-approx",
      authoringContract: { approximationsIntroduced: [] },
      meanings: { modelStatus: "approximation" },
    },
  });
  runApproximationUnlabeled(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "approximation-unlabeled");
  assert.ok(rejectCtx.reports[0]?.message.includes("without naming it in the authoring contract"));

  // Accept: contract names the approximation
  const acceptCtx = createMockContext({
    "eq-unnamed-approx": {
      id: "eq-unnamed-approx",
      authoringContract: { approximationsIntroduced: ["Dilute concentration limit"] },
      meanings: { modelStatus: "approximation" },
    },
  });
  runApproximationUnlabeled(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 10. CIRCULAR MOLECULAR COUNT REFUSALS (2 SITES)
// ============================================================================

test("runCircularMolecularCount: (run.ts:525) circular-molecular-count reports historical inference bound to avogadroConstant, accepts avogadroNumberEstimate", () => {
  // Reject: historical inference output binds to avogadroConstant
  const rejectCtx = createMockContext({
    "inf-circ-output": {
      kind: "inference",
      id: "inf-circ-output",
      historicalMode: true,
      outputQuantityId: "avogadroConstant",
    },
  });
  runCircularMolecularCount(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "circular-molecular-count");
  assert.equal(rejectCtx.reports[0]?.flaggedText, "avogadroConstant");
  assert.ok(rejectCtx.reports[0]?.message.includes("binds output N to avogadroConstant"));

  // Accept: output binds to avogadroNumberEstimate
  const acceptCtx = createMockContext({
    "inf-circ-output": {
      kind: "inference",
      id: "inf-circ-output",
      historicalMode: true,
      outputQuantityId: "avogadroNumberEstimate",
    },
  });
  runCircularMolecularCount(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runCircularMolecularCount: (run.ts:533) circular-molecular-count reports historical inference using modern-si-2019, accepts historical constant set", () => {
  // Reject: historical inference resolving constants from modern-si-2019
  const rejectCtx = createMockContext({
    "modern-si-2019": { kind: "constant-set", id: "modern-si-2019", entries: [] },
    "inf-circ-set": {
      kind: "inference",
      id: "inf-circ-set",
      historicalMode: true,
      constantSetId: "modern-si-2019",
      outputQuantityId: "avogadroNumberEstimate",
    },
  });
  runCircularMolecularCount(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "circular-molecular-count");
  assert.equal(rejectCtx.reports[0]?.flaggedText, "modern-si-2019");
  assert.ok(rejectCtx.reports[0]?.message.includes("resolves k_B or N_A from modern-si-2019"));

  // Accept: historical inference resolving from historical-1905 set
  const acceptCtx = createMockContext({
    "historical-1905": { kind: "constant-set", id: "historical-1905", entries: [] },
    "inf-circ-set": {
      kind: "inference",
      id: "inf-circ-set",
      historicalMode: true,
      constantSetId: "historical-1905",
      outputQuantityId: "avogadroNumberEstimate",
    },
  });
  runCircularMolecularCount(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 11. CIRCULAR REST ENERGY REFUSALS (1 SITE)
// ============================================================================

test("runCircularRestEnergy: (run.ts:555) circular-rest-energy reports historical rest energy initialized from mc2, accepts symbolic initialization", () => {
  // Reject: historical rest energy initialized numerically from mc2
  const rejectCtx = createMockContext({
    "el-circ": {
      kind: "energy-ledger",
      id: "el-circ",
      historicalMode: true,
      quantityId: "bodyEnergyRestBefore",
      numericFrom: "mc2",
    },
  });
  runCircularRestEnergy(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "circular-rest-energy");
  assert.equal(rejectCtx.reports[0]?.recordId, "el-circ");
  assert.ok(rejectCtx.reports[0]?.message.includes("initializes body energy with Mc^2"));

  // Accept: historical rest energy left symbolic
  const acceptCtx = createMockContext({
    "el-circ": {
      kind: "energy-ledger",
      id: "el-circ",
      historicalMode: true,
      quantityId: "bodyEnergyRestBefore",
      expr: { kind: "symbolic", symbols: ["E_0"] },
    },
  });
  runCircularRestEnergy(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 12. SIMULATION AS EVIDENCE REFUSALS (1 SITE)
// ============================================================================

test("runSimulationAsEvidence: (run.ts:582) simulation-as-evidence reports empirical-observation supported by simulator output, accepts historical observation", () => {
  // Reject: empirical observation supported by simulator output
  const rejectCtx = createMockContext({
    "obs-node": {
      kind: "argument-node",
      id: "obs-node",
      logicalRole: "empirical-observation",
      supportKind: "simulator-output",
    },
  });
  runSimulationAsEvidence(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "simulation-as-evidence");
  assert.equal(rejectCtx.reports[0]?.recordId, "obs-node");
  assert.ok(rejectCtx.reports[0]?.message.includes("supported by a simulator output"));

  // Accept: empirical observation supported by historical laboratory records
  const acceptCtx = createMockContext({
    "obs-node": {
      kind: "argument-node",
      id: "obs-node",
      logicalRole: "empirical-observation",
      supportKind: "laboratory-record",
    },
  });
  runSimulationAsEvidence(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

// ============================================================================
// 13. REVIEW FLAGS REFUSALS (8 SITES)
// ============================================================================

test("runFlags: (run.ts:601) translation-ambiguity reports review flag for translation unit with unresolved alternatives, accepts clean unit", () => {
  // Reject: translation unit with unresolved alternatives
  const rejectCtx = createMockContext({
    "tu-ambig": {
      kind: "translation-unit",
      id: "tu-ambig",
      unresolvedAlternatives: [
        { text: "diffusing", rationale: "Maintains period thermodynamic sense" },
      ],
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "translation-ambiguity");
  assert.equal(rejectCtx.reports[0]?.severity, "flag");
  assert.equal(rejectCtx.reports[0]?.recordId, "tu-ambig");

  // Accept: translation unit with empty unresolved alternatives
  const acceptCtx = createMockContext({
    "tu-ambig": {
      kind: "translation-unit",
      id: "tu-ambig",
      unresolvedAlternatives: [],
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:606) translation-ambiguity computes flag fingerprint for review queue tracking, accepts clean unit", () => {
  // Reject: fingerprint calculation matches computeFlagFingerprint
  const alts = [{ text: "suspended particles", rationale: "Literal translation" }];
  const flaggedText = JSON.stringify(alts);
  const rejectCtx = createMockContext({
    "tu-fp": {
      kind: "translation-unit",
      id: "tu-fp",
      unresolvedAlternatives: alts,
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  const expectedFp = computeFlagFingerprint({
    rule: "translation-ambiguity",
    recordId: "tu-fp",
    flaggedText,
  });
  assert.equal(rejectCtx.reports[0]?.fingerprint, expectedFp);

  // Accept: clean translation unit generates no flag
  const acceptCtx = createMockContext({
    "tu-fp": {
      kind: "translation-unit",
      id: "tu-fp",
      unresolvedAlternatives: [],
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:625) historical-influence-claim reports review flag when claimsEinsteinKnew is true, accepts historical date statement", () => {
  // Reject: premise asserting claimsEinsteinKnew: true
  const rejectCtx = createMockContext({
    "prem-influence": {
      kind: "historical-premise",
      id: "prem-influence",
      claimsEinsteinKnew: true,
      proposition: "Einstein read Poincaré (1900) before writing the relativity paper.",
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "historical-influence-claim");
  assert.equal(rejectCtx.reports[0]?.severity, "flag");
  assert.equal(rejectCtx.reports[0]?.recordId, "prem-influence");

  // Accept: premise without knowledge claim
  const acceptCtx = createMockContext({
    "prem-influence": {
      kind: "historical-premise",
      id: "prem-influence",
      claimsEinsteinKnew: false,
      proposition: "Poincaré published his synchronization convention in 1900.",
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:630) historical-influence-claim computes flag fingerprint for review tracking, accepts clean statement", () => {
  // Reject: verify fingerprint for historical influence claim
  const proposition = "Einstein was influenced by Mach (1883).";
  const rejectCtx = createMockContext({
    "prem-fp": {
      kind: "historical-premise",
      id: "prem-fp",
      claimsEinsteinKnew: true,
      proposition,
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  const expectedFp = computeFlagFingerprint({
    rule: "historical-influence-claim",
    recordId: "prem-fp",
    flaggedText: proposition,
  });
  assert.equal(rejectCtx.reports[0]?.fingerprint, expectedFp);

  // Accept: clean statement
  const acceptCtx = createMockContext({
    "prem-fp": {
      kind: "historical-premise",
      id: "prem-fp",
      claimsEinsteinKnew: false,
      proposition,
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:646) approximation-prose reports review flag for prose approximation claim, accepts clean contract", () => {
  // Reject: authoringContract introducing approximations in prose
  const rejectCtx = createMockContext({
    "node-approx-prose": {
      id: "node-approx-prose",
      authoringContract: {
        approximationsIntroduced: ["Small displacement limit for short times"],
      },
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "approximation-prose");
  assert.equal(rejectCtx.reports[0]?.severity, "flag");
  assert.equal(rejectCtx.reports[0]?.recordId, "node-approx-prose");

  // Accept: authoringContract with empty approximationsIntroduced
  const acceptCtx = createMockContext({
    "node-approx-prose": {
      id: "node-approx-prose",
      authoringContract: { approximationsIntroduced: [] },
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:651) approximation-prose computes flag fingerprint for approximation tracking, accepts clean contract", () => {
  // Reject: verify fingerprint for prose approximation
  const approx = ["Equipartition assumption"];
  const flaggedText = JSON.stringify(approx);
  const rejectCtx = createMockContext({
    "node-approx-fp": {
      id: "node-approx-fp",
      authoringContract: { approximationsIntroduced: approx },
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  const expectedFp = computeFlagFingerprint({
    rule: "approximation-prose",
    recordId: "node-approx-fp",
    flaggedText,
  });
  assert.equal(rejectCtx.reports[0]?.fingerprint, expectedFp);

  // Accept: clean contract
  const acceptCtx = createMockContext({
    "node-approx-fp": {
      id: "node-approx-fp",
      authoringContract: { approximationsIntroduced: [] },
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:665) source-disagreement reports review flag for dispute editorial note, accepts commentary note", () => {
  // Reject: editorial note of kind dispute
  const rejectCtx = createMockContext({
    "note-dispute": {
      kind: "editorial-note",
      id: "note-dispute",
      noteKind: "dispute",
      claim: "Dispute between Einstein and Smoluchowski on independent discovery.",
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  assert.equal(rejectCtx.reports[0]?.rule, "source-disagreement");
  assert.equal(rejectCtx.reports[0]?.severity, "flag");
  assert.equal(rejectCtx.reports[0]?.recordId, "note-dispute");

  // Accept: editorial note of kind commentary
  const acceptCtx = createMockContext({
    "note-dispute": {
      kind: "editorial-note",
      id: "note-dispute",
      noteKind: "commentary",
      claim: "Historical context on Smoluchowski's 1906 paper.",
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});

test("runFlags: (run.ts:670) source-disagreement computes flag fingerprint for source disagreement tracking, accepts commentary note", () => {
  // Reject: verify fingerprint for source-disagreement
  const claim = "Source text differs between 1905 journal and 1922 reprint.";
  const rejectCtx = createMockContext({
    "note-disagree-fp": {
      kind: "editorial-note",
      id: "note-disagree-fp",
      noteKind: "source-disagreement",
      claim,
    },
  });
  runFlags(rejectCtx.context);
  assert.equal(rejectCtx.reports.length, 1);
  const expectedFp = computeFlagFingerprint({
    rule: "source-disagreement",
    recordId: "note-disagree-fp",
    flaggedText: claim,
  });
  assert.equal(rejectCtx.reports[0]?.fingerprint, expectedFp);

  // Accept: clean note
  const acceptCtx = createMockContext({
    "note-disagree-fp": {
      kind: "editorial-note",
      id: "note-disagree-fp",
      noteKind: "gloss",
      claim,
    },
  });
  runFlags(acceptCtx.context);
  assert.equal(acceptCtx.reports.length, 0);
});
