import type { Baseline, ComparisonValue } from "./Baseline.ts";
import { type ComparisonContract, type VariationDecision, singleVariationLock } from "./singleVariationLock.ts";

export type ComparisonNumber = Readonly<{ status: "value"; value: number } |
  { status: "not-applicable"; reason: string }>;
export type ComparisonRow = Readonly<{
  id: string;
  baseline: ComparisonValue;
  variant: ComparisonValue;
  ratio: ComparisonNumber;
  difference: ComparisonNumber;
}>;
export type ComparisonResult = Readonly<
  | { kind: "accepted"; variation: Extract<VariationDecision, { kind: "accepted" }>; rows: readonly ComparisonRow[] }
  | { kind: "refused"; code: string; message: string }
>;
const na = (reason: string): ComparisonNumber => ({ status: "not-applicable", reason });
function arithmetic(a: ComparisonValue, b: ComparisonValue, operation: "ratio" | "difference"): ComparisonNumber {
  if (a.status !== "value" || b.status !== "value" || a.value === null || b.value === null)
    return na(`Baseline: ${a.status}. Variant: ${b.status}. Both must be numeric values.`);
  if (operation === "ratio" && a.value === 0) return na("The baseline is zero; a ratio is not defined.");
  const value = operation === "ratio" ? b.value / a.value : b.value - a.value;
  return Number.isFinite(value) ? { status: "value", value } : na("The comparison exceeds the numeric range.");
}
/** An undeclared executable equivalence is never inferred from similar-looking numbers. */
export function compareBaselines(baseline: Baseline, variant: Baseline, contract: ComparisonContract): ComparisonResult {
  const refuse = (code: string, detail: string): ComparisonResult => ({ kind: "refused", code,
    message: `${detail} The difference would not isolate one change. Keep the baseline or pin a new one.` });
  if (baseline.experimentId !== variant.experimentId || baseline.experimentId !== contract.experimentId)
    return refuse("experiment-mismatch", "These results belong to different instruments.");
  for (const key of ["modelVersion", "streamVersion", "allocationId", "constantSetId"] as const) {
    if (baseline.identity[key] !== variant.identity[key]) return refuse("model-mismatch", `The ${key} changed.`);
  }
  for (const key of ["sourceDigest", "artifactDigest", "executionLabel"] as const) {
    if (baseline.identity[key] !== variant.identity[key]) return refuse("engine-mismatch", `The ${key} changed without a declared equivalence.`);
  }
  const variation = singleVariationLock(baseline.parameters, variant.parameters, contract);
  if (variation.kind === "refused") return variation;
  const sameRun = baseline.instanceId === variant.instanceId && baseline.runId === variant.runId;
  if (variation.command && ["measurement-change", "observer-change", "estimator-change"].includes(variation.command) && !sameRun)
    return refuse("run-not-preserved", "A change of measurement, observer, or estimator must preserve the recorded run.");
  if (variation.command === "setup-change" && sameRun)
    return refuse("run-not-branched", "A changed physical setup must have a new identified run.");
  if (sameRun && (variant.snapshotVersion < baseline.snapshotVersion || variant.actionIndex < baseline.actionIndex))
    return refuse("stale-variant", "The variant precedes the pinned result.");
  if (sameRun && variation.changedInput !== null && variant.snapshotVersion === baseline.snapshotVersion)
    return refuse("mixed-snapshot", "One snapshot identity cannot carry two different inputs.");
  const rows: ComparisonRow[] = [];
  for (const { id } of contract.outputs) {
    const a = baseline.outputs[id], b = variant.outputs[id];
    if (!a || !b || a.unit !== b.unit || a.semanticKind !== b.semanticKind)
      return refuse("output-contract-mismatch", `The units or meaning of ${id} changed.`);
    rows.push(Object.freeze({ id, baseline: a, variant: b,
      ratio: arithmetic(a, b, "ratio"), difference: arithmetic(a, b, "difference") }));
  }
  return Object.freeze({ kind: "accepted", variation, rows: Object.freeze(rows) });
}
