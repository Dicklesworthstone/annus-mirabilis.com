/**
 * A scrollable formula is still keyboard-reachable AFTER React has hydrated.
 *
 * WHY THIS EXISTS, and it is not the defect anyone would guess. `formulaOverflow.inline.ts` sets
 * `tabindex="0"` and an accessible name on exactly the formulas that overflow, and it has always
 * worked. Measured on /lab/sr-03/ at 320px with performance.now():
 *
 *     DOMContentLoaded  t=61    31 formulas, 2 overflowing, 2 marked
 *     load              t=108   3 overflowing, 2 marked
 *     t+100             t=121   3 overflowing, 3 marked      <- correct
 *     t+200             t=215   3 overflowing, 0 marked      <- React reconciled them away
 *     t+1200                    3 overflowing, 0 marked      <- never restored
 *
 * The script reaches the right answer and hydration then reconciles the DOM against markup that
 * carries no tabindex and deletes it. The MutationObserver is registered for childList/subtree,
 * and removing an attribute is neither, so nothing re-runs. 93434b3e added re-checks scheduled
 * after hydration; this gate is what keeps them.
 *
 * WHAT NO STATIC CHECK CAN SEE. The source is correct in both states. The difference is a race
 * between an inline script and React, and it is only visible in a rendered page some hundreds of
 * milliseconds after load. `formulaOverflow.test.ts` has three unit tests - IIFE shape,
 * conditional setting, does-not-throw - and none of them removes an attribute and re-checks,
 * because in jsdom nothing hydrates.
 *
 * THE FAILURE THIS GATE IS MOST LIKELY TO HAVE ITSELF. A test that samples BEFORE hydration
 * passes on a broken page - that is precisely how the defect survived. So the settle below is
 * derived from the implementation's own schedule rather than chosen, and the planted negative
 * strips the attribute AFTER that schedule has finished: if this test ever samples too early the
 * plant stays GREEN and says so, instead of the gate quietly certifying a page nobody can reach.
 *
 * WHY THE FIX IS TIMER-BASED AND THIS GATE IS THE PRICE. Watching attributes would be the tidier
 * mechanism and cannot be used: the script's own writes are attribute changes, so it would observe
 * itself. A scheduled re-check is therefore correct-by-timing, and timing drifts with a React
 * version, a font, or page weight. That is the whole argument for spending a browser test here.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { FORMULA_OVERFLOW_SOURCE } from "../../src/components/edition/formulaOverflow.inline.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");

/** Pages measured to carry formulas that overflow at 320px and to hydrate. */
const ROUTES = ["/lab/sr-03/", "/lab/lq-06/"] as const;
const WIDTH = 320;

/**
 * The implementation's last scheduled re-check, read out of the shipped source rather than copied.
 *
 * If someone changes the schedule, this gate's settle moves with it. Copying the number would let
 * the two drift apart silently, which is the same class of defect as a citation that outlives the
 * line it names.
 */
