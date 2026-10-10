/**
 * EVERY REGION THAT ACTUALLY SCROLLS IS REACHABLE BY KEYBOARD, measured in a browser at the
 * narrowest supported width (am-unaudited-scroll-regions-r4jx).
 *
 * A pointer can drag a scroll region; a keyboard cannot, unless the region is a tab stop. So a
 * container whose content overflows and which carries no tabindex and no role has content that is
 * unreachable by keyboard entirely. Containing an overflow by letting a region scroll is the
 * commonest repair for phoneOverflow.e2e.test.ts, and it is also the commonest way to create that
 * trap: 8ece778c repaired /notation/ by wrapping its table in `.table-scroll` and made its
 * off-screen columns unreachable in the same change.
 *
 * WHY THIS IS NOT src/testing/a11y/scrollableRegions.test.ts, WHICH ALREADY EXISTS AND IS HONEST.
 * That one matches a list of audited class names against `className` occurrences in TSX. It is
 * correct about what it examines and says so, but a CSS rule can create a scroll region with no
 * class for it to key on -- `div:has(> table.data-table) { overflow-x: auto }` in globals.css
 * carries no class at all -- and a class-based scan cannot see one.
 *
 * WHY NOT A STATIC SCAN OVER THE STYLESHEETS, which is the cheaper half of the bead's criterion
 * and which I built and measured before writing this. Parsing all 87 built stylesheets for
 * selectors whose block sets `overflow(-x): auto|scroll` gives 54 selectors; matching them against
 * all 719 built pages with happy-dom gives 16,279 elements, 14,592 of them with no tabindex. The
 * real answer is 0. The gap is layout: `overflow-x: auto` declares what happens IF the content is
 * too wide, and `.inline-math` (398 pages), `.eq-step-formula` (208) and `.equation-body` (84)
 * carry it defensively on elements that never overflow. Only a laid-out browser knows
 * `scrollWidth > clientWidth`, and happy-dom reports 0 for both. A gate firing on 14,592 correct
 * elements would be worse than the silence it replaces.
 *
 * WHAT THIS MEASURES INSTEAD. Every element on every built route at 320px whose computed
 * `overflow-x` is `auto` or `scroll` AND whose `scrollWidth` exceeds its `clientWidth`. That is
 * the population the bead measured by hand, and it is class-blind by construction: it enumerates
 * elements and reads computed style, so a region created by a `:has()` selector with no class is
 * in it like any other.
 *
 * THE PREDICATE IS AXE'S, NOT A STRICTER ONE OF MY OWN, and that cost two rounds to learn. A
 * container whose content is ALREADY reachable is exempt: a keyboard tabbing into a focusable
 * descendant scrolls the box, so a stop on the container is the useless one the
 * scrollableRegions docblock warns about, and `formulaOverflow.inline.ts` applies the same
 * exemption deliberately. Without it this file reported four defects, all `div.source-equation`
 * on gloss faces -- `#eq-s3-1` overflowing by 12px and `#eq-2` by 11px, each holding SEVEN
 * focusable term chips. Every one was correct markup the runtime script had rightly left alone,
 * and a gate that refuses the rule it audits is worse than no gate.
 *
 * MEASURED ON THE BUILD OF 2026-10-10: 1,107 scrollable containers across 719 routes at 320px,
 * 0 unreachable.
 * The family is clean, which is the moment to put the guard on it rather than after the next
 * repair trades an overflow for a trap.
 *
 * 320 ONLY, deliberately. phoneOverflow measures three widths because a page can fit at 390 and
 * not at 320; this asks whether a region that scrolls is reachable, and a region that scrolls at
 * 360 scrolls at 320 too. The narrowest width is the strictly largest population, so a second
 * width would add runtime and no coverage.
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
const WIDTH = 320;
const CONCURRENCY = 6;

/**
 * The floor on the population, measured rather than chosen: 583 on the build of 2026-10-10.
 * Set below it with room for a route or two to change, because the number that matters is "this
 * did not collapse to nothing", not an equality that breaks on correct work (AGENTS.md, "A Count
 * Is For Reporting, Not For Asserting").
 */
