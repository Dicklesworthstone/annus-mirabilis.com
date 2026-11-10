import { describe, expect, test } from "bun:test";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { effectiveIndependentCount } from "../../physics/reference/radiation/quanta.ts";
import { type AnswerVerdict, checkExerciseAnswer, snapshotExercise } from "../exercises/answer.ts";
import { evaluate } from "../exercises/evaluate.ts";
import { parse } from "../exercises/grammar.ts";
import { ENTROPY_COUNT_EXERCISE as part } from "./entropyExercise.ts";

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("matching the radiation and gas entropy coefficients", () => {
  test("the checker retains beta's K·s dimension and the Wien qualification", () => {
    const admitted = snapshotExercise(part);
    expect(admitted.dimensions).toEqual(part.dimensions);
    expect(admitted.conditionNote).toContain("both states remain in the Wien regime");
    expect(admitted.declaredNames).not.toContain("h");
  });

  for (const answer of ["N*E/(R*beta*nu)", "E/((R*beta/N)*nu)", "(N/R)*(E/(beta*nu))"])
    test(`accepts the equivalent coefficient ${answer}`, async () => {
      expect(status(await checkExerciseAnswer(part, answer))).toBe("equivalent");
    });

  test("the entropy coefficient without N/R is not dimensionless", async () => {
    expect(status(await checkExerciseAnswer(part, "E/(beta*nu)"))).toBe("dimension");
  });

  test("a factor-of-two mistake has the right units but fails the numerical check", async () => {
    expect(status(await checkExerciseAnswer(part, "N*E/(2*R*beta*nu)"))).toBe("not-equivalent");
  });

  test("the inverse coefficient is dimensionless but describes the wrong dependence", async () => {
    expect(status(await checkExerciseAnswer(part, "R*beta*nu/(N*E)"))).toBe("not-equivalent");
  });

  test("it agrees with the radiation owner using printed constants, including noninteger counts", () => {
    const parsed = parse(part.referenceSource, new Set(part.declaredNames));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const set = getConstantSet("einstein-1905-light-quanta-printed");
    const gas = set.entries.find((entry) => entry.quantityId === "molarGasConstant");
    expect(gas?.unit).toBe("erg/(mol K)");
    // The printed set is CGS, while this exercise explicitly asks for SI inputs.
    const R = constantValue(set, "molarGasConstant").value * 1e-7;
    const N = constantValue(set, "avogadroConstant").value;
    const beta = constantValue(set, "wienConstantBeta").value;
    let sawFractionalCount = false;
    for (const E of [1e-20, 1e-19, 1e-18, 1e-16]) {
      for (const nu of [5e14, 6e14, 1.5e15]) {
        const expression = evaluate(parsed.expr, { E, R, N, beta, nu });
        expect(expression.status).toBe("value");
        if (expression.status !== "value") continue;
        const owned = effectiveIndependentCount(E, nu, set);
        expect(expression.value / owned.count).toBeCloseTo(1, 12);
        if (owned.count > 0 && owned.count < 1) {
          sawFractionalCount = true;
          expect(expression.value).toBeGreaterThan(0);
          expect(expression.value).toBeLessThan(1);
          expect(expression.value).not.toBe(Math.round(owned.count));
        }
      }
    }
    expect(sawFractionalCount).toBe(true);
  });
});
