import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getLogger } from "../../../testing/log/logger.ts";
import { clearRegisteredChecksForTests, runAllChecks } from "../../compiler/checks/registry.ts";
import { compileContent } from "../../compiler/compiler.ts";
import {
  buildReviewQueue,
  computeFlagFingerprint,
  type ReviewFlagItem,
} from "../../compiler/reviewQueue.ts";
import {
  AVOGADRO_CONSTANT,
  isGammaMc2Tree,
  isMc2Tree,
  MIXED_DIFFUSION_SCENARIO,
} from "./circularity.ts";
import { EPISTEMIC_CHECKS, registerEpistemicChecks } from "./register.ts";
import { EPISTEMIC_UNDECIDABLE } from "./undecidable.ts";

const logger = getLogger("content-epistemic-tests");
const BEAD = "am-cm-checks-epistemic-o7n";

function records(items: Record<string, unknown>[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const item of items) map.set(String(item.id), item);
  return map;
}

async function run(items: Record<string, unknown>[]) {
  return runAllChecks({ records: records(items), files: [], indexes: {} });
}

function errorRules(result: Awaited<ReturnType<typeof runAllChecks>>): string[] {
  return result.diagnostics.filter((d) => d.severity === "error").map((d) => d.rule ?? d.code);
}

function flagRules(result: Awaited<ReturnType<typeof runAllChecks>>): string[] {
  return result.diagnostics.filter((d) => d.severity === "flag").map((d) => d.rule ?? d.code);
}

const node = (id: string, extras: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: "argument-node",
  id,
  logicalRole: "derivation",
  premises: [],
  prerequisites: [],
  ...extras,
});

beforeEach(() => {
  clearRegisteredChecksForTests();
  registerEpistemicChecks();
});
afterEach(() => {
  clearRegisteredChecksForTests();
});

describe("epistemic undecidable list is not a fake check", () => {
  test("none of the undecidable ids is registered as an error check", () => {
    const registered = new Set(EPISTEMIC_CHECKS.map((c) => c.id));
    for (const item of EPISTEMIC_UNDECIDABLE) {
      expect(registered.has(item.id)).toBe(false);
      expect(item.reason.length).toBeGreaterThan(40);
    }
    logger.log({
      testId: "undecidable-not-registered",
      beadId: BEAD,
      extra: { family: "epistemic" },
      outcome: "passed",
      message: "faithfulness and related questions stay human review",
    });
  });
});

describe("proof graphs", () => {
  test("PLANTED: A -> B -> A on historical-derivation fails with its path", async () => {
    const result = await run([
      node("a", {
        premises: [{ ref: { kind: "argument", id: "b" }, edgeType: "historical-derivation" }],
      }),
      node("b", {
        premises: [{ ref: { kind: "argument", id: "a" }, edgeType: "historical-derivation" }],
      }),
      { kind: "proof", id: "proof-cycle", route: "source-order", argumentNodeIds: ["a", "b"] },
    ]);
    expect(errorRules(result)).toContain("proof-cycle");
    const finding = result.diagnostics.find((d) => d.rule === "proof-cycle");
    expect(finding?.flaggedText?.includes("a")).toBe(true);
    expect(finding?.flaggedText?.includes("b")).toBe(true);
  });

  test("GOOD: a glossary cross-reference cycle does not trigger proof-cycle", async () => {
    const result = await run([
      node("a", {
        premises: [{ ref: { kind: "argument", id: "b" }, edgeType: "cross-reference" }],
      }),
      node("b", {
        premises: [{ ref: { kind: "argument", id: "a" }, edgeType: "cross-reference" }],
      }),
      { kind: "proof", id: "proof-xref", route: "source-order", argumentNodeIds: ["a", "b"] },
    ]);
    expect(errorRules(result)).not.toContain("proof-cycle");
  });

  test("GOOD: a cycle through an evidence edge does not trigger proof-cycle", async () => {
    const result = await run([
      node("a", {
        evidence: [{ ref: { kind: "dataset", id: "b" }, relation: "supports" }],
      }),
      node("b"),
      { kind: "proof", id: "proof-ev", route: "source-order", argumentNodeIds: ["a", "b"] },
    ]);
    expect(errorRules(result)).not.toContain("proof-cycle");
  });

  test("GOOD: cross-link prerequisite cycle passes; PLANTED: the same cycle through proof-edge fails", async () => {
    const cross = await run([
      node("a", { prerequisites: [{ foundationId: "b", kind: "cross-link" }] }),
      node("b", { prerequisites: [{ foundationId: "a", kind: "cross-link" }] }),
      { kind: "proof", id: "proof-cross", route: "source-order", argumentNodeIds: ["a", "b"] },
    ]);
    expect(errorRules(cross)).not.toContain("proof-cycle");
    const proofEdge = await run([
      node("a", { prerequisites: [{ foundationId: "b", kind: "proof-edge" }] }),
      node("b", { prerequisites: [{ foundationId: "a", kind: "proof-edge" }] }),
      { kind: "proof", id: "proof-edge-cycle", route: "source-order", argumentNodeIds: ["a", "b"] },
    ]);
    expect(errorRules(proofEdge)).toContain("proof-cycle");
  });
});

