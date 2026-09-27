"use client";

/**
 * INLINE FORMULAS AS TARGETS (dispatch 272; the owner: "a ton of equations that aren't properly
 * using the colored equations with latex system"). One island per reading face. Pointing at a
 * coloured glyph in an inline formula lights every copy of its quantity on the page, in the inline
 * formulas and in the printed displays, and only in its own paper; pressing it pins the quantity
 * and opens the inspector just after the formula; a second press, a press elsewhere, or Escape
 * clears it.
 *
 * LIGHT ON THE PAGE, NOT IN A ROW. An inline formula keeps no chip row under its sentence: the
 * inspector appears on activation only. The glyphs and their quantity ids are in the server-rendered
 * page, the facts arrive once, as props, and the island holds no formula of its own.
 *
 * EXACT IDS ONLY, as TermHighlight: copies are found by string equality on data-quantity-id
 * (elementsOfQuantity), never by prefix, and the paper is read from each copy's own data-paper, so
 * relativity's V is never lit by mass-energy's. The controller clears only what it lit, so a
 * display block's own lighting (TermHighlight) is left alone.
 *
 * A CHIP IS A TARGET TOO (dispatch 290; the owner: "all must have the nice hover-over effects").
 * Pointing at a glyph in a formula already lit every copy of its quantity on the page, chips
 * included: measured on the build of 8d42d5ef, relativity's German face lit all 500 copies of
 * coordinateTimeStationary, 38 of them chips. Pointing at the CHIP lit 17, its own display block
 * and no further, because the block's own controller (TermHighlight) lights what it contains and
 * nothing else. The two directions now match. The island lights the copies OUTSIDE the chip's own
 * block and leaves those inside it to that block, so no element is lit by two owners and each
 * clears only what it lit. The pin stays the block's: a chip already opens the inspector under its
 * own formula, and a second one would be a second answer to one press.
 *
 * LABELS TOO (dispatch 280, step 1b; the owner: "all must have the nice hover-over effects"). A
 * letter the notation declares no quantity, a point A, an axis X, a system K, is marked data-label:
 * pointing at it lights every copy of the same label, which is the same reading in the same section,
 * and pressing it pins a note saying what it names. It keeps the ink: it has no quantity's colour.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { elementsOfQuantity } from "./TermHighlight.tsx";
import { SymbolicValue, TermInspector } from "./TermInspector.tsx";
import type { TermFacts } from "./termFacts.ts";

export type InlineQuantity = Readonly<{
  name: string;
  glyphHtml: string;
  facts: TermFacts;
  href: string;
  hrefMeaning?: string | undefined;
}>;

/** What a label names, in the reader's words (inlineLabels.ts). */
export type InlineLabelNote = string;

/**
 * A pinned quantity, or a pinned label, and the inline formula it was pinned from. Exactly one of
 * quantityId and labelId is set.
 */
export type InlinePin = Readonly<{
  quantityId?: string | undefined;
  labelId?: string | undefined;
  formula: Element;
}>;

const paperOf = (element: Element): string | null =>
  element.closest("[data-paper]")?.getAttribute("data-paper") ?? null;

/** The coloured glyph of an inline formula of this paper at target, if there is one. */
function inlineGlyphAt(paper: string, target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const glyph = target.closest("[data-quantity-id]");
  const formula = glyph?.closest(".inline-math[data-inline-terms]");
  return glyph && formula && formula.getAttribute("data-paper") === paper ? glyph : null;
}

/** The label of an inline formula of this paper at target, if there is one. */
function inlineLabelAt(paper: string, target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const label = target.closest("[data-label]");
  const formula = label?.closest(".inline-math[data-inline-labels]");
  return label && formula && formula.getAttribute("data-paper") === paper ? label : null;
}

/** What is under the pointer: a quantity or a label, by id, and the formula it stands in. */
function markAt(
  paper: string,
  target: EventTarget | null,
): Readonly<{ quantityId?: string; labelId?: string; formula: Element }> | null {
  const glyph = inlineGlyphAt(paper, target);
  if (glyph)
    return {
      quantityId: glyph.getAttribute("data-quantity-id") as string,
      formula: glyph.closest(".inline-math") as Element,
    };
  const label = inlineLabelAt(paper, target);
  if (label)
    return {
      labelId: label.getAttribute("data-label") as string,
      formula: label.closest(".inline-math") as Element,
    };
  return null;
}

/**
 * What the pointer is on for LIGHTING: a mark, or a chip. A chip carries the block that lights its
 * own copies, so the island can leave that block's elements alone.
 */
function litTargetAt(
  paper: string,
  target: EventTarget | null,
): Readonly<{ quantityId?: string; labelId?: string; ownBlock?: Element | null }> | null {
  const mark = markAt(paper, target);
  if (mark) return mark;
  const chip = chipAt(paper, target);
  return chip
    ? {
        quantityId: chip.getAttribute("data-quantity-id") as string,
        ownBlock: chip.closest("[data-display-terms]"),
      }
    : null;
}

/** The chip of this paper at target, if there is one: a legend chip carrying a quantity. */
function chipAt(paper: string, target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const chip = target.closest(".term-chip[data-quantity-id]");
  return chip && paperOf(chip) === paper ? chip : null;
}

/** Every copy of one label on the page, in this paper's inline formulas. */
function copiesOfLabel(root: Element, paper: string, labelId: string): Element[] {
  return [...root.querySelectorAll("[data-label]")].filter(
    (element) =>
      element.getAttribute("data-label") === labelId &&
      element.closest(".inline-math")?.getAttribute("data-paper") === paper,
  );
}

