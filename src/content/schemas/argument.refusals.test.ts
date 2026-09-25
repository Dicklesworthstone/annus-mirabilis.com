/**
 * Untested Refusal Throw Site Suite for src/content/schemas/argument.ts (am-muyh).
 *
 * Covers all 141 previously untested refusal throw sites across:
 * - validateMeanings (7 sites: 131, 167, 175, 184, 192, 201, 209)
 * - validateHistoricalPremise (24 sites: 299, 309, 318, 336, 353, 362, 373, 381, 394, 403, 412, 427, 438, 459, 471, 479, 521, 560, 568, 576, 589, 627, 642, 656)
 * - validateArgumentNode (20 sites: 769, 779, 788, 791, 800, 808, 816, 825, 854, 883, 895, 903, 933, 958, 967, 978, 993, 1003, 1012, 1032)
 * - validateProof (3 sites: 1087, 1092, 1101)
 * - validateQuantity (18 sites: 1181, 1191, 1200, 1213, 1216, 1226, 1248, 1294, 1305, 1316, 1325, 1339, 1349, 1359, 1379, 1391, 1433, 1453)
 * - validateSemanticEquation (17 sites: 1546, 1556, 1565, 1578, 1599, 1611, 1621, 1629, 1637, 1646, 1680, 1682, 1689, 1704, 1732, 1752, 1772)
 * - validateFoundationLink (2 sites: 1815, 1825)
 * - validateWorkedExample (1 site: 1876)
 * - validateFoundationOrBridge (22 sites: 1964, 1974, 1983, 1986, 2005, 2020, 2036, 2044, 2052, 2060, 2068, 2111, 2125, 2156, 2164, 2172, 2180, 2188, 2216, 2238, 2252, 2266)
 * - validateMisconception (8 sites: 2337, 2356, 2359, 2400, 2418, 2441, 2484, 2498)
 * - validateReadingSet (11 sites: 2562, 2572, 2581, 2599, 2629, 2638, 2647, 2657, 2667, 2688, 2702)
 * - validateAuthoringContract (6 sites: 2751, 2761, 2770, 2777, 2784, 2802)
 * - validateObstacleResponses (2 sites: 2861, 2871)
 *
 * Each test cites its explicit throw site (argument.ts:<line>) and provides both an accept
 * path and a reject path exercising the exact refusal boundary condition.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ArgumentSchemaError,
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

function assertArgumentRefusal(fn: () => unknown, expectedCode: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(
      err instanceof ArgumentSchemaError,
      `Expected ArgumentSchemaError, got ${String(err)}`,
    );
    assert.equal((err as ArgumentSchemaError).code, expectedCode);
    return true;
  });
}

// ============================================================================
// SHARED VALID FIXTURES
// ============================================================================

const validAuthorship = {
  draftedBy: [{ id: "jemanuel", name: "Jeffrey Emanuel", kind: "human" as const }],
};

const validMeanings = {
  logicalRole: "derivation" as const,
  historicalStatus: "pedagogical-reconstruction" as const,
  modelStatus: "exact-within-model" as const,
  executionStatus: "static-illustration" as const,
};

const validHistoricalPremise = {
  id: "van-t-hoff-1887-osmotic-pressure",
  proposition: "Dilute solute molecules exert osmotic pressure equivalent to an ideal gas.",
  status: "available" as const,
  sources: ["van 't Hoff (1887)"],
  date: {
    precision: "year" as const,
    earliest: "1887",
    latest: "1887",
    latestYear: 1887,
  },
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validArgumentNode = {
  id: "arg-bm-diffusion",
  paper: "brownian-motion",
  question: "How do particles diffuse?",
  conclusion: "Displacement variance scales linearly with time.",
  logicalRole: "derivation" as const,
  meanings: validMeanings,
  coverageObligation: {
    question: "How do particles diffuse?",
    treatment: { kind: "instrument" as const, experimentIds: ["bm-01"] },
  },
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validProof = {
  id: "proof-bm-01",
  route: "pedagogical-reconstruction" as const,
  argumentNodeIds: ["arg-bm-diffusion"],
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validQuantity = {
  id: "particleRadius",
  name: "Particle Radius",
  description: "Effective hydrodynamic radius of suspended particle",
  dimensionStatus: "declared" as const,
  dimension: [0, 1, 0, 0, 0, 0] as [number, number, number, number, number, number],
  mathematicalKind: "scalar" as const,
  densityKind: "not-applicable" as const,
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validEquation = {
  id: "eq-bm-s3-d4",
  paper: "brownian-motion",
  spokenForm: "D equals R T over 6 pi eta a N",
  notationForms: {
    source: { mode: "generated" as const, unitSystem: "gaussian-cgs" as const },
    modern: { mode: "generated" as const, unitSystem: "si" as const },
  },
  meanings: validMeanings,
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validFoundationLink = {
  foundationId: "found-stokes-drag",
  callingAnchor: "anchor-stokes",
  returnCaption: "Return to §1",
};

const validWorkedExample = {
  question: "How does drag force scale with velocity?",
  given: "Spherical particle in laminar flow",
  plausibleFirstThought: "Quadratic drag like a falling baseball",
  decisiveStep: "Stokes regime has Reynolds number much less than 1, so viscous forces dominate",
  limitation: "Valid only for low Reynolds number laminar flow",
};

const validFoundation = {
  id: "found-stokes-drag",
  kind: "foundation" as const,
  title: "Stokes Drag Law",
  learningObjective: "Understand low-Reynolds drag on a sphere",
  compactExplanation: "Viscous drag equals 6 pi eta r v.",
  fullExplanation: "Detailed explanation of viscous drag.",
  workedExample: validWorkedExample,
  textualEquivalent: "Drag is proportional to viscosity, radius, and velocity.",
  stoppingPoint: "Can calculate drag on a spherical particle.",
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validBridge = {
  id: "bridge-diffusion-to-random-walk",
  kind: "bridge" as const,
  title: "From Macroscopic Diffusion to Microscopic Random Walk",
  concreteOperation: "Map diffusion coefficient to mean squared displacement.",
  compactExplanation: "Bridge explanation.",
  textualEquivalent: "Text equivalent of bridge.",
  stoppingPoint: "Understands microscopic origin.",
  readinessSign: "Can formulate displacement variance.",
  continueWith: [
    { route: "more-guidance" as const, targetId: "found-random-walk-step" },
    { route: "less-guidance" as const, targetId: "arg-bm-diffusion-step" },
  ],
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validMisconception = {
  id: "misc-bm-instantaneous-velocity",
  paper: "brownian-motion",
  temptingClaims: [
    "Brownian particles have a well-defined instantaneous velocity proportional to temperature.",
  ],
  whyTempting: "Classical equipartition suggests (1/2) m v^2 = (1/2) k T.",
  whereItIsTrue: "Only over intervals shorter than the momentum relaxation time.",
  whatIsTrue:
    "Observable motion over experimental timescales is diffusive, where displacement variance scales with time.",
  instrumentIds: ["bm-01"],
  intervention: {
    defaultsReviewed: {
      model: "Standard Langevin dynamics",
      labels: "Shows diffusive regime",
      defaultControls: "Realistic water viscosity",
      feedback: "Demonstrates apparent velocity depends on delta t",
    },
    reviewRecordId: "rev-misc-01",
  },
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validReadingSet = {
  targetId: "s1-p1",
  targetKind: "paragraph" as const,
  authorship: validAuthorship,
  reviewState: "reviewed",
};

const validAuthoringContract = {
  question: "How does concentration gradient relate to osmotic force?",
  conclusionSupported: "Fickian flux balances osmotic pressure gradient.",
  bridge: "Connects thermodynamic pressure to particle flux.",
};

const validObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation: "Explanation of unfamiliar term.",
  },
};

test("argument.refusals: validateMeanings rejects non-object record (argument.ts:131)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: invalid-meanings-record
  assertArgumentRefusal(() => {
    validateMeanings(null);
  }, "invalid-meanings-record");
});

test("argument.refusals: validateMeanings rejects missing historicalStatus (argument.ts:167)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: missing-meaning-field
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, historicalStatus: undefined });
  }, "missing-meaning-field");
});

test("argument.refusals: validateMeanings rejects invalid historicalStatus enum (argument.ts:175)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: invalid-historical-status
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, historicalStatus: "bogus-status" });
  }, "invalid-historical-status");
});

test("argument.refusals: validateMeanings rejects missing modelStatus (argument.ts:184)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: missing-meaning-field
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, modelStatus: undefined });
  }, "missing-meaning-field");
});

test("argument.refusals: validateMeanings rejects invalid modelStatus enum (argument.ts:192)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: invalid-model-status
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, modelStatus: "bogus-status" });
  }, "invalid-model-status");
});

test("argument.refusals: validateMeanings rejects missing executionStatus (argument.ts:201)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: missing-meaning-field
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, executionStatus: undefined });
  }, "missing-meaning-field");
});

test("argument.refusals: validateMeanings rejects invalid executionStatus enum (argument.ts:209)", () => {
  // Accept path
  assert.ok(validateMeanings(validMeanings));

  // Reject path: invalid-execution-status
  assertArgumentRefusal(() => {
    validateMeanings({ ...validMeanings, executionStatus: "bogus-status" });
  }, "invalid-execution-status");
});

test("argument.refusals: validateHistoricalPremise rejects non-object record (argument.ts:299)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateHistoricalPremise(null);
  }, "invalid-record");
});

test("argument.refusals: validateHistoricalPremise rejects essentialForPrint field (argument.ts:309)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateHistoricalPremise rejects missing id (argument.ts:318)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateHistoricalPremise rejects missing proposition (argument.ts:336)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: missing-proposition
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, proposition: "" });
  }, "missing-proposition");
});

test("argument.refusals: validateHistoricalPremise rejects invalid premise status (argument.ts:353)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: invalid-premise-status
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, status: "bogus-status" });
  }, "invalid-premise-status");
});

test("argument.refusals: validateHistoricalPremise rejects missing or empty sources (argument.ts:362)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: missing-sources
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, sources: [] });
  }, "missing-sources");
});

test("argument.refusals: validateHistoricalPremise rejects missing date object (argument.ts:373)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: missing-date
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, date: null });
  }, "missing-date");
});

test("argument.refusals: validateHistoricalPremise rejects invalid date precision (argument.ts:381)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: invalid-date-precision
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { ...validHistoricalPremise.date, precision: "century" },
    });
  }, "invalid-date-precision");
});

test("argument.refusals: validateHistoricalPremise rejects non-YYYY-MM-DD for precision day (argument.ts:394)", () => {
  // Accept path
  const validDay = {
    ...validHistoricalPremise,
    date: {
      precision: "day" as const,
      earliest: "1887-05-15",
      latest: "1887-05-15",
      latestYear: 1887,
    },
  };
  assert.ok(validateHistoricalPremise(validDay));

  // Reject path: invalid-date-precision-format
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { precision: "day", earliest: "1887-05", latest: "1887-05", latestYear: 1887 },
    });
  }, "invalid-date-precision-format");
});

test("argument.refusals: validateHistoricalPremise rejects non-YYYY-MM for precision month (argument.ts:403)", () => {
  // Accept path
  const validMonth = {
    ...validHistoricalPremise,
    date: { precision: "month" as const, earliest: "1887-05", latest: "1887-05", latestYear: 1887 },
  };
  assert.ok(validateHistoricalPremise(validMonth));

  // Reject path: invalid-date-precision-format
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { precision: "month", earliest: "1887", latest: "1887", latestYear: 1887 },
    });
  }, "invalid-date-precision-format");
});

test("argument.refusals: validateHistoricalPremise rejects non-YYYY for precision year (argument.ts:412)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: invalid-date-precision-format
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { precision: "year", earliest: "1887-01", latest: "1887-01", latestYear: 1887 },
    });
  }, "invalid-date-precision-format");
});

test("argument.refusals: validateHistoricalPremise rejects invalid eventKind (argument.ts:427)", () => {
  // Accept path
  const validEvent = {
    ...validHistoricalPremise,
    date: { ...validHistoricalPremise.date, eventKind: "published" as const },
  };
  assert.ok(validateHistoricalPremise(validEvent));

  // Reject path: invalid-event-kind
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { ...validHistoricalPremise.date, eventKind: "discovered" },
    });
  }, "invalid-event-kind");
});

test("argument.refusals: validateHistoricalPremise rejects missing latestYear integer (argument.ts:438)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise(validHistoricalPremise));

  // Reject path: missing-latest-year
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      date: { ...validHistoricalPremise.date, latestYear: undefined },
    });
  }, "missing-latest-year");
});

test("argument.refusals: validateHistoricalPremise rejects non-object priorEvent (argument.ts:459)", () => {
  // Accept path
  const withPrior = {
    ...validHistoricalPremise,
    priorEvent: {
      eventKind: "presented" as const,
      earliest: "1886",
      latest: "1886",
      precision: "year" as const,
    },
  };
  assert.ok(validateHistoricalPremise(withPrior));

  // Reject path: invalid-prior-event
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, priorEvent: "presented" });
  }, "invalid-prior-event");
});

test("argument.refusals: validateHistoricalPremise rejects invalid priorEvent eventKind (argument.ts:471)", () => {
  // Accept path
  const withPrior = {
    ...validHistoricalPremise,
    priorEvent: {
      eventKind: "presented" as const,
      earliest: "1886",
      latest: "1886",
      precision: "year" as const,
    },
  };
  assert.ok(validateHistoricalPremise(withPrior));

  // Reject path: invalid-prior-event-kind
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      priorEvent: { eventKind: "conjectured" },
    });
  }, "invalid-prior-event-kind");
});

test("argument.refusals: validateHistoricalPremise rejects priorEvent latest after card date latest (argument.ts:479)", () => {
  // Accept path
  const withPrior = {
    ...validHistoricalPremise,
    priorEvent: {
      eventKind: "presented" as const,
      earliest: "1886",
      latest: "1886",
      precision: "year" as const,
    },
  };
  assert.ok(validateHistoricalPremise(withPrior));

  // Reject path: card-prior-event-not-prior
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      priorEvent: { eventKind: "published", latest: "1899", earliest: "1899", precision: "year" },
    });
  }, "card-prior-event-not-prior");
});

test("argument.refusals: validateHistoricalPremise rejects admittedImport object missing declaringJourney (argument.ts:521)", () => {
  // Accept path
  const validImport = {
    ...validHistoricalPremise,
    admittedImport: { declaringJourney: "journey-bm" },
    date: { ...validHistoricalPremise.date, earliest: "1905", latest: "1905", latestYear: 1905 },
  };
  assert.ok(validateHistoricalPremise(validImport));

  // Reject path: admitted-import-missing-declaring-journey
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      admittedImport: { sourceKey: "ap-17" },
    });
  }, "admitted-import-missing-declaring-journey");
});

test("argument.refusals: validateHistoricalPremise rejects verification missing verifiedBy (argument.ts:560)", () => {
  // Accept path
  const validVer = {
    ...validHistoricalPremise,
    verification: {
      verifiedBy: "jemanuel",
      verifierKind: "human" as const,
      date: "2026-09-18",
      method: "library scan" as const,
      evidenceLocator: "p. 5",
    },
  };
  assert.ok(validateHistoricalPremise(validVer));

  // Reject path: verified-premise-missing-verifier
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      verification: {
        verifierKind: "human",
        date: "2026-09-18",
        method: "library scan",
        evidenceLocator: "p. 5",
      },
    });
  }, "verified-premise-missing-verifier");
});

test("argument.refusals: validateHistoricalPremise rejects verification with invalid verifierKind (argument.ts:568)", () => {
  // Accept path
  const validVer = {
    ...validHistoricalPremise,
    verification: {
      verifiedBy: "jemanuel",
      verifierKind: "human" as const,
      date: "2026-09-18",
      method: "library scan" as const,
      evidenceLocator: "p. 5",
    },
  };
  assert.ok(validateHistoricalPremise(validVer));

  // Reject path: verified-premise-invalid-verifier-kind
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      verification: {
        verifiedBy: "jemanuel",
        verifierKind: "committee",
        date: "2026-09-18",
        method: "library scan",
        evidenceLocator: "p. 5",
      },
    });
  }, "verified-premise-invalid-verifier-kind");
});

test("argument.refusals: validateHistoricalPremise rejects verification missing date (argument.ts:576)", () => {
  // Accept path
  const validVer = {
    ...validHistoricalPremise,
    verification: {
      verifiedBy: "jemanuel",
      verifierKind: "human" as const,
      date: "2026-09-18",
      method: "library scan" as const,
      evidenceLocator: "p. 5",
    },
  };
  assert.ok(validateHistoricalPremise(validVer));

  // Reject path: verified-premise-missing-date
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      verification: {
        verifiedBy: "jemanuel",
        verifierKind: "human",
        method: "library scan",
        evidenceLocator: "p. 5",
      },
    });
  }, "verified-premise-missing-date");
});

test("argument.refusals: validateHistoricalPremise rejects verification with invalid method (argument.ts:589)", () => {
  // Accept path
  const validVer = {
    ...validHistoricalPremise,
    verification: {
      verifiedBy: "jemanuel",
      verifierKind: "human" as const,
      date: "2026-09-18",
      method: "library scan" as const,
      evidenceLocator: "p. 5",
    },
  };
  assert.ok(validateHistoricalPremise(validVer));

  // Reject path: verified-premise-invalid-method
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      verification: {
        verifiedBy: "jemanuel",
        verifierKind: "human",
        date: "2026-09-18",
        method: "word-of-mouth",
        evidenceLocator: "p. 5",
      },
    });
  }, "verified-premise-invalid-method");
});

test("argument.refusals: validateHistoricalPremise rejects partial top-level verifier without evidenceLocator (argument.ts:627)", () => {
  // Accept path
  const validVer = {
    ...validHistoricalPremise,
    verifier: "jemanuel",
    dateVerified: "2026-09-18",
    evidenceLocator: "p. 42",
  };
  assert.ok(validateHistoricalPremise(validVer));

  // Reject path: verified-premise-missing-locator
  assertArgumentRefusal(() => {
    validateHistoricalPremise({
      ...validHistoricalPremise,
      verifier: "jemanuel",
      dateVerified: "2026-09-18",
    });
  }, "verified-premise-missing-locator");
});

test("argument.refusals: validateHistoricalPremise rejects invalid language tag (argument.ts:642)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise({ ...validHistoricalPremise, lang: "de" }));

  // Reject path: invalid-language-tag
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, lang: "invalid..tag" });
  }, "invalid-language-tag");
});

test("argument.refusals: validateHistoricalPremise rejects invalid text direction (argument.ts:656)", () => {
  // Accept path
  assert.ok(validateHistoricalPremise({ ...validHistoricalPremise, dir: "ltr" }));

  // Reject path: invalid-direction
  assertArgumentRefusal(() => {
    validateHistoricalPremise({ ...validHistoricalPremise, dir: "diagonal" as any });
  }, "invalid-direction");
});

test("argument.refusals: validateArgumentNode rejects non-object record (argument.ts:769)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateArgumentNode(null);
  }, "invalid-record");
});

test("argument.refusals: validateArgumentNode rejects essentialForPrint field (argument.ts:779)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateArgumentNode rejects missing id (argument.ts:788)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateArgumentNode rejects id not starting with 'arg-' (argument.ts:791)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: invalid-argument-id
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, id: "node-bm-01" });
  }, "invalid-argument-id");
});

test("argument.refusals: validateArgumentNode rejects missing paper (argument.ts:800)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-paper
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, paper: "" });
  }, "missing-paper");
});

test("argument.refusals: validateArgumentNode rejects missing question (argument.ts:808)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-question
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, question: "" });
  }, "missing-question");
});

test("argument.refusals: validateArgumentNode rejects missing conclusion (argument.ts:816)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-conclusion
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, conclusion: "" });
  }, "missing-conclusion");
});

test("argument.refusals: validateArgumentNode rejects invalid logicalRole (argument.ts:825)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: invalid-logical-role
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, logicalRole: "invalid-role" as any });
  }, "invalid-logical-role");
});

test("argument.refusals: validateArgumentNode rejects invalid premise ref kind (argument.ts:854)", () => {
  // Accept path
  const withPremise = {
    ...validArgumentNode,
    premises: [
      {
        ref: { kind: "premise" as const, id: "van-t-hoff-1887-osmotic-pressure" },
        edgeType: "historical-derivation" as const,
      },
    ],
  };
  assert.ok(validateArgumentNode(withPremise));

  // Reject path: invalid-premise-ref
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      premises: [{ ref: { kind: "dataset", id: "d1" }, edgeType: "historical-derivation" }],
    });
  }, "invalid-premise-ref");
});

test("argument.refusals: validateArgumentNode rejects non-object evidence entry (argument.ts:883)", () => {
  // Accept path
  const withEv = {
    ...validArgumentNode,
    evidence: [
      { ref: { kind: "dataset" as const, id: "perrin-1909" }, relation: "supports" as const },
    ],
  };
  assert.ok(validateArgumentNode(withEv));

  // Reject path: invalid-evidence
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, evidence: ["not-an-object"] });
  }, "invalid-evidence");
});

test("argument.refusals: validateArgumentNode rejects invalid evidence ref kind (argument.ts:895)", () => {
  // Accept path
  const withEv = {
    ...validArgumentNode,
    evidence: [
      { ref: { kind: "dataset" as const, id: "perrin-1909" }, relation: "supports" as const },
    ],
  };
  assert.ok(validateArgumentNode(withEv));

  // Reject path: invalid-evidence-ref
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      evidence: [{ ref: { kind: "invalid-kind", id: "e1" }, relation: "supports" }],
    });
  }, "invalid-evidence-ref");
});

test("argument.refusals: validateArgumentNode rejects invalid evidence relation (argument.ts:903)", () => {
  // Accept path
  const withEv = {
    ...validArgumentNode,
    evidence: [
      { ref: { kind: "dataset" as const, id: "perrin-1909" }, relation: "supports" as const },
    ],
  };
  assert.ok(validateArgumentNode(withEv));

  // Reject path: invalid-evidence-relation
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      evidence: [{ ref: { kind: "dataset", id: "perrin-1909" }, relation: "invalid-rel" }],
    });
  }, "invalid-evidence-relation");
});

test("argument.refusals: validateArgumentNode rejects prerequisite missing foundationId (argument.ts:933)", () => {
  // Accept path
  const withPrereq = {
    ...validArgumentNode,
    prerequisites: [{ foundationId: "found-stokes-drag", kind: "proof-edge" as const }],
  };
  assert.ok(validateArgumentNode(withPrereq));

  // Reject path: missing-prerequisite-foundation-id
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      prerequisites: [{ foundationId: "", kind: "proof-edge" }],
    });
  }, "missing-prerequisite-foundation-id");
});

test("argument.refusals: validateArgumentNode rejects non-object coverageObligation (argument.ts:958)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-coverage-obligation
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, coverageObligation: null });
  }, "missing-coverage-obligation");
});

test("argument.refusals: validateArgumentNode rejects coverageObligation missing treatment (argument.ts:967)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-coverage-treatment
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, coverageObligation: { treatment: null } });
  }, "missing-coverage-treatment");
});

test("argument.refusals: validateArgumentNode rejects instrument treatment with empty experimentIds (argument.ts:978)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: missing-experiment-ids
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      coverageObligation: { treatment: { kind: "instrument", experimentIds: [] } },
    });
  }, "missing-experiment-ids");
});

test("argument.refusals: validateArgumentNode rejects static treatment with empty description (argument.ts:993)", () => {
  // Accept path
  const staticCov = {
    ...validArgumentNode,
    coverageObligation: {
      treatment: { kind: "static" as const, description: "Static diagram of random walk" },
    },
  };
  assert.ok(validateArgumentNode(staticCov));

  // Reject path: missing-static-description
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      coverageObligation: { treatment: { kind: "static", description: "" } },
    });
  }, "missing-static-description");
});

test("argument.refusals: validateArgumentNode rejects omitted treatment with empty reason (argument.ts:1003)", () => {
  // Accept path
  const omittedCov = {
    ...validArgumentNode,
    coverageObligation: {
      treatment: { kind: "omitted" as const, reason: "Covered thoroughly in paper §2" },
    },
  };
  assert.ok(validateArgumentNode(omittedCov));

  // Reject path: omitted-treatment-missing-reason
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      coverageObligation: { treatment: { kind: "omitted", reason: "" } },
    });
  }, "omitted-treatment-missing-reason");
});

test("argument.refusals: validateArgumentNode rejects invalid treatment kind (argument.ts:1012)", () => {
  // Accept path
  assert.ok(validateArgumentNode(validArgumentNode));

  // Reject path: invalid-treatment-kind
  assertArgumentRefusal(() => {
    validateArgumentNode({
      ...validArgumentNode,
      coverageObligation: { treatment: { kind: "interactive-3d" } },
    });
  }, "invalid-treatment-kind");
});

test("argument.refusals: validateArgumentNode rejects non-string recap (argument.ts:1032)", () => {
  // Accept path
  assert.ok(validateArgumentNode({ ...validArgumentNode, recap: "Valid recap string." }));

  // Reject path: invalid-recap-type
  assertArgumentRefusal(() => {
    validateArgumentNode({ ...validArgumentNode, recap: 12345 as any });
  }, "invalid-recap-type");
});

test("argument.refusals: validateProof rejects non-object record (argument.ts:1087)", () => {
  // Accept path
  assert.ok(validateProof(validProof));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateProof(null);
  }, "invalid-record");
});

test("argument.refusals: validateProof rejects essentialForPrint field (argument.ts:1092)", () => {
  // Accept path
  assert.ok(validateProof(validProof));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateProof({ ...validProof, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateProof rejects missing id (argument.ts:1101)", () => {
  // Accept path
  assert.ok(validateProof(validProof));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateProof({ ...validProof, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateQuantity rejects non-object record (argument.ts:1181)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateQuantity(null);
  }, "invalid-record");
});

test("argument.refusals: validateQuantity rejects essentialForPrint field (argument.ts:1191)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateQuantity rejects missing id (argument.ts:1200)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateQuantity rejects missing name (argument.ts:1213)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: missing-name
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, name: "" });
  }, "missing-name");
});

test("argument.refusals: validateQuantity rejects missing description (argument.ts:1216)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: missing-description
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, description: "" });
  }, "missing-description");
});

test("argument.refusals: validateQuantity rejects invalid dimensionStatus (argument.ts:1226)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: invalid-dimension-status
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, dimensionStatus: "dynamic" as any });
  }, "invalid-dimension-status");
});

test("argument.refusals: validateQuantity rejects state-dependent quantity missing dimensionNote (argument.ts:1248)", () => {
  // Accept path
  const stateDep = {
    ...validQuantity,
    dimensionStatus: "state-dependent" as const,
    dimension: undefined,
    dimensionNote: "Temperature dependent",
  };
  assert.ok(validateQuantity(stateDep));

  // Reject path: missing-dimension-note
  assertArgumentRefusal(() => {
    validateQuantity({
      ...validQuantity,
      dimensionStatus: "state-dependent",
      dimension: undefined,
      dimensionNote: "",
    });
  }, "missing-dimension-note");
});

test("argument.refusals: validateQuantity rejects invalid mathematicalKind (argument.ts:1294)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: invalid-mathematical-kind
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, mathematicalKind: "tensor" as any });
  }, "invalid-mathematical-kind");
});

test("argument.refusals: validateQuantity rejects invalid densityKind (argument.ts:1305)", () => {
  // Accept path
  assert.ok(validateQuantity(validQuantity));

  // Reject path: invalid-density-kind
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, densityKind: "volumetric" as any });
  }, "invalid-density-kind");
});

test("argument.refusals: validateQuantity rejects densityKind 'density' with empty densityPer (argument.ts:1316)", () => {
  // Accept path
  const densityQty = {
    ...validQuantity,
    densityKind: "density" as const,
    densityPer: ["volume" as const],
  };
  assert.ok(validateQuantity(densityQty));

  // Reject path: missing-density-per
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, densityKind: "density", densityPer: [] });
  }, "missing-density-per");
});

test("argument.refusals: validateQuantity rejects invalid densityPer item (argument.ts:1325)", () => {
  // Accept path
  const densityQty = {
    ...validQuantity,
    densityKind: "density" as const,
    densityPer: ["volume" as const],
  };
  assert.ok(validateQuantity(densityQty));

  // Reject path: invalid-density-per-item
  assertArgumentRefusal(() => {
    validateQuantity({
      ...validQuantity,
      densityKind: "density",
      densityPer: ["invalid-per" as any],
    });
  }, "invalid-density-per-item");
});

test("argument.refusals: validateQuantity rejects invalid spectralBasis (argument.ts:1339)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, spectralBasis: "per-frequency" as const }));

  // Reject path: invalid-spectral-basis
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, spectralBasis: "invalid-basis" as any });
  }, "invalid-spectral-basis");
});

test("argument.refusals: validateQuantity rejects invalid frequencyKind (argument.ts:1349)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, frequencyKind: "cyclic" as const }));

  // Reject path: invalid-frequency-kind
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, frequencyKind: "invalid-freq" as any });
  }, "invalid-frequency-kind");
});

test("argument.refusals: validateQuantity rejects invalid timeKind (argument.ts:1359)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, timeKind: "coordinate" as const }));

  // Reject path: invalid-time-kind
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, timeKind: "invalid-time" as any });
  }, "invalid-time-kind");
});

test("argument.refusals: validateQuantity rejects invalid observation kind (argument.ts:1379)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, observation: "measured" as const }));

  // Reject path: invalid-observation
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, observation: "invalid-obs" as any });
  }, "invalid-observation");
});

test("argument.refusals: validateQuantity rejects modelArtifact true missing artifactNote (argument.ts:1391)", () => {
  // Accept path
  assert.ok(
    validateQuantity({
      ...validQuantity,
      modelArtifact: true,
      artifactNote: "Derived in ether frame",
    }),
  );

  // Reject path: missing-artifact-note
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, modelArtifact: true, artifactNote: "" });
  }, "missing-artifact-note");
});

test("argument.refusals: validateQuantity rejects non-string representationField (argument.ts:1433)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, representationFields: ["x", "y"] }));

  // Reject path: invalid-representation-field
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, representationFields: [123 as any] });
  }, "invalid-representation-field");
});

test("argument.refusals: validateQuantity rejects invalid colorRole (argument.ts:1453)", () => {
  // Accept path
  assert.ok(validateQuantity({ ...validQuantity, colorRole: "energy" as const }));

  // Reject path: invalid-color-role
  assertArgumentRefusal(() => {
    validateQuantity({ ...validQuantity, colorRole: "neon-glow" as any });
  }, "invalid-color-role");
});

test("argument.refusals: validateSemanticEquation rejects non-object record (argument.ts:1546)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateSemanticEquation(null);
  }, "invalid-record");
});

test("argument.refusals: validateSemanticEquation rejects essentialForPrint field (argument.ts:1556)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateSemanticEquation rejects missing id (argument.ts:1565)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateSemanticEquation rejects missing paper (argument.ts:1578)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: missing-paper
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, paper: "" });
  }, "missing-paper");
});

test("argument.refusals: validateSemanticEquation rejects modernTree with invalid modernRelation (argument.ts:1599)", () => {
  // Accept path
  const withTree = { ...validEquation, modernTree: {}, modernRelation: "rename-only" as const };
  assert.ok(validateSemanticEquation(withTree));

  // Reject path: missing-modern-relation
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      modernTree: {},
      modernRelation: "invalid-rel" as any,
    });
  }, "missing-modern-relation");
});

test("argument.refusals: validateSemanticEquation rejects missing notationForms (argument.ts:1611)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: missing-notation-forms
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, notationForms: null });
  }, "missing-notation-forms");
});

test("argument.refusals: validateSemanticEquation rejects non-object notationForm (argument.ts:1621)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-notation-form
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      notationForms: { source: "not-an-object", modern: { mode: "generated", unitSystem: "si" } },
    });
  }, "invalid-notation-form");
});

test("argument.refusals: validateSemanticEquation rejects invalid notationMode (argument.ts:1629)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-notation-mode
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      notationForms: {
        source: { mode: "invalid-mode", unitSystem: "gaussian-cgs" },
        modern: { mode: "generated", unitSystem: "si" },
      },
    });
  }, "invalid-notation-mode");
});

test("argument.refusals: validateSemanticEquation rejects invalid unitSystem (argument.ts:1637)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-unit-system
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      notationForms: {
        source: { mode: "generated", unitSystem: "invalid-units" },
        modern: { mode: "generated", unitSystem: "si" },
      },
    });
  }, "invalid-unit-system");
});

test("argument.refusals: validateSemanticEquation rejects authored notation mode missing latex (argument.ts:1646)", () => {
  // Accept path
  const authEq = {
    ...validEquation,
    notationForms: {
      source: {
        mode: "authored" as const,
        unitSystem: "gaussian-cgs" as const,
        latex: "\\lambda = 2",
        termBindings: ["t1"],
      },
      modern: { mode: "generated" as const, unitSystem: "si" as const },
    },
  };
  assert.ok(validateSemanticEquation(authEq));

  // Reject path: authored-notation-missing-latex
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      notationForms: {
        source: { mode: "authored", unitSystem: "gaussian-cgs", latex: "", termBindings: ["t1"] },
        modern: { mode: "generated", unitSystem: "si" },
      },
    });
  }, "authored-notation-missing-latex");
});

test("argument.refusals: validateSemanticEquation rejects non-object term entry (argument.ts:1680)", () => {
  // Accept path
  const withTerm = { ...validEquation, terms: [{ termId: "t1", quantityId: "particleRadius" }] };
  assert.ok(validateSemanticEquation(withTerm));

  // Reject path: invalid-term
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, terms: ["not-an-object"] });
  }, "invalid-term");
});

test("argument.refusals: validateSemanticEquation rejects term missing termId (argument.ts:1682)", () => {
  // Accept path
  const withTerm = { ...validEquation, terms: [{ termId: "t1", quantityId: "particleRadius" }] };
  assert.ok(validateSemanticEquation(withTerm));

  // Reject path: missing-term-id
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      terms: [{ termId: "", quantityId: "particleRadius" }],
    });
  }, "missing-term-id");
});

test("argument.refusals: validateSemanticEquation rejects term missing quantityId (argument.ts:1689)", () => {
  // Accept path
  const withTerm = { ...validEquation, terms: [{ termId: "t1", quantityId: "particleRadius" }] };
  assert.ok(validateSemanticEquation(withTerm));

  // Reject path: missing-quantity-id
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, terms: [{ termId: "t1", quantityId: "" }] });
  }, "missing-quantity-id");
});

test("argument.refusals: validateSemanticEquation rejects term with invalid component (argument.ts:1704)", () => {
  // Accept path
  const withTerm = {
    ...validEquation,
    terms: [{ termId: "t1", quantityId: "particleRadius", component: "x" as const }],
  };
  assert.ok(validateSemanticEquation(withTerm));

  // Reject path: invalid-component
  assertArgumentRefusal(() => {
    validateSemanticEquation({
      ...validEquation,
      terms: [{ termId: "t1", quantityId: "particleRadius", component: "w" as any }],
    });
  }, "invalid-component");
});

test("argument.refusals: validateSemanticEquation rejects non-object operation entry (argument.ts:1732)", () => {
  // Accept path
  const withOp = {
    ...validEquation,
    operations: [{ opId: "op-1", kind: "step", explanation: "take derivative" }],
  };
  assert.ok(validateSemanticEquation(withOp));

  // Reject path: invalid-op
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, operations: ["not-an-object"] });
  }, "invalid-op");
});

test("argument.refusals: validateSemanticEquation rejects non-array alternateForms (argument.ts:1752)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-alternate-forms
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, alternateForms: "not-an-array" as any });
  }, "invalid-alternate-forms");
});

test("argument.refusals: validateSemanticEquation rejects non-array groups (argument.ts:1772)", () => {
  // Accept path
  assert.ok(validateSemanticEquation(validEquation));

  // Reject path: invalid-groups
  assertArgumentRefusal(() => {
    validateSemanticEquation({ ...validEquation, groups: "not-an-array" as any });
  }, "invalid-groups");
});

test("argument.refusals: validateFoundationLink rejects non-object record (argument.ts:1815)", () => {
  // Accept path
  assert.ok(validateFoundationLink(validFoundationLink));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateFoundationLink(null);
  }, "invalid-record");
});

test("argument.refusals: validateFoundationLink rejects essentialForPrint field (argument.ts:1825)", () => {
  // Accept path
  assert.ok(validateFoundationLink(validFoundationLink));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateFoundationLink({ ...validFoundationLink, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateWorkedExample rejects essentialForPrint field (argument.ts:1876)", () => {
  // Accept path
  assert.ok(validateWorkedExample(validWorkedExample));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateWorkedExample({ ...validWorkedExample, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateFoundationOrBridge rejects non-object record (argument.ts:1964)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateFoundationOrBridge(null);
  }, "invalid-record");
});

test("argument.refusals: validateFoundationOrBridge rejects essentialForPrint field (argument.ts:1974)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateFoundationOrBridge rejects missing id (argument.ts:1983)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateFoundationOrBridge rejects missing title (argument.ts:1986)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-title
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, title: "" });
  }, "missing-title");
});

test("argument.refusals: validateFoundationOrBridge rejects invalid kind (argument.ts:2005)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: invalid-kind
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, kind: "tutorial" as any });
  }, "invalid-kind");
});

test("argument.refusals: validateFoundationOrBridge rejects invalid returnCaption structure (argument.ts:2020)", () => {
  // Accept path
  const withRc = {
    ...validFoundation,
    returnCaptions: [{ callingAnchor: "a1", caption: "return" }],
  };
  assert.ok(validateFoundationOrBridge(withRc));

  // Reject path: invalid-return-caption
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({
      ...validFoundation,
      returnCaptions: [{ callingAnchor: 123 as any }],
    });
  }, "invalid-return-caption");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation missing learningObjective (argument.ts:2036)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-learning-objective
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, learningObjective: "" });
  }, "missing-learning-objective");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation missing compactExplanation (argument.ts:2044)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-compact-explanation
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, compactExplanation: "" });
  }, "missing-compact-explanation");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation missing fullExplanation (argument.ts:2052)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-full-explanation
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, fullExplanation: "" });
  }, "missing-full-explanation");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation missing textualEquivalent (argument.ts:2060)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-textual-equivalent
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, textualEquivalent: "" });
  }, "missing-textual-equivalent");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation missing stoppingPoint (argument.ts:2068)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validFoundation));

  // Reject path: missing-stopping-point
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, stoppingPoint: "" });
  }, "missing-stopping-point");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation invalid language tag (argument.ts:2111)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge({ ...validFoundation, lang: "de" }));

  // Reject path: invalid-language-tag
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, lang: "invalid..tag" });
  }, "invalid-language-tag");
});

test("argument.refusals: validateFoundationOrBridge rejects foundation invalid direction (argument.ts:2125)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge({ ...validFoundation, dir: "ltr" }));

  // Reject path: invalid-direction
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validFoundation, dir: "vertical" as any });
  }, "invalid-direction");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge missing concreteOperation (argument.ts:2156)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-concrete-operation
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, concreteOperation: "" });
  }, "missing-concrete-operation");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge missing compactExplanation (argument.ts:2164)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-compact-explanation
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, compactExplanation: "" });
  }, "missing-compact-explanation");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge missing textualEquivalent (argument.ts:2172)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-textual-equivalent
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, textualEquivalent: "" });
  }, "missing-textual-equivalent");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge missing stoppingPoint (argument.ts:2180)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-stopping-point
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, stoppingPoint: "" });
  }, "missing-stopping-point");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge missing readinessSign (argument.ts:2188)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-readiness-sign
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, readinessSign: "" });
  }, "missing-readiness-sign");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge continueWith item missing targetId (argument.ts:2216)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: missing-continue-with-target
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({
      ...validBridge,
      continueWith: [
        { route: "more-guidance", targetId: "" },
        { route: "less-guidance", targetId: "x" },
      ],
    });
  }, "missing-continue-with-target");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge continueWith routes not matching more/less guidance pair (argument.ts:2238)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge(validBridge));

  // Reject path: invalid-continue-with-routes
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({
      ...validBridge,
      continueWith: [
        { route: "more-guidance", targetId: "a" },
        { route: "more-guidance", targetId: "b" },
      ],
    });
  }, "invalid-continue-with-routes");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge invalid language tag (argument.ts:2252)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge({ ...validBridge, lang: "de" }));

  // Reject path: invalid-language-tag
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, lang: "invalid..tag" });
  }, "invalid-language-tag");
});

test("argument.refusals: validateFoundationOrBridge rejects bridge invalid direction (argument.ts:2266)", () => {
  // Accept path
  assert.ok(validateFoundationOrBridge({ ...validBridge, dir: "ltr" }));

  // Reject path: invalid-direction
  assertArgumentRefusal(() => {
    validateFoundationOrBridge({ ...validBridge, dir: "vertical" as any });
  }, "invalid-direction");
});

test("argument.refusals: validateMisconception rejects non-object record (argument.ts:2337)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateMisconception(null);
  }, "invalid-record");
});

test("argument.refusals: validateMisconception rejects missing id (argument.ts:2356)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: missing-id
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, id: "" });
  }, "missing-id");
});

test("argument.refusals: validateMisconception rejects missing paper (argument.ts:2365)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: missing-paper
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, paper: "" });
  }, "missing-paper");
});

test("argument.refusals: validateMisconception rejects missing whyTempting (argument.ts:2407)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: missing-why-tempting
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, whyTempting: "" });
  }, "missing-why-tempting");
});

test("argument.refusals: validateMisconception rejects missing whatIsTrue (argument.ts:2418)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: missing-what-is-true
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, whatIsTrue: undefined });
  }, "missing-what-is-true");
});

test("argument.refusals: validateMisconception rejects missing intervention object (argument.ts:2451)", () => {
  // Accept path
  assert.ok(validateMisconception(validMisconception));

  // Reject path: missing-intervention
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, intervention: null });
  }, "missing-intervention");
});

test("argument.refusals: validateMisconception rejects invalid language tag (argument.ts:2494)", () => {
  // Accept path
  assert.ok(validateMisconception({ ...validMisconception, lang: "de" }));

  // Reject path: invalid-language-tag
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, lang: "invalid..tag" });
  }, "invalid-language-tag");
});

test("argument.refusals: validateMisconception rejects invalid direction (argument.ts:2508)", () => {
  // Accept path
  assert.ok(validateMisconception({ ...validMisconception, dir: "ltr" }));

  // Reject path: invalid-direction
  assertArgumentRefusal(() => {
    validateMisconception({ ...validMisconception, dir: "vertical" as any });
  }, "invalid-direction");
});

test("argument.refusals: validateReadingSet rejects non-object record (argument.ts:2573)", () => {
  // Accept path
  assert.ok(validateReadingSet(validReadingSet));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateReadingSet(null);
  }, "invalid-record");
});

test("argument.refusals: validateReadingSet rejects non-boolean essentialForPrint (argument.ts:2583)", () => {
  // Accept path
  assert.ok(validateReadingSet({ ...validReadingSet, essentialForPrint: true }));

  // Reject path: invalid-essential-for-print
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, essentialForPrint: "yes" as any });
  }, "invalid-essential-for-print");
});

test("argument.refusals: validateReadingSet rejects missing targetId (argument.ts:2592)", () => {
  // Accept path
  assert.ok(validateReadingSet(validReadingSet));

  // Reject path: missing-target-id
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, targetId: "" });
  }, "missing-target-id");
});

test("argument.refusals: validateReadingSet rejects invalid reading target kind (argument.ts:2602) (argument.ts:2610)", () => {
  // Accept path
  assert.ok(validateReadingSet(validReadingSet));

  // Reject path: invalid-reading-target-kind
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, targetKind: "diagram" as any });
  }, "invalid-reading-target-kind");
});

test("argument.refusals: validateReadingSet rejects invalid footnote targetId grammar (argument.ts:2631)", () => {
  // Accept path
  assert.ok(
    validateReadingSet({ ...validReadingSet, targetKind: "footnote" as const, targetId: "s3-fn1" }),
  );

  // Reject path: invalid-target-id-for-kind
  assertArgumentRefusal(() => {
    validateReadingSet({
      ...validReadingSet,
      targetKind: "footnote",
      targetId: "not-a-footnote-id",
    });
  }, "invalid-target-id-for-kind");
});

test("argument.refusals: validateReadingSet rejects invalid closing targetId grammar (argument.ts:2640)", () => {
  // Accept path
  assert.ok(
    validateReadingSet({
      ...validReadingSet,
      targetKind: "closing" as const,
      targetId: "closing-dateline",
    }),
  );

  // Reject path: invalid-target-id-for-kind
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, targetKind: "closing", targetId: "not-a-closing-id" });
  }, "invalid-target-id-for-kind");
});

test("argument.refusals: validateReadingSet rejects invalid equation targetId grammar (argument.ts:2647)", () => {
  // Accept path
  assert.ok(
    validateReadingSet({
      ...validReadingSet,
      targetKind: "equation" as const,
      targetId: "eq-bm-s3-d4",
    }),
  );

  // Reject path: invalid-target-id-for-kind
  assertArgumentRefusal(() => {
    validateReadingSet({
      ...validReadingSet,
      targetKind: "equation",
      targetId: "not-an-equation-id",
    });
  }, "invalid-target-id-for-kind");
});

test("argument.refusals: validateReadingSet rejects invalid derivation-step targetId grammar (argument.ts:2657)", () => {
  // Accept path
  assert.ok(
    validateReadingSet({
      ...validReadingSet,
      targetKind: "derivation-step" as const,
      targetId: "chain-1/step-1",
    }),
  );

  // Reject path: invalid-target-id-for-kind
  assertArgumentRefusal(() => {
    validateReadingSet({
      ...validReadingSet,
      targetKind: "derivation-step",
      targetId: "INVALID_STEP_ID!",
    });
  }, "invalid-target-id-for-kind");
});

test("argument.refusals: validateReadingSet rejects invalid instrument-caption targetId grammar (argument.ts:2667)", () => {
  // Accept path
  assert.ok(
    validateReadingSet({
      ...validReadingSet,
      targetKind: "instrument-caption" as const,
      targetId: "bm-01-figure",
    }),
  );

  // Reject path: invalid-target-id-for-kind
  assertArgumentRefusal(() => {
    validateReadingSet({
      ...validReadingSet,
      targetKind: "instrument-caption",
      targetId: "INVALID_CAPTION!",
    });
  }, "invalid-target-id-for-kind");
});

test("argument.refusals: validateReadingSet rejects invalid language tag (argument.ts:2699)", () => {
  // Accept path
  assert.ok(validateReadingSet({ ...validReadingSet, lang: "de" }));

  // Reject path: invalid-language-tag
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, lang: "invalid..tag" });
  }, "invalid-language-tag");
});

test("argument.refusals: validateReadingSet rejects invalid direction (argument.ts:2713)", () => {
  // Accept path
  assert.ok(validateReadingSet({ ...validReadingSet, dir: "ltr" }));

  // Reject path: invalid-direction
  assertArgumentRefusal(() => {
    validateReadingSet({ ...validReadingSet, dir: "vertical" as any });
  }, "invalid-direction");
});

test("argument.refusals: validateAuthoringContract rejects non-object record (argument.ts:2762)", () => {
  // Accept path
  assert.ok(validateAuthoringContract(validAuthoringContract));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateAuthoringContract(null);
  }, "invalid-record");
});

test("argument.refusals: validateAuthoringContract rejects essentialForPrint field (argument.ts:2772)", () => {
  // Accept path
  assert.ok(validateAuthoringContract(validAuthoringContract));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateAuthoringContract({ ...validAuthoringContract, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

test("argument.refusals: validateAuthoringContract rejects missing question (argument.ts:2781)", () => {
  // Accept path
  assert.ok(validateAuthoringContract(validAuthoringContract));

  // Reject path: missing-question
  assertArgumentRefusal(() => {
    validateAuthoringContract({ ...validAuthoringContract, question: "" });
  }, "missing-question");
});

test("argument.refusals: validateAuthoringContract rejects missing conclusionSupported (argument.ts:2788)", () => {
  // Accept path
  assert.ok(validateAuthoringContract(validAuthoringContract));

  // Reject path: missing-conclusion
  assertArgumentRefusal(() => {
    validateAuthoringContract({ ...validAuthoringContract, conclusionSupported: "" });
  }, "missing-conclusion");
});

test("argument.refusals: validateAuthoringContract rejects missing bridge (argument.ts:2795)", () => {
  // Accept path
  assert.ok(validateAuthoringContract(validAuthoringContract));

  // Reject path: missing-bridge
  assertArgumentRefusal(() => {
    validateAuthoringContract({ ...validAuthoringContract, bridge: "" });
  }, "missing-bridge");
});

test("argument.refusals: validateAuthoringContract rejects malformed qualification entry (argument.ts:2802)", () => {
  // Accept path
  const withQual = {
    ...validAuthoringContract,
    approximationsIntroduced: [
      { qualificationId: "q1", statement: "dilute limit", restricts: "concentration" },
    ],
  };
  assert.ok(validateAuthoringContract(withQual));

  // Reject path: invalid-qualification
  assertArgumentRefusal(() => {
    validateAuthoringContract({
      ...validAuthoringContract,
      approximationsIntroduced: [{ qualificationId: 123 as any }],
    });
  }, "invalid-qualification");
});

test("argument.refusals: validateObstacleResponses rejects non-object record (argument.ts:2872)", () => {
  // Accept path
  assert.ok(validateObstacleResponses(validObstacleResponses));

  // Reject path: invalid-record
  assertArgumentRefusal(() => {
    validateObstacleResponses(null);
  }, "invalid-record");
});

test("argument.refusals: validateObstacleResponses rejects essentialForPrint field (argument.ts:2882)", () => {
  // Accept path
  assert.ok(validateObstacleResponses(validObstacleResponses));

  // Reject path: essential-for-print-rejected
  assertArgumentRefusal(() => {
    validateObstacleResponses({ ...validObstacleResponses, essentialForPrint: true });
  }, "essential-for-print-rejected");
});

// ============================================================================
// dimensionStatus "undefined-in-source" (dispatch 236): a quantity the source names but never
// defines, such as the 1905 paper's A_m and A_e (p. 920), declares no dimension and says why.
// ============================================================================

const sourceUndefined = {
  ...validQuantity,
  id: "magneticDeflectability",
  dimensionStatus: "undefined-in-source" as const,
  dimension: undefined,
  dimensionNote: "Named on p. 920; the paper fixes only that A_m and A_e share a dimension.",
};

test("argument.refusals: an undefined-in-source quantity validates with a note and no dimension", () => {
  const q = validateQuantity(sourceUndefined);
  assert.equal(q.dimensionStatus, "undefined-in-source");
  assert.equal(q.dimension, undefined);
  assert.equal(q.dimensionNote, sourceUndefined.dimensionNote);
});

test("argument.refusals: validateQuantity rejects undefined-in-source without a dimensionNote", () => {
  for (const dimensionNote of [undefined, "", "   "]) {
    assertArgumentRefusal(
      () => validateQuantity({ ...sourceUndefined, dimensionNote }),
      "undefined-in-source-missing-dimension-note",
    );
  }
});

test("argument.refusals: validateQuantity rejects undefined-in-source declaring a dimension in any unit system", () => {
  const vector = [0, 1, 0, 0, 0, 0];
  for (const key of ["dimension", "gaussianDimension", "emuDimension"]) {
    assertArgumentRefusal(
      () => validateQuantity({ ...sourceUndefined, [key]: vector }),
      "undefined-in-source-dimension-declared",
    );
  }
});

test("argument.refusals: validateQuantity rejects undefined-in-source as a constant", () => {
  assertArgumentRefusal(
    () => validateQuantity({ ...sourceUndefined, isConstant: true }),
    "undefined-in-source-cannot-be-constant",
  );
});

test("argument.refusals: the new status leaves declared and state-dependent as they were", () => {
  // A declared quantity still needs its vector: the new branch must not open a way around it.
  assertArgumentRefusal(
    () => validateQuantity({ ...validQuantity, dimension: undefined }),
    "missing-dimension",
  );
  // A state-dependent quantity still refuses a missing note under its own code, not the new one.
  assertArgumentRefusal(
    () =>
      validateQuantity({
        ...validQuantity,
        dimensionStatus: "state-dependent",
        dimension: undefined,
        dimensionNote: "",
      }),
    "missing-dimension-note",
  );
  const stateDependent = validateQuantity({
    ...validQuantity,
    dimensionStatus: "state-dependent",
    dimension: undefined,
    dimensionNote: "Temperature dependent",
  });
  assert.equal(stateDependent.dimensionNote, "Temperature dependent");
});