describe("oracles", () => {
  test("PLANTED: a historical Lorentz route citing interval invariance as a derivation premise fails", async () => {
    const result = await run([
      node("lorentz-step", {
        premises: [
          {
            ref: { kind: "premise", id: "minkowski-interval" },
            edgeType: "modern-verification-oracle",
          },
        ],
      }),
      {
        kind: "proof",
        id: "proof-lorentz-historical",
        route: "discovery",
        argumentNodeIds: ["lorentz-step"],
      },
    ]);
    expect(errorRules(result)).toContain("oracle-in-historical-route");
  });

  test("GOOD: the same premise as a modern verification oracle in a modern-verification route passes", async () => {
    const result = await run([
      node("lorentz-step", {
        premises: [
          {
            ref: { kind: "premise", id: "minkowski-interval" },
            edgeType: "modern-verification-oracle",
          },
        ],
      }),
      {
        kind: "proof",
        id: "proof-lorentz-modern",
        route: "modern-verification",
        argumentNodeIds: ["lorentz-step"],
      },
    ]);
    expect(errorRules(result)).not.toContain("oracle-in-historical-route");
  });
});

describe("shelf dates on journeys", () => {
  test("PLANTED: Jeans 1905 available as a chain premise fails; GOOD: Rayleigh 1900 passes", async () => {
    const result = await run([
      {
        kind: "historical-premise",
        id: "jeans-1905",
        status: "available",
        date: { latestYear: 1905 },
      },
      {
        kind: "historical-premise",
        id: "rayleigh-1900",
        status: "available",
        date: { latestYear: 1900 },
      },
      {
        kind: "journey",
        id: "journey-i",
        stages: [
          { id: "stage-jeans", premiseRefs: [{ cardId: "jeans-1905" }] },
          { id: "stage-rayleigh", premiseRefs: [{ cardId: "rayleigh-1900" }] },
        ],
      },
    ]);
    expect(errorRules(result)).toContain("shelf-date-violation");
    expect(result.diagnostics.some((d) => d.recordId === "jeans-1905")).toBe(true);
    expect(
      result.diagnostics.some(
        (d) => d.rule === "shelf-date-violation" && d.recordId === "rayleigh-1900",
      ),
    ).toBe(false);
  });
});

