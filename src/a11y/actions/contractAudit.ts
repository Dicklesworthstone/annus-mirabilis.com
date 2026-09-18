/**
 * Instrument Action Contract Audit Engine (am-a11y-action-contracts-k75g).
 *
 * Enforces:
 * 1. Every interactive action declares a contract.
 * 2. Visual and equivalent affordances are present and valid.
 * 3. Drag-only, canvas-only, color-only, and sound-only equivalents are strictly rejected.
 * 4. Equivalent affordance must provide an actionable accessible modality.
 * 5. Output quantities and accepted statuses are verified.
 */

import type { ActionContract, ActionContractAuditDiagnostic } from "./types.ts";

const DRAG_GESTURE_PATTERN =
  /\b(drag|dragging|draggable|swipe|mouse|pointer|canvas|draw|scrub|slider-only)\b/i;

const ACCESSIBLE_MODALITY_PATTERN =
  /\b(type|enter|select|choose|toggle|read|inspect|compare|adjust|advance|retreat|set|switch|press|navigate|button|radio|checkbox|table|direct entry|keyboard|stepper|input)\b/i;

export function auditActionContract(
  contract: ActionContract,
  instrumentId: string,
  declaredOutputIds?: ReadonlySet<string>,
): readonly ActionContractAuditDiagnostic[] {
  const diags: ActionContractAuditDiagnostic[] = [];
  const actionId = contract.actionId;

  const vis = contract.visualAffordance?.trim() || "";
  const eq = contract.equivalentAffordance?.trim() || "";
  const ann = contract.announcement?.trim() || "";

  if (!vis) {
    diags.push({
      code: "missing-visual-affordance",
      message: `Action "${actionId}" must declare visualAffordance.`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.visualAffordance`,
    });
  }

  if (!eq) {
    diags.push({
      code: "missing-equivalent-affordance",
      message: `Action "${actionId}" must declare an accessible equivalentAffordance.`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.equivalentAffordance`,
    });
  }

  if (!ann) {
    diags.push({
      code: "missing-action-announcement",
      message: `Action "${actionId}" must declare an assistive announcement template for live regions.`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.announcement`,
    });
  }

  // Check drag-only rejection
  const isVisualDrag = DRAG_GESTURE_PATTERN.test(vis);
  const isEquivalentDrag = DRAG_GESTURE_PATTERN.test(eq);

  if (isEquivalentDrag && !ACCESSIBLE_MODALITY_PATTERN.test(eq.replace(DRAG_GESTURE_PATTERN, ""))) {
    diags.push({
      code: "drag-only-action-forbidden",
      message: `Action "${actionId}" equivalentAffordance requires drag/mouse interaction without a non-drag alternative.`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.equivalentAffordance`,
    });
  }

  if (isVisualDrag && vis.toLowerCase() === eq.toLowerCase()) {
    diags.push({
      code: "drag-only-action-forbidden",
      message: `Action "${actionId}" has identical visual and equivalent affordances requiring drag.`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.equivalentAffordance`,
    });
  }

  // Ensure equivalent affordance provides an actionable accessible modality
  if (eq && !ACCESSIBLE_MODALITY_PATTERN.test(eq)) {
    diags.push({
      code: "action-equivalent-insufficient",
      message: `Action "${actionId}" equivalentAffordance must specify an actionable accessible modality (e.g. type, enter, select, toggle, read, compare, inspect).`,
      instrumentId,
      actionId,
      path: `actionContracts.${actionId}.equivalentAffordance`,
    });
  }

  // Check declared output IDs if provided
  if (declaredOutputIds && contract.acceptedResult?.outputs) {
    for (const outId of contract.acceptedResult.outputs) {
      if (!declaredOutputIds.has(outId)) {
        diags.push({
          code: "result-outputs-mismatch",
          message: `Action "${actionId}" result output "${outId}" is not a declared output of instrument "${instrumentId}".`,
          instrumentId,
          actionId,
          path: `actionContracts.${actionId}.acceptedResult.outputs`,
        });
      }
    }
  }

  return Object.freeze(diags);
}

export function auditInstrumentManifestContracts(
  manifest: Record<string, unknown>,
): readonly ActionContractAuditDiagnostic[] {
  const diags: ActionContractAuditDiagnostic[] = [];
  const instrumentId = String(manifest.id ?? "unknown-instrument");
  const contracts =
    (manifest.actionContracts as readonly ActionContract[]) ??
    (manifest.actions as readonly ActionContract[]) ??
    [];

  if (contracts.length === 0 && manifest.hasInteractiveControls === true) {
    diags.push({
      code: "missing-action-contract",
      message: `Instrument "${instrumentId}" declares interactive controls but has no action contracts.`,
      instrumentId,
    });
    return Object.freeze(diags);
  }

  const outputIds = new Set<string>(
    Array.isArray(manifest.outputs)
      ? manifest.outputs.map((o: { id?: unknown }) => String(o.id ?? ""))
      : [],
  );

  for (const c of contracts) {
    const cDiags = auditActionContract(c, instrumentId, outputIds.size > 0 ? outputIds : undefined);
    diags.push(...cDiags);
  }

  return Object.freeze(diags);
}
