"use client";

import { useEffect } from "react";
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
  return null;
}