describe("world check and later evidence", () => {
  test("PLANTED: Perrin 1909 as a later chain premise fails", async () => {
    const result = await run([
      {
        kind: "historical-premise",
        id: "perrin-1909",
        status: "later",
        date: { latestYear: 1909 },
      },
      {
        kind: "journey",
        id: "journey-bm",
        stages: [{ id: "stage-chain", premiseRefs: [{ cardId: "perrin-1909" }] }],
      },
    ]);
    expect(errorRules(result)).toContain("shelf-date-violation");
  });

  test("GOOD: Perrin 1909 as labeled world-check evidence passes; PLANTED: unlabeled fails; PLANTED: no quantity id fails", async () => {
    const labeled = await run([
      {
        kind: "journey",
        id: "journey-bm",
        stages: [],
        worldChecks: [
          {
            id: "wc-perrin",
            quantityId: "avogadroNumberEstimate",
            comparisonKind: "measured-fact",
            laterEvidence: { year: 1909, description: "later evidence (1909)" },
          },
        ],
      },
    ]);
    expect(errorRules(labeled)).not.toContain("later-evidence-unlabeled");

    const unlabeled = await run([
      {
        kind: "journey",
        id: "journey-bm",
        stages: [],
        worldChecks: [
          {
            id: "wc-perrin-bare",
            quantityId: "avogadroNumberEstimate",
            comparisonKind: "measured-fact",
            laterEvidence: { year: 1909, description: "Perrin 1909" },
          },
        ],
      },
    ]);
    expect(errorRules(unlabeled)).toContain("later-evidence-unlabeled");

    const noQty = await run([
      {
        kind: "journey",
        id: "journey-bm",
        stages: [],
        worldChecks: [
          {
            id: "wc-empty",
            quantityId: "",
            comparisonKind: "measured-fact",
            laterEvidence: { year: 1909, description: "later evidence (1909)" },
          },
        ],
      },
    ]);
    expect(errorRules(noQty)).toContain("later-evidence-unlabeled");
  });

  test("GOOD: fixture Brownian slice journey (shelf, chain, world check with labeled later dataset) passes with zero errors", async () => {
    const result = await run([
      {
        kind: "historical-premise",
        id: "stokes-1851",
        status: "available",
        date: { latestYear: 1851 },
      },
      {
        kind: "journey",
        id: "journey-brownian-slice",
        stages: [
          {
            id: "stage-shelf-stokes",
            kind: "shelf",
            premiseRefs: [{ cardId: "stokes-1851" }],
          },
          {
            id: "stage-chain-diffusivity",
            kind: "chain",
            premiseRefs: [{ cardId: "stokes-1851" }],
          },
        ],
        worldChecks: [
          {
            id: "wc-perrin-brownian",
            quantityId: "avogadroNumberEstimate",
            comparisonKind: "measured-fact",
            laterEvidence: { year: 1909, description: "later evidence (1909)" },
          },
        ],
      },
    ]);
    expect(result.passed).toBe(true);
    expect(errorRules(result)).toHaveLength(0);
    logger.log({
      testId: "journey-brownian-slice-zero-errors",
      beadId: BEAD,
      extra: { family: "epistemic" },
      outcome: "passed",
      message:
        "Brownian slice journey with shelf, chain, and labeled world check passes with 0 errors",
    });
  });
});

