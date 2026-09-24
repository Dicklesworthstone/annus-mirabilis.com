/**
 * THE READER STAYS ON THEIR PASSAGE WHILE THE PAGE CHANGES AROUND IT (am-read-detail-axis-sfc,
 * criteria 9 and 14).
 *
 * A Detail change swaps every passage's reading, and on a whole-paper page "Show every step" then
 * loads each passage's steps from its section page (stepsBody.ts), so the page above the reader
 * changes height several times over about a second. Chromium's scroll anchoring absorbs that;
 * WebKit has none, so Safari kept the scroll offset and the reader's passage went with it.
 * Measured on live b2077fc1, /papers/special-relativity/#arg-sr-light-complex, Detail changed to
 * "Show every step": the passage's top went from 69px to -7,621px at 1440x900 and from 24px to
 * -8,734px at 390x844 in WebKit, and stayed at 69 and 24 in Chromium. Arriving by
 * ?detail=2#arg-sr-light-complex failed in both engines: the smooth fragment scroll set off for
 * where the passage stood before the steps above it loaded, and it ended 14,426px (Chromium, 1440)
 * and 15,187px (WebKit, 390) below the viewport.
 *
 * A hold pins one passage at a viewport offset and puts it back after every change of the reader
 * root's size, until the reader scrolls, presses a key or touches the page, or the page has been
 * still for HOLD_MS. While it holds, the browser's own anchoring is off, so the two never both
 * correct one change. The offset rule is keepPlace.ts's.
 */
import { nearestStableAnchor } from "./detail/nearestStableAnchor.ts";
import { type Place, scrollToKeep } from "./keepPlace.ts";

/** How long a hold outlasts the last change it was told of. */
export const HOLD_MS = 2000;

/** What the reader does to take the page back: any of these ends a hold. */
const READER_MOVES = ["wheel", "touchstart", "keydown", "mousedown"] as const;

export type PlaceHold = Readonly<{
  /** Pin `place` now and keep it pinned; replaces any hold already running. */
  hold(place: Place): void;
  /** Run `change`, keeping `place` (or the hold already running) where it stood. */
  across(place: () => Place | null, change: () => void): void;
  active(): boolean;
  release(): void;
}>;

type Rect = Readonly<{ top: number; bottom: number }>;

/**
 * The passage at the reader's reading line: the deepest one crossing the top 40% of the viewport
 * (nearestStableAnchor.ts), not merely the first with a sliver on screen. A reader at the top of
 * passage 12 with the last 69px of passage 11 above it is reading passage 12.
 */
export function readingPlace(
  passages: readonly Element[],
  viewportHeight: number,
  rectOf: (passage: Element) => Rect = (passage) => passage.getBoundingClientRect(),
): Place | null {
  const rects = passages.map(rectOf);
  const at = nearestStableAnchor(
    rects.map((rect, i) => ({ id: String(i), top: rect.top, height: rect.bottom - rect.top })),
    viewportHeight,
  );
  const i = at === undefined ? -1 : Number(at);
  const passage = passages[i];
  const rect = rects[i];
  return passage && rect && rect.bottom > rect.top ? { passage, top: rect.top } : null;
}

/**
 * Where a followed link puts `element`: its scroll margin below the page's scroll padding, which
 * is where scrollIntoView and the fragment scroll bring it. Measuring the element after scrolling
 * would be wrong while the page is still short: the scroll stops at the page's end and the passage
 * stands lower than the link meant.
 */
export function landingPlace(element: Element): Place {
  const view = element.ownerDocument.defaultView;
  const px = (value: string | undefined) => Number.parseFloat(value ?? "") || 0;
  const top = view
    ? px(view.getComputedStyle(element).scrollMarginTop) +
      px(view.getComputedStyle(element.ownerDocument.documentElement).scrollPaddingTop)
    : 0;
  return { passage: element, top };
}

export function createPlaceHold(
  root: Element,
  options: Readonly<{
    win?: Window & typeof globalThis;
    rectOf?: (passage: Element) => Rect;
    Observer?: typeof ResizeObserver;
  }> = {},
): PlaceHold {
  const win = options.win ?? window;
  const Observer =
    options.Observer ?? (typeof win.ResizeObserver === "function" ? win.ResizeObserver : undefined);
  const html = win.document.documentElement;
  let place: Place | null = null;
  let timer = 0;
  let savedAnchor = "";
  const observer = Observer ? new Observer(() => apply()) : null;

  function apply() {
    if (!place) return;
    if (!place.passage.isConnected) return release();
    const delta = scrollToKeep(place, win.innerHeight, options.rectOf);
    if (Math.abs(delta) >= 1) win.scrollBy({ top: delta, behavior: "instant" });
  }
  function arm() {
    if (timer) win.clearTimeout(timer);
    timer = win.setTimeout(release, HOLD_MS);
  }
  function release() {
    if (!place) return;
    place = null;
    if (timer) win.clearTimeout(timer);
    timer = 0;
    observer?.disconnect();
    for (const type of READER_MOVES) win.removeEventListener(type, release, true);
    html.style.overflowAnchor = savedAnchor;
  }
  function hold(next: Place) {
    if (!place) {
      savedAnchor = html.style.overflowAnchor;
      html.style.overflowAnchor = "none";
      observer?.observe(root);
      for (const type of READER_MOVES)
        win.addEventListener(type, release, { capture: true, passive: true });
    }
    place = next;
    arm();
    apply();
  }
  return {
    hold,
    across(placeNow, change) {
      if (place) {
        change();
        arm();
        apply();
        return;
      }
      const at = placeNow();
      change();
      if (at) hold(at);
    },
    active: () => place !== null,
    release,
  };
}
