import { describe, expect, test } from "bun:test";
import type { Expression } from "../ast.ts";
import { parseEquationRecord } from "../record.ts";
import {
  type BrownianPredictionInput,
  brownianPredictionCheckRows,
  brownianPredictionEquations,
  brownianPredictionInput,
  brownianPredictionRecords,
} from "./brownianPrediction.ts";
import { verifyBrownianPrediction } from "./brownianPredictionProof.ts";

function rewrite(expression: Expression, edit: (node: Expression) => Expression): Expression {
  const child = (node: Expression) => rewrite(node, edit);
  let mapped = expression;
  switch (expression.kind) {
    case "sum":
    case "product":
      mapped = { ...expression, args: expression.args.map(child) };
      break;
    case "quotient":
      mapped = {
        ...expression,
        numerator: child(expression.numerator),
        denominator: child(expression.denominator),
      };
      break;
    case "power":
      mapped = { ...expression, base: child(expression.base) };
      break;
    case "root":
      mapped = { ...expression, radicand: child(expression.radicand) };
      break;
    case "relation":
      mapped = { ...expression, left: child(expression.left), right: child(expression.right) };
      break;
  }
  return edit(mapped);
}

function changed(
  key: keyof BrownianPredictionInput,
  edit: (node: Expression) => Expression,
): BrownianPredictionInput {
  return { ...brownianPredictionInput, [key]: rewrite(brownianPredictionInput[key], edit) };
}