describe("coverage, accessibility, notModeled, misconceptions", () => {
  test("PLANTED: complete paper with four misconceptions fails; GOOD: five passes", async () => {
    const four = await run([
      { kind: "paper", id: "brownian-motion", status: "complete" },
      {
        kind: "misconception-ledger",
        id: "mc-bm",
        paper: "brownian-motion",
        entries: [{}, {}, {}, {}],
      },
    ]);
    expect(errorRules(four)).toContain("misconception-minimum");
    const five = await run([
      { kind: "paper", id: "brownian-motion", status: "complete" },
      {
        kind: "misconception-ledger",
        id: "mc-bm",
        paper: "brownian-motion",
        entries: [{}, {}, {}, {}, {}],
      },
    ]);
    expect(errorRules(five)).not.toContain("misconception-minimum");
  });

  test("PLANTED: two nodes sharing an instrument without a correspondence note fail", async () => {
    const result = await run([
      {
        kind: "experiment",
        id: "bm-06",
        owner: { id: "host" },
        notModeled: ["slip"],
        views: [{ kind: "svg" }],
        actions: [{ actionId: "interval", equivalentAffordance: "enter limits" }],
        parameters: [{ id: "D" }],
      },
      node("arg-a", {
        coverageObligation: { treatment: { kind: "instrument", experimentIds: ["bm-06"] } },
      }),
      node("arg-b", {
        coverageObligation: { treatment: { kind: "instrument", experimentIds: ["bm-06"] } },
      }),
    ]);
    expect(errorRules(result)).toContain("coverage-without-owner");
  });

  test("GOOD: two nodes sharing an instrument with correspondence notes pass", async () => {
    const result = await run([
      {
        kind: "experiment",
        id: "bm-06",
        owner: { id: "host" },
        notModeled: ["slip"],
        views: [{ kind: "svg" }],
        actions: [{ actionId: "interval", equivalentAffordance: "enter limits" }],
        parameters: [{ id: "D" }],
      },
      node("arg-a", {
        coverageObligation: {
          treatment: {
            kind: "instrument",
            experimentIds: ["bm-06"],
            correspondenceNote: "Visualizes the dispersion law for passage A",
          },
        },
      }),
      node("arg-b", {
        coverageObligation: {
          treatment: {
            kind: "instrument",
            experimentIds: ["bm-06"],
            correspondenceNote: "Compares step predictions against passage B",
          },
        },
      }),
    ]);
    expect(errorRules(result)).not.toContain("coverage-without-owner");
  });

  test("PLANTED: omitted treatment without a written reason fails; GOOD: with a written reason passes", async () => {
    const noReason = await run([
      node("arg-omitted-no-reason", {
        coverageObligation: { treatment: { kind: "omitted" } },
      }),
    ]);
    expect(errorRules(noReason)).toContain("coverage-without-owner");

    const emptyReason = await run([
      node("arg-omitted-empty-reason", {
        coverageObligation: { treatment: { kind: "omitted", reason: "   " } },
      }),
    ]);
    expect(errorRules(emptyReason)).toContain("coverage-without-owner");

    const withReason = await run([
      node("arg-omitted-ok", {
        coverageObligation: {
          treatment: {
            kind: "omitted",
            reason:
              "Historical derivation is purely algebraic without a continuous simulation model.",
          },
        },
      }),
    ]);
    expect(errorRules(withReason)).not.toContain("coverage-without-owner");
  });

  test("PLANTED: instrument treatment without resolvable owner or empty experimentIds fails; GOOD: registered owner passes", async () => {
    const emptyIds = await run([
      node("arg-empty-ids", {
        coverageObligation: { treatment: { kind: "instrument", experimentIds: [] } },
      }),
    ]);
    expect(errorRules(emptyIds)).toContain("coverage-without-owner");

    const unresolvable = await run([
      node("arg-unresolvable", {
        coverageObligation: {
          treatment: { kind: "instrument", experimentIds: ["unregistered-lab"] },
        },
      }),
    ]);
    expect(errorRules(unresolvable)).toContain("coverage-without-owner");

    const ownerlessExp = await run([
      {
        kind: "experiment",
        id: "ownerless-lab",
        notModeled: ["slip"],
        views: [{ kind: "svg" }],
        actions: [{ actionId: "a", equivalentAffordance: "type" }],
        parameters: [{ id: "x" }],
      },
      node("arg-ownerless", {
        coverageObligation: { treatment: { kind: "instrument", experimentIds: ["ownerless-lab"] } },
      }),
    ]);
    expect(errorRules(ownerlessExp)).toContain("coverage-without-owner");

    const okOwned = await run([
      {
        kind: "experiment",
        id: "valid-lab",
        owner: { id: "host" },
        notModeled: ["slip"],
        views: [{ kind: "svg" }],
        actions: [{ actionId: "a", equivalentAffordance: "type" }],
        parameters: [{ id: "x" }],
      },
      node("arg-valid-owned", {
        coverageObligation: { treatment: { kind: "instrument", experimentIds: ["valid-lab"] } },
      }),
    ]);
    expect(errorRules(okOwned)).not.toContain("coverage-without-owner");
  });

  test("PLANTED: empty notModeled fails; GOOD: a listed limitation passes", async () => {
    const empty = await run([{ kind: "experiment", id: "bm-01", notModeled: [] }]);
    expect(errorRules(empty)).toContain("missing-not-modeled");
    const ok = await run([
      {
        kind: "experiment",
        id: "bm-01",
        notModeled: ["Cunningham slip"],
        views: [{ kind: "svg" }],
        actions: [{ actionId: "a", equivalentAffordance: "type" }],
        parameters: [{ id: "D" }],
      },
    ]);
    expect(errorRules(ok)).not.toContain("missing-not-modeled");
  });

  test("PLANTED: a foundation with no prose fails; GOOD: explanation paragraphs pass", async () => {
    const empty = await run([{ kind: "foundation", id: "found-empty" }]);
    expect(errorRules(empty)).toContain("missing-accessibility-alternative");
    const ok = await run([
      {
        kind: "foundation",
        id: "bridge-sum-average",
        summary: "An average distributes a total.",
        explanation: [{ kind: "paragraph", text: "Count and divide." }],
      },
    ]);
    expect(errorRules(ok)).not.toContain("missing-accessibility-alternative");
  });

  test("PLANTED: canvas view without a table/text alternative fails", async () => {
    const result = await run([
      {
        kind: "experiment",
        id: "sr-03",
        notModeled: ["optical appearance"],
        views: [{ kind: "three" }],
        actions: [{ actionId: "boost", equivalentAffordance: "enter v/c" }],
        parameters: [{ id: "vOverC" }],
      },
    ]);
    expect(errorRules(result)).toContain("missing-accessibility-alternative");
  });

  test("GOOD: canvas or Three.js view with a table/text alternative passes", async () => {
    const withTable = await run([
      {
        kind: "experiment",
        id: "sr-03-accessible",
        notModeled: ["optical appearance"],
        views: [{ kind: "three" }, { kind: "table" }],
        actions: [{ actionId: "boost", equivalentAffordance: "enter v/c" }],
        parameters: [{ id: "vOverC" }],
      },
    ]);
    expect(errorRules(withTable)).not.toContain("missing-accessibility-alternative");

    const withTextDesc = await run([
      {
        kind: "experiment",
        id: "sr-03-described",
        notModeled: ["optical appearance"],
        views: [{ kind: "canvas" }],
        textualDescription: "Tabular summary and accessible prose describing event coordinates.",
        actions: [{ actionId: "boost", equivalentAffordance: "enter v/c" }],
        parameters: [{ id: "vOverC" }],
      },
    ]);
    expect(errorRules(withTextDesc)).not.toContain("missing-accessibility-alternative");
  });
});

