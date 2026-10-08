"use client";

import { useEffect } from "react";
import { type AnchorKind, parseAnchor } from "../../content/anchors.ts";
import { capturePlace, restoreDelta } from "../anchors/placeKeeper.ts";
import { contentIdVariants, isSentenceContentId } from "../weave/contentIds.ts";

/**
 * A fragment this face does not publish is resolved to the id it does, instead of landing nowhere.
 * The destination half of am-read-anchors-navigation-a6o's criterion 2.
 *
 * MEASURED IN THE BUILT SITE, on special-relativity, English against German:
 *
 *     sentence anchors   English 285   German 223   shared 223
 *
 * German is a SUBSET of English, so arriving on English never needs this. Arriving on GERMAN needs
 * it for exactly 62 ids, and all 62 are split halves (`s1-p10-s1a`, `s1-p10-s1b`): English splits a
 * German sentence into two translation units and publishes both halves, German publishes only the
 * source id. So `/view/german/#s1-p10-s1a` scrolls nowhere today, and this is what fixes that.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: put the fragment on the outbound face link. That half is NOT
 * safe to add from here, and the reason is recorded so the next implementer does not rediscover it
 * by breaking the same lane:
 *
 *   - `scripts/e2e/journeys/steps.ts:72` selects the face link by an EXACT href attribute match,
 *     `a[href="/papers/<paper>/view/<face>/"]`. Appending a fragment makes that locator find zero
 *     links, and the paper journey's switch-face step throws. Measured: the node lane went from
 *     604 pass to 601 pass, 3 fail, with the planted journey test reporting 4 of 7 steps down.
 *   - `ReaderController.tsx:357` ALREADY intercepts `[data-view-link]` clicks, and the comment at
 *     ReaderController.tsx:726 explains the convention: a face link that must really navigate
 *     carries NO `data-view-link`, precisely so the root handler does not swallow it. Any outbound
 *     scheme has to be designed with that handler rather than beside it.
 *
 * So carrying the fragment is a design decision inside a subsystem with an authored convention, and
 * it belongs to the bead rather than to this file. The measured allowlist of anchor kinds that
 * actually cross the two faces is recorded on am-read-anchors-navigation-a6o for whoever takes it.
 *
 * WHY `contentIdVariants` AND NOT `mapToFace`. `src/reader/anchors/mapToFace.ts` does this plus an
 * ancestor walk, but needs a `StructureIndex` carrying `parentId` and nothing builds one (am-to1q).
 * Its split-sentence arm consumes `weave/contentIds.ts` anyway since c6346e5c, which is the owner,
 * so calling the owner directly is the same computation without the index. The ancestor fallback is
 * not implemented and is not needed by any measured case: zero ids on either face require it.
 *
 * NO-SCRIPT BEHAVIOUR IS UNCHANGED, because nothing here alters the document the server sent.
 */

/**
 * The id on THIS face that a requested id should resolve to: itself when present, else its
 * split-sentence counterpart, else null. `present` is asked rather than a set passed in, so the
 * caller can answer from the live document.
 */
/**
 * THE ANCHOR KINDS BOTH SOURCE FACES PUBLISH, so a carried fragment lands on something. Measured in
 * the built site for special-relativity, English against German, as shared-id counts:
 *
 *     sentence 223    equation 98    section 10    footnote 4
 *     inline-equation 2    part 2    closing 3    masthead 2
 *
 * EXCLUDED, each for a measured reason rather than caution:
 *
 *   - `paragraph`: German publishes 111 and English publishes ZERO, so it is German-only and a
 *     carried paragraph id would land nowhere going the other way.
 *   - `argument`, `lab`, `entry`, `result`: on neither source face; they live on the reading face.
 *     Not hypothetical: `scripts/test-reader-browser.mjs:316` navigates to
 *     `?view=german#arg-bm-observable` and then asserts the German link's href ENDS at
 *     `/view/german/`. An earlier version of this island appended every fragment, which would have
 *     broken that anchored regex AND sent the reader to a face with 0 `arg-*` ids.
 *
 * Anything that is not a content anchor at all -- quantity ids like `acceleratingPotential`,
 * React's `_R_`, `reader-root` -- is refused by `parseAnchor` itself, so the grammar answers that
 * half and this list only says which content kinds cross.
 */
const CROSS_FACE_KINDS: ReadonlySet<AnchorKind> = new Set<AnchorKind>([
  "sentence",
  "equation",
  "section",
  "footnote",
  "inline-equation",
  "part",
  "closing",
  "masthead",
]);

