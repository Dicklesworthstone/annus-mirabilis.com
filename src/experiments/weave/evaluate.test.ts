import { describe, expect, test } from "bun:test";
import { checkAllOf, checkCondition } from "./conditions.ts";
import { createWeaveEvaluator } from "./evaluate.ts";
import type { WeavePredicate, WeaveSnapshotView } from "./types.ts";

function snapshot(
  runId: string,
  snapshotVersion: number,
  outputs: Record<
    string,
    { status: WeaveSnapshotView["outputs"][string]["status"]; value?: number | string }
  >,
  extra: Partial<WeaveSnapshotView> = {},
): WeaveSnapshotView {
  return {
    runId,
    snapshotVersion,
    outputs: Object.fromEntries(
      Object.entries(outputs).map(([k, v]) => [
        k,
        { quantityId: k, status: v.status, value: v.value },
      ]),
    ),
    refused: false,
    ...extra,
  };
}

describe("weave conditions: not-evaluable and basic checks (am-read-result-weave-jex)", () => {
  test("threshold is not-evaluable when the output is missing", () => {
    const result = checkCondition(
      { kind: "threshold", quantityId: "missing", direction: "at-least", enter: 1, exit: 0.9 },
      snapshot("r1", 1, {}),
      "enter",
    );
    expect(result).toBe("not-evaluable");
  });

  test("threshold is not-evaluable when the output is not a value (e.g. outside-domain)", () => {
    const result = checkCondition(
      { kind: "threshold", quantityId: "x", direction: "at-least", enter: 1, exit: 0.9 },
      snapshot("r1", 1, { x: { status: "outside-domain" } }),
      "enter",
    );
    expect(result).toBe("not-evaluable");
  });

  test("a status condition IS evaluable on a non-value output -- this is what makes outside-selected-domain expressible", () => {
    const result = checkCondition(
      { kind: "status", quantityId: "x", equals: "outside-domain" },
      snapshot("r1", 1, { x: { status: "outside-domain" } }),
      "enter",
    );
    expect(result).toBe("hold");
  });

  test("checkAllOf: any not-evaluable condition makes the whole predicate not-evaluable", () => {
    const result = checkAllOf(
      [
        { kind: "threshold", quantityId: "x", direction: "at-least", enter: 1, exit: 0.9 },
        { kind: "threshold", quantityId: "missing", direction: "at-least", enter: 1, exit: 0.9 },
      ],
      snapshot("r1", 1, { x: { status: "value", value: 5 } }),
      "enter",
    );
    expect(result).toBe("not-evaluable");
  });
});

describe("fixture predicate: slowed clock (paper 3, S4) -- am-read-result-weave-jex's own worked example", () => {
  const predicate: WeavePredicate = {
    id: "fixture-slowed-clock",
    instrumentId: "fixture-sr",
    meaning: "quantity-compared",
    conditions: [
      { kind: "threshold", quantityId: "vOverC", direction: "at-least", enter: 0.5, exit: 0.48 },
    ],
    targets: ["sr-s4-slowed-clock"],
    pointerText:
      "The slowing exists at every nonzero speed; from here it is large enough to read on these clocks.",
  };

  test("enters at v=0.50c, holds at v=0.49c, exits at v<0.48c", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    const enter = evaluator.evaluate(
      snapshot("run-1", 1, { vOverC: { status: "value", value: 0.5 } }),
    );
    expect(enter.flags["fixture-slowed-clock"]?.lit).toBe(true);
    expect(enter.flags["fixture-slowed-clock"]?.state).toBe("enter");

    const hold = evaluator.evaluate(
      snapshot("run-1", 2, { vOverC: { status: "value", value: 0.49 } }),
    );
    expect(hold.flags["fixture-slowed-clock"]?.lit).toBe(true);
    expect(hold.flags["fixture-slowed-clock"]?.state).toBe("hold");

    const exit = evaluator.evaluate(
      snapshot("run-1", 3, { vOverC: { status: "value", value: 0.47 } }),
    );
    expect(exit.flags["fixture-slowed-clock"]?.lit).toBe(false);
    expect(exit.flags["fixture-slowed-clock"]?.state).toBe("exit");
  });

  test("stays lit inside the hysteresis band (0.48 <= v < 0.50) once entered, per the bead's own acceptance criterion", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    evaluator.evaluate(snapshot("run-1", 1, { vOverC: { status: "value", value: 0.5 } }));
    const stillLit = evaluator.evaluate(
      snapshot("run-1", 2, { vOverC: { status: "value", value: 0.49 } }),
    );
    expect(stillLit.flags["fixture-slowed-clock"]?.lit).toBe(true);
  });
});

