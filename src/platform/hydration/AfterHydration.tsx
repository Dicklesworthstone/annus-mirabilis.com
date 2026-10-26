"use client";

/**
 * RENDER CHILDREN ONLY AFTER MOUNT, SO A HOOK A STATIC EXPORT CANNOT RESOLVE IS NEVER CALLED WHILE
 * PRERENDERING.
 *
 * WHAT THIS FIXES. `src/app/layout.tsx` renders three trails -- `GuidedTourTrail`,
 * `CapstoneReturnTrail`, `GuidedTourTrail compact` -- and both components call
 * `useSearchParams()`. In a static export that hook cannot be resolved at build time, so each
 * instance made Next give up on its Suspense boundary and emit
 * `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">` after React's `<!--$!-->`: the server
 * rendered NOTHING there and the client had to render it after hydration. Measured over the build
 * before this change: **2,211 such markers, three on each of 737 pages.**
 *
 * Those three boundaries are the measured cause of React #418 on **one load in five of every page
 * under about 57 KB** -- `/`, `/accessibility/`, `/capstones/`, `/notebook/`, `/equations/`,
 * `/search/results/`, all four tour outlines -- against 0 of 80 loads on pages over 133 KB
 * (am-xh2o). A MutationObserver recording removals inside `<body>` showed React discarding the body
 * region around those boundaries, taking `a.skip-link` and `header.site-header` with it.
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
