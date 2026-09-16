/**
 * contexts.ts
 *
 * Resolves editorial voice context from content record kind, field path,
 * message catalog namespace, or component structure.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import type { VoiceContext } from "./rules.ts";

/**
 * Resolves the VoiceContext for a given record kind and field path.
 */
export function resolveVoiceContext(
  recordKind: string | undefined,
  fieldPath: string,
): VoiceContext {
  const normField = fieldPath.toLowerCase();

  // 1. Task feedback & Exercise checker
  if (
    normField.includes("feedback") ||
    normField.includes("hint") ||
    normField.includes("separatingassumption") ||
    normField.includes("scopenote") ||
    normField.includes("domainnote") ||
    normField.includes("answerdisplay") ||
    normField.includes("teachback") ||
    normField.includes("selfcheck") ||
    normField.includes("predictprompt")
  ) {
    return "task-feedback";
  }

  // 2. Reader progress
  if (
    recordKind === "tour" ||
    normField.includes("progress") ||
    normField.includes("notebook") ||
    normField.includes("recap") ||
    normField.includes("explanationreplay") ||
    normField.includes("worksheet")
  ) {
    return "reader-progress";
  }

  // 3. Journey branch
  if (
    recordKind === "journey-branch" ||
    normField.includes("journeybranch") ||
    normField.includes("forkbranch") ||
    normField.includes("branchcopy")
  ) {
    return "journey-branch";
  }

  // 4. Countermodel cell
  if (
    recordKind === "countermodel" ||
    normField.includes("countermodel") ||
    normField.includes("countermodelcell") ||
    normField.includes("workbenchcell")
  ) {
    return "countermodel-cell";
  }

  // 5. Independence claim
  if (
    recordKind === "independence-claim" ||
    normField.includes("independenceclaim") ||
    normField.includes("independencereadout") ||
    normField.includes("inferenceresult")
  ) {
    return "independence-claim";
  }

  // 6. UI label
  if (
    normField.includes("label") ||
    normField.includes("title") ||
    normField.includes("button") ||
    normField.includes("heading") ||
    normField.includes("aria") ||
    (normField.includes("caption") && normField.includes("header"))
  ) {
    return "ui-label";
  }

  // Default context is prose
  return "prose";
}
