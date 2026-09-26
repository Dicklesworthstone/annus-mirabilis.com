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

/** A pinned quantity and the inline formula it was pinned from. */
export type InlinePin = Readonly<{ quantityId: string; formula: Element }>;

const paperOf = (element: Element): string | null =>
  element.closest("[data-paper]")?.getAttribute("data-paper") ?? null;

/** The coloured glyph of an inline formula of this paper at target, if there is one. */
function inlineGlyphAt(paper: string, target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const glyph = target.closest("[data-quantity-id]");
  const formula = glyph?.closest(".inline-math[data-inline-terms]");
  return glyph && formula && formula.getAttribute("data-paper") === paper ? glyph : null;
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
  let hovered: string | null = null;
  let pinned: InlinePin | null = null;
  let lit: Element[] = [];
  const update = () => {
    for (const element of lit) element.removeAttribute("data-lit");
    const active = hovered ?? pinned?.quantityId ?? null;
    lit =
      active === null
        ? []
        : elementsOfQuantity(root, active).filter((element) => paperOf(element) === paper);
    for (const element of lit) element.setAttribute("data-lit", "true");
  };
  const pin = (next: InlinePin | null) => {
    pinned = next;
    onPin(next);
    update();
  };
  const onOver = (event: Event) => {
    hovered = inlineGlyphAt(paper, event.target)?.getAttribute("data-quantity-id") ?? null;
    update();
  };
  const onLeave = () => {
    hovered = null;
    update();
  };
  const onClick = (event: Event) => {
    const glyph = inlineGlyphAt(paper, event.target);
    if (glyph) {
      const quantityId = glyph.getAttribute("data-quantity-id") as string;
      const formula = glyph.closest(".inline-math") as Element;
      pin(
        pinned?.quantityId === quantityId && pinned.formula === formula
          ? null
          : { quantityId, formula },
      );
      return;
    }
    // A press inside the open inspector (its notation link) keeps the pin.
    if (event.target instanceof Element && event.target.closest("[data-inline-inspector]")) return;
    if (pinned) pin(null);
  };
  const onKey = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape" || (!pinned && hovered === null)) return;
    hovered = null;
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
}: {
  paper: string;
  quantities: Readonly<Record<string, InlineQuantity>>;
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
  const quantity = pin ? quantities[pin.quantityId] : undefined;
  if (!pin || !host || !quantity) return null;
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
