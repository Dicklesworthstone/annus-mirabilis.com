/**
 * DRIVES A REAL BROWSER FOR THE THREE BUDGET ROWS THAT HAVE NEVER HAD ONE (am-snn0).
 *
 * `visible-text-math`, `interaction-latency-p75` and `layout-shift` each had a pure, tested
 * evaluator implementing its catalogued method and a SYNTHETIC input, so each reported
 * `not-available` on every run since the harness was written. This script renders the built pages,
 * drives real interactions, collects the browser's own Event Timing and layout-shift entries, and
 * writes what it observed to `artifacts/budgets/browser-<tool-run-id>.json`, which
 * `scripts/run-perf-budgets.ts` then reports.
 *
 * IT MEASURES `out/`, NOT A FIXTURE, and serves it over HTTP with the same `createServer` the other
 * browser lanes use, because `serve -s` answers every unknown path with the home page at 200 -- it
 * did so for all 36 embed routes on 2026-10-09 and the lane read it as success.
 *
 * THE EVALUATORS DECIDE, NOT THIS FILE. The percentile, the 20-sample refusal, the session windows
 * and the budget comparisons all live in the three modules under `scripts/perf/`. This script's job
 * is to produce honest INPUT for them, and the distinction matters: an earlier probe of mine
 * computed p75 as `durations[floor(0.75 * n)]`, which is not the catalogued "p75 by nearest rank:
 * with 20 sorted samples the 15th value", and summed every layout shift into one total rather than
 * grouping into session windows. Both would have reported a number against a method it did not
 * follow.
 *
 * ONE ENTRY PER EVENT TYPE IS NOT ONE ENTRY PER INTERACTION. The Event Timing API emits an entry for
 * pointerdown, pointerup and click separately, all sharing one `interactionId`. Measured 2026-10-10,
 * 1,340 entries over these routes were 78 interactions, a ratio of 17 to 1, and reading entries as
 * interactions took p75 from 24 ms to 136 ms. `evaluateInteractionLatency` groups by id and takes
 * each interaction's longest entry; this script passes the raw entries and lets it.
 *
 * A ROW IS OMITTED RATHER THAN GUESSED. If fewer than 20 interactions are driven, the evaluator
 * refuses and no latency row is written, so the harness reports that row `not-available` while still
 * giving the other two a real verdict.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  BROWSER_BUDGET_DIR,
  BROWSER_BUDGET_PREFIX,
  BROWSER_BUDGET_SCHEMA_VERSION,
  readBuildId,
} from "./browserBudgetArtifact.ts";
import { evaluateInteractionLatency } from "./interactionLatency.ts";
import { evaluateLayoutShift } from "./layoutShift.ts";
import { checkVisibleTextAndMath } from "./visibleTextMath.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "out");

/**
 * The routes the three rows are driven over: the home page, a long paper page, the heaviest section
 * page, a foundation lesson and a laboratory. Chosen to span what the budgets are about rather than
 * to be a sample of the 744 built pages -- the paper and section pages carry the mathematics the
 * visible-text row is about, and the laboratory carries the controls the latency row needs.
 */
const ROUTES = [
  "/",
  "/papers/special-relativity/",
  "/papers/brownian-motion/s4/",
  "/foundations/logarithms/",
  "/lab/bm-01/",
];

const VIEWPORT = { width: 1280, height: 900 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

/** Serves `out/` exactly as exported: a missing file is 404, never the home page. */
function serveOut() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let path = join(OUT, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) path = join(path, "index.html");
    else if (extname(path) === "" && existsSync(`${path}.html`)) path = `${path}.html`;
    else if (extname(path) === "" && existsSync(join(path, "index.html")))
      path = join(path, "index.html");
    if (!path.startsWith(OUT) || !existsSync(path)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(readFileSync(path));
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done({ server, port: server.address().port }));
  });
}

