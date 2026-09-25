/**
 * A printed display in the explanation's colours (dispatch 224; the owner: "all the equations
 * should be done in the nice colored equation format that's interactive with hover over and all
 * that stuff"). The face keeps its own display element, now drawn with the coloured render
 * (printedDisplays.ts), and this wraps it with the same island and chips as the explanation's
 * formulas (ColouredFormula.tsx): pointing at, focusing or pressing a quantity lights it in the
 * formula and its chip, a press pins it and opens what the inspector knows, and Escape clears.
 *
 * The block is named by the display's authored spoken form. The coloured HTML stays aria-hidden and
 * the MathML beside it is what assistive technology reads, unchanged from before the colour.
 * Without JavaScript the colours are the stylesheet's, and the chips are disabled buttons that read
 * as the legend (noScriptControls.ts hides only enabled buttons), so no dead control shows.
 *
 * INLINE, most displays are set inside a paragraph's <p>: the block and its chips are then spans.
 * A face holds many displays, so their chips keep no live region of their own (BlockTermChips).
 */
import type { ReactNode } from "react";
import type { PrintedDisplayPayload } from "../../equations/printed/paperDisplays.ts";
import { colourStyle, paperQuantityColours } from "../../equations/quantityColourView.ts";
import { BlockTermChips } from "../../equations/TermChips.tsx";
import { TermHighlight } from "../../equations/TermHighlight.tsx";
import "../../equations/equations.css";

export function PrintedDisplayTerms({
  display,
  inline,
  children,
}: {
  display: PrintedDisplayPayload;
  inline: boolean;
  /** The face's own display element, holding display.html. */
  children: ReactNode;
}) {
  const colours = paperQuantityColours(display.paper);
  const items = display.legend.flatMap((line) => {
    const colour = colours[line.quantityId];
    return colour
      ? [
          {
            quantityId: line.quantityId,
            name: colour.name,
            glyphHtml: line.glyphHtml,
            style: colourStyle(colour),
            facts: display.facts[line.quantityId],
          },
        ]
      : [];
  });
  return (
    <TermHighlight
      as={inline ? "span" : "div"}
      className="printed-display-terms"
      data-paper={display.paper}
      data-display-terms={display.display}
      role="group"
      aria-label={display.spoken}
    >
      {children}
      <BlockTermChips
        inline={inline}
        announce={false}
        label="Quantities in this formula"
        items={items}
      />
    </TermHighlight>
  );
}
