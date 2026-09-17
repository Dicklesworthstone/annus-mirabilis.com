/**
 * What this family cannot settle (am-cm-checks-epistemic-o7n).
 *
 * A green compiler that implies more verification than it performs is the
 * failure mode this layer exists to prevent. These ids are never registered
 * as error checks.
 */

export type UndecidableCheck = Readonly<{
  id: string;
  reason: string;
}>;

export const EPISTEMIC_UNDECIDABLE: readonly UndecidableCheck[] = Object.freeze([
  Object.freeze({
    id: "faithfulness-to-source",
    reason:
      "Whether an explanation is faithful to a cited source is a human review question. The compiler can require a citation and refuse an unsigned review; it cannot certify that the prose matches the source.",
  }),
  Object.freeze({
    id: "einstein-knowledge",
    reason:
      "Whether Einstein knew or used a result is not settled by a date. Influence claims are flagged for review; they are never auto-promoted to evidence.",
  }),
  Object.freeze({
    id: "fair-hearing-for-alternatives",
    reason:
      "Whether a rival is presented fairly is editorial. No check encodes that an empirically equivalent alternative is refuted.",
  }),
  Object.freeze({
    id: "approximation-adequacy",
    reason:
      "The compiler can require an approximation to be labeled. It cannot decide whether the approximation is scientifically adequate.",
  }),
  Object.freeze({
    id: "simulator-matches-nature",
    reason:
      "A simulator can be refused as empirical-observation support. It cannot be certified as a measurement of the world.",
  }),
]);