function lastRecheckMs(source: string): number {
  const delays = [...source.matchAll(/setTimeout\([^,]+,\s*(\d+)\s*\)/g)].map((m) =>
    Number.parseInt(m[1] ?? "0", 10),
  );
  assert.ok(
    delays.length > 0,
    "no scheduled re-check found in FORMULA_OVERFLOW_SOURCE; if the fix stopped being timer-based, this gate needs rewriting rather than deleting",
  );
  return Math.max(...delays);
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serve(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    try {
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      /* fall through to 404 */
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
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      done({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/** Overflowing formulas on the page, and how many of them a keyboard can reach and hear. */
const COUNT_IN_PAGE = `(() => {
  const all = [...document.querySelectorAll(".formula")];
  const over = all.filter((e) => e.scrollWidth > e.clientWidth);
  return {
    formulas: all.length,
    overflowing: over.length,
    reachable: over.filter((e) => e.getAttribute("tabindex") === "0").length,
    named: over.filter((e) => (e.getAttribute("aria-label") || "").trim().length > 0).length,
  };
})()`;

test("an overflowing formula keeps its tab stop and name after hydration", async () => {
  assertOutFreshness();
  const settleMs = lastRecheckMs(FORMULA_OVERFLOW_SOURCE) + 800;

  const { server, origin } = await serve(OUT_DIR);
  const browser = await chromium.launch();
  const failures: string[] = [];
  let overflowingSeen = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    for (const route of ROUTES) {
      const page = await context.newPage();
      await page.goto(`${origin}${route}`, { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.waitForTimeout(settleMs);
      const seen = (await page.evaluate(COUNT_IN_PAGE)) as {
        formulas: number;
        overflowing: number;
        reachable: number;
        named: number;
      };
      overflowingSeen += seen.overflowing;
      console.log(
        `[formula-focus] ${route}@${WIDTH} settle ${settleMs}ms: ${seen.formulas} formulas, ${seen.overflowing} overflowing, ${seen.reachable} reachable, ${seen.named} named`,
      );
      if (seen.overflowing > seen.reachable) {
        failures.push(
          `${route}: ${seen.overflowing - seen.reachable} of ${seen.overflowing} overflowing formula(s) have no tabindex after ${settleMs}ms. A region that scrolls and cannot be focused is unreachable content.`,
        );
      }
      if (seen.overflowing > seen.named) {
        failures.push(
          `${route}: ${seen.overflowing - seen.named} of ${seen.overflowing} overflowing formula(s) have no accessible name, so a screen reader announces a focusable nothing.`,
        );
      }
      await page.close();
    }
    // The denominator, asserted rather than assumed. If layout changes so that nothing overflows
    // at 320px, every count above is 0/0 and this gate would report a clean run over an empty
    // population - which is indistinguishable from a passing one.
    assert.ok(
      overflowingSeen > 0,
      `no formula overflowed at ${WIDTH}px on ${ROUTES.join(" or ")}, so this gate measured nothing. Re-pick the routes rather than letting it pass empty.`,
    );
    assert.deepEqual(failures, [], failures.join("\n"));
  } finally {
    await browser.close();
    server.close();
  }
});

test("PLANTED NEGATIVE: stripping the attribute after the last re-check turns this gate red", async () => {
  assertOutFreshness();
  const lastRecheck = lastRecheckMs(FORMULA_OVERFLOW_SOURCE);
  const settleMs = lastRecheck + 800;

  const { server, origin } = await serve(OUT_DIR);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const route = ROUTES[0] as string;
    await page.goto(`${origin}${route}`, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Strip AFTER the implementation has finished re-checking, so nothing legitimately repairs it.
    // This is the plant's whole point: it proves the assertion above samples late. A gate that
    // sampled before hydration would still see the marked state here, stay GREEN, and reveal
    // itself as unable to see the defect it exists for.
    await page.waitForTimeout(lastRecheck + 200);
    const strippedCount = await page.evaluate(`(() => {
      const over = [...document.querySelectorAll(".formula")].filter((e) => e.scrollWidth > e.clientWidth);
      for (const el of over) { el.removeAttribute("tabindex"); el.removeAttribute("aria-label"); }
      return over.length;
    })()`);
    assert.ok(
      (strippedCount as number) > 0,
      "the plant removed nothing, so it proves nothing: no formula overflowed on this route",
    );

    await page.waitForTimeout(settleMs - (lastRecheck + 200));
    const seen = (await page.evaluate(COUNT_IN_PAGE)) as { overflowing: number; reachable: number };
    console.log(
      `[formula-focus] PLANT ${route}: stripped ${String(strippedCount)}, then ${seen.reachable} of ${seen.overflowing} reachable at the same settle the gate uses`,
    );
    assert.equal(
      seen.reachable,
      0,
      "the plant stripped every overflowing formula after the last scheduled re-check, so the gate's own check must see zero reachable here. Seeing more means either something re-added the attribute after its schedule, or this gate samples earlier than it claims.",
    );
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
});
