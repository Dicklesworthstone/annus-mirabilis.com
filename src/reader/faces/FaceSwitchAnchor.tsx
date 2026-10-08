"use client";

import { useEffect, useRef } from "react";
import { type AnchorKind, parseAnchor, sectionAnchorOf } from "../../content/anchors.ts";
import { mapToResultsFace } from "../anchors/mapToFace.ts";
import { capturePlace, type PlaceKeeperSnapshot, restoreDelta } from "../anchors/placeKeeper.ts";
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

/**
 * THE RESULTS FACE PUBLISHES NO SOURCE ANCHORS, so a carried sentence id lands nowhere on it.
 * Measured in the built relativity results face: 16 cards, 186 ids, and ZERO sentence, paragraph or
 * section ids. Criterion 2 of am-read-anchors-navigation-a6o asks that "a switch to results shows
 * the section's results", so the id has to be mapped, not carried.
 *
 * `mapToResultsFace` is the owner of that mapping and takes a section -> result-ids index. The index
 * is read from the DOM, because the association is already published there: each card carries
 * `data-sections`, projected from the `section:` field of content/results/<paper>.yaml. Nothing new
 * is computed here and no second copy of the association exists.
 *
 * WHY THE FULL FACE RATHER THAN A REDIRECT TO THE SECTION-SCOPED ROUTE. Those routes exist and are
 * built, and sending the reader to `/papers/<paper>/<section>/view/results/` was the first design.
 * Measured across the four papers: 29 section-scoped results routes, of which THREE are empty --
 * light-quanta s0, brownian-motion s0 and s2 declare no result cards. A redirect would land a
 * reader reading those sections on a page with nothing on it, which is worse than not redirecting,
 * and the client cannot know which sections are empty without being told. Resolving on the full
 * face degrades the right way instead: a section with cards scrolls to its first one, and a section
 * without any leaves the reader on the complete results face.
 */
export function resultsAnchorForSource(
  sourceId: string,
  cards: readonly Readonly<{ resultId: string; sections: readonly string[] }>[],
): string | null {
  const section = sectionAnchorOf(sourceId);
  if (section === null) return null;
  const resultsBySection: Record<string, string[]> = {};
  for (const card of cards) {
    for (const s of card.sections) {
      const list = resultsBySection[s] ?? [];
      list.push(`result-${card.resultId}`);
      resultsBySection[s] = list;
    }
  }
  // `units: []` because no parent-chain walk is wanted here: a section with no cards must return
  // nothing rather than climbing to a neighbour's results, and mapToResultsFace does not walk.
  const anchors = mapToResultsFace(section, { units: [], resultsBySection });
  return anchors[0] ?? null;
}

/**
 * The place of the element the current fragment names, if it is at least half visible. One unit
 * rather than a document scan, because the fragment is the reader's address and the first
 * half-visible sentence anywhere in the document is not (see the click handler's note).
 */
function placeOfHash(): PlaceKeeperSnapshot | undefined {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) return undefined;
  let element: HTMLElement | null;
  try {
    element = document.getElementById(decodeURIComponent(raw));
  } catch {
    return undefined;
  }
  if (element === null || !isPlaceKeepingUnit(element.id)) return undefined;
  const rect = element.getBoundingClientRect();
  return capturePlace([{ id: element.id, top: rect.top, height: rect.height }], window.innerHeight);
}

