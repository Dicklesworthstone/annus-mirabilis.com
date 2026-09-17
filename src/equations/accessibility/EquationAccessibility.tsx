import type React from "react";
import { type EquationPatternKind, evaluatePatternAccessibility } from "./patterns.ts";

export interface EquationAccessibilityProps {
  readonly equationId: string;
  readonly title: string;
  readonly spokenText: string;
  readonly html: string;
  readonly mathml: string;
  readonly pattern?: EquationPatternKind | undefined;
  readonly className?: string | undefined;
  readonly tabIndex?: number | undefined;
  readonly onKeyDown?: ((e: React.KeyboardEvent<HTMLElement>) => void) | undefined;
  readonly onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
  readonly children?: React.ReactNode | undefined;
}

/**
 * Injects aria-label="{spokenText}" into the root <math ...> element of MathML markup.
 */
function injectMathMlAriaLabel(mathml: string, label: string): string {
  if (!mathml.includes("<math")) return mathml;
  const escaped = label.replace(/"/g, "&quot;");
  return mathml.replace(/<math(\s|>)/, `<math aria-label="${escaped}"$1`);
}

/**
 * Universal accessible math component implementing the 3 research-backed patterns (am-eq-spoken-forms-w4f):
 * - Pattern A: Visually hidden screen reader text span (.sr-only), math visual & mathml aria-hidden.
 * - Pattern B: Container aria-label with role="math", internal math visual & mathml aria-hidden.
 * - Pattern C: MathML element itself annotated with aria-label, KaTeX visual HTML aria-hidden.
 */
export function EquationAccessibility({
  equationId,
  title,
  spokenText,
  html,
  mathml,
  pattern = "B",
  className = "",
  tabIndex,
  onKeyDown,
  onClick,
  children,
}: EquationAccessibilityProps) {
  const evalResult = evaluatePatternAccessibility({
    pattern,
    spokenText,
    html,
    mathml,
    title,
    equationId,
  });
  const baseClassName = `am-eq-accessible pattern-${pattern} ${className}`.trim();

  if (pattern === "A") {
    return (
      <figure
        className={baseClassName}
        data-equation-id={equationId}
        data-pattern="A"
        data-a11y-name-source="sr-only-text"
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <span className="sr-only" data-a11y-spoken-name="true">
          {evalResult.accessibleName}
        </span>
        <div
          className="equation-visual"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div
          className="equation-mathml"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: mathml }}
        />
        {children}
      </figure>
    );
  }

  if (pattern === "B") {
    return (
      <figure
        className={baseClassName}
        data-equation-id={equationId}
        data-pattern="B"
        data-a11y-name-source="container-aria-label"
        role="math"
        aria-label={evalResult.accessibleName}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <div
          className="equation-visual"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div
          className="equation-mathml"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: mathml }}
        />
        {children}
      </figure>
    );
  }

  // Pattern C: MathML carries aria-label
  const mathmlAnnotated = injectMathMlAriaLabel(mathml, evalResult.accessibleName);

  return (
    <figure
      className={baseClassName}
      data-equation-id={equationId}
      data-pattern="C"
      data-a11y-name-source="mathml-aria-label"
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div
        className="equation-visual"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div
        className="equation-mathml"
        data-a11y-mathml="true"
        dangerouslySetInnerHTML={{ __html: mathmlAnnotated }}
      />
      {children}
    </figure>
  );
}
