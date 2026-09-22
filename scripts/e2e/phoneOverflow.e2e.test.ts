/**
 * The layout viewport invariant at real phone widths, across EVERY built route.
 *
 * The property: `document.documentElement.scrollWidth === clientWidth` at every supported phone
 * width, on every page the build emits. When it does not hold the reader gets horizontal scroll:
 * the column drifts sideways, the right edge of every line is off screen, and pinch-zoom fights
 * the page. It is the cheapest single signal that a layout only works because the viewport is wide.
 *
 * The property does not hold yet, so it is enforced against a baseline of the pairs that still
 * violate it, BY IDENTITY and TWO-SIDED. See "the shape of the assertion" below.
 *
 * WHY AGAINST out/ AND NOT A FIXTURE. src/testing/styles/computedStylesLayout.test.ts already
 * injects globals.css into hand-written markup and measures a button there. That is a fixture
 * check: it proves a rule computes, on markup the test author chose. Every defect this file was
 * written from would have passed it, because each came from the INTERACTION between real content
 * and a real container - a 64 character sha256 inside a grid item whose min-width is auto, a five
 * column table inside a 342px block, a flex row of buttons with no flex-wrap. None of those is
 * visible in a stylesheet, and none is visible in a fixture.
 *
 * WHY THREE WIDTHS. 320 is the narrowest viewport the lane matrix commits to (`touch-320` in
 * scripts/e2e/lanes.ts); 360 is the commonest Android width; 390 is the iPhone logical width.
 * They are not interchangeable, and that is measured rather than assumed: /notation/ overflowed
 * at all three, /lab/me-02/ at 320 and 360 while fitting at 390, /lab/bm-03/ only at 320. Any
 * single width reports one of those cases as the other.
 *
 * WHY IT REFUSES A STALE BUILD. A page that never loaded reports no overflow, and so does a page
 * that is fine. An absent or stale out/ would make this file green for the wrong reason,
 * permanently. assertOutFreshness turns both into a failure that names the cause.
 *
 * HOW IT SURVIVES A PEER REBUILDING out/ UNDERNEATH IT. A peer rebuilds several times an hour in
 * this checkout, and `next build` empties the directory before refilling it. The first run of
 * this test loaded /notation/ at 320px and got a 404 for the same route at 360px, mid-rebuild.
 * Refusing on that would be a refusal on a condition that is permanently true here, which is
 * precisely how `bun run test:node` became an off switch for 49 commits (see outFreshness.ts).
 *
 * The first repair was to copy the build and measure the copy. That works and costs 130MB per
 * run, and disposing of the copy would mean writing file deletion into a test, which RULE 1 puts
 * out of reach. So instead the Next build id is read off every route BEFORE and AFTER the sweep:
 * one id both times, and the same id both times, means no rebuild landed while the pages were
 * being measured. Two ids, or two different ids, means the numbers are a mixture of builds and
 * the test says so INSTEAD of reporting them. That check is asserted before the load failures,
 * because a mid-sweep rebuild is the cause and a 404 is only its symptom.
 *
 * WHY A SINGLE-THREADED SERVER WOULD BE WORSE THAN NO TEST. Measured while writing this: serving
 * out/ single-threaded reset 591 of 616 page loads under a browser's parallel asset fetches. The
 * sweep reported "2 violations" and read as clean; it had measured 25 pages of 616. Node's server
 * handles concurrent sockets, a non-ok response is a failure rather than a skip, and the pair
 * count is both asserted complete and printed.
 *
 * THE SHAPE OF THE ASSERTION, and why it is not a count.
 *
 * AGENTS.md ("A Count Is For Reporting, Not For Asserting") records what `typos.length === 6`
 * cost: a census frozen into an equality breaks on correct work and, worse, aborts above the
 * checks that matter. `assert.equal(violations.length, 22)` would be the same mistake wearing a
 * mobile hat. It would go red when a peer adds a route, it would go red when someone repairs a
 * page, and in neither case would the message say which.
 *
 * So the count is REPORTED (t.diagnostic prints pairs measured and violations found, with the
 * command that reproduces them) and the PROPERTY is asserted, in the only form that is true
 * today: the set of overflowing (route, width) pairs is exactly the recorded baseline. The
 * members are identities, not a number, and the comparison is two-sided:
 *
 *   - a pair measured overflowing that is NOT in the baseline is a REGRESSION, and the failure
 *     names the route and the width;
 *   - a pair in the baseline that no longer overflows is a REPAIR, and the failure says to delete
 *     that line. Fixing a page therefore forces the baseline down instead of leaving slack for a
 *     later regression to hide in.
 *
 * When the baseline empties, both halves keep holding and the assertion becomes the unconditional
 * property with nothing to edit.
 *
 * THIS GATE IS HALF OF A PAIR, AND THE OTHER HALF CAN BE BROKEN BY SATISFYING THIS ONE.
 *
 * The commonest way to stop a region overflowing is to let it scroll. That is also the commonest
 * way to create a keyboard trap: a pointer can drag a scroll region, and without a tab stop its
 * off-screen content is unreachable by keyboard entirely. So a page can be moved out of
 * BASELINE_OVERFLOWING by a change that puts a new entry into the scrollableRegions ratchet
 * (src/testing/a11y/scrollableRegions.test.ts, am-bc6s), and the author sees one green tick and
 * one number going the right way.
 *
 * That is not hypothetical: 8ece778c repaired /notation/ by wrapping its table in .table-scroll,
 * and central verify caught "1 unreachable scroll region(s), baseline 0" at HEAD. f6f8a9ea is the
 * missing half. Before claiming a route repaired here, run that ratchet, because the trade this
 * gate rewards is exactly the trade that one refuses.
 *
 * Neither gate can see the trade on its own. It is visible because both are two-sided: this one
 * refuses to let a repair go unrecorded, and that one refuses to let a scroll region go
 * unreachable, so a change that buys one with the other has to show up in one of them.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");

const PHONE_WIDTHS = [320, 360, 390] as const;

/** Pages loaded at once per width. Wall clock, not semantics; the measurement is per page. */
const CONCURRENCY = 4;

