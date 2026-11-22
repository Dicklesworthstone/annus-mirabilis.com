/** Exact local calculus after the §2 statistical and volume assumptions are admitted.
 * This does not prove the measure, uniformity, independence or thermodynamic work relation. */
import type { Expression } from "../ast.ts";
import {
  type BrownianOsmoticExpressions,
  brownianOsmoticExpressions as expected,
  brownianOsmoticSymbols as s,
} from "./brownianOsmotic.ts";
import { LogarithmicCalculusRefusal, logarithmicCalculus } from "./logarithmicCalculus.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";

export const brownianOsmoticCheckRows = [
  "free-energy-cancellation",
  "reference-volume-difference",
  "constant-factor-derivative",
  "log-volume-derivative",
  "free-energy-derivative",
  "pressure-sign",
  "number-density",
  "one-cluster-derivative",
] as const;
type RowId = (typeof brownianOsmoticCheckRows)[number];
export type BrownianOsmoticReport = Readonly<{
  status: "pass" | "fail";
  rows: readonly Readonly<{ id: RowId; label: string; status: "pass" | "fail"; reason: string }>[];
}>;

export function verifyBrownianOsmotic(
  input: BrownianOsmoticExpressions = expected,
): BrownianOsmoticReport {
  const calculus = logarithmicCalculus({
    positive: [s.R, s.N, s.T, s.V, s.V0, s.J, s.B],
    constants: [s.count, s.meanEnergy],
  });
  const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
  const equalShape = (key: keyof BrownianOsmoticExpressions): boolean =>
    input[key].operator === "=" && structurallyEqual(input[key].left, expected[key].left);
  const row = (id: RowId, label: string, check: () => boolean) => {
    try {
      const passed = check();
      return Object.freeze({
        id,
        label,
        status: passed ? ("pass" as const) : ("fail" as const),
        reason: passed
          ? "Exact identity under the stated fixed-parameter and positive-domain declarations."
          : "The supplied expression does not satisfy this identity and its declared operands.",
      });
    } catch (error) {
      if (!(error instanceof LogarithmicCalculusRefusal)) throw error;
      return Object.freeze({ id, label, status: "fail" as const, reason: error.message });
    }
  };
  const rows = Object.freeze([
    row(
      "free-energy-cancellation",
      "Cancel the same mean energy in F = Ē − TS",
      () =>
        equalShape("freeEnergySubstitution") &&
        equalShape("sourceFreeEnergy") &&
        calculus.equal(input.freeEnergySubstitution.right, expected.freeEnergySubstitution.right) &&
        calculus.equal(input.freeEnergySubstitution.right, input.sourceFreeEnergy.right),
    ),
    row(
      "reference-volume-difference",
      "Cancel the common J and retain ln(V*/V₀)",
      () =>
        equalShape("freeEnergySubtraction") &&
        equalShape("freeEnergyDifference") &&
        calculus.equal(input.freeEnergySubtraction.right, expected.freeEnergySubtraction.right) &&
        calculus.equal(input.freeEnergySubtraction.right, input.freeEnergyDifference.right),
    ),
    row(
      "constant-factor-derivative",
      "The declared V-independent ln J has zero derivative",
      () =>
        equalShape("fixedFactorDerivative") &&
        calculus.differentiatesTo(
          { kind: "function", name: "ln", argument: s.J },
          s.V,
          input.fixedFactorDerivative.right,
        ),
    ),
    row(
      "log-volume-derivative",
      "Differentiate the dimensionless positive volume ratio",
      () =>
        equalShape("logarithmDerivative") &&
        input.logarithmDerivative.left.kind === "derivative" &&
        calculus.differentiatesTo(
          input.logarithmDerivative.left.expression,
          s.V,
          input.logarithmDerivative.right,
        ),
    ),
    row(
      "free-energy-derivative",
      "Differentiate the admitted free-energy difference",
      () =>
        equalShape("freeEnergyDerivative") &&
        equalShape("freeEnergyDifference") &&
        calculus.differentiatesTo(
          input.freeEnergyDifference.right,
          s.V,
          input.freeEnergyDerivative.right,
        ),
    ),
    row(
      "pressure-sign",
      "Negate the derivative to obtain osmotic pressure",
      () =>
        equalShape("independentPressure") &&
        calculus.equal(negative(input.freeEnergyDerivative.right), input.independentPressure.right),
    ),
    row(
      "number-density",
      "Replace count divided by volume with number density",
      () =>
        equalShape("numberDensity") &&
        equalShape("densityPressure") &&
        structurallyEqual(input.numberDensity.right, expected.numberDensity.right) &&
        calculus.equal(
          input.independentPressure.right,
          substituteNode(input.densityPressure.right, "numberDensity", input.numberDensity.right),
        ),
    ),
    row(
      "one-cluster-derivative",
      "One freely placed cluster supplies one volume factor",
      () =>
        equalShape("lockedFreeEnergyDifference") &&
        equalShape("lockedPressure") &&
        calculus.equal(
          input.lockedFreeEnergyDifference.right,
          expected.lockedFreeEnergyDifference.right,
        ) &&
        calculus.differentiatesTo(
          input.lockedFreeEnergyDifference.right,
          s.V,
          negative(input.lockedPressure.right),
        ),
    ),
  ]);
  return Object.freeze({ status: rows.every((r) => r.status === "pass") ? "pass" : "fail", rows });
}
