"use client";
import { type CSSProperties, useContext, useEffect } from "react";
import { announce as announceToReader } from "../a11y/announce.ts";
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
  /**
   * Where the chip links until JavaScript has run (dispatch 254): a real link to the quantity's
   * entry on /notation/, since a reader without JavaScript can follow a link and not a button.
   * After mount it is the button that pins the inspector. Absent, the chip is a disabled button
   * until then, as before.
   */
  href?: string | undefined;
  /** The link's accessible name, where the name alone would name several destinations. */
  hrefLabel?: string | undefined;
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
      {/* Inline, the list roles stand in for a <ul> and <li>, which would end the paragraph. */}
      <List
        className="equation-legend term-chips"
        aria-label={label}
        role={inline ? "list" : undefined}
      >
        {items.map((item) => (
          <Item key={`${item.quantityId} ${item.glyphHtml}`} role={inline ? "listitem" : undefined}>
            {disabled && item.href ? (
              <a
                className="term-chip"
                href={item.href}
                aria-label={item.hrefLabel}
                data-quantity-id={item.quantityId}
                style={item.style}
              >
                <ChipContent item={item} />
              </a>
            ) : (
              <button
                type="button"
                className="term-chip"
                data-quantity-id={item.quantityId}
                style={item.style}
                aria-pressed={pressed === item.quantityId}
                disabled={disabled}
                onClick={onPress ? () => onPress(item.quantityId) : undefined}
              >
                <ChipContent item={item} />
              </button>
            )}
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
 * A chip's glyph (printed, and modern under the notation toggle) and name.
 *
 * THE DOT IS GONE (dispatch 499). The chip carried its quantity's colour five times over: a dot, the
 * glyph, the label text, the border and a filled background tint. A screenshot pass found the chips
 * "the loudest things on a page whose job is reading", and on the parallel face the same legend
 * appears in both columns, so every excess is paid twice on one screen. What remains is the glyph in
 * its colour and the name in words, which is what AGENTS.md's rule requires: colour helps identify
 * meaning and never carries it alone, so the two NON-colour carriers are the floor and the dot was
 * never one of them.
 */
function ChipContent({ item }: { item: TermChipItem }) {
  return (
    <>
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
    </>
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
  announce = true,
}: {
  items: readonly TermChipItem[];
  label: string;
  /** Phrasing content only (TermChips): for a formula set inside a paragraph. */
  inline?: boolean | undefined;
  /**
   * Whether pinning a term is announced at all. It used to mean "render a live region of my own",
   * and was passed false where a page holds many such blocks (a reading face's printed displays,
   * dispatch 224) because "one live region each would put seven on mass-energy's English face and
   * fifty-two on light quanta's German face".
   *
   * THAT REASON IS GONE, because the announcement now goes through the site's one shared region
   * (src/a11y/announce.ts) instead of a region per block. Measured in a browser on 2026-10-28,
   * before the change: 24 concurrent live regions on relativity's reading page, TWENTY of them this
   * one, 22 on light quanta and 15 on mass-energy. The explanation face was never passed false, and
   * the default is true, so the page the docblock warns about had exactly the defect it describes.
   *
   * The prop stays because a caller may still want no announcement; it no longer costs a region.
   */
  announce?: boolean | undefined;
}) {
  const block = useContext(TermHighlightContext);
  const pinned = block?.pinned ?? null;
  const item = pinned === null ? undefined : items.find((i) => i.quantityId === pinned);
  /*
   * ONE SHARED REGION, NOT ONE PER BLOCK. `announce()` writes into `#a11y-live-region`, which the
   * root layout renders empty and server-side so the region exists before the first update rather
   * than being created in the same tick as the text it carries -- which is the shape a screen
   * reader can miss, and which this utility had to fall back to while nothing rendered the element.
   *
   * Keyed on the STRING, so a re-render that recomputes the same sentence announces nothing. An
   * empty string is not an announcement: `announce()` returns early, which is the behaviour the
   * rendered region had when a pin was cleared.
   */
  const spoken = announce && item ? announcement(item) : "";
  useEffect(() => {
    if (spoken !== "") announceToReader(spoken);
  }, [spoken]);
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
    </>
  );
}

/** What the live region says on a pin: the name, and what the quantity does in this formula. */
export function announcement(item: Pick<TermChipItem, "name" | "facts">): string {
  const role = item.facts?.roles[0]?.explanation;
  return role ? `${item.name}. ${role}` : item.name;
}
