import { anchorFromFaceHash, FACE_SWITCH_PLACE_KEY } from "./anchors/faceSwitchPlace.ts";
import { capturePlace } from "./anchors/placeKeeper.ts";
import { FACE_REGISTRY } from "./faces/registry.ts";
import { createPlaceHold, type PlaceHold } from "./holdPlace.ts";
import {
  type PassageFace,
  type PassageFaceLink,
  passageFaceLinks,
  passageFaceOrigin,
  passageFaceRoute,
  passageProjectionsAt,
} from "./passageFaceSwitch.ts";

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
    record.relativeOffset >= -0.8 &&
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
  if (record?.anchor !== anchorFromFaceHash(win.location.hash)) return null;
  const element = record ? win.document.getElementById(record.anchor) : null;
  return element && root.contains(element) ? record : null;
}

/** A cancelled departure cannot keep owning this entry after the reader chooses another place. */
export function discardSupersededPassageProjectionReturn(
  root: HTMLElement,
  win: Window & typeof globalThis = window,
): boolean {
  const state = object(win.history.state);
  if (!("passageProjectionReturn" in state) || pendingPassageProjectionReturn(root, win))
    return false;
  const next = { ...state };
  delete next.passageProjectionReturn;
  try {
    win.history.replaceState(next, "");
  } catch {
    // The current-fragment check still refuses the superseded record when history is blocked.
  }
  return true;
}

/**
 * Keep the departure passage in this history entry. Authored links remain native; the global
 * face chooser follows the same relations, offering a choice when they are not one-to-one.
 * The existing face-transfer slot carries an optional position and exact source return. The
 * reader place-holder absorbs layout changes on Back, including a full document reload.
 */
