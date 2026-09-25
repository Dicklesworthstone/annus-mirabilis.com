/**
 * Rendering record for the expandable model note (am-inst-execution-labels-5ywv).
 *
 * Assembly of engine-selection facts, comparison kinds, and the parity ladder
 * belongs to am-rt-determinism-fallbacks-8i4 (`modelNoteData`, `replayMetadata.ts`).
 * That module does not exist yet; this bead must not invent a second copy of
 * those names. The note therefore renders the facts a snapshot already carries
 * (owners, revisions, seed as a decimal string) plus optional ordinary-language
 * sentences supplied by the caller. Comparison-kind and rung identifiers are
 * not declared here.
 */
import type { ExperimentView } from "../store/instanceStore.ts";

export type ModelNoteOutputRole = "primary" | "secondary";

export type ModelNoteOutput = Readonly<{
  outputId: string;
  ownerId: string;
  role: ModelNoteOutputRole;
  /** Already-resolved engine wording, never a loader flag. */
  engineSentence: string;
}>;

export type ModelNoteData = Readonly<{
  outputs: readonly ModelNoteOutput[];
  modelVersion?: string | undefined;
  artifactDigest?: string | undefined;
  constantSetId?: string | undefined;
  constantSetLabel?: string | undefined;
  /** Decimal string; never coerced through Number (values above 2^53 must survive). */
  seed?: string | undefined;
  streamVersion?: string | undefined;
  commonRandomNumbers?: boolean | undefined;
  acceptedInputRevision: number;
  snapshotVersion: number;
  /** Ordinary-language fallback sentence, already resolved by the owner bead. */
  fallbackSentence?: string | undefined;
  /** Ordinary-language model-choice sentence; never presented as a fallback. */
  modelChoiceSentence?: string | undefined;
  /** View substitution (2D in place of WebGL), distinct from an engine fallback. */
  viewSubstitutionSentence?: string | undefined;
  notModeled: string;
  showTheCodeHref?: string | undefined;
  /** Pre-authored ordinary-language parity sentences; identifiers live upstream. */
  paritySentences?: readonly string[] | undefined;
}>;

/**
 * Lists each accepted output's owner id from the store view. Engine selection
 * and primary-vs-secondary classification are not re-derived here: the caller
 * supplies `role` and `engineSentence` per output, or we fall back to a host
 * wording and treat every listed output as primary.
 */
export function modelNoteFromView(
  view: ExperimentView,
  options: Readonly<{
    notModeled: string;
    seed?: string;
    roles?: Readonly<Record<string, ModelNoteOutputRole>>;
    engineSentences?: Readonly<Record<string, string>>;
    showTheCodeHref?: string;
  }>,
): ModelNoteData | undefined {
  const accepted = view.accepted;
  if (!accepted) return undefined;
  const outputs: ModelNoteOutput[] = accepted.outputs.map((output) =>
    Object.freeze({
      outputId: output.quantityId,
      ownerId: output.ownerId,
      role: options.roles?.[output.quantityId] ?? "primary",
      // The public execution label verbatim, then what it means. The owner id is not repeated
      // here: the note names it after the sentence, "Computed in <code>owner</code>".
      engineSentence:
        options.engineSentences?.[output.quantityId] ??
        "Host calculation, by the site's own reference code.",
    }),
  );
  const seed =
    options.seed ??
    (typeof accepted.parameters.seed === "string" ? accepted.parameters.seed : undefined);
  return Object.freeze({
    outputs: Object.freeze(outputs),
    acceptedInputRevision: accepted.revisions.input,
    snapshotVersion: accepted.snapshotVersion,
    notModeled: options.notModeled,
    ...(seed === undefined ? {} : { seed }),
    ...(options.showTheCodeHref === undefined ? {} : { showTheCodeHref: options.showTheCodeHref }),
  });
}
