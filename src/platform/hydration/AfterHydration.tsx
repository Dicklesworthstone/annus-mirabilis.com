"use client";

/**
 * RENDER CHILDREN ONLY AFTER MOUNT, SO A HOOK A STATIC EXPORT CANNOT RESOLVE IS NEVER CALLED WHILE
 * PRERENDERING.
 *
 * WHAT THIS CHANGES. `src/app/layout.tsx` renders three trails -- `GuidedTourTrail`,
 * `CapstoneReturnTrail`, `GuidedTourTrail compact` -- and both components call
 * `useSearchParams()`. In a static export that hook cannot be resolved at build time, so each
 * instance made Next give up on its Suspense boundary and emit
 * `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">` after React's `<!--$!-->`: the server
 * rendered NOTHING there and the client had to render it after hydration. Measured over the build
 * before this change: **2,211 such markers, three on each of 737 pages.**
 *
 * I BELIEVED THOSE BOUNDARIES WERE THE CAUSE OF REACT #418, AND THE EXPERIMENT REFUTED IT. Keep that
 * written here, because the shape of the evidence was convincing and someone will reach the same
 * conclusion again. A MutationObserver recording removals inside `<body>` showed React discarding
 * the body region around exactly these boundaries, taking `a.skip-link` and `header.site-header`
 * with it; the marker count matched the boundary count exactly, three and three, on every page; and
 * #418 fell on one load in five of the short pages. Every part of that is true and it is not a
 * cause.
 *
 * Measured after this change, 405 loads at 9 concurrent contexts, every load's hydration confirmed:
 * the bailout markers are **2,211 to 0** across all 765 pages, and #418 is **still 34 of 405**. So
 * this commit removes the bailouts and does NOT fix am-xh2o, which stays open. What it does buy the
 * next investigation is one fewer confound: the failing boundary is no longer in the page at all.
 *
 * It also corrected a claim of mine that was over-read from a small sample. I had reported the size
 * correlation as "monotone, no overlap" from 0 of 80 loads on pages over 133 KB. At 180 loads
 * `/notation/` (3.4 MB) shows 3. The tendency is real and strong -- 31 of 225 on pages under 57 KB
 * against 3 of 180 above -- but it is a tendency, not a clean separation, and 0 of 80 at a ~2% rate
 * was never evidence of absence.
 *
 * WHY A MOUNT GATE RATHER THAN CHANGING THE TRAILS. Passing `<GuidedTourTrail />` as `children`
 * creates an ELEMENT; React does not call the component until it renders one. So while
 * prerendering, this returns `null`, the trail's function body never runs, and `useSearchParams()`
 * is never called -- with no change to either trail's own logic, history handling or output. Both
 * read `window.location` in their own effects already.
 *
 * READER-VISIBLE BEHAVIOUR IS UNCHANGED, which is the point. A bailed-out boundary ALSO rendered
 * nothing on the server and nothing before hydration: a reader without JavaScript saw no trail
 * before and sees no trail now, and a reader with JavaScript gets it just after hydration either
 * way. What goes away is the discarded-and-re-rendered body region.
 *
 * THIS IS NOT `c3b3116b`, AND THE DIFFERENCE MATTERS. That commit put a Suspense boundary around
 * `<main>{children}</main>` to stop this same #418, which made the static export stream every page
 * as a hidden late segment moved in by a script -- so every page on live had an EMPTY `<main>` for
 * readers without JavaScript, 2026-09-24 to 2026-09-25. `src/app/layout.tsx` records that and says
 * "#418 needs another fix". This touches only the three trails, never the page, and the guard for
 * that regression is `src/testing/rootLayoutHydration.test.tsx`.
 *
 * DO NOT use this to defer reader-facing CONTENT. Everything a reader comes for is server rendered,
 * because "the reading experience is excellent ... without JavaScript". This is for a navigation
 * aid that was already client-only.
 */

import { type ReactNode, useEffect, useState } from "react";

export function AfterHydration({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted ? <>{children}</> : null;
}
