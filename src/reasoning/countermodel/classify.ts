import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { classifyWithTolerance, withinTolerance } from "../../units/tolerance.ts";
import type { CountermodelTest } from "./caseSchema.ts";
import { testUnit } from "./caseSchema.ts";
import { cellQuantity, cellSampleLabels, OUTPUT_PARTS } from "./cellEvaluator.ts";

export type CellOutcome =
  | "consistent"
  | "violates"
  | "indistinguishable"
  | "indeterminate"
  | "unavailable";
export type CellSample = Readonly<{
  label: string;
  actual: number;
  reference: number;
  residual: number;
  allowed: number;
  outcome: CellOutcome;
}>;
export type CellResult = Readonly<{
  outcome: CellOutcome;
  samples: readonly CellSample[];
  reason: string;
}>;
/** Classification of already accepted numbers, through the shared tolerance owner. */
export function classifySample(
  actual: number,
  reference: number,
  residual: number,
  test: CountermodelTest,
): { outcome: CellOutcome; allowed: number } {
  if (![actual, reference, residual].every(Number.isFinite))
    throw new TypeError("A nonfinite result is not a comparison.");
  const verdict = withinTolerance(actual, reference, {
    absolute: test.tolerance.absolute,
    relative: test.tolerance.relative,
    relativeTo: "larger",
  });
  if (verdict.kind === "invalid-spec") throw new TypeError("Invalid case tolerance.");
  const boundary = classifyWithTolerance(Math.abs(residual) - verdict.allowed, {
    relative: 32 * Number.EPSILON,
    scale: Math.max(Math.abs(residual), verdict.allowed),
  });
  const outcome =
    boundary.sign === "indeterminate"
      ? "indeterminate"
      : boundary.sign === "positive"
        ? "violates"
        : test.kind === "observation"
          ? "indistinguishable"
          : "consistent";
  return { outcome, allowed: verdict.allowed };
}
export function classifyCell(
  snapshot: AcceptedSnapshot,
  candidate: number,
  testIndex: number,
  test: CountermodelTest,
): CellResult {
  if (!snapshot.final) throw new TypeError("Compare a completed accepted snapshot.");
  const arrays: number[][] = [];
  const labels = cellSampleLabels(test);
  for (const part of OUTPUT_PARTS) {
    const matches = snapshot.outputs.filter(
      (output) => output.quantityId === cellQuantity(candidate, testIndex, part),
    );
    const output = matches[0];
    if (matches.length !== 1 || !output || output.unit !== testUnit(test.test))
      throw new TypeError("Missing or mismatched comparison output.");
    if (output.status !== "value")
      return {
        outcome: "unavailable",
        samples: [],
        reason:
          "reason" in output
            ? String(output.reason)
            : "The owner did not produce a numeric comparison.",
      };
    if (typeof output.value === "number" || output.value.length !== labels.length)
      throw new TypeError("Mismatched countermodel sample layout.");
    arrays.push(
      Array.from({ length: labels.length }, (_, i) =>
        output.value instanceof Object && typeof output.value !== "number"
          ? output.value.at(i)
          : NaN,
      ),
    );
  }
  const samples = labels.map((label, i) => {
    const actual = arrays[0]?.[i] ?? NaN,
      reference = arrays[1]?.[i] ?? NaN,
      residual = arrays[2]?.[i] ?? NaN;
    return {
      label,
      actual,
      reference,
      residual,
      ...classifySample(actual, reference, residual, test),
    };
  });
  const outcome: CellOutcome = samples.some((s) => s.outcome === "violates")
    ? "violates"
    : samples.some((s) => s.outcome === "indeterminate")
      ? "indeterminate"
      : test.kind === "observation"
        ? "indistinguishable"
        : "consistent";
  return {
    outcome,
    samples,
    reason:
      outcome === "indeterminate"
        ? "A computed residual lies on the numerical tolerance boundary; this test cannot assign a definite outcome."
        : "",
  };
}
export function cellOutcomeText(result: CellResult, test: CountermodelTest): string {
  switch (result.outcome) {
    case "consistent":
      return `Consistent with ${test.label}`;
    case "violates":
      return test.kind === "constraint"
        ? `Violates ${test.label}`
        : `Different predictions under ${test.label}`;
    case "indistinguishable":
      return "Indistinguishable under this observation";
    case "indeterminate":
      return "Indeterminate at the tolerance boundary";
    case "unavailable":
      return "No numeric comparison available";
  }
}