const MIN_SCROLLABLE_CONTAINERS = 800;
const MIN_ROUTES = 500;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/**
 * Waits for the real reading face before anything is measured, exactly as phoneOverflow does and
 * for the same reason: `scrollWidth` is a function of the face in use, and `waitUntil: "load"`
 * does not mean the webfonts have been applied.
 *
 * This is not a formality here either. The first run of this file WITHOUT it reported 0
 * unreachable regions; a scratch probe with the identical predicate, also without it, reported 0;
 * and the first run WITH the pages warm found FOUR, all `div.source-equation` on gloss faces. The
 * same build, the same predicate, two answers -- which is a measurement whose verdict depends on
 * whether the font had arrived when the page was read.
 */
async function settleFonts(page: import("playwright").Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // A repaint after the swap; the face can arrive before the reflow it causes.
  await page.waitForTimeout(150);
}

/**
 * Reads the predicate repeatedly until two consecutive readings agree, and REFUSES rather than
 * returning the last one if they never do.
 *
 * MEASURING THIS PAGE AT REST IS NOT OPTIONAL, and the first version of this file proved it by
 * reporting four defects that do not exist. With fonts settled and nothing else, it found four
 * overflowing `div.source-equation` on gloss faces; a probe that waited 1600ms on the same two
 * routes found ZERO overflowing at all. The containers overflow transiently, between the webfont
 * arriving and the layout settling, and `formulaOverflow.inline.ts` schedules its last re-check
 * at 1200ms precisely because of that. Sampling before it is sampling in transit.
 *
 * A fixed sleep would work and would cost 719 routes times its length. Quiescence is both faster
 * on most routes and stricter: a page still changing at the budget is a page this instrument
 * cannot read, which is a finding about the instrument and is reported as one rather than
 * resolved by taking whatever the last reading happened to be.
 */
/**
 * The page's own last scheduled mutation, read off the mechanism rather than guessed.
 *
 * `src/components/edition/formulaOverflow.inline.ts` re-runs its pass at
 * `setTimeout(afterHydration, 300)` and `setTimeout(afterHydration, 1200)`, because React
 * hydration strips the tabindex it sets and an attribute removal is not a mutation its observer
 * can see. So nothing read before 1200ms is a reading of the finished page.
 *
 * QUIESCENCE ALONE IS NOT ENOUGH, and that is measured, not reasoned. With "two consecutive equal
 * readings 150ms apart" and no floor, this file still reported four defects: two reads agreeing at
 * 300ms say only that nothing changed in that window, and the 1200ms pass had not run yet. A
 * separate probe waiting 1600ms on the same routes found ZERO overflowing containers. So the floor
 * comes first and quiescence is checked on top of it.
 */
const SETTLE_FLOOR_MS = 1400;
const SETTLE_POLLS = 12;
const SETTLE_INTERVAL_MS = 150;

async function readAtRest(
  page: import("playwright").Page,
  route: string,
): Promise<{ examined: number; unreachable: string[] }> {
  await page.waitForTimeout(SETTLE_FLOOR_MS);
  let previous = JSON.stringify(await page.evaluate(FIND_UNREACHABLE));
  const seen: string[] = [previous];
  for (let poll = 0; poll < SETTLE_POLLS; poll += 1) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const current = JSON.stringify(await page.evaluate(FIND_UNREACHABLE));
    if (current === previous) return JSON.parse(current);
    seen.push(current);
    previous = current;
  }
  throw new Error(
    `${route} never settled: ${SETTLE_POLLS} readings ${SETTLE_INTERVAL_MS}ms apart never ` +
      `agreed twice in a row. The last four were ${seen.slice(-4).join(" | ")}. A reading taken ` +
      "in transit is not a measurement of what a reader gets.",
  );
}

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
 * The predicate, as it runs inside the page.
 *
 * Exported as a string so the planted negative below runs the SAME source against markup built
 * for the purpose. A plant against a re-implementation proves the re-implementation.
 */
const FIND_UNREACHABLE_BODY = `() => {
  const FOCUSABLE = "a[href],button,input,select,textarea,summary,[tabindex]";
  const REACHABLE_WITHIN = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])';
  const out = { examined: 0, unreachable: [] };
  for (const el of document.querySelectorAll("*")) {
    if (el.clientWidth === 0) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (!/auto|scroll/.test(getComputedStyle(el).overflowX)) continue;
    out.examined += 1;
    if (el.matches(FOCUSABLE) || el.getAttribute("role")) continue;
    // AXE'S OWN EXEMPTION, and the one formulaOverflow.inline.ts applies: a container whose
    // content is ALREADY reachable needs no stop of its own, because a keyboard tabbing into a
    // descendant scrolls the box. Adding one there is the useless tab stop the scrollableRegions
    // ratchet's docblock warns about.
    if (el.querySelector(REACHABLE_WITHIN)) continue;
    const cls = typeof el.className === "string" ? el.className : "";
    out.unreachable.push(el.tagName.toLowerCase() + (cls ? "." + cls.split(/\\s+/)[0] : ""));
  }
  return out;
}`;

