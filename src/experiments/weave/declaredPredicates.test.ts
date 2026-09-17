/**
 * Fixture copies of the six predicates declared by BM-01, BM-05, and BM-06
 * (am-read-result-weave-jex's own table). These are fixtures owned by THIS bead to prove the
 * contract can express them; the instruments' own manifests declare the real predicates.
 */
import { describe, expect, test } from "bun:test";
import { createWeaveEvaluator } from "./evaluate.ts";
import type { WeaveMeaning, WeavePredicate, WeaveSnapshotView } from "./types.ts";
import { validateWeavePredicate } from "./validate.ts";

function snapshot(
  runId: string,
  snapshotVersion: number,
  outputs: Record<
    string,
    { status: WeaveSnapshotView["outputs"][string]["status"]; value?: number | string }
  >,
  constantSetId?: string,
): WeaveSnapshotView {
  return {
    runId,
    snapshotVersion,
    constantSetId,
    outputs: Object.fromEntries(
      Object.entries(outputs).map(([k, v]) => [
        k,
        { quantityId: k, status: v.status, value: v.value },
      ]),
    ),
    refused: false,
  };
}

const DECLARED: readonly (WeavePredicate & { readonly expectedMeaning: WeaveMeaning })[] = [
  {
    id: "bm01-s4-cancellation",
    instrumentId: "bm-01",
    meaning: "agreement-within-stated-bound",
    expectedMeaning: "agreement-within-stated-bound",
    conditions: [
      {
        kind: "threshold",
        quantityId: "ensembleSize",
        direction: "at-least",
        enter: 100,
        exit: 100,
      },
      {
        kind: "agreement",
        statisticQuantityId: "signedMean",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "owner-band",
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
        lowerBoundQuantityId: "signedMeanLowerBand",
        upperBoundQuantityId: "signedMeanUpperBand",
      },
      {
        kind: "agreement",
        statisticQuantityId: "meanSquare",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "owner-band",
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
        lowerBoundQuantityId: "meanSquareLowerBand",
        upperBoundQuantityId: "meanSquareUpperBand",
      },
    ],
    targets: ["bm-s4-cancellation"],
    pointerText:
      "The signed mean and the mean square agree with the model band at the stated significance level, sample size 400, seed 1905.",
  },
  {
    id: "bm01-s5-distribution-agreement",
    instrumentId: "bm-01",
    meaning: "agreement-within-stated-bound",
    expectedMeaning: "agreement-within-stated-bound",
    conditions: [
      {
        kind: "agreement",
        statisticQuantityId: "kolmogorovDistance",
        sampleCountQuantityId: "ensembleSize",
        minimumSampleSize: 100,
        boundFamily: "dkw",
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
      },
    ],
    targets: ["bm-s5-lambda-x"],
    pointerText:
      "The sampled displacement histogram agrees with the model Gaussian within the stated bound, sample size 400, seed 1905.",
  },
  {
    id: "bm01-s5-printed-numbers",
    instrumentId: "bm-01",
    meaning: "assumption-active",
    expectedMeaning: "assumption-active",
    conditions: [
      { kind: "regime", on: "constantSet", equals: "einstein-1905-brownian-printed" },
      {
        kind: "threshold",
        quantityId: "lambdaX1s",
        direction: "at-least",
        enter: 0.75,
        exit: 0.75,
      },
      { kind: "threshold", quantityId: "lambdaX60s", direction: "at-least", enter: 5.5, exit: 5.5 },
    ],
    targets: ["bm-s5-printed-numbers"],
    pointerText: "The historical constant set einstein-1905-brownian-printed is currently active.",
  },
  {
    id: "bm05-s4-second-moment",
    instrumentId: "bm-05",
    meaning: "agreement-within-stated-bound",
    expectedMeaning: "agreement-within-stated-bound",
    conditions: [
      { kind: "threshold", quantityId: "sampleSize", direction: "at-least", enter: 400, exit: 400 },
      {
        kind: "agreement",
        statisticQuantityId: "secondMomentDistance",
        sampleCountQuantityId: "sampleSize",
        minimumSampleSize: 400,
        boundFamily: "dkw",
        enterAlpha: 1e-3,
        exitAlpha: 1e-4,
        offsetQuantityId: "kolmogorovShapeTerm",
      },
    ],
    targets: ["bm05-s4-second-moment"],
    pointerText:
      "Agrees within the DKW bound plus the exact shape-term offset, sample size 2000, seed logged.",
  },
  {
    id: "bm06-s4-solution",
    instrumentId: "bm-06",
    meaning: "quantity-compared",
    expectedMeaning: "quantity-compared",
    conditions: [
      { kind: "threshold", quantityId: "t", direction: "at-least", enter: 1e-9, exit: 1e-9 },
      { kind: "status", quantityId: "intervalProbability", equals: "value" },
    ],
    targets: ["bm06-s4-solution"],
    pointerText: "This is the quantity currently being compared.",
  },
  {
    id: "bm06-s4-grid-agreement",
    instrumentId: "bm-06",
    meaning: "agreement-within-stated-bound",
    expectedMeaning: "agreement-within-stated-bound",
    conditions: [
      { kind: "regime", on: "ftcsEnabled", equals: "true" },
      { kind: "regime", on: "wallContact", equals: "false" },
      {
        kind: "threshold",
        quantityId: "maxCellMassDifference",
        direction: "at-most",
        enter: 1e-3,
        exit: 2e-3,
      },
    ],
    targets: ["bm06-s4-grid-agreement"],
    pointerText: "The grid solution agrees with the model within the stated cell-mass tolerance.",
  },
];

