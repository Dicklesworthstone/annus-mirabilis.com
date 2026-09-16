import type { AcceptedSnapshot, NumericView, PublishedResult } from "../../experiments/store/instanceStore.ts";
export function result(snapshot: AcceptedSnapshot, id: string): PublishedResult {
  const value = snapshot.outputs.find(o => o.quantityId === id);
  if (!value) throw new TypeError(`Missing declared laboratory output: ${id}`);
  return value;
}
export function scalar(snapshot: AcceptedSnapshot, id: string): number {
  const output = result(snapshot, id);
  if (output.status !== "value" || typeof output.value !== "number") throw new TypeError(`Expected scalar output: ${id}`);
  return output.value;
}
export function array(snapshot: AcceptedSnapshot, id: string): NumericView {
  const output = result(snapshot, id);
  if (output.status !== "value" || typeof output.value === "number") throw new TypeError(`Expected array output: ${id}`);
  return output.value;
}
/** Presentation rounding and explicit unit conversion only; no physical laws live here. */
export function display(value: number, factor = 1): string {
  const scaled = value * factor;
  if (!Number.isFinite(scaled)) throw new TypeError("A nonfinite display value was rejected.");
  return scaled === 0 ? "0" : Number(scaled.toPrecision(5)).toString();
}
export function identity(snapshot: AcceptedSnapshot) {
  return { "data-instance-id": snapshot.instanceId, "data-run-id": snapshot.runId, "data-snapshot-version": snapshot.snapshotVersion };
}
