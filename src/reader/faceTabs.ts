/**
 * The reading faces a chooser offers, in order, and which of them wait in the "Not yet
 * available" line: ONE list for the two choosers (dispatch 211).
 *
 * WHY THIS FILE EXISTS. The explanation page's tabs (ReaderController) were four literal links,
 * written before any English existed: Explanation, Results, German source, Facsimile. The face
 * pages' chooser (FaceChooser) derived its tabs from face availability. When the English of all
 * four papers was final, measured on live, every face page offered "English translation" and
 * "Parallel bilingual" and no paper page did, so a reader landing on a paper could not reach its
 * translation. Both choosers now call faceTabList, and faceTabsParity.test.tsx holds each paper's
 * explanation tabs equal to its English face's chooser.
 *
 * The href and attribute policy stay with each chooser, because they differ for a reason: on the
 * explanation page a [data-view-link] naming a face is intercepted and switched in place, so its
 * route links carry none (ReaderController.tsx). This module decides only WHICH faces, in WHAT
 * order, and WHERE each sits.
 *
 * Client-safe: type-only imports, so ReaderController ("use client") can call it without pulling
 * paperRoutes' server content index into the browser bundle.
 */

import type { FaceAvailability } from "./faceAvailability.ts";
import type { FaceId } from "./faces/registry.ts";
import type { FaceFallbackId } from "./paperRoutes.ts";

/*
  THE ORDER OF THE TABS after Explanation, which each chooser renders first: Results, then the
  source faces with the language faces after German, facsimile, and split view last. FaceChooser
  used FACE_FALLBACK_IDS' order once, so moving from the explanation to the German face moved
  Results from second place to third.
*/
export const FACE_TAB_ORDER = [
  "results",
  "german",
  "english",
  "gloss",
  "parallel",
  "facsimile",
  "split",
] as const satisfies readonly FaceFallbackId[];

export type FaceTabId = (typeof FACE_TAB_ORDER)[number];

/*
  TABS FOR THE FACES THAT HAVE SOMETHING, AND ONE LINE FOR THE ONES THAT DO NOT. Eight equal
  links, three of them "not set yet", wrapped into three rows on a phone and read as a list of
  doors. A face reported empty is still a link - its page says what is missing - but it sits
  in a quiet line after the tabs rather than posing as one, unless it is the face on screen,
  which is always a tab. A face whose availability is `unknown`, or absent, is a tab: facsimile
  cannot be decided without hashing its PDF (faceAvailability.ts).
*/
export function faceTabList(
  availability: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined,
  current?: FaceId | undefined,
): { readonly tabs: readonly FaceTabId[]; readonly pending: readonly FaceTabId[] } {
  const pending = FACE_TAB_ORDER.filter((id) => availability?.[id] === "empty" && id !== current);
  const tabs = FACE_TAB_ORDER.filter((id) => !pending.includes(id));
  return { tabs, pending };
}