/** The viewport the planted negative runs at, named so its precondition can check against it. */
const PLANT_WIDTH = 320;

/**
 * The (route, width) pairs that still overflow, by identity.
 *
 * Reproduce exactly what this list records:
 *   bun run build
 *   node --experimental-strip-types --test scripts/e2e/phoneOverflow.e2e.test.ts
 * and read the diagnostic, which prints every measured violation as `route@width`.
 *
 * Each cause is recorded so the next reader repairs the defect rather than the symptom. Three
 * distinct causes account for all of them, and one of the three is not a mobile fix at all:
 * am-orphaned-stylesheets-5u3c records that src/components/foundations/foundations.css is
 * imported by nothing, so its `.construction-table-wrap { overflow-x: auto }` computes VISIBLE on
 * the page and the foundation tables have no container. Wiring it up changes 42 pages and is an
 * ownership decision.
 */
// The `// +Npx` annotations are INDICATIVE, not asserted. Only the route@width identities are
// enforced, because the magnitudes move with copy and type scale while the defect does not:
// /lab/bm-03/ has read +23 and +20, /foundations/exponentials/ +14 and +22, on builds a few hours
// apart with no commit touching either page.
const BASELINE_OVERFLOWING: readonly string[] = Object.freeze([
  // TABLE WITH NO WORKING SCROLL CONTAINER. A table is at least its min-content width, so
  // `width: 100%` cannot contain it and the document grows instead. The foundations three are
  // NOT missing a rule: src/components/foundations/foundations.css declares
  // `.construction-table-wrap { overflow-x: auto }` and is imported by nothing, so the wrapper
  // computes overflow-x VISIBLE on the page - measured 358px wide with scrollWidth 453 at 390px.
  // Wiring that stylesheet up changes 42 pages, which is an ownership decision, not a mobile fix:
  // am-orphaned-stylesheets-5u3c.
  "/foundations/taylor-expansion/@320", // +85px
  "/foundations/taylor-expansion/@360", // +45px
  "/foundations/taylor-expansion/@390", // +15px
  // WHAT THE ORPHANED-STYLESHEET WIRING REACHED, AND WHAT IT COULD NOT.
  //
  // 0e50a762 and e684aae1 made foundations.css live, so its
  // `.construction-table-wrap { overflow-x: auto }` finally applies. Measured on build
  // oHPd2JiH5los7k6SuuBJz: /foundations/logarithms/ at all three widths and
  // /foundations/exponentials/@320 are contained and have left this list.
  //
  // The two that remain do not use that wrapper, which is why a stylesheet fix could not reach
  // them - counted in the built HTML rather than assumed: logarithms 1, exponentials 1,
  // partial-derivatives 0, taylor-expansion 0. partial-derivatives wraps its table in
  // div.thermodynamics-held-fixed-comparison, which has no overflow rule; taylor-expansion has no
  // wrapper at all, its table.data-table being a direct child of the section.
  "/foundations/partial-derivatives/@320", // +47px
  // Added one cycle after the rest of this list, and the gate is how it was found rather than a
  // guess. It was NOT overflowing at 360 when the baseline was derived; a type-scale change landed
  // between the two builds (4137906a) and this table, which nothing constrains, grew about 10px:
  // 357 -> 367 at 320, and 360 -> 366 at 360. Measured 5 runs at each width before recording it,
  // because a 6px excess is exactly the size that could have been noise: 5/5 overflowing at 320
  // and at 360, 0/5 at 390. Same cause as its sibling entries - am-orphaned-stylesheets-5u3c.
  "/foundations/partial-derivatives/@360", // +6px
  // /foundations/exponentials/ was filed under "rendered mathematics" and belongs here: its
  // offender is table.data-table inside div.construction-table-wrap, the same inert wrapper as
  // its three siblings above. Re-measured, not inherited.

  // A ROW THAT WILL NOT WRAP. Same class as the .predict-mode-tabs defect already repaired on
  // /lab/me-02/: two 240px button.secondary elements side by side on /lab/lq-07/, a 167px
  // button.secondary on /lab/bm-03/, and a 280px div.input-field on /lab/lq-05/.
  //
  // /lab/lq-05/ is the one of the three whose obvious cause is already handled - .input-field
  // carries min-width:0 and .input-grid collapses to a single column at 560px - so whatever holds
  // it open is something else and it is not grouped here on the strength of looking similar.
  "/lab/lq-05/@320",
  "/lab/bm-03/@320",
  // /discover/brownian-motion/ - THE EXCURSION IS EXPLAINED, AND IT WAS NOT THE COPY.
  //
  // This entry read "+236px" and its two wider siblings are gone, repaired by ca2b4d29 and
  // measured clear on build ZTNqNE8jl2GU8tr0dDU9e. The account that stood here was wrong and is
  // worth correcting rather than deleting, because I acted on it twice.
  //
  // I had it as a page whose width tracks its own prose: a knowledge card's <summary> is
  // display:flex with no flexWrap and holds a .badge whose text is a sentence, so the longest
  // label sets the width - and pane29 was editing those labels. That mechanism is real. It was
  // not what produced the 556px readings. 556 appeared at 320, 360 AND 390 alike, which is the
  // signature of a fixed-width element rather than of text: a badge row measured 311px and
  // cannot make a 556px document unless its container is already that wide. The container was
  // an auto-fit track with a 280px floor. This page carries 22 such grids and four are at 280;
  // all 22 are converted now and none is left unconverted.
  //
  // What survives at 320 is a different element: article#arg-branch-* at 288px inside a 288px
  // main, offset by the gutter, from the fork cards in Branch.tsx. Undiagnosed beyond that.
  //
  // The lesson I take is about the earlier removal, not the mechanism. I deleted the two wider
  // entries once on a five-run stability check against ONE build, and they returned as
  // regressions on the next. Repeating a measurement on the axis you chose says nothing about
  // the axis the quantity moves on. They leave now for a different reason - a named cause, a
  // code change that addresses it, and a measurement after it - not because they were quiet.
  "/discover/brownian-motion/@320", // +236px
]);

