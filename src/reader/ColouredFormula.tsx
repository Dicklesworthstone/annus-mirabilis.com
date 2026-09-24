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
import { NotationNote } from "../equations/NotationNote.tsx";
import { quantityLegend } from "../equations/quantityColourView.ts";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import { QuantityLegendList } from "./QuantityLegendList.tsx";
import "../equations/equations.css";

export function ColouredFormula({ equations }: { equations: readonly CompiledEquation[] }) {
  // The notation toggle takes the row as one formula: it is drawn in Einstein's letters only when
  // no relation in it keeps today's, so a row never shows his V beside our c. A relation whose
  // letters are his and ours alike is drawn once in either state.
  const held = equations.some((e) => e.notationForm?.state === "modern");
  const printedOf = (e: CompiledEquation) =>
    !held && e.notationForm?.state === "printed" ? e.notationForm : undefined;
  const legend = quantityLegend(equations).map((item) => {
    const printedGlyphHtml = equations
      .map((e) => printedOf(e)?.glyphHtml[item.quantityId])
      .find((glyph) => glyph !== undefined);
    return printedGlyphHtml ? { ...item, printedGlyphHtml } : item;
  });
  const rowLabel = `Formula: ${equations.map((e) => e.title || e.id).join("; ")}`;
  return (
    <div className="reading-formula" data-equations={equations.map((e) => e.id).join(" ")}>
      {/* A tab stop because it can scroll: a relation wider than a phone scrolls inside its own
          line rather than pushing the page sideways, and a keyboard reader needs to reach that
          scroll. Named by the equations it shows; the focus ring is the global one. */}
      <section
        className="reading-formula-row"
        aria-label={rowLabel}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1); see the comment above.
        tabIndex={0}
      >
        {equations.map((equation) => {
          const printed = printedOf(equation);
          return (
            <div key={equation.id} className="reading-formula-relation">
              <div
                className="equation-visual"
                aria-hidden="true"
                data-notation-form={printed ? "modern" : undefined}
                {...{ dangerouslySetInnerHTML: { __html: equation.html } }}
              />
              <div
                className="equation-mathml"
                data-notation-form={printed ? "modern" : undefined}
                {...{ dangerouslySetInnerHTML: { __html: equation.mathml } }}
              />
              {printed ? (
                <>
                  <div
                    className="equation-visual"
                    aria-hidden="true"
                    data-notation-form="printed"
                    {...{ dangerouslySetInnerHTML: { __html: printed.html } }}
                  />
                  <div
                    className="equation-mathml"
                    data-notation-form="printed"
                    {...{ dangerouslySetInnerHTML: { __html: printed.mathml } }}
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </section>
      {held ? (
        <NotationNote
          seeAt={equations
            .map((e) => (e.notationForm?.state === "modern" ? e.notationForm.seeAt : undefined))
            .find((target) => target !== undefined)}
        />
      ) : null}
      <QuantityLegendList legend={legend} label="Quantities in this formula" />
    </div>
  );
}
