/**
 * The model-choice router (am-rt-command-classes-dzp requirement 10). A command that selects
 * a different `modelId` from an instrument's declared `models[]` is dispatched as an ordinary
 * `setup-change` -- the governing model is part of what a run *is*, so switching it starts a
 * new identified run with `parentRunId`, exactly like any other setup-change
 * (`createInstanceStore`'s existing fork-on-setup-change behavior applies unmodified; this
 * module only validates the requested id and keeps the model-choice and fallback fields
 * disjoint).
 *
 * What this module deliberately does not do: rank models, treat any model as preferred, or
 * write `fallbackReason`. The register is read as an unordered set for that reason -- there is
 * no comparator here to accidentally expose one.
 */
import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";

export type ModelChoiceDecision =
  | Readonly<{ accepted: true; modelId: string }>
  | Readonly<{ accepted: false; refusal: RequestRefusal }>;

/**
 * Refuses an unknown `modelId` rather than silently defaulting to one (am-rt-command-classes-dzp
 * requirement 10: "an unknown modelId is refused rather than defaulted"). `declaredModelIds` is
 * read as an unordered collection; no ordering in it is ever treated as a preference.
 */
export function validateModelChoice(
  declaredModelIds: ReadonlySet<string> | readonly string[],
  requestedModelId: string,
  parameterId = "modelId",
): ModelChoiceDecision {
  const declared = declaredModelIds instanceof Set ? declaredModelIds : new Set(declaredModelIds);
  if (declared.size === 0)
    throw new TypeError("An instrument's models[] must declare at least one model.");
  if (declared.has(requestedModelId)) return { accepted: true, modelId: requestedModelId };
  return {
    accepted: false,
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds: [parameterId] },
      {
        details: {
          requestedModelId,
          declaredModelIds: [...declared].sort(),
        },
      },
    ),
  };
}

/**
 * A model choice and a fallback answer different questions and must never both be set on one
 * command (am-rt-command-classes-dzp requirement 10: "the two paths write disjoint fields").
 * Throws naming both fields when a caller has set both; never silently prefers one.
 */
export function assertModelChoiceAndFallbackAreDisjoint(command: {
  readonly modelId?: string | undefined;
  readonly fallbackReason?: string | undefined;
}): void {
  if (command.modelId !== undefined && command.fallbackReason !== undefined)
    throw new TypeError(
      "A command may carry modelId or fallbackReason, never both: a deliberate model choice is not a degradation.",
    );
}