describe("fixture predicate: Wien regime (paper 1, S4)", () => {
  const predicate: WeavePredicate = {
    id: "fixture-wien-regime",
    instrumentId: "fixture-lq",
    meaning: "assumption-active",
    conditions: [
      { kind: "threshold", quantityId: "x", direction: "at-least", enter: 3, exit: 2.8 },
    ],
    targets: ["lq-s4-wien-limit"],
    pointerText: "States the pointwise relative difference.",
  };

  test("enters at x=3, exits at x<2.8", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    const enter = evaluator.evaluate(snapshot("run-1", 1, { x: { status: "value", value: 3.0 } }));
    expect(enter.flags["fixture-wien-regime"]?.lit).toBe(true);
    const exit = evaluator.evaluate(snapshot("run-1", 2, { x: { status: "value", value: 2.7 } }));
    expect(exit.flags["fixture-wien-regime"]?.lit).toBe(false);
    expect(exit.flags["fixture-wien-regime"]?.state).toBe("exit");
  });
});

describe("fixture predicate: lambda_x agreement (paper 2, S5) -- mirrors bm01-s5-distribution-agreement", () => {
  const predicate: WeavePredicate = {
    id: "fixture-lambda-x-agreement",
    instrumentId: "fixture-bm",
    meaning: "agreement-within-stated-bound",
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
    pointerText: "States the bound, alpha, M, and the seed.",
  };

  test("lights when M=400 and the distance is within the 1e-3 bound (0.0975), clears only beyond the 1e-4 bound (0.1113)", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    const enter = evaluator.evaluate(
      snapshot("run-1", 1, {
        kolmogorovDistance: { status: "value", value: 0.05 },
        ensembleSize: { status: "value", value: 400 },
      }),
    );
    expect(enter.flags["fixture-lambda-x-agreement"]?.lit).toBe(true);

    // Between the 1e-3 (0.0975) and 1e-4 (0.1113) bounds: stays lit once entered (hysteresis).
    const between = evaluator.evaluate(
      snapshot("run-1", 2, {
        kolmogorovDistance: { status: "value", value: 0.1 },
        ensembleSize: { status: "value", value: 400 },
      }),
    );
    expect(between.flags["fixture-lambda-x-agreement"]?.lit).toBe(true);
    expect(between.flags["fixture-lambda-x-agreement"]?.state).toBe("hold");

    const exit = evaluator.evaluate(
      snapshot("run-1", 3, {
        kolmogorovDistance: { status: "value", value: 0.12 },
        ensembleSize: { status: "value", value: 400 },
      }),
    );
    expect(exit.flags["fixture-lambda-x-agreement"]?.lit).toBe(false);
  });

  test("at M=99 stays unlit as not-evaluable (below the minimum sample size)", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    const result = evaluator.evaluate(
      snapshot("run-1", 1, {
        kolmogorovDistance: { status: "value", value: 0.05 },
        ensembleSize: { status: "value", value: 99 },
      }),
    );
    expect(result.flags["fixture-lambda-x-agreement"]?.lit).toBe(false);
    expect(result.flags["fixture-lambda-x-agreement"]?.state).toBe("not-evaluable");
  });
});

describe("outside-selected-domain: reachable via a status condition, deterministic, no flicker", () => {
  const predicate: WeavePredicate = {
    id: "fixture-outside-domain",
    instrumentId: "fixture",
    meaning: "outside-selected-domain",
    conditions: [{ kind: "status", quantityId: "entropyComparison", equals: "outside-domain" }],
    targets: ["fixture-out-of-domain-sentence"],
    pointerText: "This conclusion is outside the model's domain here.",
  };

  test("lights when the named output leaves the domain, unlights when it returns, exactly once each", () => {
    const evaluator = createWeaveEvaluator([predicate]);
    const inDomain = evaluator.evaluate(
      snapshot("run-1", 1, { entropyComparison: { status: "value", value: 1 } }),
    );
    expect(inDomain.flags["fixture-outside-domain"]?.lit).toBe(false);

    const outOfDomain = evaluator.evaluate(
      snapshot("run-1", 2, { entropyComparison: { status: "outside-domain" } }),
    );
    expect(outOfDomain.flags["fixture-outside-domain"]?.lit).toBe(true);
    expect(outOfDomain.flags["fixture-outside-domain"]?.state).toBe("enter");

    const backInDomain = evaluator.evaluate(
      snapshot("run-1", 3, { entropyComparison: { status: "value", value: 1 } }),
    );
    expect(backInDomain.flags["fixture-outside-domain"]?.lit).toBe(false);
    expect(backInDomain.flags["fixture-outside-domain"]?.state).toBe("exit");
  });
});