describe("Brownian historical displacement join", () => {
  test("the actual records parse and conclude with the canonical combined prediction", () => {
    const records = brownianPredictionRecords.map((record) =>
      parseEquationRecord(record, record.id),
    );
    expect(records.map((record) => record.id)).toEqual([
      "eq-model-bm-diffusivity-molar",
      "eq-model-bm-rms",
      "eq-model-bm-predicted-displacement",
    ]);
    const conclusion = records[2];
    if (!conclusion) throw new Error("Expected the canonical combined prediction.");
    expect(conclusion.argument).toBe("arg-bm-inference");
    expect(verifyBrownianPrediction().passed).toBe(true);
    expect(verifyBrownianPrediction().rows).toEqual(
      brownianPredictionCheckRows.map(({ id }) => ({ id, passed: true })),
    );
  });

  test("displayed substitution and collection are connected to those same input trees", () => {
    const steps = brownianPredictionEquations();
    expect(steps.substituted.kind).toBe("relation");
    expect(steps.collected.kind).toBe("relation");
    expect(steps.prediction.kind).toBe("relation");
    const report = verifyBrownianPrediction();
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  test("occurrence labels and the order of rational factors do not change the quantities", () => {
    const input = Object.fromEntries(
      Object.entries(brownianPredictionInput).map(([key, expression]) => [
        key,
        rewrite(expression, (node) => {
          if (node.kind === "symbol") return { ...node, termId: `renamed.${node.termId}` };
          if (node.kind === "product" && key === "diffusivity")
            return { ...node, args: [...node.args].reverse() };
          return node;
        }),
      ]),
    ) as unknown as BrownianPredictionInput;
    expect(verifyBrownianPrediction(input).passed).toBe(true);
  });

  test("a molecular-number estimate cannot replace the forward input N", () => {
    const input = changed("diffusivity", (node) =>
      node.kind === "symbol" && node.quantityId === "avogadroConstant"
        ? { ...node, quantityId: "avogadroNumberEstimate" }
        : node,
    );
    expect(verifyBrownianPrediction(input).passed).toBe(false);
  });

  test("the radius cannot silently become a diameter", () => {
    const input = changed("prediction", (node) =>
      node.kind === "symbol" && node.quantityId === "particleRadius"
        ? { ...node, quantityId: "particleDiameter" }
        : node,
    );
    expect(verifyBrownianPrediction(input).passed).toBe(false);
  });

  test("the RMS and elapsed interval keep their one-coordinate meanings", () => {
    for (const [from, to] of [
      ["rmsDisplacement1d", "rmsDisplacementRadial"],
      ["observationInterval", "timeCoordinate"],
    ] as const) {
      const input = changed("rms", (node) =>
        node.kind === "symbol" && node.quantityId === from ? { ...node, quantityId: to } : node,
      );
      expect(verifyBrownianPrediction(input).passed).toBe(false);
    }
  });

  test("changing the admitted drag coefficient does not get certified as the same model", () => {
    const input = changed("diffusivity", (node) =>
      node.kind === "number" && node.value === "6" ? { ...node, value: "3" } : node,
    );
    const report = verifyBrownianPrediction(input);
    expect(report.passed).toBe(false);
    expect(report.rows.find((row) => row.id === "canonical-model-laws")?.passed).toBe(false);
  });

  test("a missing factor of two in the combined prediction is caught at the join", () => {
    const input = changed("prediction", (node) =>
      node.kind === "number" && node.value === "3" ? { ...node, value: "6" } : node,
    );
    const report = verifyBrownianPrediction(input);
    expect(report.rows.find((row) => row.id === "canonical-model-laws")?.passed).toBe(true);
    expect(report.rows.find((row) => row.id === "collect-two-over-six")?.passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  test("the time root cannot become linear time", () => {
    const input = changed("prediction", (node) =>
      node.kind === "root" &&
      node.radicand.kind === "symbol" &&
      node.radicand.quantityId === "observationInterval"
        ? {
            ...node,
            radicand: { kind: "power", base: node.radicand, exponent: { num: 2, den: 1 } },
          }
        : node,
    );
    expect(verifyBrownianPrediction(input).passed).toBe(false);
  });

  test("a different root branch or degree is outside this RMS derivation", () => {
    // The canonical root-product admission rejects this degree (brownianPrediction.ts:106).
    const input = changed("prediction", (node) =>
      node.kind === "root" ? { ...node, degree: 3 } : node,
    );
    expect(verifyBrownianPrediction(input)).toMatchObject({
      passed: false,
      refusalCode: "brownian-prediction-expression",
    });
    const rms = brownianPredictionInput.rms;
    if (rms.kind !== "relation") throw new Error("Expected the canonical RMS equality.");
    expect(
      verifyBrownianPrediction({
        ...brownianPredictionInput,
        rms: {
          ...rms,
          right: { kind: "product", args: [{ kind: "number", value: "-1" }, rms.right] },
        },
      }).passed,
    ).toBe(false);
  });

  test("an evaluated or indexed quantity is not merged into a bare scalar", () => {
    // The scalar-identity guard rejects this index (brownianPredictionProof.ts:114).
    const input = changed("diffusivity", (node) =>
      node.kind === "symbol" && node.quantityId === "temperature"
        ? { ...node, index: "initial" }
        : node,
    );
    expect(verifyBrownianPrediction(input)).toMatchObject({
      passed: false,
      refusalCode: "brownian-prediction-expression",
    });
  });

  test("cancellation cannot conceal a pole or exclude the allowed zero-time limit", () => {
    // These divisors fail before any cancellation (brownianPredictionProof.ts:295).
    const variable = (quantityId: string): Expression => ({
      kind: "symbol",
      quantityId,
      termId: `test.${quantityId}`,
    });
    const difference: Expression = {
      kind: "sum",
      args: [
        variable("molarGasConstant"),
        { kind: "product", args: [{ kind: "number", value: "-1" }, variable("temperature")] },
      ],
    };
    const zero: Expression = { kind: "number", value: "0" };
    for (const divisor of [difference, zero, variable("observationInterval")]) {
      const prediction = brownianPredictionInput.prediction;
      if (prediction.kind !== "relation" || prediction.right.kind !== "product")
        throw new Error("Expected the canonical product of roots.");
      const [timeRoot, materialRoot] = prediction.right.args;
      if (!timeRoot || !materialRoot || materialRoot.kind !== "root")
        throw new Error("Expected both the time and material roots.");
      const input: BrownianPredictionInput = {
        ...brownianPredictionInput,
        prediction: {
          ...prediction,
          right: {
            ...prediction.right,
            args: [
              timeRoot,
              {
                ...materialRoot,
                radicand: {
                  kind: "product",
                  args: [
                    materialRoot.radicand,
                    { kind: "quotient", numerator: divisor, denominator: divisor },
                  ],
                },
              },
            ],
          },
        },
      };
      expect(verifyBrownianPrediction(input)).toMatchObject({
        passed: false,
        refusalCode: "brownian-prediction-expression",
      });
    }
  });

  test("malformed authored nodes fail before any symbolic substitution", () => {
    expect(verifyBrownianPrediction().passed).toBe(true);
    const badRightSides: readonly {
      readonly label: string;
      readonly right: unknown;
      readonly reason: string;
    }[] = [
      // Plain-node admission (brownianPredictionProof.ts:85).
      { label: "absent node", right: null, reason: "plain authored node" },
      // Decimal coefficients must be bounded text (brownianPredictionProof.ts:93).
      {
        label: "coefficient without decimal text",
        right: { kind: "number", value: 6 },
        reason: "bounded decimal strings",
      },
      {
        label: "overlong exact coefficient",
        right: { kind: "number", value: "1".repeat(129) },
        reason: "bounded decimal strings",
      },
      {
        label: "infinite constant",
        // The only admitted finite named constant is pi (brownianPredictionProof.ts:100).
        right: { kind: "constant", name: "infinity" },
        reason: "finite constant pi",
      },
      // Arity is validated before traversal (brownianPredictionProof.ts:122).
      { label: "empty product", right: { kind: "product", args: [] }, reason: "bounded arguments" },
      {
        label: "oversized sum",
        right: {
          kind: "sum",
          args: Array.from({ length: 65 }, () => ({ kind: "number", value: "1" })),
        },
        reason: "bounded arguments",
      },
      {
        label: "zero exponent denominator",
        // A rational exponent cannot have a zero denominator (brownianPredictionProof.ts:139).
        right: {
          kind: "power",
          base: { kind: "number", value: "1" },
          exponent: { num: 1, den: 0 },
        },
        reason: "exact rational exponent",
      },
      {
        label: "zero-degree root",
        // Root degree must be a positive integer (brownianPredictionProof.ts:147).
        right: { kind: "root", degree: 0, radicand: { kind: "number", value: "1" } },
        reason: "positive integer degree",
      },
      {
        label: "unsupported operation",
        // Unadmitted operations cannot reach projection (brownianPredictionProof.ts:163).
        right: { kind: "negate", argument: { kind: "number", value: "1" } },
        reason: "outside the displacement derivation",
      },
    ];
    const law = brownianPredictionInput.diffusivity;
    if (law.kind !== "relation") throw new Error("Expected the canonical diffusivity equality.");
    for (const fixture of badRightSides) {
      const report = verifyBrownianPrediction({
        ...brownianPredictionInput,
        diffusivity: { ...law, right: fixture.right as Expression },
      });
      expect(report.passed, fixture.label).toBe(false);
      expect(report.refusalCode, fixture.label).toBe("brownian-prediction-expression");
      expect(report.reason, fixture.label).toContain(fixture.reason);
      expect(report.rows, fixture.label).toEqual([]);
      expect(report.reconstruction, fixture.label).toBeUndefined();
    }
  });

  test("accessors are refused without executing authored code", () => {
    // The same plain-node guard rejects an accessor without reading it (brownianPredictionProof.ts:85).
    let evaluated = false;
    const node: Expression = {
      kind: "number",
      get value() {
        evaluated = true;
        return "6";
      },
    };
    const law = brownianPredictionInput.diffusivity;
    if (law.kind !== "relation") throw new Error("Expected the canonical diffusivity equality.");
    const report = verifyBrownianPrediction({
      ...brownianPredictionInput,
      diffusivity: { ...law, right: node },
    });
    expect(report.refusalCode).toBe("brownian-prediction-expression");
    expect(report.reason).toContain("plain authored node");
    expect(evaluated).toBe(false);
  });

  test("a relation that only claims approximation is not an admitted exact law", () => {
    // Equality admission is checked before children (brownianPredictionProof.ts:155).
    const input = changed("rms", (node) =>
      node.kind === "relation" ? { ...node, operator: "approx" } : node,
    );
    const report = verifyBrownianPrediction(input);
    expect(report.refusalCode).toBe("brownian-prediction-expression");
    expect(report.reason).toContain("exact equalities");
    expect(report.passed).toBe(false);
  });

  test("an absent premise or extra input cannot receive a partial proof", () => {
    // The complete input record is required (brownianPredictionProof.ts:176).
    for (const input of [
      { diffusivity: brownianPredictionInput.diffusivity, rms: brownianPredictionInput.rms },
      { ...brownianPredictionInput, extra: brownianPredictionInput.rms },
    ]) {
      const report = verifyBrownianPrediction(input as BrownianPredictionInput);
      expect(report.refusalCode).toBe("brownian-prediction-expression");
      expect(report.reason).toContain("Supply the diffusivity, RMS law and combined prediction");
      expect(report.rows).toEqual([]);
      expect(report.passed).toBe(false);
    }
  });

  test("authored depth is bounded before symbol projection and rational checking", () => {
    // The typed expression-budget guard precedes all recursive algebra (brownianPredictionProof.ts:83).
    const law = brownianPredictionInput.diffusivity;
    if (law.kind !== "relation") throw new Error("Expected the canonical diffusivity equality.");
    let right = law.right;
    for (let index = 0; index < 40; index += 1)
      right = { kind: "power", base: right, exponent: { num: 1, den: 1 } };
    expect(
      verifyBrownianPrediction({ ...brownianPredictionInput, diffusivity: { ...law, right } }),
    ).toMatchObject({ passed: false, refusalCode: "brownian-prediction-budget" });
  });
});