/**
 * Attaches the page's inline lighting under root and returns what detaches it. Framework-free, so
 * a DOM test drives it with native events as a reader's browser does. onPin hears every pin and
 * every clear.
 */
export function attachInlineLighting(
  root: Element,
  paper: string,
  onPin: (pin: InlinePin | null) => void,
): () => void {
  const owner = root.ownerDocument;
  // What the pointer is on, as "q:<quantity id>" or "l:<label id>", so the two never collide.
  let hovered: string | null = null;
  // The block that lights the hovered chip's own copies, which this island leaves to it.
  let hoveredOwnBlock: Element | null = null;
  let pinned: InlinePin | null = null;
  let lit: Element[] = [];
  const keyOf = (mark: Pick<InlinePin, "quantityId" | "labelId"> | null) =>
    mark?.quantityId !== undefined
      ? `q:${mark.quantityId}`
      : mark?.labelId !== undefined
        ? `l:${mark.labelId}`
        : null;
  const update = () => {
    for (const element of lit) element.removeAttribute("data-lit");
    const active = hovered ?? keyOf(pinned);
    lit =
      active === null
        ? []
        : active.startsWith("l:")
          ? copiesOfLabel(root, paper, active.slice(2))
          : elementsOfQuantity(root, active.slice(2)).filter(
              (element) =>
                paperOf(element) === paper &&
                !hoveredOwnBlock?.contains(element),
            );
    for (const element of lit) element.setAttribute("data-lit", "true");
  };
  const pin = (next: InlinePin | null) => {
    pinned = next;
    onPin(next);
    update();
  };
  const onOver = (event: Event) => {
    const target = litTargetAt(paper, event.target);
    hovered = keyOf(target ?? null);
    hoveredOwnBlock = target?.ownBlock ?? null;
    update();
  };
  const onLeave = () => {
    hovered = null;
    hoveredOwnBlock = null;
    update();
  };
  const onClick = (event: Event) => {
    const mark = markAt(paper, event.target);
    if (mark) {
      pin(pinned && keyOf(pinned) === keyOf(mark) && pinned.formula === mark.formula ? null : mark);
      return;
    }
    // A press inside the open inspector (its notation link) keeps the pin.
    if (event.target instanceof Element && event.target.closest("[data-inline-inspector]")) return;
    if (pinned) pin(null);
  };
  const onKey = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape" || (!pinned && hovered === null)) return;
    hovered = null;
    hoveredOwnBlock = null;
    pin(null);
  };
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("click", onClick);
  owner.addEventListener("keydown", onKey);
  return () => {
    root.removeEventListener("pointerover", onOver);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("click", onClick);
    owner.removeEventListener("keydown", onKey);
    for (const element of lit) element.removeAttribute("data-lit");
    lit = [];
  };
}

/** The island: attaches the lighting to the page's main and sets the inspector after a pin. */
export function InlineTermLighting({
  paper,
  quantities,
  labels = {},
}: {
  paper: string;
  quantities: Readonly<Record<string, InlineQuantity>>;
  /** What each name the paper prints says (dispatch 280): a point, an axis, a system, a sign. */
  labels?: Readonly<Record<string, InlineLabelNote>>;
}) {
  const [pin, setPin] = useState<InlinePin | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    return attachInlineLighting(root, paper, setPin);
  }, [paper]);
  // The inspector stands just after the formula it was pinned from, inside its sentence: a span of
  // this island's own, removed when the pin clears.
  useEffect(() => {
    if (!pin) {
      setHost(null);
      return;
    }
    const span = document.createElement("span");
    span.setAttribute("data-inline-inspector", "");
    span.setAttribute("data-paper", paper);
    pin.formula.after(span);
    setHost(span);
    return () => span.remove();
  }, [pin, paper]);
  if (!pin || !host) return null;
  const note = pin.labelId === undefined ? undefined : labels[pin.labelId];
  if (note) return createPortal(<LabelNote note={note} />, host);
  const quantity = pin.quantityId === undefined ? undefined : quantities[pin.quantityId];
  if (!quantity || pin.quantityId === undefined) return null;
  return createPortal(
    <TermInspector
      inline
      name={quantity.name}
      glyphHtml={quantity.glyphHtml}
      glyphQuantityId={pin.quantityId}
      facts={quantity.facts}
      value={<SymbolicValue lab={quantity.facts.lab} />}
    >
      <a href={quantity.href}>
        {quantity.hrefMeaning ? `In the notation: ${quantity.hrefMeaning}` : "In the notation"}
      </a>
    </TermInspector>,
    host,
  );
}

/**
 * A pinned label's note: its glyph and what it names, set out as the inspector sets out a
 * quantity, inside the sentence. It has no unit, dimension or value, because it names no quantity.
 */
function LabelNote({ note }: { note: string }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: inline, a <fieldset> would end the paragraph the formula is printed in, and it groups form controls, not a note.
    <span
      className="term-inspector inline-label-note"
      role="group"
      aria-label="About this letter"
      data-inline=""
    >
      <span className="term-inspector-name">
        <strong>{note}</strong>
      </span>
      <span className="term-inspector-facts">
        <span className="term-inspector-fact">
          <span className="term-inspector-fact-value">A name in the text, not a quantity.</span>
        </span>
      </span>
    </span>
  );
}