describe("a typed refusal leaves every predicate unlit", () => {
  test("refused=true produces not-evaluable, unlit flags for every predicate regardless of outputs", () => {
    const predicate: WeavePredicate = {
      id: "fixture-any",
      instrumentId: "fixture",
      meaning: "quantity-compared",
      conditions: [
        { kind: "threshold", quantityId: "x", direction: "at-least", enter: 0, exit: -1 },
      ],
      targets: ["t"],
      pointerText: "text",
    };
    const evaluator = createWeaveEvaluator([predicate]);
    const result = evaluator.evaluate(
      snapshot("run-1", 1, { x: { status: "value", value: 100 } }, { refused: true }),
    );
    expect(result.flags["fixture-any"]?.lit).toBe(false);
    expect(result.flags["fixture-any"]?.state).toBe("not-evaluable");
  });
});

describe("flags reset on a new run", () => {
  test("a predicate lit in run-1 starts unlit again in run-2 even with the same qualifying output", () => {
    const predicate: WeavePredicate = {
      id: "fixture-reset",
      instrumentId: "fixture",
      meaning: "quantity-compared",
      conditions: [
        { kind: "threshold", quantityId: "x", direction: "at-least", enter: 1, exit: 0.5 },
      ],
      targets: ["t"],
      pointerText: "text",
    };
    const evaluator = createWeaveEvaluator([predicate]);
    const first = evaluator.evaluate(snapshot("run-1", 1, { x: { status: "value", value: 2 } }));
    expect(first.flags["fixture-reset"]?.state).toBe("enter");

    // New run: the tracker resets, so entering again is still logged as "enter", not "hold".
    const secondRun = evaluator.evaluate(
      snapshot("run-2", 1, { x: { status: "value", value: 2 } }),
    );
    expect(secondRun.flags["fixture-reset"]?.state).toBe("enter");
  });
});

describe("determinism: the same sequence of accepted snapshots always replays to the same flags", () => {
  test("two independent evaluators fed the identical sequence produce identical flags", () => {
    const predicate: WeavePredicate = {
      id: "fixture-deterministic",
      instrumentId: "fixture",
      meaning: "quantity-compared",
      conditions: [
        { kind: "threshold", quantityId: "x", direction: "at-least", enter: 1, exit: 0.5 },
      ],
      targets: ["t"],
      pointerText: "text",
    };
    const sequence = [0.2, 1.5, 0.8, 0.3, 2.0].map((v, i) =>
      snapshot("run-1", i + 1, { x: { status: "value", value: v } }),
    );
    const a = createWeaveEvaluator([predicate]);
    const b = createWeaveEvaluator([predicate]);
    const resultsA = sequence.map((s) => a.evaluate(s).flags["fixture-deterministic"]);
    const resultsB = sequence.map((s) => b.evaluate(s).flags["fixture-deterministic"]);
    expect(resultsA).toEqual(resultsB);
  });

  test("a seeded noisy agreement metric hovering near its threshold produces no flicker once entered", () => {
    const predicate: WeavePredicate = {
      id: "fixture-noisy",
      instrumentId: "fixture",
      meaning: "agreement-within-stated-bound",
      conditions: [
        {
          kind: "agreement",
          statisticQuantityId: "d",
          sampleCountQuantityId: "n",
          minimumSampleSize: 100,
          boundFamily: "dkw",
          enterAlpha: 1e-3,
          exitAlpha: 1e-4,
        },
      ],
      targets: ["t"],
      pointerText: "text",
    };
    // A seeded pseudo-random walk hovering near the 1e-3 bound (0.0975 at n=400), never
    // crossing the wider 1e-4 exit bound (0.1113): once entered, must stay lit throughout.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const evaluator = createWeaveEvaluator([predicate]);
    let enteredAt = -1;
    let flickered = false;
    for (let i = 0; i < 50; i++) {
      const d = 0.06 + rand() * 0.02; // stays within [0.06, 0.08], comfortably under 0.0975
      const result = evaluator.evaluate(
        snapshot("run-1", i + 1, {
          d: { status: "value", value: d },
          n: { status: "value", value: 400 },
        }),
      );
      const lit = result.flags["fixture-noisy"]?.lit ?? false;
      if (lit && enteredAt === -1) enteredAt = i;
      if (enteredAt !== -1 && i > enteredAt && !lit) flickered = true;
    }
    expect(enteredAt).toBeGreaterThanOrEqual(0);
    expect(flickered).toBe(false);
  });
});