describe("circularity patterns", () => {
  test("PLANTED: historical BM-07 generator bound to modern-si-2019 fails", async () => {
    const result = await run([
      {
        kind: "constant-set",
        id: "modern-si-2019",
        entries: [{ quantityId: AVOGADRO_CONSTANT, dependsOn: [] }],
      },
      {
        kind: "scenario",
        id: "bm-07-historical",
        historicalMode: true,
        purpose: "molecular-number-estimation",
        constantSetId: "modern-si-2019",
        outputQuantityId: "avogadroNumberEstimate",
      },
    ]);
    expect(errorRules(result)).toContain("circular-molecular-count");
  });

  test("PLANTED: historical inference output bound to avogadroConstant fails", async () => {
    const result = await run([
      {
        kind: "scenario",
        id: "bm-07-bind-n",
        historicalMode: true,
        purpose: "molecular-number-estimation",
        constantSetId: "printed-1905",
        outputQuantityId: AVOGADRO_CONSTANT,
      },
    ]);
    expect(errorRules(result)).toContain("circular-molecular-count");
  });

  test("PLANTED: historical set whose R dependsOn modern exact N_A fails; GOOD: mixed labeled scenario is not an inference", async () => {
    const planted = await run([
      {
        kind: "constant-set",
        id: "historical-laundered",
        entries: [{ quantityId: "molarGasConstant", dependsOn: [AVOGADRO_CONSTANT] }],
      },
      {
        kind: "scenario",
        id: "bm-07-launder",
        historicalMode: true,
        purpose: "molecular-number-estimation",
        constantSetId: "historical-laundered",
        outputQuantityId: "avogadroNumberEstimate",
      },
    ]);
    expect(errorRules(planted)).toContain("circular-molecular-count");
    const mixed = await run([
      { kind: "constant-set", id: "modern-si-2019", entries: [{ quantityId: AVOGADRO_CONSTANT }] },
      {
        kind: "scenario",
        id: MIXED_DIFFUSION_SCENARIO,
        historicalMode: true,
        purpose: "molecular-number-estimation",
        constantSetId: "modern-si-2019",
      },
    ]);
    expect(errorRules(mixed)).not.toContain("circular-molecular-count");
  });

  test("PLANTED: historical mass-energy Mc^2 tree fails; GOOD: symbolic body energy passes", async () => {
    expect(
      isMc2Tree({
        kind: "product",
        factors: [
          { kind: "quantity", id: "restMass" },
          { kind: "power", base: { kind: "quantity", id: "speedOfLight" }, exponent: 2 },
        ],
      }),
    ).toBe(true);
    expect(
      isGammaMc2Tree({
        kind: "product",
        factors: [
          { kind: "quantity", id: "lorentzFactor" },
          { kind: "quantity", id: "restMass" },
          { kind: "power", base: { kind: "constant", id: "c" }, exponent: 2 },
        ],
      }),
    ).toBe(true);
    const planted = await run([
      {
        kind: "scenario",
        id: "me-mc2",
        historicalMode: true,
        quantityId: "bodyEnergyRestBefore",
        expr: {
          kind: "product",
          factors: [
            { kind: "quantity", id: "restMass" },
            { kind: "power", base: { kind: "quantity", id: "speedOfLight" }, exponent: 2 },
          ],
        },
      },
    ]);
    expect(errorRules(planted)).toContain("circular-rest-energy");
    const symbolic = await run([
      {
        kind: "scenario",
        id: "me-symbolic",
        historicalMode: true,
        quantityId: "bodyEnergyRestBefore",
        expr: { kind: "symbolic", symbols: ["E0"] },
      },
    ]);
    expect(errorRules(symbolic)).not.toContain("circular-rest-energy");
  });

  test("PLANTED: empirical-observation supported by a simulator output fails", async () => {
    const result = await run([
      node("arg-photoelectric-threshold", {
        logicalRole: "empirical-observation",
        supportKind: "simulator-output",
      }),
    ]);
    expect(errorRules(result)).toContain("simulation-as-evidence");
  });

  test("GOOD: empirical-observation supported by a cited dataset passes", async () => {
    const result = await run([
      node("arg-perrin-data", {
        logicalRole: "empirical-observation",
        supportKind: "dataset",
        evidence: [
          {
            ref: { kind: "dataset", id: "perrin-1909" },
            relation: "dataset-observation",
          },
        ],
      }),
    ]);
    expect(errorRules(result)).not.toContain("simulation-as-evidence");
  });
});

