/**
 * Portable term navigation asks the existing formula owner to pin an exact quantity.
 * The owner acknowledges the request; finding a similarly named element alone is not success.
 * No pin state, inspector rendering, or history entry is duplicated here.
 */
export const TERM_OPEN_EVENT = "am:open-quantity-term";
export const TERM_READY_EVENT = "am:quantity-terms-ready";

type QuantityTermAddress = Readonly<{ routeSlug: string | null; termId: string }>;

function interruptedPassage(root: HTMLElement): Element | null {
  const doc = root.ownerDocument;
  const hash = doc.defaultView?.location.hash.slice(1);
  if (!hash) return null;
  let id: string;
  try {
    id = decodeURIComponent(hash);
  } catch {
    return null;
  }
  const anchor = doc.getElementById(id);
  if (!anchor || !root.contains(anchor)) return null;
  return anchor.closest("p, [data-translation-unit-id]") ?? anchor;
}

/** Pin through the hydrated owner, preserving the current URL and the interrupted passage. */
export function openQuantityTerm(root: HTMLElement, target: QuantityTermAddress): boolean {
  const candidates = [...root.querySelectorAll<HTMLElement>("[data-quantity-id]")].filter(
    (element) =>
      element.getAttribute("data-quantity-id") === target.termId &&
      (target.routeSlug === null ||
        element.closest("[data-paper]")?.getAttribute("data-paper") === target.routeSlug),
  );
  const passage = interruptedPassage(root);
  const ordered = passage
    ? [
        ...candidates.filter((element) => passage.contains(element)),
        ...candidates.filter((element) => !passage.contains(element)),
      ]
    : candidates;
  for (const element of ordered) {
    const event = new Event(TERM_OPEN_EVENT, { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    if (!event.defaultPrevented) continue;
    let ancestor: HTMLElement | null = element;
    while (ancestor && root.contains(ancestor)) {
      if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
      ancestor = ancestor.parentElement;
    }
    // The glyph can be inside KaTeX's aria-hidden drawing. Focus its readable formula or card.
    const focusTarget =
      element.closest<HTMLElement>(".inline-math[data-inline-terms], [data-term-highlight]") ??
      element;
    if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
    focusTarget.scrollIntoView?.({ block: "center" });
    focusTarget.focus({ preventScroll: true });
    return true;
  }
  return false;
}
