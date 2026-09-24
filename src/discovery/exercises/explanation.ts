/**
 * Explanation parts of the exercise checker (am-disc-exercise-checker-i4h2): a question answered in
 * the reader's own words, a worked explanation, and a few concrete things a full explanation
 * mentions, shown on request. The outcome is always "needs-human-reading".
 *
 * The guarantee is structural, not a promise: explanationOutcome takes no reader text, so no
 * outcome can depend on what the reader wrote, and ExplanationPart is a server component, so no
 * code in the page ever reads the text box. Nothing is graded, scored, detected or sent.
 */

export interface ExplanationExercisePart {
  readonly id: string;
  readonly prompt: string;
  /** Two to five concrete things a full explanation mentions, each one sentence. */
  readonly criteria: readonly string[];
  readonly workedExplanation: string;
}

export type ExplanationOutcome =
  | Readonly<{
      kind: "needs-human-reading";
      /** What the reader does with the criteria: judge their own explanation against them. */
      sentence: string;
      criteria: readonly string[];
    }>
  | Readonly<{ kind: "invalid"; reason: string }>;

export const HUMAN_READING_SENTENCE =
  "Only a person can judge an explanation, and here that person is you. Read yours against each of these in turn:";

const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** The outcome of an explanation part, from its authored settings alone. Nothing throws. */
export function explanationOutcome(part: ExplanationExercisePart): ExplanationOutcome {
  if (!part || typeof part !== "object") return { kind: "invalid", reason: "No settings." };
  if (!text(part.id, 160) || !/^[a-z][a-z0-9-]*$/.test(part.id))
    return { kind: "invalid", reason: "The id must be lowercase and hyphenated." };
  if (!text(part.prompt, 4000)) return { kind: "invalid", reason: "The prompt is missing." };
  if (!text(part.workedExplanation, 8000))
    return { kind: "invalid", reason: "The worked explanation is missing." };
  const criteria = part.criteria;
  if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 5)
    return { kind: "invalid", reason: "An explanation part lists two to five criteria." };
  if (!criteria.every((c) => text(c, 400) && !/[\n\r]/.test(c)))
    return { kind: "invalid", reason: "Each criterion is one sentence on one line." };
  if (new Set(criteria).size !== criteria.length)
    return { kind: "invalid", reason: "Each criterion is listed once." };
  return Object.freeze({
    kind: "needs-human-reading",
    sentence: HUMAN_READING_SENTENCE,
    criteria: Object.freeze([...criteria]),
  });
}
