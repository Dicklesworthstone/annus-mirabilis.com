"use client";

/**
 * THE LEVELS, FETCHED WHEN A READER FIRST OPENS A PANEL (dispatch 292).
 *
 * A reading face carries the control, the equation in words and the names of the levels, and not the
 * levels themselves: relativity's German face stood at 992,203 bytes gzipped against a recorded
 * 385,289 when it carried them, because every panel is written twice, once as markup and once into
 * React's flight data. The levels live in a static fragment per explanation
 * (public/equation-explanations/<paper>/<id>.json, written by the build from the same component the
 * no-script page renders), and this fetches one the first time its panel is opened.
 *
 * ONE ISLAND PER PAGE, no state of its own worth the name: it listens for a press anywhere under the
 * page, reads the address from the pressed panel's own data-explainer-fragment, and sets the markup
 * into that panel. A page with ninety-eight panels fetches the one or two a reader opens.
 *
 * THE CONTROL IS A LINK, AND THIS KEEPS THE READER HERE. Each panel carries one anchor to the page
 * holding its every level. Without this island a press follows it, which is what a reader without
 * JavaScript gets. With it, the press is taken over: the panel opens in place and the words arrive
 * from the fragment. A press with a modifier key, or of any button but the first, is left alone, so
 * opening the explanation in a new tab still works.
 *
 * NOTHING IS LOST WHEN IT FAILS. Every panel already carries a real link to the page that holds its
 * every level, which a reader without JavaScript sees and which is shown again here if the fetch
 * fails, with the reason said plainly rather than an empty panel. The inserted glyphs carry the same
 * quantity ids as the rest of the page, so the lighting islands find them with no re-arming: they
 * query the document when a reader points, not when they mount.
 */
import { useEffect } from "react";

/** What the build writes: which levels the fragment holds, and their markup. */
type Fragment = Readonly<{ levels?: readonly string[]; html?: string }>;

const FILLED = "data-explainer-filled";

/** Fetches one panel's levels and sets them, or leaves the panel's own link standing. */
async function fill(panel: Element): Promise<void> {
  const url = panel.getAttribute("data-explainer-fragment");
  const slot = panel.querySelector(".eq-explain-levels");
  if (!url || !slot || panel.hasAttribute(FILLED)) return;
  // Set before the await: two rapid opens must not fetch the same fragment twice.
  panel.setAttribute(FILLED, "fetching");
  const response = await fetch(url).catch(() => null);
  const fragment =
    response?.ok === true ? ((await response.json().catch(() => null)) as Fragment | null) : null;
  if (fragment && typeof fragment.html === "string") {
    slot.innerHTML = fragment.html;
    panel.setAttribute(FILLED, "true");
    return;
  }
  // The link to the page holding every level is already in the panel; this says why it is there.
  panel.setAttribute(FILLED, "failed");
}

/** A press this island may take over: the first button, with no modifier a reader means for the link. */
function opensInPlace(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/** Attaches the page's panels under root and returns what detaches it. */
export function attachExplainerFragments(root: Element): () => void {
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest(".eq-explain-control");
    const panel = control?.closest(".eq-explainer");
    if (!control || !panel || !opensInPlace(event as MouseEvent)) return;
    event.preventDefault();
    const open = panel.getAttribute("data-open") === "true";
    panel.setAttribute("data-open", open ? "false" : "true");
    if (!open) void fill(panel);
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

export function ExplainerFragments() {
  useEffect(() => attachExplainerFragments(document.querySelector("main") ?? document.body), []);
  return null;
}
