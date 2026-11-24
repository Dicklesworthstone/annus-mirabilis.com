import type { ExecutionState } from "../../experiments/provenance/executionState.ts";
import type { ExperimentView, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { formatScaledDecimal } from "../../units/decimalScale.ts";
import type { NumericalBinding } from "../record.ts";
import type { CompiledEquation } from "../viewTypes.ts";

export type LiveSlot = Readonly<{
  slot: string;
  experimentId: string;
  /** An authored comparison name, independent of the runtime instance id. */
  label?: string;
  view: ExperimentView;
  execution: ExecutionState;
}>;
export type TermValue = Readonly<{
  kind: "value" | "symbolic" | "status";
  text: string;
  unit: string;
  ownerId: string | null;
}>;
export type SlotResolution = Readonly<
  { kind: "resolved"; value: LiveSlot } | { kind: "unresolved" | "ambiguous"; message: string }
>;
export type EquationValueGroup = Readonly<{
  experimentId: string;
  instanceSlot: string;
  bindings: readonly NumericalBinding[];
  resolution: SlotResolution;
  label: string;
}>;

/** A slot label cannot lend another laboratory or instance its accepted values. */
function slotIdentityMatches(slot: LiveSlot): boolean {
  const { accepted, requested } = slot.view;
  return (
    (!accepted || accepted.experimentId === slot.experimentId) &&
    (!requested || requested.experimentId === slot.experimentId) &&
    (!accepted || !requested || accepted.instanceId === requested.instanceId)
  );
}

export function resolveSlot(
  slots: readonly LiveSlot[],
  experimentId: string,
  slot: string,
): SlotResolution {
  const matching = slots.filter((s) => s.experimentId === experimentId && s.slot === slot);
  const selected = matching[0];
  if (matching.length !== 1 || !selected)
    return {
      kind: matching.length ? "ambiguous" : "unresolved",
      message: matching.length
        ? "More than one trial occupies this slot. No value is selected."
        : "Symbolic here. Open the linked laboratory for a worked example and live values.",
    };
  if (!slotIdentityMatches(selected))
    return {
      kind: "unresolved",
      message:
        "The accepted calculation does not belong to this laboratory instance. No value is selected.",
    };
  return { kind: "resolved", value: selected };
}

/** Resolve each experiment and slot once for both the table and the selected-term inspector. */
export function equationValueGroups(
  bindings: readonly NumericalBinding[],
  slots: readonly LiveSlot[],
): readonly EquationValueGroup[] {
  const groups = new Map<string, [NumericalBinding, ...NumericalBinding[]]>();
  for (const binding of bindings) {
    const key = JSON.stringify([binding.experimentId, binding.instanceSlot]);
    const group = groups.get(key);
    if (group) group.push(binding);
    else groups.set(key, [binding]);
  }
  return [...groups.values()].map((own, index) => {
    const { experimentId, instanceSlot } = own[0];
    const resolution = resolveSlot(slots, experimentId, instanceSlot);
    return {
      experimentId,
      instanceSlot,
      bindings: own,
      resolution,
      label:
        (resolution.kind === "resolved" ? resolution.value.label : undefined) ??
        (instanceSlot === "baseline"
          ? "Baseline trial"
          : instanceSlot === "variant"
            ? "Comparison trial"
            : `Trial ${index + 1}`),
    };
  });
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
  binding?: NumericalBinding,
): TermValue {
  const symbolic = (text: string): TermValue => ({
    kind: "symbolic",
    text,
    unit: term.quantity.displayUnit,
    ownerId: null,
  });
  if (!slot?.view.accepted || slot.execution.label === "unavailable")
    return symbolic("No accepted value is available here.");
  if (!slotIdentityMatches(slot))
    return symbolic("The accepted calculation does not belong to this laboratory instance.");
  if (
    binding &&
    (binding.termId !== term.termId ||
      binding.quantityId !== term.quantityId ||
      binding.experimentId !== slot.experimentId ||
      binding.instanceSlot !== slot.slot)
  )
    return symbolic("This term is linked to a different calculation. No value is selected.");
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
  // PublishedResult keys are canonical quantity ids. The declared outputId is authoritative;
  // a missing output must never be replaced by a quantity selected from another binding.
  const outputs = slot.view.accepted.outputs.filter(
    (o) => o.quantityId === (binding?.outputId ?? term.quantityId),
  );
  const result = outputs[0];
  if (outputs.length !== 1 || !result)
    return symbolic("No unique accepted output is available for this term.");
  if (
    result.quantityId !== term.quantityId ||
    result.unit !== term.quantity.unit ||
    result.semanticKind !== term.quantity.semanticKind
  )
    return symbolic("This output has a different unit or meaning; it is not substituted.");
  if (!slot.execution.owners.includes(result.ownerId))
    return symbolic("The source of this value is not identified for this trial.");
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

/** A repeated glyph or quantity never grants an unbound occurrence somebody else's binding. */
export function readBoundTermValue(
  term: CompiledEquation["terms"][number],
  group: EquationValueGroup,
): TermValue {
  const bindings = group.bindings.filter((binding) => binding.termId === term.termId);
  if (bindings.length !== 1)
    return {
      kind: "symbolic",
      text: bindings.length
        ? "This term has more than one value assigned in this trial. No value is selected."
        : "This occurrence stays symbolic; no accepted value is assigned to it.",
      unit: term.quantity.displayUnit,
      ownerId: null,
    };
  if (group.resolution.kind !== "resolved")
    return {
      kind: "symbolic",
      text: group.resolution.message,
      unit: term.quantity.displayUnit,
      ownerId: null,
    };
  return readTermValue(term, group.resolution.value, bindings[0]);
}

export function retainedState(slot: LiveSlot): string {
  const view = slot.view;
  if (view.pending) return "Previous accepted settings: a new calculation is pending.";
  if (view.status === "refused")
    return `Previous accepted settings: request refused. ${view.refusal?.message ?? ""}`;
  if (view.status === "unavailable")
    return `Previous accepted settings: calculation unavailable. ${view.outcome?.message ?? ""}`;
  if (view.status === "paused") return "Previous accepted settings: calculation stopped.";
  return "These values are for the settings last applied, not for edits you have not applied yet.";
}