const ctx = {
  instrumentOutputIds: new Set(
    DECLARED.flatMap((p) =>
      p.conditions.flatMap((c) => {
        if (c.kind === "threshold" || c.kind === "status") return [c.quantityId];
        if (c.kind === "regime") return c.on === "constantSet" ? [] : [c.on];
        return [
          c.statisticQuantityId,
          c.sampleCountQuantityId,
          ...(c.offsetQuantityId ? [c.offsetQuantityId] : []),
          ...(c.lowerBoundQuantityId ? [c.lowerBoundQuantityId] : []),
          ...(c.upperBoundQuantityId ? [c.upperBoundQuantityId] : []),
        ];
      }),
    ),
  ),
  resolvableTargetIds: new Set(DECLARED.flatMap((p) => p.targets)),
};

describe("declared predicates: fixture copies of the six BM-01/BM-05/BM-06 predicates validate and carry the mapped meaning", () => {
  for (const predicate of DECLARED) {
    test(`${predicate.id} validates and carries meaning ${predicate.expectedMeaning}`, () => {
      const { expectedMeaning, ...raw } = predicate;
      void expectedMeaning;
      const validated = validateWeavePredicate(raw, ctx);
      expect(validated.meaning).toBe(predicate.expectedMeaning);
    });
  }
});

function mustFind(id: string): WeavePredicate {
  const predicate = DECLARED.find((p) => p.id === id);
  if (!predicate) throw new Error(`Missing declared predicate fixture "${id}"`);
  return predicate;
}

describe("declared predicates evaluate on scripted snapshot sequences", () => {
  test("bm01-s5-distribution-agreement lights at M=400 within bound and stays unlit at M=99", () => {
    const predicate = mustFind("bm01-s5-distribution-agreement");
    const evaluator = createWeaveEvaluator([predicate]);
    const lit = evaluator.evaluate(
      snapshot("run-1", 1, {
        kolmogorovDistance: { status: "value", value: 0.05 },
        ensembleSize: { status: "value", value: 400 },
      }),
    );
    expect(lit.flags["bm01-s5-distribution-agreement"]?.lit).toBe(true);

    const evaluator2 = createWeaveEvaluator([predicate]);
    const unlit = evaluator2.evaluate(
      snapshot("run-1", 1, {
        kolmogorovDistance: { status: "value", value: 0.05 },
        ensembleSize: { status: "value", value: 99 },
      }),
    );
    expect(unlit.flags["bm01-s5-distribution-agreement"]?.lit).toBe(false);
    expect(unlit.flags["bm01-s5-distribution-agreement"]?.state).toBe("not-evaluable");
  });

  test("bm01-s5-printed-numbers lights only under the historical constant set with numbers in the printed range", () => {
    const predicate = mustFind("bm01-s5-printed-numbers");
    const evaluator = createWeaveEvaluator([predicate]);
    const lit = evaluator.evaluate(
      snapshot(
        "run-1",
        1,
        {
          lambdaX1s: { status: "value", value: 0.7947833 },
          lambdaX60s: { status: "value", value: 6.156365 },
        },
        "einstein-1905-brownian-printed",
      ),
    );
    expect(lit.flags["bm01-s5-printed-numbers"]?.lit).toBe(true);

    const evaluator2 = createWeaveEvaluator([predicate]);
    const unlitUnderModern = evaluator2.evaluate(
      snapshot(
        "run-1",
        1,
        {
          lambdaX1s: { status: "value", value: 0.7935339 },
          lambdaX60s: { status: "value", value: 6.146687 },
        },
        "modern-si-2019",
      ),
    );
    expect(unlitUnderModern.flags["bm01-s5-printed-numbers"]?.lit).toBe(false);
  });

  test("bm06-s4-grid-agreement lights within tolerance and clears beyond it", () => {
    const predicate = mustFind("bm06-s4-grid-agreement");
    const evaluator = createWeaveEvaluator([predicate]);
    const lit = evaluator.evaluate(
      snapshot("run-1", 1, {
        ftcsEnabled: { status: "value", value: "true" },
        wallContact: { status: "value", value: "false" },
        maxCellMassDifference: { status: "value", value: 5e-4 },
      }),
    );
    expect(lit.flags["bm06-s4-grid-agreement"]?.lit).toBe(true);

    const exited = evaluator.evaluate(
      snapshot("run-1", 2, {
        ftcsEnabled: { status: "value", value: "true" },
        wallContact: { status: "value", value: "false" },
        maxCellMassDifference: { status: "value", value: 3e-3 },
      }),
    );
    expect(exited.flags["bm06-s4-grid-agreement"]?.lit).toBe(false);
  });
});