describe("approximation labeling", () => {
  test("PLANTED: contract lists an approximation while the equation is exact-within-model", async () => {
    const result = await run([
      {
        kind: "argument-node",
        id: "arg-approx",
        premises: [{ ref: { kind: "equation", id: "eq-1" }, edgeType: "historical-derivation" }],
        authoringContract: { approximationsIntroduced: [{ qualificationId: "low-speed" }] },
        meanings: { modelStatus: "exact-within-model" },
      },
    ]);
    expect(errorRules(result)).toContain("approximation-unlabeled");
    const unnamed = await run([
      {
        kind: "argument-node",
        id: "arg-unnamed",
        premises: [{ ref: { kind: "equation", id: "eq-1" }, edgeType: "historical-derivation" }],
        authoringContract: { approximationsIntroduced: [] },
        meanings: { modelStatus: "approximation" },
      },
    ]);
    expect(errorRules(unnamed)).toContain("approximation-unlabeled");
  });

  test("GOOD: approximation labeled in contract and modelStatus passes; exact with empty approximations passes", async () => {
    const agreedApprox = await run([
      {
        kind: "argument-node",
        id: "arg-approx-ok",
        premises: [{ ref: { kind: "equation", id: "eq-1" }, edgeType: "historical-derivation" }],
        authoringContract: { approximationsIntroduced: [{ qualificationId: "low-speed" }] },
        meanings: { modelStatus: "approximation" },
      },
    ]);
    expect(errorRules(agreedApprox)).not.toContain("approximation-unlabeled");

    const agreedExact = await run([
      {
        kind: "argument-node",
        id: "arg-exact-ok",
        premises: [{ ref: { kind: "equation", id: "eq-1" }, edgeType: "historical-derivation" }],
        authoringContract: { approximationsIntroduced: [] },
        meanings: { modelStatus: "exact-within-model" },
      },
    ]);
    expect(errorRules(agreedExact)).not.toContain("approximation-unlabeled");
  });
});

