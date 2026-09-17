import { type ComparisonParameters, validateComparisonParameters } from "./Baseline.ts";

export type ComparisonCommand = "setup-change" | "observer-change" | "measurement-change" |
  "estimator-change" | "presentation-change";
export type ComparisonInput = Readonly<{
  label: string;
  unit: string;
  displayFactor: number;
  command: ComparisonCommand;
  comparable: boolean;
}>;
export type ComparisonOutput = Readonly<{ id: string; label: string; displayUnit: string; displayFactor: number }>;
export type ComparisonContract = Readonly<{
  experimentId: string;
  inputs: Readonly<Record<string, ComparisonInput>>;
  outputs: readonly ComparisonOutput[];
}>;
export type VariationDecision = Readonly<
  | { kind: "accepted"; changedInput: string | null; command: ComparisonCommand | null }
  | { kind: "refused"; code: "invalid-input" | "second-input-change" | "input-locked"; message: string }
>;

/** Compare complete canonical parameter records. Form controls are never the enforcement boundary. */
export function singleVariationLock(baseline: ComparisonParameters, requested: ComparisonParameters,
  contract: ComparisonContract): VariationDecision {
  try { validateComparisonParameters(baseline); validateComparisonParameters(requested); }
  catch { return { kind: "refused", code: "invalid-input", message: "Use finite, complete canonical settings." }; }
  const keys = Object.keys(baseline).sort(), declared = Object.keys(contract.inputs).sort();
  if (keys.length !== declared.length || keys.some((key, i) => key !== declared[i]) ||
      Object.keys(requested).length !== keys.length || keys.some((key) => !Object.hasOwn(requested, key) ||
        typeof requested[key] !== typeof baseline[key]))
    return { kind: "refused", code: "invalid-input", message: "Every independent input must have one declared comparison role." };
  const changed = keys.filter((key) => !Object.is(baseline[key], requested[key]));
  if (changed.length > 1)
    return { kind: "refused", code: "second-input-change",
      message: `This would change ${changed.map((key) => contract.inputs[key]?.label ?? key).join(" and ")}. Change one input, or pin a new baseline first.` };
  const key = changed[0];
  if (key === undefined) return { kind: "accepted", changedInput: null, command: null };
  const input = contract.inputs[key];
  if (!input?.comparable)
    return { kind: "refused", code: "input-locked", message: `${input?.label ?? key} is held fixed in this comparison. Pin a new baseline to change the question.` };
  return { kind: "accepted", changedInput: key, command: input.command };
}