export function mountPassageProjectionNavigation(
  root: HTMLElement,
  win: Window & typeof globalThis = window,
  options: Readonly<{
    /** The reading controller already owns a hold for asynchronously loaded steps. */
    hold?: PlaceHold;
    /** Keep the controller's live state in agreement with its serialized history entry. */
    onDeparture?: (anchor: string) => void;
    /** A newer fragment superseded an aborted departure; synchronize the controller before saving. */
    onLocationChange?: (anchor: string) => void;
    /** The actual arrival URL, before the reader serializes a stored Detail setting. */
    arrivalPath?: string;
  }> = {},
): () => void {
  const hold = options.hold ?? createPlaceHold(root, { win });
  const path = () => win.location.pathname + win.location.search;
  // A legitimate Back return belongs to the arrival path even if the reader normalizes Detail.
  const arrivalState = object(win.history.state);
  const arrivalReturn = options.arrivalPath
    ? returnRecord(arrivalState.passageProjectionReturn, options.arrivalPath)
    : null;
  if (
    arrivalReturn &&
    arrivalReturn.anchor === anchorFromFaceHash(win.location.hash) &&
    passageProjectionTarget(root, arrivalReturn.anchor)
  ) {
    try {
      win.history.replaceState(
        { ...arrivalState, passageProjectionReturn: { ...arrivalReturn, path: path() } },
        "",
      );
    } catch {
      // Blocked history leaves normal fragment navigation available.
    }
  }
  let cachedPlace: Readonly<{ anchor: string; relativeOffset: number }> | null = null;
  let frame = 0;
  const visibleOffset = (anchor: string): number | null => {
    const element = passageProjectionTarget(root, anchor);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const captured = capturePlace(
      [{ id: anchor, top: rect.top, height: rect.height }],
      win.innerHeight,
    );
    if (captured && captured.relativeOffset >= -0.8 && captured.relativeOffset <= 0.8)
      return captured.relativeOffset;
    // A long argument can begin visibly even though half of the whole article cannot fit.
    const fraction = rect.top / win.innerHeight;
    return rect.bottom > 0 && Number.isFinite(fraction) && fraction >= 0 && fraction <= 0.8
      ? fraction
      : null;
  };
  const rememberPlace = () => {
    frame = 0;
    const anchor = anchorFromFaceHash(win.location.hash);
    if (cachedPlace?.anchor !== anchor) cachedPlace = null;
    const fraction = anchor ? visibleOffset(anchor) : null;
    if (anchor && fraction !== null) cachedPlace = { anchor, relativeOffset: fraction };
  };
  const onScroll = () => {
    if (frame === 0) frame = win.requestAnimationFrame(rememberPlace);
  };
  const offsetFor = (anchor: string) => {
    return (
      visibleOffset(anchor) ?? (cachedPlace?.anchor === anchor ? cachedPlace.relativeOffset : 0.12)
    );
  };
  const discardSupersededReturn = () => {
    if (!discardSupersededPassageProjectionReturn(root, win)) return;
    hold.release();
    const anchor = anchorFromFaceHash(win.location.hash);
    if (anchor) options.onLocationChange?.(anchor);
  };
  const onHashChange = () => {
    discardSupersededReturn();
    rememberPlace();
  };
  const departure = (anchor: string, relativeOffset: number) => {
    options.onDeparture?.(anchor);
    const state = object(win.history.state);
    const reader = object(state.annusReader);
    const readerState = object(reader.state);
    const destination = new URL(win.location.href);
    destination.hash = anchor;
    try {
      win.history.replaceState(
        {
          ...state,
          ...(typeof readerState.anchor === "string"
            ? { annusReader: { ...reader, state: { ...readerState, anchor } } }
            : {}),
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
  const transfer = (
    href: string,
    anchor: string,
    relativeOffset: number,
    projections: readonly HTMLElement[],
    destinationOffset = relativeOffset,
  ) => {
    try {
      // A cancelled navigation must not leave a position for a later unrelated visit.
      win.sessionStorage.removeItem(FACE_SWITCH_PLACE_KEY);
      const target = passageFaceRoute(href, win.location.href);
      const current = passageFaceRoute(win.location.href, win.location.href);
      const targetAnchor = target ? anchorFromFaceHash(target.url.hash) : null;
      if (!target || !current || target.paper !== current.paper || !targetAnchor) return;
      const origin = new URL(win.location.href);
      origin.hash = anchor;
      win.sessionStorage.setItem(
        FACE_SWITCH_PLACE_KEY,
        JSON.stringify({
          path: target.url.pathname + target.url.search,
          anchorId: targetAnchor,
          relativeOffset: destinationOffset,
          ...(target.face === "reading" && current.face !== "reading"
            ? {
                projectionOrigin: {
                  readingAnchor: targetAnchor,
                  href: origin.pathname + origin.search + origin.hash,
                  paragraphs: passageFaceLinks(projections, "german").map((link) => link.href),
                  relativeOffset,
                },
              }
            : {}),
        }),
      );
    } catch {
      // With blocked storage the authored destination still works, without its optional offset.
    }
  };
  const arriveAtExplanation = () => {
    if (root.dataset.view !== "reading") return;
    let value: unknown;
    try {
      const raw = win.sessionStorage.getItem(FACE_SWITCH_PLACE_KEY);
      if (raw === null) return;
      win.sessionStorage.removeItem(FACE_SWITCH_PLACE_KEY);
      value = JSON.parse(raw);
    } catch {
      return;
    }
    const incoming = object(value);
    const anchor = anchorFromFaceHash(win.location.hash);
    const element = anchor ? passageProjectionTarget(root, anchor) : null;
    if (
      !anchor ||
      !element ||
      incoming.path !== (options.arrivalPath ?? path()) ||
      incoming.anchorId !== anchor
    )
      return;
    const origin = passageFaceOrigin(
      incoming.projectionOrigin,
      anchor,
      passageProjectionsAt(root, anchor),
      win.location.href,
    );
    if (!origin) return;
    try {
      win.history.replaceState({ ...object(win.history.state), passageFaceOrigin: origin }, "");
    } catch {
      // The argument is still the linked destination if history cannot keep the source address.
    }
    hold.hold({ passage: element, top: origin.relativeOffset * win.innerHeight });
  };
  let choices: HTMLElement | null = null;
  const showChoices = (
    trigger: HTMLAnchorElement,
    anchor: string,
    face: PassageFace,
    links: readonly PassageFaceLink[],
  ) => {
    choices?.remove();
    const panel = win.document.createElement("section");
    panel.dataset.faceSwitchChoices = "";
    panel.dataset.passageProjections = anchor;
    panel.setAttribute("aria-label", "Choose the corresponding passage");
    const message = win.document.createElement("p");
    message.setAttribute("role", "status");
    const label = face === "reading" ? "explanations" : `${FACE_REGISTRY[face].label} passages`;
    message.textContent = links.length
      ? `This passage corresponds to several ${label}. Choose the one you want to read.`
      : `No ${label} have been linked to this passage yet. You can keep reading here.`;
    const list = win.document.createElement("ul");
    list.dataset.projection = face === "reading" ? "explanation" : face;
    for (const item of links) {
      const li = win.document.createElement("li");
      const link = win.document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      link.dataset.passageProjectionLink = "";
      li.append(link);
      list.append(li);
    }
    const close = win.document.createElement("button");
    close.type = "button";
    close.className = "secondary";
    close.textContent = "Keep reading here";
    close.addEventListener("click", () => {
      panel.remove();
      if (choices === panel) choices = null;
      trigger.focus({ preventScroll: true });
    });
    panel.append(message, list, close);
    (trigger.closest("nav") ?? trigger).after(panel);
    choices = panel;
    (list.querySelector("a") ?? close).focus({ preventScroll: true });
  };
  const restore = () => {
    discardSupersededReturn();
    const state = object(win.history.state);
    const record = pendingPassageProjectionReturn(root, win);
    if (!record) return;
    const element = passageProjectionTarget(root, record.anchor);
    if (!element) return;
    const disclosure = [
      ...root.querySelectorAll<HTMLDetailsElement>("details[data-passage-projections]"),
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
    const link = event.target.closest<HTMLAnchorElement>(
      "a[data-passage-projection-link],a[data-reader-face-link],a[data-view-link='reading']",
    );
    if (
      !link ||
      !root.contains(link) ||
      link.hasAttribute("download") ||
      (link.target !== "" && link.target !== "_self")
    )
      return;
    if (link.origin !== win.location.origin) return;
    if (!link.hasAttribute("data-passage-projection-link")) {
      const face = link.dataset.readerFaceLink ?? link.dataset.viewLink;
      if (
        face !== "reading" &&
        face !== "german" &&
        face !== "english" &&
        face !== "parallel" &&
        face !== "gloss" &&
        face !== "facsimile"
      )
        return;
      // The explanation controller owns its same-page Explanation tab.
      if (face === "reading" && root.dataset.view === "reading") return;
      const anchor = anchorFromFaceHash(win.location.hash);
      const projections = anchor ? passageProjectionsAt(root, anchor) : [];
      if (!anchor || projections.length === 0) return;
      const links = passageFaceLinks(projections, face);
      const current = passageFaceRoute(win.location.href, win.location.href);
      const destinations = links.filter((item) => {
        const target = passageFaceRoute(item.href, win.location.href);
        return target?.paper === current?.paper && target?.face === face && target.url.hash;
      });
      const origin = passageFaceOrigin(
        object(win.history.state).passageFaceOrigin,
        anchor,
        projections,
        win.location.href,
      );
      const remembered =
        origin && passageFaceRoute(origin.href, win.location.href)?.face === face ? origin : null;
      event.preventDefault();
      if (!remembered && destinations.length !== 1) {
        showChoices(link, anchor, face, destinations);
        return;
      }
      const href = remembered?.href ?? destinations[0]?.href;
      if (!href) return;
      const offset = offsetFor(anchor);
      departure(anchor, offset);
      transfer(href, anchor, offset, projections, remembered?.relativeOffset ?? offset);
      win.location.assign(href);
      return;
    }
    const disclosure = link.closest<HTMLElement>("[data-passage-projections]");
    let anchor = disclosure?.dataset.passageProjections;
    // A header's choice can refer to the precise sentence that opened the menu. Ordinary
    // paragraph menus also keep that sentence when it really belongs to the selected passage.
    const currentAnchor = anchorFromFaceHash(win.location.hash);
    if (
      currentAnchor &&
      disclosure &&
      passageProjectionsAt(root, currentAnchor).includes(disclosure)
    )
      anchor = currentAnchor;
    const element = anchor ? passageProjectionTarget(root, anchor) : null;
    if (!anchor || !element) return;
    // Native in-document links have no departure to restore. In particular, a face's own link
    // must not leave a pending marker which would suppress its normal source-history writes.
    if (link.pathname + link.search === path()) {
      options.onDeparture?.(anchor);
      return;
    }
    const relativeOffset = offsetFor(anchor);
    departure(anchor, relativeOffset);
    transfer(link.href, anchor, relativeOffset, passageProjectionsAt(root, anchor));
  };
  root.addEventListener("click", click);
  win.addEventListener("pageshow", restore);
  win.addEventListener("popstate", restore);
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  win.addEventListener("hashchange", onHashChange);
  rememberPlace();
  arriveAtExplanation();
  restore();
  return () => {
    // A supplied hold has a longer-lived owner (ReaderController) which releases it itself.
    if (!options.hold) hold.release();
    root.removeEventListener("click", click);
    win.removeEventListener("pageshow", restore);
    win.removeEventListener("popstate", restore);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    win.removeEventListener("hashchange", onHashChange);
    if (frame !== 0) win.cancelAnimationFrame(frame);
    choices?.remove();
  };
}
