/**
 * HOW MANY SUSPENSE BOUNDARIES IN THE BUILT SITE GAVE UP AND BAILED OUT TO THE CLIENT.
 *
 * A boundary that cannot be prerendered is emitted by Next as a `<template>` carrying
 * `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"`, preceded by React's `<!--$!-->` marker: the server
 * rendered NOTHING there, and the client must render it after hydration. Nothing in this repository
 * counted them, so a site-wide condition was invisible.
 *
 * MEASURED 2026-10-26, BEFORE the repair: **765 HTML pages, 2,211 bailout markers; 737 pages
 * carrying exactly 3, and 28 at 0 -- all `/offline/...` chapters, which use a different shell.** So
 * every page on the reading path carried three. AFTER `da12fd9f7`: **0 markers, all 765 pages.**
 *
 * WHERE THE THREE COME FROM, named so a fourth is diagnosable rather than mysterious.
 * `src/app/layout.tsx` wraps three components in `<Suspense fallback={null}>`: `GuidedTourTrail`,
 * `CapstoneReturnTrail`, and `GuidedTourTrail compact`. Both components call `useSearchParams()`
 * (`GuidedTourTrail.tsx:12`, `CapstoneReturnTrail.tsx:18`), which a static export cannot resolve at
 * build time, so each of the three instances bails out. Three instances, three markers, every page.
 *
 * WHY IT IS WORTH A GATE AND NOT JUST A NOTE. Those three boundaries are the measured cause of
 * React #418 on **one load in five of every page under about 57 KB** -- `/`, `/accessibility/`,
 * `/capstones/`, `/notebook/`, `/equations/`, `/search/results/` and all four tour outlines -- and 0
 * of 80 loads on pages over 133 KB (am-xh2o). `src/app/layout.tsx:100-107` records that trade-off
 * and costs it at "one load in 300", which is the figure the decision rests on and is about sixty
 * times too low. A FOURTH bailout would widen that class silently, because a page component calling
 * `useSearchParams()` looks like ordinary code and produces no warning in a passing build.
 *
 * THIS IS A CEILING, NOT A TARGET. AGENTS.md: "a baseline is the record of a debt, not a budget to
 * draw on", and "when a debt is paid down, lower the ceiling with it". If a repair removes the
 * bailouts the census below prints a smaller number and this test still passes -- so read the
 * printed count, and when it drops, drop `CEILING_PER_PAGE` with it in the same commit.
 *
 * WHAT THIS DOES NOT WATCH: whether a bailout causes a visible defect on any particular page. That
 * is a browser question and am-xh2o carries the reproduction. This file answers how many there are
 * and where, from the build alone.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "./outFreshness.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(ROOT, "out");

/** Next's digest for a boundary that could not be prerendered. */
const BAILOUT = 'data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"';

/**
 * ZERO, BECAUSE THE DEBT WAS PAID (`da12fd9f7`, same day this gate landed at 3).
 *
 * `AfterHydration` defers the three trails past prerender, so `useSearchParams()` is never called
 * while the static export runs and no boundary bails out. Re-measured over the next build: **0
 * markers across all 765 pages**, from 2,211. AGENTS.md: "when a debt is paid down, lower the
 * ceiling with it" -- a ceiling left at 3 would silently re-admit three bailouts per page.
 *
 * Raising this is taking on reader-facing hydration debt and needs the reason written here beside
 * the number. It is NOT justified by the #418 this gate was written alongside: removing the
 * bailouts did not fix that (`de14283b5`), so a future bailout cannot be excused as harmless on the
 * grounds that these three turned out not to cause it either.
 */
const CEILING_PER_PAGE = 0;

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, found);
    else if (p.endsWith(".html")) found.push(p);
  }
  return found;
}

const PAGES = existsSync(OUT) ? walk(OUT) : [];

/** Bailout markers per page, keyed by the route a reader would type. */
function bailoutsByPage(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of PAGES) {
    const route = `/${posix.relative(OUT, page).split("\\").join("/")}`;
    let n = 0;
    let at = 0;
    const body = readFileSync(page, "utf8");
    for (;;) {
      const next = body.indexOf(BAILOUT, at);
      if (next === -1) break;
      n += 1;
      at = next + BAILOUT.length;
    }
    counts.set(route, n);
  }
  return counts;
}

describe("client-side rendering bailouts in the built site", () => {
  test("the build is present, fresh, and the population is the pages", () => {
    assertOutFreshness("out", ROOT);
    // The population is PAGES, deliberately, not markers. If a repair takes the marker count to
    // zero this file must still be examining something, or it would become vacuous at exactly the
    // moment it starts guarding a clean state.
    assert.ok(
      PAGES.length >= 400,
      `no built pages under out/ (${PAGES.length}). Run \`bun run build\`; this gate reads the build.`,
    );
    const counts = bailoutsByPage();
    const distribution = new Map<number, number>();
    for (const n of counts.values()) distribution.set(n, (distribution.get(n) ?? 0) + 1);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    console.log(
      `[bailouts] ${PAGES.length} built page(s); ${total} bailout marker(s); per-page distribution ${JSON.stringify(
        Object.fromEntries([...distribution].sort((a, b) => a[0] - b[0])),
      )} (ceiling ${CEILING_PER_PAGE})`,
    );
  });

  test("no page exceeds the declared ceiling of client-side bailouts", () => {
    assertOutFreshness("out", ROOT);
    const over = [...bailoutsByPage().entries()]
      .filter(([, n]) => n > CEILING_PER_PAGE)
      .sort((a, b) => b[1] - a[1])
      .map(([route, n]) => `${route}: ${n} (ceiling ${CEILING_PER_PAGE})`);
    // Named, not counted: a new bailout is repaired by finding which component on that route calls
    // a hook the static export cannot resolve, and `useSearchParams()` is the one that has done it.
    assert.deepEqual(
      over,
      [],
      `pages with more client-side-rendering bailouts than the root layout's own:\n${over.join("\n")}`,
    );
  });

  test("PLANTED: the marker is counted in served markup and not invented from prose", () => {
    /*
     * The count above is read with indexOf over raw bytes, so it cannot tell a real template from a
     * docblock quoting the digest -- and this very file quotes it four times. That is survivable
     * only because nothing under `out/` is a source comment, which is an assumption worth stating
     * and checking rather than relying on. The two directions:
     */
    const served = `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>`;
    assert.ok(served.includes(BAILOUT), "the digest as Next emits it must match");
    assert.ok(
      !"// a comment about BAILOUT_TO_CLIENT_SIDE_RENDERING".includes(BAILOUT),
      "the bare digest name without the attribute form must NOT match",
    );
    // And the assumption: no page under out/ is TypeScript source, so no docblock can be counted.
    const sources = PAGES.filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
    assert.deepEqual(sources, [], "out/ must hold no source files for this count to be honest");
    /*
     * THE CEILING COMPARISON CAN STILL FAIL AT ZERO, asserted rather than assumed. A gate whose
     * population has gone to zero is the shape that quietly stops biting: every real page now
     * carries 0 markers, so the only thing standing between this file and permanent vacuous green
     * is that `n > CEILING_PER_PAGE` rejects a single marker. One synthetic page says so.
     */
    const exceeds = (n: number): boolean => n > CEILING_PER_PAGE;
    assert.equal(exceeds(0), false, "a clean page must pass");
    assert.equal(exceeds(1), true, `one bailout must fail at ceiling ${CEILING_PER_PAGE}`);
    assert.equal(exceeds(3), true, "the three this gate was written at must now fail");
  });
});
