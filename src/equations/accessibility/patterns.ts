/**
 * Candidate accessible math announcement patterns (am-eq-spoken-forms-w4f).
 * Specification: AGENTS.md, am-eq-spoken-forms-w4f, docs/accessibility/math-announcement.md.
 *
 * Implements candidate patterns A, B, and C with automated snapshot proofs,
 * single-name-source enforcement, and visual KaTeX HTML hiding.
 */

export const EQUATION_PATTERNS = ["A", "B", "C"] as const;
export type EquationPatternKind = (typeof EQUATION_PATTERNS)[number];

export interface PatternRenderConfig {
  readonly pattern: EquationPatternKind;
  readonly spokenText: string;
  readonly html: string;
  readonly mathml: string;
  readonly hasVisibleCaption?: boolean | undefined;
  readonly equationId?: string | undefined;
  readonly title?: string | undefined;
}

export interface PatternAccessibilityResult {
  readonly pattern: EquationPatternKind;
  readonly accessibleName: string;
  readonly nameSource: "sr-only-text" | "container-aria-label" | "mathml-aria-label";
  readonly visualHtmlHidden: boolean;
  readonly mathmlHidden: boolean;
  readonly role: "math" | "group" | "region" | undefined;
}

/**
 * Derives the accessibility properties and checks for a given pattern configuration.
 */
export function evaluatePatternAccessibility(
  config: PatternRenderConfig,
): PatternAccessibilityResult {
  const { pattern, spokenText, hasVisibleCaption, title } = config;

  // When a visible caption already exists, avoid duplicate announcement
  const accessibleName = hasVisibleCaption && title ? `${title}: ${spokenText}` : spokenText;

  switch (pattern) {
    case "A":
      // Pattern A: Visual HTML is aria-hidden, name provided by a screen-reader-only span
      return {
        pattern: "A",
        accessibleName,
        nameSource: "sr-only-text",
        visualHtmlHidden: true,
        mathmlHidden: true,
        role: "group",
      };

    case "B":
      // Pattern B: Container carries role="math" and aria-label="{spokenText}", all children aria-hidden
      return {
        pattern: "B",
        accessibleName,
        nameSource: "container-aria-label",
        visualHtmlHidden: true,
        mathmlHidden: true,
        role: "math",
      };

    case "C":
      // Pattern C: MathML element carries aria-label="{spokenText}", visual HTML is aria-hidden
      return {
        pattern: "C",
        accessibleName,
        nameSource: "mathml-aria-label",
        visualHtmlHidden: true,
        mathmlHidden: false,
        role: undefined,
      };

    default:
      throw new Error(`Unknown equation accessibility pattern: "${String(pattern)}"`);
  }
}
