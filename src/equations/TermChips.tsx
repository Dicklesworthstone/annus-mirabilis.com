"use client";
import { type CSSProperties, useContext } from "react";
import { TermHighlightContext } from "./TermHighlight.tsx";
import { SymbolicValue, TermInspector } from "./TermInspector.tsx";
import type { TermFacts } from "./termFacts.ts";

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
  /** What the inspector says once this quantity is pinned (unit c). Absent, no inspector opens. */
  facts?: TermFacts | undefined;
}>;

export function TermChips({
  items,
  label,
  pressed,
  disabled,
  onPress,
  onClear,
  inline = false,
}: {
  items: readonly TermChipItem[];
  label: string;
  /** The pinned quantity id, if any: its chip is aria-pressed. */
  pressed: string | null;
  disabled: boolean;
  /** Given, a chip calls it; omitted, the block's delegated click listener pins the chip's quantity. */
  onPress?: ((quantityId: string) => void) | undefined;
  onClear?: (() => void) | undefined;
  /**
   * Phrasing content only, for a formula set inside a paragraph (a printed display on a reading
   * face): spans with list roles in place of the div, ul and li a <p> may not hold.
   */
  inline?: boolean | undefined;
}) {
  if (items.length === 0) return null;
  const Row = inline ? "span" : "div";
  const List = (inline ? "span" : "ul") as "ul";
  const Item = (inline ? "span" : "li") as "li";
  return (
    <Row className="term-chips-row" data-inline={inline ? "" : undefined}>
      {/* biome-ignore lint/a11y/useSemanticElements: inline, a <ul> would end the paragraph the formula is printed in. */}
      <List
        className="equation-legend term-chips"
        aria-label={label}
        role={inline ? "list" : undefined}
      >
        {items.map((item) => (
          // biome-ignore lint/a11y/useSemanticElements: as above, an <li> needs the <ul>.
          <Item key={`${item.quantityId} ${item.glyphHtml}`} role={inline ? "listitem" : undefined}>
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
          </Item>
        ))}
      </List>
      {pressed !== null && onClear ? (
        <button type="button" className="secondary term-chips-clear" onClick={onClear}>
          Clear the highlight
        </button>
      ) : null}
    </Row>
  );
}

/**
 * Chips inside a TermHighlight block, which pins, lights and reports readiness for them, and the
 * inspector for the pinned quantity. Nothing here follows the pointer: the inspector and the live
 * region change when a quantity is pinned or unpinned, which is a reader's commit, and never on a
 * mouse move, so a screen reader is not read a stream of names as the pointer crosses a formula.
 */
export function BlockTermChips({
  items,
  label,
  inline = false,
}: {
  items: readonly TermChipItem[];
  label: string;
  /** Phrasing content only (TermChips): for a formula set inside a paragraph. */
  inline?: boolean | undefined;
}) {
  const block = useContext(TermHighlightContext);
  const pinned = block?.pinned ?? null;
  const item = pinned === null ? undefined : items.find((i) => i.quantityId === pinned);
  return (
    <>
      <TermChips
        items={items}
        label={label}
        pressed={pinned}
        disabled={!block?.ready}
        onClear={block ? () => block.pin(null) : undefined}
        inline={inline}
      />
      {item?.facts ? (
        <TermInspector
          inline={inline}
          name={item.name}
          glyphHtml={item.glyphHtml}
          printedGlyphHtml={item.printedGlyphHtml}
          facts={item.facts}
          style={item.style}
          value={<SymbolicValue lab={item.facts.lab} />}
        />
      ) : null}
      {inline ? (
        <span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {item ? announcement(item) : ""}
        </span>
      ) : (
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {item ? announcement(item) : ""}
        </p>
      )}
    </>
  );
}

/** What the live region says on a pin: the name, and what the quantity does in this formula. */
export function announcement(item: Pick<TermChipItem, "name" | "facts">): string {
  const role = item.facts?.roles[0]?.explanation;
  return role ? `${item.name}. ${role}` : item.name;
}
