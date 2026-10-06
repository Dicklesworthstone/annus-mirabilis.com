/**
 * A LABORATORY'S APPLY FAILURE, KEPT TYPED (am-ig23).
 *
 * `session.apply(settings)` returns an accepted result, a typed refusal, or an execution outcome. Seventeen
 * lab components do the same thing with the second case:
 *
 *     setError(r.kind === "refused"
 *       ? String(r.refusal.details?.requirements ?? r.refusal.message)
 *       : r.outcome.message);
 *
 * The reason text that produces is good. What it throws away is the refusal's IDENTITY and its REPAIRS.
 * Measured on bm-08 after entering an exposure of 0.3 s: the alert reads the right sentence, and no element
 * in the lab carries `data-refusal-code`, so the code `off-replay-grid` is nowhere; no element carries
 * `data-currency-state`, so the accepted readouts are not marked stale; and the `rankedRepairs` entry
 * `src/experiments/bm08/parameters.ts` supplies is never offered. AGENTS.md's contract asks for all four -
 * "freeze the illegal step, show the reason, and keep the last legal state", plus an admissible boundary
 * offered - and three of them were lost at this one assignment.
 *
 * The same component already renders the typed surface correctly for a WORKER refusal, twenty lines further
 * down, with `data-refusal-code`, the ranked repairs and a reset. So the two paths disagree inside one file:
 * a refusal raised while validating the request takes the codeless path and one raised by the worker takes
 * the typed one.
 *
 * This module is the shared half, so the seventeen can converge on one shape rather than seventeen. It holds
 * no JSX: a component's repair buttons need its own parameter type and its own apply function, and a
 * generic renderer would either take them as untyped props or force every lab through one layout. What is
 * genuinely shared is the DISCRIMINATION and the SENTENCE, and both were being written out by hand.
 */

import type { ExecutionOutcome } from "./outcomes.ts";
import { refusalSentence } from "./refusalSentence.ts";
import type { RequestRefusal } from "./refusals.ts";

/** What a lab's `apply()` has to tell its reader when the request was not accepted. */
export type ApplyFailure =
  | Readonly<{ kind: "refused"; refusal: RequestRefusal; text: string }>
  | Readonly<{ kind: "unavailable"; outcome: ExecutionOutcome; text: string }>
  /**
   * A result that is neither accepted, refused, nor carrying an outcome.
   *
   * It gets its own variant rather than a fabricated ExecutionOutcome. Inventing one would mean choosing a
   * code and a retry guidance this layer has no basis for, and an invented outcome is indistinguishable
   * downstream from one the engine actually raised - which is exactly the honesty this module exists to
   * restore.
   */
  | Readonly<{ kind: "unexplained"; resultKind: string; text: string }>;

/**
 * A PARAMETER REFUSAL THROWN BY A DRAFT PARSER, with the refusal kept on it.
 *
 * THE REAL SITE, one layer below the component. `fromCameraDraft` in src/experiments/bm08/controls.ts
 * validated the form and then did this:
 *
 *     throw new TypeError(
 *       r.kind === "refused" ? String(r.refusal.details?.requirements ?? r.refusal.message) : r.outcome.message,
 *     );
 *
 * so by the time the component's `catch` saw it the refusal was already gone. Measured on the built export
 * after entering an exposure of 0.3 s: the notice carried `data-apply-failure="unexplained"` and no code,
 * even after the component was fixed to keep a typed failure, because what reached it was a TypeError whose
 * message happened to be the right sentence. Five `controls.ts` modules do this, four of them in exactly
 * these words.
 *
 * The sentence those throws produce is correct and the reader sees it. What is lost is the code, the ranked
 * repairs and the staleness marking - and losing them in a `throw` is worse than losing them in a `setState`,
 * because nothing downstream can tell this apart from an ordinary programming error.
 */
export class ParameterRefusalError extends Error {
  readonly refusal: RequestRefusal;
  constructor(refusal: RequestRefusal) {
    super(refusalSentence(refusal));
    this.name = "ParameterRefusalError";
    this.refusal = refusal;
  }
}

/**
 * Turn a thrown value back into a typed failure.
 *
 * A ParameterRefusalError restores the whole refusal. Anything else keeps its message, or the caller's
 * fallback sentence when it has none, as an `unexplained` failure - which is honest: an ordinary throw from
 * a draft parser is a programming error and not a refusal the model raised.
 */
export function failureFromThrown(error: unknown, fallback: string): ApplyFailure {
  if (error instanceof ParameterRefusalError)
    return { kind: "refused", refusal: error.refusal, text: refusalSentence(error.refusal) };
  return {
    kind: "unexplained",
    resultKind: "threw",
    text: error instanceof Error && error.message.trim().length > 0 ? error.message : fallback,
  };
}

/**
 * Discriminate an apply result, keeping the refusal itself.
 *
 * Returns null for an accepted result, so a caller reads as `const failure = applyFailure(r); if (failure)`.
 * The shape is deliberately the narrowest thing every one of the seventeen needs: the kind, the typed
 * refusal where there is one, and the sentence.
 */
export function applyFailure(result: {
  kind: string;
  refusal?: RequestRefusal;
  outcome?: ExecutionOutcome;
}): ApplyFailure | null {
  if (result.kind === "accepted") return null;
  if (result.kind === "refused" && result.refusal)
    return { kind: "refused", refusal: result.refusal, text: refusalSentence(result.refusal) };
  if (result.outcome)
    return { kind: "unavailable", outcome: result.outcome, text: result.outcome.message };
  // Neither a refusal nor an outcome: a result shape this layer does not know. Named rather than silently
  // treated as accepted, because an apply that neither accepted nor explained itself is the one case a
  // reader cannot be told anything about.
  return {
    kind: "unexplained",
    resultKind: result.kind,
    text: `The laboratory did not accept these settings and gave no reason. The results shown are the last accepted ones.`,
  };
}

/**
 * The refusal's code when there is one, for `data-refusal-code`.
 *
 * Separate from the sentence because the attribute is what a browser check keys on and what makes a refusal
 * auditable after the fact: a reason a reader can read and a code a gate can find are two different
 * obligations, and the seventeen were meeting only the first.
 */
export function failureCode(failure: ApplyFailure): string | undefined {
  return failure.kind === "refused" ? failure.refusal.code : undefined;
}
