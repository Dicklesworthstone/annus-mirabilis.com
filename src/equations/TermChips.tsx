"use client";
import { type CSSProperties, useContext } from "react";
import { TermHighlightContext } from "./TermHighlight.tsx";

/**
 * THE TERM CHIPS (dispatch 144 unit b): each quantity of a formula as a button with a dot of its
 * colour, its glyph and its name, replacing the plain legend. Pointing at or focusing a chip lights
 * the quantity everywhere in its block; pressing one pins it, pressing it again or Escape or the
 * clear button unpins.
 *
 * WITHOUT JAVASCRIPT the chips are disabled buttons, so they stay visible and read as the legend
 * they replace: noScriptControls.ts hides only enabled buttons, which JavaScript alone could work.
 * The keyboard reaches every quantity through them, one tab stop each, while no glyph in the
 * formula is a tab stop.
 */
export type TermChipItem = Readonly<{
  quantityId: string;
  name: string;
  glyphHtml: string;
  /** The glyph in Einstein's letters, shown instead under html[data-notation] (notation toggle). */
  printedGlyphHtml?: string | undefined;
  style?: CSSProperties | undefined;
}>;

export function TermChips({
  items,
  label,
  pressed,
  disabled,
  onPress,
  onClear,
}: {
  items: readonly TermChipItem[];
  label: string;
  /** The pinned quantity id, if any: its chip is aria-pressed. */
  pressed: string | null;
  disabled: boolean;
  /** Given, a chip calls it; omitted, the block's delegated click listener pins the chip's quantity. */
  onPress?: ((quantityId: string) => void) | undefined;
  onClear?: (() => void) | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <div className="term-chips-row">
      <ul className="equation-legend term-chips" aria-label={label}>
        {items.map((item) => (
          <li key={`${item.quantityId} ${item.glyphHtml}`}>
            <button
              type="button"
              className="term-chip"
              data-quantity-id={item.quantityId}
              style={item.style}
              aria-pressed={pressed === item.quantityId}
              disabled={disabled}
              onClick={onPress ? () => onPress(item.quantityId) : undefined}
            >
              <span className="term-chip-dot" aria-hidden="true" />
              {item.glyphHtml ? (
                <span
                  className="equation-legend-glyph"
                  aria-hidden="true"
                  data-notation-form={item.printedGlyphHtml ? "modern" : undefined}
                  {...{ dangerouslySetInnerHTML: { __html: item.glyphHtml } }}
                />
              ) : null}
              {item.printedGlyphHtml ? (
                <span
                  className="equation-legend-glyph"
                  aria-hidden="true"
                  data-notation-form="printed"
                  {...{ dangerouslySetInnerHTML: { __html: item.printedGlyphHtml } }}
                />
              ) : null}
              <span className="equation-legend-name">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {pressed !== null && onClear ? (
        <button type="button" className="secondary term-chips-clear" onClick={onClear}>
          Clear the highlight
        </button>
      ) : null}
    </div>
  );
}

/** Chips inside a TermHighlight block, which pins, lights and reports readiness for them. */
export function BlockTermChips({
  items,
  label,
}: {
  items: readonly TermChipItem[];
  label: string;
}) {
  const block = useContext(TermHighlightContext);
  return (
    <TermChips
      items={items}
      label={label}
      pressed={block?.pinned ?? null}
      disabled={!block?.ready}
      onClear={block ? () => block.pin(null) : undefined}
    />
  );
}