/** `visible-text-math`: the served HTML of each route, judged by the catalogued evaluator. */
async function measureVisibleTextMath(base, browser) {
  const violations = [];
  let mathMlCount = 0;
  let katexCount = 0;
  let offOriginFonts = 0;
  // The method names "JavaScript disabled and a cold font cache", so each route gets its own
  // context with scripting off: what a reader sees before any hydration, which is the claim.
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: VIEWPORT, javaScriptEnabled: false });
    const page = await context.newPage();
    const fonts = [];
    page.on("response", (response) => {
      const u = new URL(response.url());
      if (/\.(woff2?|ttf|otf)$/.test(u.pathname)) fonts.push(u);
    });
    await page.goto(base + route, { waitUntil: "load" });
    const html = await page.content();
    const result = checkVisibleTextAndMath(html);
    mathMlCount += result.mathMlCount;
    katexCount += result.katexCount;
    for (const v of result.violations) violations.push(`${route}: ${v}`);
    const external = fonts.filter((u) => u.host !== new URL(base).host);
    offOriginFonts += external.length;
    for (const u of external) violations.push(`${route}: font fetched off-origin: ${u.href}`);
    await context.close();
  }
  return {
    ok: violations.length === 0,
    routes: ROUTES.length,
    mathMlCount,
    katexCount,
    offOriginFonts,
    violations,
  };
}

/** `layout-shift`: the browser's own entries, grouped into session windows by the evaluator. */
async function measureLayoutShift(base, browser) {
  let worst = { route: "", score: 0, result: null };
  const all = [];
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__shifts.push({
            startTime: e.startTime,
            value: e.value,
            hadRecentInput: e.hadRecentInput,
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(base + route, { waitUntil: "load" });
    // The method names "load, font swap, and deferred math activation", so the window has to be
    // long enough for the deferred work to land, and a scroll is what makes a lazy island arrive.
    await page.waitForTimeout(4000);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" }),
    );
    await page.waitForTimeout(2500);
    const entries = await page.evaluate(() => window.__shifts);
    const result = evaluateLayoutShift(entries);
    all.push({ route, entries: entries.length, score: result.maxSessionWindowScore });
    if (result.maxSessionWindowScore >= worst.score) {
      worst = { route, score: result.maxSessionWindowScore, result };
    }
    await context.close();
  }
  console.log(`[browser-budgets] layout-shift per route: ${JSON.stringify(all)}`);
  const r = worst.result;
  return {
    maxSessionWindowScore: r.maxSessionWindowScore,
    sessionWindowsCount: r.sessionWindowsCount,
    worstRoute: worst.route,
    budgetScore: r.budgetScore,
    overBudget: r.overBudget,
  };
}

