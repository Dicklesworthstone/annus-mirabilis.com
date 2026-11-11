import type { ExpressionExercisePart } from "../exercises/answer.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import type { NumericExercisePart } from "../exercises/numeric.ts";

/** Existing checker parts, grouped into a transfer task rather than another discovery step. */
export type ConnectionExercisePart =
  | Readonly<{ kind: "numeric"; part: NumericExercisePart }>
  | Readonly<{ kind: "expression"; part: ExpressionExercisePart }>
  | Readonly<{ kind: "explanation"; part: ExplanationExercisePart }>;

export type ConnectionLink = Readonly<{ href: string; label: string }>;

export type ConnectionExerciseSection = Readonly<{
  id: string;
  title: string;
  paragraphs: readonly string[];
  parts: readonly ConnectionExercisePart[];
  links?: readonly ConnectionLink[];
}>;

export type ConnectionExercise = Readonly<{
  id: string;
  title: string;
  introduction: readonly string[];
  /** A modern synthesis is never silently presented as a premise available in 1904. */
  historicalStatus?: "later-development";
  sections: readonly ConnectionExerciseSection[];
  links: readonly ConnectionLink[];
}>;