describe("flags", () => {
  test("translation alternatives produce a flag, the build still passes, and the fingerprint is stable", async () => {
    const unit = {
      kind: "translation-unit",
      id: "tu-s3-p1",
      unresolvedAlternatives: ["suggests", "requires"],
    };
    const first = await run([unit]);
    const second = await run([unit]);
    expect(first.passed).toBe(true);
    expect(flagRules(first)).toContain("translation-ambiguity");
    const fp1 = first.diagnostics.find((d) => d.rule === "translation-ambiguity")?.fingerprint;
    const fp2 = second.diagnostics.find((d) => d.rule === "translation-ambiguity")?.fingerprint;
    expect(fp1).toBe(fp2);
    expect(fp1).toBe(
      computeFlagFingerprint({
        rule: "translation-ambiguity",
        recordId: "tu-s3-p1",
        flaggedText: JSON.stringify(["suggests", "requires"]),
      }),
    );
    logger.log({
      testId: "flag-translation-stable",
      beadId: BEAD,
      extra: { family: "epistemic", fingerprint: fp1 },
      outcome: "passed",
      message: "translation alternatives flag; build passes; fingerprint stable",
    });
  });

  test("historical influence claims produce a flag, the build still passes, and the fingerprint is stable", async () => {
    const premise = {
      kind: "historical-premise",
      id: "hp-maxwell-velocity",
      claimsEinsteinKnew: true,
      proposition: "Einstein knew Maxwell's distribution before writing paper 2.",
    };
    const note = {
      kind: "editorial-note",
      id: "ed-influence-boltzmann",
      noteKind: "influence",
      claim: "Boltzmann gas theory directly influenced §1.",
    };
    const result = await run([premise, note]);
    expect(result.passed).toBe(true);
    expect(flagRules(result)).toContain("historical-influence-claim");

    const fp1 = result.diagnostics.find(
      (d) => d.recordId === "hp-maxwell-velocity" && d.rule === "historical-influence-claim",
    )?.fingerprint;
    const fp2 = computeFlagFingerprint({
      rule: "historical-influence-claim",
      recordId: "hp-maxwell-velocity",
      flaggedText: "Einstein knew Maxwell's distribution before writing paper 2.",
    });
    expect(fp1).toBe(fp2);

    logger.log({
      testId: "flag-historical-influence-stable",
      beadId: BEAD,
      extra: { family: "epistemic", fingerprint: fp1 },
      outcome: "passed",
      message: "historical influence claims flag for review; build passes; fingerprint stable",
    });
  });

  test("approximation claims in prose produce a flag, the build still passes, and the fingerprint is stable", async () => {
    const record = {
      kind: "argument-node",
      id: "arg-series-truncation",
      authoringContract: {
        approximationsIntroduced: [{ qualificationId: "first-order-taylor" }],
      },
      meanings: { modelStatus: "approximation" },
    };
    const result = await run([record]);
    expect(result.passed).toBe(true);
    expect(flagRules(result)).toContain("approximation-prose");

    const fp = result.diagnostics.find((d) => d.rule === "approximation-prose")?.fingerprint;
    expect(fp).toBe(
      computeFlagFingerprint({
        rule: "approximation-prose",
        recordId: "arg-series-truncation",
        flaggedText: JSON.stringify([{ qualificationId: "first-order-taylor" }]),
      }),
    );

    logger.log({
      testId: "flag-approximation-prose-stable",
      beadId: BEAD,
      extra: { family: "epistemic", fingerprint: fp },
      outcome: "passed",
      message: "approximation claims in prose flag for review; build passes; fingerprint stable",
    });
  });

  test("source disagreement notes produce a flag, the build still passes, and the fingerprint is stable", async () => {
    const disputeNote = {
      kind: "editorial-note",
      id: "ed-dispute-date",
      noteKind: "dispute",
      claim: "Cowper translates as 'speed', Beck translates as 'velocity'.",
    };
    const disagreementNote = {
      kind: "editorial-note",
      id: "ed-source-disagree",
      noteKind: "source-disagreement",
      claim: "CP2 records 1906 date while Annalen issue indicates late 1905.",
    };
    const result = await run([disputeNote, disagreementNote]);
    expect(result.passed).toBe(true);
    expect(flagRules(result)).toContain("source-disagreement");

    const fp = result.diagnostics.find(
      (d) => d.recordId === "ed-dispute-date" && d.rule === "source-disagreement",
    )?.fingerprint;
    expect(fp).toBe(
      computeFlagFingerprint({
        rule: "source-disagreement",
        recordId: "ed-dispute-date",
        flaggedText: "Cowper translates as 'speed', Beck translates as 'velocity'.",
      }),
    );

    logger.log({
      testId: "flag-source-disagreement-stable",
      beadId: BEAD,
      extra: { family: "epistemic", fingerprint: fp },
      outcome: "passed",
      message: "source disagreements flag for review; build passes; fingerprint stable",
    });
  });
});

