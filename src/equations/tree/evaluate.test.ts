/**
 * Unit tests for numerical spot-check evaluation and admissible-point sampling.
 * Specified in am-eq-expression-tree-8kl (Test Plan: evaluate.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { expectClose } from "../../testing/log/assertions.ts";
import { evaluateForSpotCheck } from "./evaluateForSpotCheck.ts";
import { FIXTURE_3_DISPLACEMENT } from "./fixtures.ts";
import { sampleAdmissiblePoint } from "./sampleAdmissiblePoint.ts";
import type { Expression } from "./types.ts";

describe("Numerical Spot-Check Evaluator and Sampler (evaluate.test.ts)", () => {
  test("sqrt(2Dt) with D = 4.3e-13 and t = 1 s gives 9.273618e-7 m within relative 1e-12", () => {
    const dVal = 4.3e-13;
    const tVal = 1.0;
    const expected = Math.sqrt(2 * dVal * tVal); // Math.sqrt(8.6e-13) ~ 9.273618495495704e-7

    const res = evaluateForSpotCheck(FIXTURE_3_DISPLACEMENT.root, {
      "eq-bm-disp.t.d": dVal,
      "eq-bm-disp.t.t": tVal,
    });

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(
        res.value,
        expected,
        { relative: 1e-12 },
        {
          suite: "equations-tree",
          testId: "evaluate-sqrt-2dt",
          beadId: "am-eq-expression-tree-8kl",
        },
      );
    }
  });

  test("ln of a negative value returns outside-domain naming the node", () => {
    const tree: Expression = {
      kind: "function",
      opId: "eq-test.op.badLn",
      name: "ln",
      argument: { kind: "number", value: "-5" },
    };

    const res = evaluateForSpotCheck(tree, {});
    expect(res.status).toBe("outside-domain");
    if (res.status === "outside-domain") {
      expect(res.nodeId).toBe("eq-test.op.badLn");
      expect(res.reason).toContain("ln of nonpositive argument");
    }
  });

  test("division by zero returns outside-domain naming the node", () => {
    const tree: Expression = {
      kind: "quotient",
      opId: "eq-test.op.divZero",
      numerator: { kind: "number", value: "10" },
      denominator: { kind: "number", value: "0" },
    };

    const res = evaluateForSpotCheck(tree, {});
    expect(res.status).toBe("outside-domain");
    if (res.status === "outside-domain") {
      expect(res.nodeId).toBe("eq-test.op.divZero");
      expect(res.reason).toContain("division by zero");
    }
  });

  test("an unsupported node returns unsupported-node", () => {
    const tree: Expression = {
      kind: "textAnnotation",
      opId: "eq-test.op.annotation",
      text: "konst.",
    };

    const res = evaluateForSpotCheck(tree, {});
    expect(res.status).toBe("unsupported-node");
    if (res.status === "unsupported-node") {
      expect(res.nodeId).toBe("eq-test.op.annotation");
      expect(res.kind).toBe("textAnnotation");
    }
  });

  test("sampleAdmissiblePoint never produces a nonpositive radius or temperature in 10,000 draws from a fixed seed", () => {
    const tree: Expression = {
      kind: "sum",
      args: [
        {
          kind: "symbol",
          termId: "eq-test.t.rad",
          quantityId: "particleRadius",
        },
        {
          kind: "symbol",
          termId: "eq-test.t.temp",
          quantityId: "temperature",
        },
      ],
    };

    const seedBase = 123456789n;
    for (let i = 0; i < 10000; i++) {
      const point = sampleAdmissiblePoint(tree, null, seedBase + BigInt(i));
      const rad = point.assignments["eq-test.t.rad"];
      const temp = point.assignments["eq-test.t.temp"];

      if (rad === undefined || rad <= 0) {
        throw new Error(`Draw ${i} produced nonpositive radius: ${rad}`);
      }
      if (temp === undefined || temp <= 0) {
        throw new Error(`Draw ${i} produced nonpositive temperature: ${temp}`);
      }
    }
  });
});
