import type { ExecutionState } from "../../experiments/provenance/executionState.ts";
import type { ExperimentView, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { formatScaledDecimal } from "../../units/decimalScale.ts";
import type { CompiledEquation } from "../viewTypes.ts";
export type LiveSlot = Readonly<{
  slot: string;
  experimentId: string;
  view: ExperimentView;
  execution: ExecutionState;
}>;
export type TermValue = Readonly<{
  kind: "value" | "symbolic" | "status";
  text: string;
  unit: string;
  ownerId: string | null;
}>;
export function resolveSlot(
  slots: readonly LiveSlot[],
  experimentId: string,
  slot: string,
): Readonly<
  { kind: "resolved"; value: LiveSlot } | { kind: "unresolved" | "ambiguous"; message: string }
> {
  const matching = slots.filter((s) => s.experimentId === experimentId && s.slot === slot);
  if (matching.length !== 1)
    return {
      kind: matching.length ? "ambiguous" : "unresolved",
      message: matching.length
        ? "More than one trial occupies this slot. No value is selected."
        : "Symbolic here. Open the linked laboratory for a worked example and live values.",
    };
  return { kind: "resolved", value: matching[0]! };
}
export function statusText(result: PublishedResult): string {
  switch (result.status) {
    case "value":
      return "A scalar value is not available for this term.";
    case "symbolic":
      return "This quantity is still symbolic; supply the required information.";
    case "analytic-limit":
      return result.description;
    case "underdetermined":
      return `${result.compatibleFamily} Needed: ${result.neededInformation.join("; ")}`;
    case "not-applicable":
      return result.reason;
    case "outside-domain":
      return result.reason;
    case "divergent":
      return `The stated model has no finite value over this range. ${result.rate.statement}`;
  }
}
export function readTermValue(
  term: CompiledEquation["terms"][number],
  slot: LiveSlot | null,
): TermValue {
  const symbolic = (text: string): TermValue => ({
    kind: "symbolic",
    text,
    unit: term.quantity.displayUnit,
    ownerId: null,
  });
  if (!slot?.view.accepted || slot.execution.label === "unavailable")
    return symbolic("No accepted value is available here.");
  // ME-02 retains normalized c=1 settings for its teaching comparison. The SI
  // equation catalogue must not mistake those numbers for joules/kilograms,
  // even though the legacy output contract uses the same quantity identities.
  if (
    slot.experimentId === "me-02" &&
    !["joule", "erg"].includes(String(slot.view.accepted.parameters.energyUnit))
  )
    return symbolic(
      "SI substitution is unavailable for normalized units. Apply joule or erg settings in this laboratory first.",
    );
  const outputs = slot.view.accepted.outputs.filter((o) => o.quantityId === term.quantityId);
  if (outputs.length !== 1)
    return symbolic("No unique accepted output is available for this term.");
  const result = outputs[0]!;
  if (result.unit !== term.quantity.unit || result.semanticKind !== term.quantity.semanticKind)
    return symbolic("This output has a different unit or meaning; it is not substituted.");
  if (result.status !== "value" || typeof result.value !== "number")
    return { kind: "status", text: statusText(result), unit: "", ownerId: result.ownerId };
  const value = (result.value / term.scale.den) * term.scale.num;
  if (!Number.isFinite(value) || (result.value !== 0 && value === 0))
    return symbolic("The scaled value is not representable.");
  return {
    kind: "value",
    text: formatScaledDecimal(value, term.quantity.displayPower, 5),
    unit: term.quantity.displayUnit,
    ownerId: result.ownerId,
  };
}
export function retainedState(slot: LiveSlot): string {
  const view = slot.view;
  if (view.pending) return "Previous accepted settings — a new calculation is pending.";
  if (view.status === "refused")
    return `Previous accepted settings — request refused. ${view.refusal?.message ?? ""}`;
  if (view.status === "unavailable")
    return `Previous accepted settings — calculation unavailable. ${view.outcome?.message ?? ""}`;
  if (view.status === "paused") return "Previous accepted settings — calculation stopped.";
  return "Values describe this accepted snapshot, not unsaved input edits.";
}