/**
 * The expression Playwright evaluates. A STRING handed to `page.evaluate` is evaluated as an
 * EXPRESSION, so the arrow source alone yields the function object and every destructure of the
 * result reads `undefined` -- which is how the first run of this file failed, before it had
 * measured anything.
 */
const FIND_UNREACHABLE = `(${FIND_UNREACHABLE_BODY})()`;

test("every region that scrolls at 320px is reachable by keyboard", async (t) => {
  assertOutFreshness("out", REPO_ROOT);
  const routes = discoverRoutes(OUT_DIR);
  assert.ok(
    routes.length >= MIN_ROUTES,
    `Only ${routes.length} routes found under out/; a sweep over a near-empty build would report ` +
      "0 unreachable regions and read exactly like a clean one.",
  );

  const { server, origin } = await startStaticServer(OUT_DIR);
  const browser = await chromium.launch();
  let examined = 0;
  const unreachable: string[] = [];
  const loadFailures: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    // THE INSTRUMENT MUST BE ABLE TO FAIL, and the plant runs the predicate's own source rather
    // than a copy of it. A scrolling, class-less, unfocusable div must be found; the same div with
    // a tabindex must not. Both directions, because a predicate that found everything and one that
    // found nothing would each pass a single-sided plant.
    const probe = await context.newPage();
    await probe.setContent(
      `<style>.w{width:200px;overflow-x:auto}.i{width:900px;height:20px}</style>` +
        `<div class="w"><div class="i"></div></div>`,
    );
    const planted = (await probe.evaluate(FIND_UNREACHABLE)) as {
      examined: number;
      unreachable: string[];
    };
    assert.equal(
      planted.examined,
      1,
      `PLANTED NEGATIVE DID NOT REACH THE PREDICATE: a 900px block inside a 200px overflow-x:auto ` +
        `container was not counted as scrollable (examined ${planted.examined}).`,
    );
    assert.deepEqual(
      planted.unreachable,
      ["div.w"],
      "A scrolling, class-less, unfocusable container must be reported as unreachable.",
    );

    await probe.setContent(
      `<style>.w{width:200px;overflow-x:auto}.i{width:900px;height:20px}</style>` +
        `<div class="w" tabindex="0" aria-label="probe"><div class="i"></div></div>`,
    );
    const focusable = (await probe.evaluate(FIND_UNREACHABLE)) as {
      examined: number;
      unreachable: string[];
    };
    assert.equal(focusable.examined, 1, "The focusable container is still a scrollable container.");
    assert.deepEqual(
      focusable.unreachable,
      [],
      "A container with a tab stop must NOT be reported, or the gate would refuse the repair it asks for.",
    );
    await probe.close();

    const queue = [...routes];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const page = await context.newPage();
        for (let route = queue.pop(); route !== undefined; route = queue.pop()) {
          const response = await page.goto(`${origin}${route}`, { waitUntil: "load" });
          if (!response?.ok()) {
            loadFailures.push(`${route} (http ${response?.status()})`);
            continue;
          }
          await settleFonts(page);
          const found = await readAtRest(page, route);
          examined += found.examined;
          for (const el of found.unreachable) unreachable.push(`${route} ${el}`);
        }
        await page.close();
      }),
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  t.diagnostic(
    `[unreachable scroll regions] examined ${examined} scrollable container(s) across ` +
      `${routes.length} route(s) at ${WIDTH}px; ${unreachable.length} not keyboard reachable`,
  );

  // A load failure is not a skip: a page that never rendered reports no scroll regions, and so
  // does a page that is fine.
  assert.deepEqual(loadFailures, [], "Every route must load before its regions can be judged.");
  assert.ok(
    examined >= MIN_SCROLLABLE_CONTAINERS,
    `Only ${examined} scrollable containers found, against ${MIN_SCROLLABLE_CONTAINERS} measured ` +
      "on 2026-10-10. A sweep that found almost none reports 0 unreachable and reads as clean.",
  );
  assert.deepEqual(
    unreachable,
    [],
    "A region that scrolls and has no tab stop has content no keyboard can reach. Give the " +
      "container tabIndex={0} and an aria-label saying what is in it, in the same change that " +
      "made it scroll.",
  );
});