/** `interaction-latency-p75`: real clicks on real controls, with the entries the browser recorded. */
async function measureInteractionLatency(base, browser) {
  const entries = [];
  let driven = 0;
  let refused = 0;
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__events = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__events.push({
            name: e.name,
            entryType: e.entryType,
            startTime: e.startTime,
            duration: e.duration,
            interactionId: e.interactionId ?? 0,
          });
        }
        // durationThreshold 16 because Event Timing rounds durations to 8 ms; the catalogue says
        // so explicitly ("do not set a finer threshold").
      }).observe({ type: "event", durationThreshold: 16, buffered: true });
    });
    await page.goto(base + route, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const controls = await page
      .locator(
        'button:not([disabled]):visible, summary:visible, input[type="radio"]:not([disabled]):visible',
      )
      .elementHandles();
    for (const handle of controls.slice(0, 30)) {
      try {
        await handle.scrollIntoViewIfNeeded({ timeout: 1200 });
        await handle.click({ timeout: 1800, noWaitAfter: true });
        driven += 1;
        await page.waitForTimeout(120);
      } catch {
        refused += 1;
      }
    }
    await page.waitForTimeout(1500);
    entries.push(...(await page.evaluate(() => window.__events)));
    await context.close();
  }
  console.log(
    `[browser-budgets] interaction latency: ${driven} controls driven, ${refused} not clickable, ${entries.length} raw event entries`,
  );
  try {
    const result = evaluateInteractionLatency(entries);
    return {
      p75LatencyMs: result.p75LatencyMs,
      interactionCount: result.interactionCount,
      rawEntryCount: entries.length,
      budgetMs: result.budgetMs,
      overBudget: result.overBudget,
    };
  } catch (error) {
    // The evaluator refuses fewer than 20 interactions. That is not a budget failure and it is not
    // a measurement either: no row is written and the harness reports `not-available`.
    console.log(
      `[browser-budgets] interaction latency NOT MEASURED: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function toolRunId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  return `${stamp}-${createHash("sha256").update(String(Math.random())).digest("hex").slice(0, 8)}`;
}

async function main() {
  const buildId = readBuildId(OUT);
  if (buildId === null) {
    console.error(
      "[browser-budgets] no build id under out/_next/static. Run `bun run build` first. Nothing was measured.",
    );
    process.exitCode = 2;
    return;
  }
  const only = new Set(
    process.argv
      .filter((a) => a.startsWith("--only="))
      .flatMap((a) => a.slice("--only=".length).split(",")),
  );
  const wanted = (row) => only.size === 0 || only.has(row);

  const { server, port } = await serveOut();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const artifact = {
    schemaVersion: BROWSER_BUDGET_SCHEMA_VERSION,
    toolRunId: toolRunId(),
    timestamp: new Date().toISOString(),
    buildId,
    browser: `chromium ${browser.version()}`,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    routes: ROUTES,
  };
  try {
    if (wanted("visible-text-math")) {
      artifact.visibleTextMath = await measureVisibleTextMath(base, browser);
    }
    if (wanted("layout-shift")) artifact.layoutShift = await measureLayoutShift(base, browser);
    if (wanted("interaction-latency-p75")) {
      const row = await measureInteractionLatency(base, browser);
      if (row !== null) artifact.interactionLatency = row;
    }
  } finally {
    await browser.close();
    server.close();
  }

  const dir = join(ROOT, BROWSER_BUDGET_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${BROWSER_BUDGET_PREFIX}${artifact.toolRunId}.json`);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const rows = ["visibleTextMath", "layoutShift", "interactionLatency"].filter(
    (k) => artifact[k] !== undefined,
  );
  const over = [
    artifact.visibleTextMath?.ok === false ? "visible-text-math" : null,
    artifact.layoutShift?.overBudget ? "layout-shift" : null,
    artifact.interactionLatency?.overBudget ? "interaction-latency-p75" : null,
  ].filter((x) => x !== null);
  console.log(
    `[census] browser-budgets drove ${ROUTES.length} built routes for ${rows.length} of 3 rows (minimum 1): ${rows.join(", ")}`,
  );
  console.log(
    `[browser-budgets] build ${buildId}; ${artifact.visibleTextMath ? `visible-text-math ok=${artifact.visibleTextMath.ok}` : "visible-text-math not measured"}; ${
      artifact.layoutShift
        ? `layout-shift ${artifact.layoutShift.maxSessionWindowScore} (${artifact.layoutShift.worstRoute})`
        : "layout-shift not measured"
    }; ${
      artifact.interactionLatency
        ? `p75 ${artifact.interactionLatency.p75LatencyMs} ms over ${artifact.interactionLatency.interactionCount} interactions`
        : "interaction-latency not measured"
    }`,
  );
  console.log(`[browser-budgets] wrote ${path}`);
  if (rows.length === 0) {
    console.error("[browser-budgets] no row was measured, so this run is not evidence.");
    process.exitCode = 1;
    return;
  }
  if (over.length > 0) {
    console.error(`[browser-budgets] OVER BUDGET: ${over.join(", ")}`);
    process.exitCode = 1;
  }
}

await main();