/**
 * THE UNITS PLACE-KEEPING MEASURES: "sentence-level (or finer)", in the bead's own words. A
 * paragraph or a section is coarser than the reader's place and would restore to the top of a block
 * they were reading the middle of; an equation or a footnote is not a position in the running text.
 * `inline-equation` is the "or finer" case, since `s3-p2-s1-m1` sits inside a sentence.
 */
const PLACE_KEEPING_KINDS: ReadonlySet<AnchorKind> = new Set<AnchorKind>([
  "sentence",
  "inline-equation",
]);

/** True when an id addresses a unit fine enough to restore a reader's place to. */
export function isPlaceKeepingUnit(id: string): boolean {
  if (!id) return false;
  const parsed = parseAnchor(id);
  return parsed.ok && PLACE_KEEPING_KINDS.has(parsed.value.kind);
}

/**
 * Where a captured place is left for the next page. sessionStorage rather than the URL: the
 * fraction is a viewport measurement, not an address, and putting it in the link would make a
 * copied URL carry one reader's scroll position.
 */
const PLACE_KEY = "am:reader:v1:face-switch-place";

/** True when a fragment names a content anchor that both source faces publish. */
export function crossesFaces(id: string): boolean {
  if (!id) return false;
  const parsed = parseAnchor(id);
  return parsed.ok && CROSS_FACE_KINDS.has(parsed.value.kind);
}

/**
 * The URL a face link should lead to, given the reader's current fragment. Returns `href`
 * unchanged whenever nothing should be carried, so a caller can compare and do nothing.
 */
export function faceHrefWithFragment(href: string, hash: string): string {
  if (!href || href.includes("#")) return href;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return href;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return href;
  }
  if (!crossesFaces(id)) return href;
  return `${href}#${raw}`;
}

export function resolvedFaceAnchor(
  requestedId: string,
  present: (id: string) => boolean,
): string | null {
  if (!requestedId) return null;
  if (present(requestedId)) return requestedId;
  if (!isSentenceContentId(requestedId)) return null;
  for (const variant of contentIdVariants(requestedId)) {
    if (variant !== requestedId && present(variant)) return variant;
  }
  return null;
}

