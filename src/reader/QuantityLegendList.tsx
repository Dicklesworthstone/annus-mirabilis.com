/**
 * Each quantity by its glyph, in its colour, and by its name: the legend under a reading formula
 * and the key to a section's symbols in the companion. One component, so the two cannot drift. The
 * name is the channel that does not depend on seeing colour, and the glyph is aria-hidden because
 * the name already says what it is.
 */
import { colourStyle, type quantityLegend } from "../equations/quantityColourView.ts";

export function QuantityLegendList({
  legend,
  label,
  className = "equation-legend",
}: {
  legend: ReturnType<typeof quantityLegend>;
  label: string;
  className?: string;
}) {
  if (legend.length === 0) return null;
  return (
    <ul className={className} aria-label={label}>
      {legend.map(({ quantityId, colour }) => (
        <li
          key={`${quantityId} ${colour.glyphHtml}`}
          className="equation-quantity"
          data-quantity-id={quantityId}
          style={colourStyle(colour)}
        >
          <span
            className="equation-legend-glyph"
            aria-hidden="true"
            {...{ dangerouslySetInnerHTML: { __html: colour.glyphHtml } }}
          />
          <span className="equation-legend-name">{colour.name}</span>
        </li>
      ))}
    </ul>
  );
}
