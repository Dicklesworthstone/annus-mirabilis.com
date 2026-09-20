/**
 * contexts.ts
 *
 * Resolves editorial voice context from content record kind, field path,
 * message catalog namespace, or component structure. The context chosen here
 * decides which SEVERITY every rule applies, so a wrong answer is not cosmetic:
 * reader-progress, task-feedback and ui-label are the three contexts where the
 * theater rule is an error rather than a flag.
 *
 * Spec: AGENTS.md "Editorial Voice" and am-edit-voice-lint-trmf
 */

import type { VoiceContext } from "./rules.ts";

/**
 * The words of a field path: it is split on ".", "[n]", "-" and "_", and at camelCase humps.
 *
 * A branch below matches a WORD, never an arbitrary substring (am-9yw6). Substring matching
 * made "variant" a ui-label, because v-ARIA-nt contains "aria", and the same accident catches
 * "variants", "invariant", "invariants", "covariant" and "variance" - which in a critical
 * edition of the relativity paper is ordinary vocabulary, not an accessible name. That was
 * harmless only because the 199 matching strings happened to be enum values; Experiment already
 * declares an `invariants[].description` field that holds prose.
 */
function fieldWords(fieldPath: string): ReadonlySet<string> {
  const parts = fieldPath
    .replace(/\[\d+\]/gu, ".")
    .split(/[.\-_]/u)
    .flatMap((segment) => segment.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").split(/\s+/u))
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  return new Set(parts);
}

/**
 * Resolves the VoiceContext for a given record kind and field path.
 */
export function resolveVoiceContext(
  recordKind: string | undefined,
  fieldPath: string,
): VoiceContext {
  const normField = fieldPath.toLowerCase();
  const words = fieldWords(fieldPath);
  /**
   * A multi-word marker such as "separatingassumption" survives camelCase splitting as separate
   * words, so a long marker is also allowed to match the path with its punctuation removed. The
   * length floor keeps that fallback away from short words like "aria", which is the collision
   * this function is being fixed for.
   */
  const joined = normField.replace(/[^a-z0-9]/gu, "");
  const names = (...markers: readonly string[]): boolean =>
    markers.some((m) => words.has(m) || (m.length > 8 && joined.includes(m)));

  // 1. Task feedback & Exercise checker
  if (
    names(
      "feedback",
      "hint",
      "separatingassumption",
      "scopenote",
      "domainnote",
      "answerdisplay",
      "teachback",
      "selfcheck",
      "predictprompt",
    )
  ) {
    return "task-feedback";
  }

  // 2. Reader progress.
  //
  // An argument node's `recap` is NOT progress copy (am-9yw6). It is the argument's
  // one-sentence summary, authored beside question, conclusion, premises and limitations, and
  // it reads "Independent centred steps add mean squares; the root therefore grows as the
  // square root of time." The field was mapped here by where its text is SHOWN - the
  // interrupted reader's recap card of am-read-notebook-tde - rather than by what the text is.
  // That has it backwards: the gamification a recap card invites lives in the card's own
  // chrome, not in the scientific sentence the card quotes. Every `recap` field in the corpus
  // belongs to an argument record, all 42 of them, so this exception is the whole field today;
  // the branch is kept for a recap authored on some other record, where it would be progress
  // copy.
  const scholarlyRecap = recordKind === "argument" && words.has("recap");
  if (
    recordKind === "tour" ||
    names("progress", "notebook", "explanationreplay", "worksheet") ||
    (words.has("recap") && !scholarlyRecap)
  ) {
    return "reader-progress";
  }

  // 3. Journey branch
  if (recordKind === "journey-branch" || names("journeybranch", "forkbranch", "branchcopy")) {
    return "journey-branch";
  }

  // 4. Countermodel cell
  if (recordKind === "countermodel" || names("countermodel", "countermodelcell", "workbenchcell")) {
    return "countermodel-cell";
  }

  // 5. Independence claim
  if (
    recordKind === "independence-claim" ||
    names("independenceclaim", "independencereadout", "inferenceresult")
  ) {
    return "independence-claim";
  }

  // 6. UI label
  if (
    names("label", "title", "button", "heading", "aria") ||
    (words.has("caption") && words.has("header"))
  ) {
    return "ui-label";
  }

  // Default context is prose
  return "prose";
}