export function FaceSwitchAnchor() {
  useEffect(() => {
    const raw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!raw) return;
    let requested: string;
    try {
      requested = decodeURIComponent(raw);
    } catch {
      // A malformed percent-escape names no anchor; leave the page as the browser left it.
      return;
    }
    const resolved = resolvedFaceAnchor(requested, (id) => document.getElementById(id) !== null);
    if (resolved === null || resolved === requested) return;
    const element = document.getElementById(resolved);
    if (element === null) return;
    // Default behaviour is instant, which is what reduced motion wants; an explicit smooth scroll
    // would animate a navigation the reader did not ask to watch.
    element.scrollIntoView();
    // replaceState, so Back still goes where the reader came from and a copied URL names the id
    // they are actually at.
    window.history.replaceState(window.history.state, "", `#${resolved}`);
  }, []);

  /*
    THE SAME RELATIVE POSITION, criterion 2's second clause: "shows the same sentence at the same
    relative position (within 8 CSS px)".

    `scrollIntoView` and the browser's own fragment handling both put the anchor at the TOP of the
    viewport. A reader who was reading a sentence in the middle of the screen gets it jumped to the
    top, which is a different place even though it is the right sentence. `restoreDelta` returns the
    delta that puts it back at the fraction it held, and a delta rather than an absolute offset
    because an absolute one breaks under font loading, a Detail change or zoom (placeKeeper.ts).

    CONSUMED ONCE. The snapshot is removed before it is used, so an ordinary later load of the same
    face cannot restore a stale position, and a failed parse cannot wedge every future visit.
  */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(PLACE_KEY);
      if (raw !== null) window.sessionStorage.removeItem(PLACE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    let snapshot: { anchorId: string; relativeOffset: number };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as { anchorId?: unknown }).anchorId !== "string" ||
        typeof (parsed as { relativeOffset?: unknown }).relativeOffset !== "number" ||
        !Number.isFinite((parsed as { relativeOffset: number }).relativeOffset)
      )
        return;
      snapshot = parsed as { anchorId: string; relativeOffset: number };
    } catch {
      return;
    }
    const present = (id: string) => document.getElementById(id) !== null;
    const landed = resolvedFaceAnchor(snapshot.anchorId, present);
    if (landed === null) return;
    const element = document.getElementById(landed);
    if (element === null) return;
    const delta = restoreDelta(element.getBoundingClientRect().top, snapshot, window.innerHeight);
    // Instant, because this completes a navigation the reader asked for rather than animating one
    // they did not.
    if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "instant" });
  }, []);

  /*
    THE OUTBOUND HALF: INTERCEPT THE CLICK, NEVER REWRITE THE HREF (owner's choice, 2026-10-08).

    Rewriting it was tried and withdrawn. `scripts/e2e/journeys/steps.ts:72` locates the face link
    by an EXACT href match, so appending a fragment made it find zero links: the node lane went
    604 pass to 601 pass / 3 fail, with the planted journey reporting "4 of 7 steps failed". An
    href other code matches exactly is a contract, and the no-script reader depends on it too.

    WHY THIS CANNOT DOUBLE-HANDLE WITH ReaderController, which also intercepts `[data-view-link]`.
    Its effect returns early unless a clarification dialog AND an announcement region exist
    (ReaderController.tsx:89), and its listener is attached after that guard (:597). Measured in the
    built site: the reading page carries 2 `data-clarification-dialog` and 1
    `data-reader-announcement`; the parallel, English, German and gloss faces carry ZERO of each and
    16 `data-view-link` apiece. So the two populations are disjoint -- it owns the clicks wherever it
    attaches, and on a source face nothing does, which is exactly where the fragment is lost. The
    guard below is its own condition, read the same way, so the two cannot drift apart silently.
  */
  useEffect(() => {
    if (document.querySelector("[data-clarification-dialog]") !== null) return;
    const onClick = (event: MouseEvent): void => {
      // Leave every modified or non-primary press to the browser: a reader opening a face in a new
      // tab or window must get the page the href names, unchanged.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLAnchorElement>("a[data-view-link]");
      if (link === null) return;
      const href = link.getAttribute("href") ?? "";

      /*
        THE ADDRESS IS THE FRAGMENT; THE FRACTION ONLY REFINES IT.

        The bead specifies the capture rule as "the first sentence-level (or finer) anchor, in
        document order, whose element is at least half visible". Implemented literally over the whole
        document, that rule DISCARDS the reader's address, and it does so in the ordinary case rather
        than an edge one. Measured in the built English face of special-relativity: there is exactly
        ONE face chooser, 15,472 bytes into a 6,129,321-byte document, and `.reader-controls` sets
        only `border-block` and `padding` -- it is not sticky (src/reader/reader.css:76). A reader who
        followed `#s4-p3-s1` has the chooser scrolled off the top of the viewport, so switching face
        means scrolling back to the top FIRST. The first half-visible sentence at the moment of the
        click is therefore the first sentence of the paper, and carrying it would have replaced a
        deep link the reader chose with the top of the paper. That is worse than doing nothing, and
        the first version of this file did it.

        So the fragment the reader is at stays the address, exactly as before place-keeping, and
        `capturePlace` is asked about ONE unit: the element that fragment names. When it is at least
        half visible the fraction is carried and the other face restores it; when the reader has
        scrolled away from it, nothing is carried and the other face lands the anchor the way the
        browser would. Both halves are honest, and neither can move the reader somewhere they did
        not ask to go.

        THE BEAD'S WORDING IS NOT WRONG, IT IS CONDITIONAL on a chooser the reader can reach without
        scrolling. Whether to make the chooser sticky instead is a layout decision for the owner, and
        it is recorded on the bead rather than taken here.
      */
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      let atHash: HTMLElement | null = null;
      try {
        atHash = hash === "" ? null : document.getElementById(decodeURIComponent(hash));
      } catch {
        atHash = null;
      }
      const place =
        atHash !== null && isPlaceKeepingUnit(atHash.id)
          ? capturePlace(
              [
                {
                  id: atHash.id,
                  top: atHash.getBoundingClientRect().top,
                  height: atHash.getBoundingClientRect().height,
                },
              ],
              window.innerHeight,
            )
          : undefined;
      const next = faceHrefWithFragment(href, window.location.hash);
      if (next === href) return;
      event.preventDefault();
      if (place) {
        // Best effort, and the switch must happen whether or not it lands: reading continues when
        // storage is blocked or full.
        try {
          window.sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
        } catch {
          /* no storage: the fragment alone still puts the reader on the right sentence */
        }
      }
      window.location.assign(next);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
