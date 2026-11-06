import { createPlaceHold, type PlaceHold } from "./holdPlace.ts";

type PassageReturn = Readonly<{
  path: string;
  anchor: string;
  relativeOffset: number;
}>;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function returnRecord(value: unknown, path: string): PassageReturn | null {
  const record = object(value);
  return record.path === path &&
    typeof record.anchor === "string" &&
    record.anchor.length > 0 &&
    record.anchor.length <= 200 &&
    typeof record.relativeOffset === "number" &&
    Number.isFinite(record.relativeOffset) &&
    record.relativeOffset >= 0 &&
    record.relativeOffset <= 1
    ? (record as PassageReturn)
    : null;
}

/** German footnotes publish their id on an empty span; the visible body owns their position. */
export function passageProjectionTarget(root: HTMLElement, anchor: string): HTMLElement | null {
  const element = root.ownerDocument.getElementById(anchor);
  if (!element || !root.contains(element)) return null;
  if (element.hasAttribute("data-footnote-anchor")) {
    const body = element.closest<HTMLElement>(".footnote-body, .footnote-item");
    if (body && root.contains(body)) return body;
  }
  return element;
}

/** An exact return that belongs to this mounted reader, not another page or a missing anchor. */
export function pendingPassageProjectionReturn(
  root: HTMLElement,
  win: Window & typeof globalThis = window,
): PassageReturn | null {
  const record = returnRecord(
    object(win.history.state).passageProjectionReturn,
    win.location.pathname + win.location.search,
  );
  const element = record ? win.document.getElementById(record.anchor) : null;
  return element && root.contains(element) ? record : null;
}

/**
 * Keep the departure passage in this history entry. Links and their destinations remain native;
 * no notebook or persistent storage is needed. The existing reader place-holder absorbs layout
 * changes on Back, including a full document reload rather than a back/forward-cache restore.
 */
export function mountPassageProjectionNavigation(
  root: HTMLElement,
  win: Window & typeof globalThis = window,
  options: Readonly<{
    /** The reading controller already owns a hold for asynchronously loaded steps. */
    hold?: PlaceHold;
    /** Keep the controller's live state in agreement with its serialized history entry. */
    onDeparture?: (anchor: string) => void;
  }> = {},
): () => void {
  const hold = options.hold ?? createPlaceHold(root, { win });
  const path = () => win.location.pathname + win.location.search;
  const restore = () => {
    const state = object(win.history.state);
    const record = pendingPassageProjectionReturn(root, win);
    if (!record) return;
    const element = passageProjectionTarget(root, record.anchor);
    if (!element) return;
    const disclosure = [
      ...root.querySelectorAll<HTMLDetailsElement>("[data-passage-projections]"),
    ].find((item) => item.dataset.passageProjections === record.anchor);
    if (disclosure) disclosure.open = true;
    // Consume the return once. An unrelated reload after reading on must not restore this old visit.
    const next: Record<string, unknown> = {
      ...state,
      // FaceSwitchAnchor can mount before or after this island. Once the dedicated return is
      // consumed, its ordinary history restore must see this same passage and viewport offset.
      face: root.dataset.view ?? "reading",
      anchor: record.anchor,
      relativeOffset: record.relativeOffset,
    };
    delete next.passageProjectionReturn;
    try {
      win.history.replaceState(next, "");
    } catch {
      // History can be unavailable; this optional enhancement never prevents navigation.
    }
    hold.hold({ passage: element, top: record.relativeOffset * win.innerHeight });
  };
  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof win.Element)
    )
      return;
    const link = event.target.closest<HTMLAnchorElement>("a[data-passage-projection-link]");
    if (
      !link ||
      !root.contains(link) ||
      link.hasAttribute("download") ||
      (link.target !== "" && link.target !== "_self")
    )
      return;
    if (link.origin !== win.location.origin) return;
    const disclosure = link.closest<HTMLDetailsElement>("[data-passage-projections]");
    const anchor = disclosure?.dataset.passageProjections;
    const element = anchor ? passageProjectionTarget(root, anchor) : null;
    if (!anchor || !element) return;
    options.onDeparture?.(anchor);
    // Native in-document links have no departure to restore. In particular, a face's own link
    // must not leave a pending marker which would suppress its normal source-history writes.
    if (link.pathname + link.search === path()) return;
    const fraction = element.getBoundingClientRect().top / win.innerHeight;
    const relativeOffset =
      Number.isFinite(fraction) && fraction >= 0 && fraction <= 0.8 ? fraction : 0.12;
    const state = object(win.history.state);
    const reader = object(state.annusReader);
    const readerState = object(reader.state);
    const destination = new URL(win.location.href);
    destination.hash = anchor;
    try {
      win.history.replaceState(
        {
          ...state,
          // The reading controller restores its own state before parsing the URL on a revisit.
          ...(typeof readerState.anchor === "string"
            ? {
                annusReader: { ...reader, state: { ...readerState, anchor } },
              }
            : {}),
          // Source-face restoration already consumes these fields; give it the same departure.
          face: root.dataset.view ?? "reading",
          anchor,
          relativeOffset,
          passageProjectionReturn: { path: path(), anchor, relativeOffset },
        },
        "",
        destination,
      );
    } catch {
      // Native links still work if history cannot be written.
    }
  };
  root.addEventListener("click", click);
  win.addEventListener("pageshow", restore);
  win.addEventListener("popstate", restore);
  restore();
  return () => {
    // A supplied hold has a longer-lived owner (ReaderController) which releases it itself.
    if (!options.hold) hold.release();
    root.removeEventListener("click", click);
    win.removeEventListener("pageshow", restore);
    win.removeEventListener("popstate", restore);
  };
}
