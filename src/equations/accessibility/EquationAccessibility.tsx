import React from "react";
import { type EquationPatternKind, evaluatePatternAccessibility } from "./patterns.ts";

export interface EquationAccessibilityProps {
  readonly equationId: string;
  readonly spokenText: string;
  readonly html: string;
  readonly mathml: string;
  readonly pattern?: EquationPatternKind;
  readonly title?: string;
  readonly hasVisibleCaption?: boolean;
  readonly className?: string;
  readonly children?: React.ReactNode;
  readonly onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  readonly onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  readonly tabIndex?: number;
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
 * Accessible formula wrapper implementing candidate patterns A, B, and C.
 *
 * Guarantees:
 * 1. KaTeX visual HTML is always aria-hidden="true".
 * 2. Exactly one accessible-name source exists per formula.
 * 3. Prevents duplicate speech announcements when a visible title/caption is present.
 */
export function EquationAccessibility({
  equationId,
  spokenText,
  html,
  mathml,
  pattern = "B",
  title,
  hasVisibleCaption = false,
  className = "",
  children,
  onKeyDown,
  onClick,
  tabIndex,
}: EquationAccessibilityProps) {
  const evalResult = evaluatePatternAccessibility({
    pattern,
    spokenText,
    html,
    mathml,
    hasVisibleCaption,
    title,
    equationId,
  });

  const baseClassName = `am-eq-accessible pattern-${pattern} ${className}`.trim();

  if (pattern === "A") {
    return (
      <div
        className={baseClassName}
        data-equation-id={equationId}
        data-pattern="A"
        data-a11y-name-source="sr-only-text"
        role="group"
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
      </div>
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
    <div
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
    </div>
  );
}