describe("review queue artifacts and compiler integration", () => {
  test("review queue produces valid JSON artifact with all epistemic review flags", () => {
    const rawFlags: ReviewFlagItem[] = [
      {
        code: "translation-ambiguity",
        rule: "translation-ambiguity",
        recordId: "tu-s1-p1",
        flaggedText: JSON.stringify(["word-a", "word-b"]),
        message: "Translation unit has unresolved alternatives.",
      },
      {
        code: "historical-influence-claim",
        rule: "historical-influence-claim",
        recordId: "hp-influence-1",
        flaggedText: "Einstein knew Planck 1900",
        message: "Record asserts influence.",
      },
      {
        code: "approximation-prose",
        rule: "approximation-prose",
        recordId: "arg-approx-1",
        flaggedText: JSON.stringify([{ qualificationId: "small-t" }]),
        message: "Approximation claim in prose.",
      },
      {
        code: "source-disagreement",
        rule: "source-disagreement",
        recordId: "ed-note-1",
        flaggedText: "Disagreement on printed symbol",
        message: "Source disagreement noted.",
      },
    ];

    const queue = buildReviewQueue(rawFlags, new Map());
    expect(queue.openFlags.length).toBe(4);
    expect(queue.summary.openCount).toBe(4);
    expect(queue.summary.totalFlags).toBe(4);

    const parsed = JSON.parse(queue.jsonContent);
    expect(parsed.summary.openCount).toBe(4);
    expect(parsed.openFlags.map((f: { rule: string }) => f.rule)).toEqual([
      "translation-ambiguity",
      "historical-influence-claim",
      "approximation-prose",
      "source-disagreement",
    ]);
    for (const flag of parsed.openFlags) {
      expect(flag.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(flag.status).toBe("open");
    }
  });

  test("end-to-end compiler run: planted epistemic errors fail compilation with exact rule ids", async () => {
    const files = [
      {
        path: "papers/brownian-motion.json",
        text: JSON.stringify({
          kind: "paper",
          id: "brownian-motion",
          title: "Brownian Motion",
          status: "in-progress",
          sections: [],
        }),
      },
      {
        path: "arguments/brownian-motion/arg-sim.json",
        text: JSON.stringify({
          kind: "argument-node",
          id: "arg-sim",
          logicalRole: "empirical-observation",
          supportKind: "simulator-output",
        }),
      },
    ];

    clearRegisteredChecksForTests();
    registerEpistemicChecks();

    const result = await compileContent(files);
    expect(result.ok).toBe(false);
    const errorRules = result.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => d.rule ?? d.code);
    expect(errorRules).toContain("simulation-as-evidence");
  });

  test("end-to-end compiler run: clean corpus with review flags compiles ok and generates review queue", async () => {
    const files = [
      {
        path: "papers/brownian-motion.json",
        text: JSON.stringify({
          kind: "paper",
          id: "brownian-motion",
          title: "Brownian Motion",
          status: "in-progress",
          sections: [],
        }),
      },
      {
        path: "editorial-notes/brownian-motion/ed-note-clean.json",
        text: JSON.stringify({
          kind: "editorial-note",
          id: "ed-note-clean",
          noteKind: "source-disagreement",
          claim: "Translators disagree on whether 'ruhend' means 'stationary' or 'at rest'.",
        }),
      },
    ];

    clearRegisteredChecksForTests();
    registerEpistemicChecks();

    const result = await compileContent(files);
    expect(result.ok).toBe(true);
    expect(result.reviewQueue).toBeDefined();
    expect(result.reviewQueue?.openFlags.some((f) => f.rule === "source-disagreement")).toBe(true);
    if (!result.reviewQueue) throw new Error("Expected reviewQueue to be defined");
    const parsedQueue = JSON.parse(result.reviewQueue.jsonContent);
    expect(parsedQueue.openFlags.length).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  await logger.flush();
});
