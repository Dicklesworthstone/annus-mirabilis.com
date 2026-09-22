/**
 * A reading formula shown as the semantic equations that express it, coloured by quantity
 * (owner's ruling, 2026-09-22: "Per quantity (Recommended)"). The formula a reader meets in the
 * explanation is the one that carries the colour, not a plain copy with a coloured card further
 * down or behind a closed disclosure.
 *
 * Server-rendered and static: the coloured HTML is aria-hidden and the MathML beside it is what
 * assistive technology reads, as in SemanticEquation. The legend under it names every quantity by
 * glyph and name, which is the channel that does not depend on seeing colour. Exploring a term
 * stays with the explorer cards.
 */
import { quantityLegend } from "../equations/quantityColourView.ts";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import { QuantityLegendList } from "./QuantityLegendList.tsx";
import "../equations/equations.css";

export function ColouredFormula({ equations }: { equations: readonly CompiledEquation[] }) {
  const legend = quantityLegend(equations);
  return (
    <div className="reading-formula" data-equations={equations.map((e) => e.id).join(" ")}>
      <div className="reading-formula-row">
        {equations.map((equation) => (
          <div key={equation.id} className="reading-formula-relation">
            <div
              className="equation-visual"
              aria-hidden="true"
              {...{ dangerouslySetInnerHTML: { __html: equation.html } }}
            />
            <div
              className="equation-mathml"
              {...{ dangerouslySetInnerHTML: { __html: equation.mathml } }}
            />
          </div>
        ))}
      </div>
      <QuantityLegendList legend={legend} label="Quantities in this formula" />
    </div>
  );
}
