import { describe, expect, test } from "bun:test";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  estimateIncrements,
  estimatorInterval,
  invertToMolecularNumber,
} from "../../physics/reference/inference.ts";
import { type AnswerVerdict, checkExerciseAnswer, snapshotExercise } from "../exercises/answer.ts";
import { evaluate } from "../exercises/evaluate.ts";
import { parse } from "../exercises/grammar.ts";
import { MOLECULAR_NUMBER_EXERCISE as part } from "./molecularNumberExercise.ts";

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("recovering the molecular number from one-axis spread", () => {
  test("the exercise retains every variable's dimensions and the radius condition", () => {
    const admitted = snapshotExercise(part);
    expect(admitted.dimensions).toEqual(part.dimensions);
    expect(admitted.conditionNote).toContain("independently known radius");
    expect(admitted.declaredNames).not.toContain("kB");
    expect(admitted.declaredNames).not.toContain("N");
  });

  for (const answer of [
    "R*T*t/(3*pi*eta*a*m2)",
    "R*T/(6*pi*eta*a*(m2/(2*t)))",
    "(R*T/(3*pi))*(t/m2)/eta/a",
  ])
    test(`accepts the equivalent inversion ${answer}`, async () => {
      expect(status(await checkExerciseAnswer(part, answer))).toBe("equivalent");
    });

  test("using 6 instead of 3 loses the one-axis factor of two", async () => {
    expect(status(await checkExerciseAnswer(part, "R*T*t/(6*pi*eta*a*m2)"))).toBe("not-equivalent");
  });

  test("using the plane's factor of four for one-axis data doubles the estimate", async () => {
    expect(status(await checkExerciseAnswer(part, "2*R*T*t/(3*pi*eta*a*m2)"))).toBe(
      "not-equivalent",
    );
  });

  test("substituting an RMS distance for the mean square fails its dimension", async () => {
    expect(status(await checkExerciseAnswer(part, "R*T*t/(3*pi*eta*a*sqrt(m2))"))).toBe(
      "dimension",
    );
  });

  test("the expression agrees with the actual independent-increment inference owner", () => {
    const parsed = parse(part.referenceSource, new Set(part.declaredNames));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const set = getConstantSet("einstein-1905-brownian-printed");
    const R = constantValue(set, "molarGasConstant").value;
    // Authored synthetic observations, not historical data and not generated using an unknown N.
    const increments = new Float64Array([-0.8e-6, 0.4e-6, -1.1e-6, 0.7e-6, 0.2e-6, -0.3e-6]);
    const m2 = increments.reduce((sum, x) => sum + x * x, 0) / increments.length;
    for (const t of [0.1, 1, 10]) {
      const estimated = estimateIncrements(
        increments,
        t,
        1,
        "independent-increment-known-zero-drift",
      );
      expect(estimated.kind).toBe("accepted");
      if (estimated.kind !== "accepted") continue;
      const interval = estimatorInterval(estimated.data, 0.05);
      expect(interval.kind).toBe("accepted");
      if (interval.kind !== "accepted") continue;
      for (const a of [0.25e-6, 0.5e-6, 1e-6]) {
        const input = {
          T: 290.15,
          eta: 1.35e-3,
          a,
          dHat: estimated.data.dHat,
          interval: interval.data,
          radiusProvenance: "independently-declared" as const,
          synthetic: true,
        };
        const inferred = invertToMolecularNumber(input, set);
        expect(inferred.kind).toBe("accepted");
        if (inferred.kind !== "accepted") continue;
        const expression = evaluate(parsed.expr, { R, T: input.T, eta: input.eta, a, t, m2 });
        expect(expression.status).toBe("value");
        if (expression.status !== "value") continue;
        expect(expression.value / inferred.data.estimate).toBeCloseTo(1, 12);
        expect(inferred.data.semanticKind).toBe("synthetic-recovery");

        // A known radius is a scientific premise, not an algebraic detail the checker can infer.
        const circular = invertToMolecularNumber(
          { ...input, radiusProvenance: "same-displacements" },
          set,
        );
        expect(circular.kind).toBe("refused");
        if (circular.kind === "refused")
          expect(circular.refusal.code).toBe("circular-radius-from-displacement");
      }
    }
  });
});