/**
 * Routes repaired by 8ece778c, named by IDENTITY rather than left to the baseline's silence.
 *
 * The full sweep already requires these to fit, because anything not in BASELINE_OVERFLOWING must
 * not overflow. Naming them adds the thing a generic regression message cannot: which defect came
 * back. Both are permanent facts about pages that exist, which is the case AGENTS.md says to
 * assert by identity instead of by count.
 */
const REPAIRED: readonly { readonly route: string; readonly defect: string }[] = Object.freeze([
  {
    route: "/notation/",
    defect:
      "the .entries-grid `1fr` track sized itself to a card's min-content and reached 511.281px inside a 342px grid, from a dotted quantity id and a 64-character sha256 that carry no break opportunity; and modern-symbols-table had no scroll container",
  },
  {
    route: "/lab/me-02/",
    defect:
      ".predict-mode-tabs was display:flex with no flex-wrap, so a row of ~113px buttons could not break onto a second line; it fitted at 390 and failed at 320 and 360",
  },
  // The auto-fit cohort, repaired together by ca2b4d29 and measured together on build
  // ZTNqNE8jl2GU8tr0dDU9e. One defect, one remedy, five routes.
  ...(["/lab/lq-01/", "/lab/lq-06/", "/lab/lq-07/", "/lab/lq-09/", "/lab/sr-03/"] as const).map(
    (route) => ({
      route,
      defect:
        "an inline `repeat(auto-fit, minmax(Npx, 1fr))` laid a track wider than its container, because auto-fit collapses empty tracks and does not shrink one below the minmax floor; the item was never the problem, which is why min-width:0 on it moved nothing. Repaired by giving every floor a ceiling: minmax(min(Npx, 100%), 1fr)",
    }),
  ),
  {
    route: "/lab/sr-01/",
    defect:
      "table.event-ledger carries six columns and had no container at all, so its 437px min-content went straight into the document at 320, 360 and 390 alike; contained by .table-scroll, with the tab stop and name shipped in the same commit so the fix did not trade the overflow for a keyboard trap (702cd935)",
  },
]);

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

