import {
  enumerateSignedSteps,
  type StepDependence,
} from "../../experiments/bm05/stepEnumeration.ts";
import { compareBitwise } from "../../units/tolerance.ts";
import type { Expression } from "../ast.ts";
import type { MissingStepLesson } from "./transitionSchema.ts";
/** Checks full finite worked distributions, not a proof of a general identity. */
export function checkWorkedTransitions(lesson: MissingStepLesson): void {
  let distribution = enumerateSignedSteps(2);
  function evaluate(e: Expression, row: readonly number[], scale: number): number {
    switch (e.kind) {
      case "symbol":
        return e.termId === "A" ? row[0]! * scale : e.termId === "B" ? row[1]! * scale : scale;
      case "number":
        return Number(e.value);
      case "sum":
        return e.args.reduce((s, x) => s + evaluate(x, row, scale), 0);
      case "product":
        return e.args.reduce((s, x) => s * evaluate(x, row, scale), 1);
      case "power":
        return evaluate(e.base, row, scale) ** (e.exponent.num / e.exponent.den);
      case "group":
        return evaluate(e.argument, row, scale);
      case "average":
        return (
          distribution.rows.reduce((s, r) => s + evaluate(e.argument, r.steps, scale), 0) /
          distribution.denominator
        );
      default:
        throw new Error("Unsupported expression in the finite worked-case check.");
    }
  }
  for (const step of lesson.chain.steps) {
    const pointwise =
      step.rule.kind === "expand" || step.rule.params.identityId === "linearity-of-average";
    const models: readonly StepDependence[] = pointwise
      ? ["independent", "same-direction", "opposite-direction"]
      : ["independent"];
    for (const model of models) {
      distribution = enumerateSignedSteps(2, model);
      for (const scale of [1, 2, 3])
        for (const row of distribution.rows)
          if (
            !compareBitwise(
              evaluate(step.from, row.steps, scale),
              evaluate(step.to, row.steps, scale),
            ).ok
          )
            throw new Error(
              `[missing-step-worked-case] ${step.id} fails the enumerated example at step size ${scale}.`,
            );
    }
  }
}
