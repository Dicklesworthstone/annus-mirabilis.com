import { TermHighlight } from "../equations/TermHighlight.tsx";
import { EquationExplainer } from "../reader/faces/EquationExplainer.tsx";
import { journeyExplainer, journeyPageOf } from "./journeyExplainers.ts";
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
 *
 * "EXPLAIN THIS FORMULA" UNDER A DISPLAY (am-hk4b). A displayed formula carries the same control the
 * printed displays and the laboratories carry, from content/journey-explanations/: the paper's own
 * record where the journey draws one of its printed displays, so the reader meets the same words in
 * both places; the journey's own words for a form the paper does not print; and for a derivation
 * step, the step's own explanation as the full explanation with the record adding the equation in
 * words and the historian's margin. 739 lines and 39 entries had been authored and no reader could
 * reach any of them.
 *
 * An INLINE formula never carries it: the sentence around it is its explanation, which is the rule
 * the lab family states and the reason `inline` short-circuits below. A formula with no entry draws
 * no control rather than an empty one.
 *
 * The panel weighs what its words weigh and no more: its levels are in a static fragment it fetches
 * on first expansion, which for a reused record is the one the reading face already fetches.
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
  const lit =
    compiled.terms.length === 0 ? (
      formula
    ) : (
      <TermHighlight as={Element} className="printed-display-terms" data-paper={scope.paper}>
        {formula}
      </TermHighlight>
    );
  const explanation = inline ? undefined : journeyExplainer(scope, latex);
  if (explanation === undefined) return lit;
  // The pair is wrapped only where there is something to pair, so a page's markup is unchanged
  // wherever no entry has been written. The wrapper carries a data attribute and NO class, for the
  // reason LabFormula.tsx records: a className with no declared rule is caught by the
  // declared-classes ratchet, correctly, and this pair needs no styling.
  return (
    <div data-journey-formula-explained={journeyPageOf(scope)}>
      {lit}
      <EquationExplainer explanation={explanation} />
    </div>
  );
}