/** Every route the build emits, as a URL path, discovered rather than listed. */
function discoverRoutes(root: string): string[] {
  const routes: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_next") continue;
        walk(full);
      } else if (entry.name === "index.html") {
        const rel = relative(root, dir).split(sep).join("/");
        routes.push(rel === "" ? "/" : `/${rel}/`);
      }
    }
  };
  walk(root);
  return routes.sort();
}

/** Every distinct Next build id currently on disk across the given routes. */
function buildIdsOnDisk(routes: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const route of routes) {
    const file = join(OUT_DIR, route, "index.html");
    if (!existsSync(file)) continue;
    const id = /\\"b\\":\\"([^\\"]+)\\"/.exec(readFileSync(file, "utf8"))?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    try {
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      /* fall through to the 404 below */
    }
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolveServer({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * Waits for the real reading face to be laid out before anything is measured.
 *
 * `waitUntil: "load"` does not mean the webfonts have been applied, and scrollWidth is a function
 * of the face in use. This site self-hosts Newsreader, and the fallback metrics are not close
 * enough to ignore: measured on this build with the font files aborted at the network against the
 * same page with them allowed,
 *
 *   /foundations/logarithms/          @320  474 -> 480   (+6px)
 *   /foundations/partial-derivatives/ @320  350 -> 367   (+17px)
 *   /foundations/partial-derivatives/ @360  360 -> 366   (+6px)  <- changes the VERDICT
 *
 * The last one is why this is not a formality. Under fallback that route fits 360 exactly and the
 * gate would call it clean; with the face a reader actually gets, it overflows by 6px. The gate
 * reached the right answer before this existed only because the sweep reuses one context per
 * width, so the fonts were already cached by the second navigation - correct by luck, and wrong
 * for whichever route happened to be measured first.
 *
 * The home page, by contrast, is 320 and 390 either way, which matches what pane28 measured for
 * the header: the chrome does not move at phone width, route CONTENT does.
 *
 * WHY THE CHECK AND NOT THE STATUS. With the fonts blocked the page still reports
 * `document.fonts.status === "loaded"` and `document.fonts.size === 23` - "loaded" means nothing
 * is pending, not that anything arrived. Awaiting readiness and asserting the status would be a
 * guard that cannot fail. `document.fonts.check()` is the one that distinguishes a usable face
 * from a dead one, so that is what every measurement carries and what is asserted below.
 */
async function settleFonts(page: import("playwright").Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // A repaint after the swap; the face can arrive before the reflow it causes.
  await page.waitForTimeout(150);
}

interface Pair {
  readonly id: string;
  readonly route: string;
  readonly width: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly readingFaceUsable: boolean;
}

test("no built route overflows its layout viewport at a supported phone width", async (t) => {
  const freshness = assertOutFreshness("out", REPO_ROOT);
  if (freshness.dirtyStaticSources && freshness.dirtyStaticSources.length > 0) {
    t.diagnostic(
      `out/ predates ${freshness.dirtyStaticSources.length} uncommitted static source(s); this measures the BUILT artefact, not the working tree`,
    );
  }

  const routes = discoverRoutes(OUT_DIR);
  const buildIdsBefore = buildIdsOnDisk(routes);

  // Non-vacuity, stated on purpose rather than supplied by accident. A sweep over zero routes
  // reports zero violations and is indistinguishable from a clean one.
  assert.ok(
    routes.length > 100,
    `Only ${routes.length} routes discovered under out/. The build emits hundreds; a collapsed route set would report the property as holding without having tested it.`,
  );

  const { server, origin } = await startStaticServer(OUT_DIR);
  const browser = await chromium.launch();
  const measured: Pair[] = [];
  const loadFailures: string[] = [];
  try {
    for (const width of PHONE_WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const queue = [...routes];
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          const page = await context.newPage();
          for (let route = queue.pop(); route !== undefined; route = queue.pop()) {
            const response = await page.goto(`${origin}${route}`, { waitUntil: "load" });
            if (!response?.ok()) {
              loadFailures.push(`${route}@${width} (http ${response?.status()})`);
              continue;
            }
            await settleFonts(page);
            const box = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              readingFaceUsable: document.fonts.check('1rem "Newsreader"'),
            }));
            measured.push({ id: `${route}@${width}`, route, width, ...box });
          }
          await page.close();
        }),
      );
      await context.close();
    }

    // The instrument must be able to fail. Without this every assertion below is a claim about a
    // measurement never observed going red, and a check that cannot fail looks exactly like one
    // that found nothing wrong.
    const plantContext = await browser.newContext({
      viewport: { width: PLANT_WIDTH, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const plantPage = await plantContext.newPage();
    const plantResponse = await plantPage.goto(`${origin}/`, { waitUntil: "load" });
    await settleFonts(plantPage);
    const clean = await plantPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // The plant's preconditions, checked before its verdict is allowed to mean anything.
    //
    // This is not defensive padding. The first run of the full sweep reported "PLANTED NEGATIVE
    // DID NOT FIRE ... scrollWidth 980 against clientWidth 980", and the plant was fine: a peer's
    // `next build` had emptied out/ mid-run, so / returned the 404 body, and a page with no
    // viewport meta lays out at Chromium's 980px default where a 900px block fits with room to
    // spare. Both numbers were 980 and the old weak precondition - scrollWidth === clientWidth -
    // was satisfied by that. The message then blamed the measurement for what was a missing file.
    // A precondition that a 404 can satisfy is not a precondition.
    assert.ok(
      plantResponse?.ok(),
      `The planted negative could not load / (http ${plantResponse?.status()}). out/ was probably emptied by a peer's build mid-run. This says nothing about whether the measurement works; re-run.`,
    );
    assert.equal(
      clean.clientWidth,
      PLANT_WIDTH,
      `The plant page laid out at ${clean.clientWidth}px rather than the requested ${PLANT_WIDTH}px. Chromium falls back to 980px for a document with no viewport meta, which is what the 404 body does, so this is a page that did not load rather than a page that is too wide. Re-run.`,
    );
    assert.equal(
      clean.scrollWidth,
      clean.clientWidth,
      "Planted negative needs a clean baseline on / at the plant width before the plant proves anything.",
    );
    await plantPage.evaluate(() => {
      const bar = document.createElement("div");
      bar.style.cssText = "width:900px;height:8px;";
      document.body.appendChild(bar);
    });
    await plantPage.waitForTimeout(200);
    const planted = await plantPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      planted.scrollWidth > planted.clientWidth,
      `PLANTED NEGATIVE DID NOT FIRE: a 900px block on a 320px viewport left scrollWidth ${planted.scrollWidth} against clientWidth ${planted.clientWidth}. The measurement cannot detect overflow, so every assertion in this file is vacuous.`,
    );
    await plantContext.close();
  } finally {
    await browser.close();
    server.close();
  }

  // ASSERTED FIRST, because a mid-sweep rebuild is the CAUSE and a 404 is only its symptom.
  // Reporting overflow numbers drawn from two different builds would be worse than reporting none.
  const buildIdsAfter = buildIdsOnDisk(routes);
  assert.equal(
    buildIdsBefore.size,
    1,
    `out/ held ${buildIdsBefore.size} distinct Next build ids before the sweep (${[...buildIdsBefore].join(", ")}); it was mid-rebuild. Re-run.`,
  );
  assert.deepEqual(
    [...buildIdsAfter].sort(),
    [...buildIdsBefore].sort(),
    `out/ was rebuilt DURING the sweep (before: ${[...buildIdsBefore].join(", ")}; after: ${[...buildIdsAfter].join(", ")}). These measurements are a mixture of two builds, so they are not reported. Re-run.`,
  );
  const buildId = [...buildIdsBefore][0] as string;

  // A page that did not load cannot be judged either way, so it is a failure and not a gap.
  assert.deepEqual(
    loadFailures,
    [],
    `Routes failed to load, and an unloaded page reports no overflow exactly as a clean one does: ${loadFailures.join(", ")}`,
  );
  // THE WAIT IS ONLY WORTH ANYTHING IF THE FACE ACTUALLY ARRIVED.
  //
  // With the font files aborted at the network the page still reports
  // `document.fonts.status === "loaded"` and 23 registered faces, because "loaded" means nothing
  // is pending rather than that anything came. So awaiting readiness proves nothing on its own,
  // and a self-hosted font that 404s would silently return every number here to fallback metrics
  // while the run stayed green. This is the assertion that cannot be satisfied by an absent font.
  const fallbackMetrics = measured
    .filter((m) => !m.readingFaceUsable)
    .map((m) => m.id)
    .sort();
  assert.deepEqual(
    fallbackMetrics,
    [],
    `The reading face was not usable on these pages, so they were measured in fallback metrics and their widths are not what a reader gets (/foundations/partial-derivatives/@360 is 360 under fallback and 366 with Newsreader, which changes the verdict):\n  ${fallbackMetrics.join("\n  ")}`,
  );

  // THE OTHER HALF OF THE INVARIANT, and the plant is why it is here.
  //
  // scrollWidth === clientWidth alone is satisfiable by a layout viewport that grew to match its
  // content. A document with no viewport meta lays out at Chromium's 980px default and reports
  // 980 === 980, which is how the plant's old precondition passed on a 404 body. Measured across
  // 1809 real route/width pairs the site never inflates - clientWidth equalled the requested width
  // every time - so this costs nothing today and closes the hole the plant found.
  const wrongWidth = measured
    .filter((m) => m.clientWidth !== m.width)
    .map((m) => `${m.id} (laid out at ${m.clientWidth}px)`)
    .sort();
  assert.deepEqual(
    wrongWidth,
    [],
    `These pages did not lay out at the viewport width they were given, so "scrollWidth === clientWidth" would be true of the wrong viewport:\n  ${wrongWidth.join("\n  ")}`,
  );

  assert.equal(
    measured.length,
    routes.length * PHONE_WIDTHS.length,
    `Measured ${measured.length} pairs but ${routes.length} routes x ${PHONE_WIDTHS.length} widths is ${routes.length * PHONE_WIDTHS.length}. A partial sweep cannot establish the property.`,
  );

  const violations = measured.filter((m) => m.scrollWidth > m.clientWidth);

  // REPORTED, not asserted: the numbers, anchored to what produced them.
  t.diagnostic(
    `build ${buildId}: measured ${measured.length} pairs (${routes.length} routes x ${PHONE_WIDTHS.length} widths: ${PHONE_WIDTHS.join(", ")}px); ${violations.length} overflowing`,
  );
  for (const v of violations) {
    t.diagnostic(`  overflow ${v.id} scrollWidth=${v.scrollWidth} clientWidth=${v.clientWidth}`);
  }

  // ASSERTED: the property, in the only form true today, two-sided and by identity.
  const seen = new Set(violations.map((v) => v.id));
  const baseline = new Set(BASELINE_OVERFLOWING);
  const measuredIds = new Set(measured.map((m) => m.id));

  const regressions = violations
    .filter((v) => !baseline.has(v.id))
    .map(
      (v) =>
        `${v.id} (scrollWidth ${v.scrollWidth} vs clientWidth ${v.clientWidth}, +${v.scrollWidth - v.clientWidth}px)`,
    )
    .sort();
  assert.deepEqual(
    regressions,
    [],
    `REGRESSION - these overflow at a phone width and are not in BASELINE_OVERFLOWING:\n  ${regressions.join("\n  ")}\nFix the page, or if the overflow is intended and contained, say why in this file.`,
  );

  const repaired = [...baseline].filter((id) => !seen.has(id) && measuredIds.has(id)).sort();
  assert.deepEqual(
    repaired,
    [],
    `REPAIRED - these no longer overflow. Delete them from BASELINE_OVERFLOWING in ${relative(REPO_ROOT, fileURLToPath(import.meta.url))} so the baseline ratchets down instead of leaving slack for a later regression to hide in:\n  ${repaired.join("\n  ")}`,
  );

  for (const { route, defect } of REPAIRED) {
    const pairs = measured.filter((m) => m.route === route);
    assert.equal(
      pairs.length,
      PHONE_WIDTHS.length,
      `${route} was repaired and must stay measured at every phone width; found ${pairs.length} of ${PHONE_WIDTHS.length}. If the route was renamed, update REPAIRED rather than dropping the anchor.`,
    );
    const broken = pairs.filter((m) => m.scrollWidth > m.clientWidth);
    assert.deepEqual(
      broken.map((m) => `${m.id} (+${m.scrollWidth - m.clientWidth}px)`),
      [],
      `${route} overflows again. It was repaired for: ${defect}`,
    );
  }

  const stale = [...baseline].filter((id) => !measuredIds.has(id)).sort();
  assert.deepEqual(
    stale,
    [],
    `STALE - these baseline entries name pairs the sweep never measured, so they protect nothing. The route was renamed or removed; update BASELINE_OVERFLOWING:\n  ${stale.join("\n  ")}`,
  );
});