export function FaceSwitchAnchor() {
  /** The anchor's place the last time it was at least half visible. */
  const placeRef = useRef<PlaceKeeperSnapshot | undefined>(undefined);

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
    const present = (id: string) => document.getElementById(id) !== null;
    const resolved =
      resolvedFaceAnchor(requested, present) ??
      // Nothing in the source grammar is on this page. If it is the results face, the carried id
      // still names a section, and that section's first card is where the reader asked to be.
      resultsAnchorForSource(
        requested,
        [...document.querySelectorAll<HTMLElement>("[data-result-id][data-sections]")].map(
          (el) => ({
            resultId: el.dataset.resultId ?? "",
            sections: (el.dataset.sections ?? "").split(" ").filter((s) => s !== ""),
          }),
        ),
      );
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
    viewport, so the same sentence rests at a different place on each face: measured at 1280x900 on
    relativity, #s4-p3-s1 settles 16.1px from the top on the English face and 59.5px on the German
    one, a 43.4px difference, because the German face sets each paragraph beside a "[p. 903]" locator
    line. 43px is five times what the criterion allows and a reader sees it.

    SCROLL-MARGIN, NOT A ONE-SHOT SCROLL. The obvious implementation -- compute `restoreDelta` and
    `scrollBy` it on mount -- was written first and cannot work, because the anchor's position is not
    settled when an effect runs. Measured on that same page: scrollY is 0 at `load`, 8,413 three
    hundred milliseconds later and 24,438 after about 1.8 seconds, as the browser re-scrolls to the
    anchor while the document grows past 65,000px. A delta applied at mount is computed from a
    mid-flight position and is then overwritten by the browser's next convergence pass.

    So the wanted offset is handed to the browser as `scroll-margin-top` on the target, and every
    convergence pass -- including the ones still to come -- honours it. `scrollIntoView()` follows,
    for the case where convergence had already finished before this effect ran. `restoreDelta` is
    still the owner of the arithmetic; only where its answer is applied has changed, from a scroll
    position to a margin, which is why it takes a top of 0: the margin is measured from the
    viewport top, not from wherever the element currently sits.

    The inline margin is left in place deliberately. It affects exactly one element on one page
    view, and it means a later in-page link to the same sentence lands where the reader last chose
    to have it rather than somewhere else.

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
    // The offset the snapshot asks for, as a distance from the viewport top: restoreDelta with a
    // current top of 0 is exactly `-relativeOffset * viewportHeight`, and the margin is its
    // negation. Clamped to the viewport so a corrupt or stale fraction cannot push the anchor off
    // the screen entirely, and floored at 0 because a negative scroll-margin would scroll the
    // anchor ABOVE the top edge.
    const wanted = -restoreDelta(0, snapshot, window.innerHeight);
    const margin = Math.min(Math.max(wanted, 0), window.innerHeight * 0.8);
    element.style.scrollMarginTop = `${margin}px`;
    element.scrollIntoView();

    /*
      AND THEN CORRECT UNTIL IT SETTLES, because a margin cannot absorb a residual it does not know
      about. Measured at 1280x900 on relativity's #s4-p3-s1, each after the scroll had stopped
      moving: the anchor rests at `scroll-margin-top + about 12px`, not at the margin.

          face                  margin    resting top
          English, deep link     0px        16.1px
          German, deep link     48px        59.5px      (48px comes from the stylesheet)
          German, restored      16.1px      28.5px      (margin set by this effect)

      The document keeps growing above the anchor after the engine's last pass -- fonts, KaTeX, late
      blocks -- so the anchor is pushed down from wherever it was placed and nothing re-corrects it.
      That residual is why the margin alone took the drift from 43.4px to 12.4px and no further: the
      criterion's allowance is 8px.

      So the offset is re-checked on each scroll or resize tick and corrected while it is off by
      more than a pixel. Three conditions keep this from becoming a loop that fights someone:

        - it stops as soon as two consecutive ticks agree, which is the normal exit;
        - it stops at a deadline, so a page that never settles costs a bounded number of ticks
          rather than running for as long as the reader stays;
        - it stops the instant the reader shows intent -- wheel, touch, or a key. That is the
          important one. A reader who starts scrolling has overridden the restore, and continuing
          to correct would drag them back to a place they just left.
    */
    let ticks = 0;
    const deadline = Date.now() + 4000;
    let settledAt = Number.NaN;
    let frame = 0;
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onTick);
      window.removeEventListener("resize", onTick);
      for (const kind of ["wheel", "touchstart", "keydown"] as const) {
        window.removeEventListener(kind, stop);
      }
    };
    const correct = () => {
      frame = 0;
      if (done) return;
      ticks += 1;
      const top = element.getBoundingClientRect().top;
      const off = top - wanted;
      if (Math.abs(off) <= 1) {
        // Two agreeing ticks, not one: a single reading can be taken mid-animation.
        if (Number.isFinite(settledAt) && ticks - settledAt >= 1) stop();
        else settledAt = ticks;
        return;
      }
      settledAt = Number.NaN;
      if (ticks > 60 || Date.now() > deadline) {
        stop();
        return;
      }
      window.scrollBy({ top: off, behavior: "instant" });
    };
    function onTick(): void {
      if (frame === 0) frame = window.requestAnimationFrame(correct);
    }
    window.addEventListener("scroll", onTick, { passive: true });
    window.addEventListener("resize", onTick, { passive: true });
    for (const kind of ["wheel", "touchstart", "keydown"] as const) {
      window.addEventListener(kind, stop, { passive: true, once: true });
    }
    onTick();
    return stop;
  }, []);

  /*
    KEEP THE ANCHOR'S PLACE WHILE THE READER CAN SEE IT.

    A deep link's position is not settled at load. Measured on relativity's English face at
    #s4-p3-s1, 1280x900, document 65,961px tall and the anchor 24,454px down: scrollY is 0 at
    `load`, 8,413 three hundred milliseconds later, and 24,438 after about 1.8 seconds, as the
    browser chases the anchor while the document grows. So there is no single moment to measure at,
    and this records on every scroll instead, keeping the last reading taken while the anchor was at
    least half visible.

    Passive, rAF-coalesced, and it reads ONE element's rect, so a scroll does no layout work beyond
    that. It records nothing once the anchor leaves the screen, which is what makes the stored value
    "where the sentence was when the reader last had it in front of them" rather than "where the
    page happens to be now".
  */
  useEffect(() => {
    let frame = 0;
    const record = () => {
      frame = 0;
      const place = placeOfHash();
      if (place !== undefined) placeRef.current = place;
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(record);
    };
    record();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
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
      // THE LAST POSITION AT WHICH THE READER COULD SEE THE ANCHOR, not the position at the click.
      // Measuring at the click reads nothing useful, and this was measured rather than assumed: the
      // only face chooser sits 15,472 bytes into a 6.1MB document and is not sticky, so reaching it
      // means scrolling the anchor off the screen first. Across three journeys at 1280x900
      // (mass-energy #s0-p4-s1 and #s0-p6-s1, brownian-motion #s1-p2-s1) the German link was NEVER
      // on screen while the sentence was, so a click-time capture is always undefined and
      // place-keeping would be dead code.
      //
      // `placeRef` is kept up to date by the effect below for exactly as long as the anchor is at
      // least half visible, so what is carried is where the sentence sat when the reader last had
      // it in front of them. A live reading is still preferred when there is one.
      const live = placeOfHash();
      const place = live ?? placeRef.current;
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
