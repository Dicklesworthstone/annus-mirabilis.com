import { TermHighlight } from "../equations/TermHighlight.tsx";
import { type JourneyScope, journeyFormula } from "./journeyFormulas.ts";

export { journeyScope } from "./journeyFormulas.ts";

import "../equations/equations.css";
import "../generated/quantity-colours-by-paper.css";

/**
 * A discover page's formula in its paper's colours (dispatch 276): each term bound in its step's
 * scope (journeyFormulas.ts) is marked with its quantity, coloured as on the reading faces, and lit
 * with every other mark of the same quantity on pointing, focus or a press (TermHighlight). A
 * formula whose atoms are all operators or listed exceptions has nothing to colour and is drawn
 * as it is. One that does not resolve stops the build, naming its page and step.
 */
export function JourneyFormula({
  latex,
  scope,
  tabIndex,
  inline = false,
}: Readonly<{ latex: string; scope: JourneyScope; tabIndex?: number; inline?: boolean }>) {
  const compiled = journeyFormula(latex, scope, !inline);
  const Element = inline ? "span" : "div";
  const formula = (
    <Element
      className={inline ? "formula-inline" : "formula"}
      tabIndex={tabIndex}
      data-latex={latex}
      data-journey-formula={scope.anchor}
      data-journey-formula-bound={compiled.terms.length === 0 ? "none" : undefined}
      {...{ dangerouslySetInnerHTML: { __html: compiled.html } }}
    />
  );
  if (compiled.terms.length === 0) return formula;
  return (
    <TermHighlight as={Element} className="printed-display-terms" data-paper={scope.paper}>
      {formula}
    </TermHighlight>
  );
}
