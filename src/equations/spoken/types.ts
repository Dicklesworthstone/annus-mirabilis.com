/**
 * Types and schemas for authored spoken forms and equation accessibility (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f, am-eq-static-katex-7da.
 */

export type SpokenForms = Readonly<{
  /** ClearSpeak-style speech for the printed 1905 formula using historical symbols */
  printed: string;
  /** ClearSpeak-style speech for the modern representation */
  modern: string;
  /** Alternative verbal / conceptual explanation of the equation */
  alternate?: string | undefined;
  /** Short accessible title / name for the equation */
  shortName?: string | undefined;
}>;

export type TermRole =
  | "input"
  | "constant"
  | "model-result"
  | "operation"
  | "parameter"
  | "coordinate"
  | "field";

export type TermValueStatus =
  | "numeric"
  | "held-fixed"
  | "unmeasured"
  | "symbolic"
  | "varying"
  | "derived";

export type TermSpokenDetails = Readonly<{
  nodeId: string;
  name: string;
  role: TermRole;
  unit?: string | undefined;
  value?: string | undefined;
  status?: TermValueStatus | undefined;
  fixedOrChanging?: "fixed" | "changing" | "parameter" | undefined;
  speechText: string;
}>;

export type SpokenFormLintRule =
  | "no-raw-latex"
  | "no-dollar-delimiters"
  | "no-html-tags"
  | "no-x-prime-for-xi"
  | "unstated-integral-variable"
  | "no-d-over-dt"
  | "unmentioned-bound-term";

export type SpokenFormLintFinding = Readonly<{
  severity: "error" | "warning";
  rule: SpokenFormLintRule;
  message: string;
  match?: string | undefined;
}>;

export type SpokenFormLintResult = Readonly<{
  valid: boolean;
  findings: readonly SpokenFormLintFinding[];
  errors: readonly SpokenFormLintFinding[];
  warnings: readonly SpokenFormLintFinding[];
}>;
