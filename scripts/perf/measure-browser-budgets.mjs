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
import { reportPopulation } from "../gate-census/population.ts";
import {
  BROWSER_BUDGET_DIR,
  BROWSER_BUDGET_PREFIX,
  BROWSER_BUDGET_SCHEMA_VERSION,
  readBuildId,
} from "./browserBudgetArtifact.ts";
import { evaluateInstrumentFeedback } from "./instrumentFeedback.ts";
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

/**
 * THE LABORATORIES THE `instrument-feedback` ROW IS DRIVEN OVER, one per paper plus the one lab
 * whose results FrankenSim computes.
 *
 * Deliberately NOT `ROUTES` above. Those five span what the other three rows are about -- the
 * mathematics the visible-text row judges, the controls the latency row clicks -- and adding four
 * laboratories to them would change three settled populations as a side effect of measuring a
 * fourth. This row needs pages that accept a snapshot when a parameter changes, which is a
 * different question, so it gets its own list and its own count in the artifact.
 */
const INSTRUMENT_ROUTES = [
  "/lab/bm-01/",
  "/lab/bm-05/",
  "/lab/lq-03/",
  "/lab/sr-01/",
  "/lab/me-01/",
];

/*
 * THE NAVIGATION BUDGET IS PLUMBING, NOT A MEASUREMENT, and it was Playwright's default 30 s.
 *
 * `waitUntil: "load"` waits for every subresource -- fonts, chunks, images -- and on a loaded
 * machine the home page exceeds 30 s from a cold cache. Measured 2026-10-11 against a build of
 * 9f1aed5ea: `page.goto: Timeout 30000ms exceeded ... navigating to "http://127.0.0.1:60737/"`, so
 * the whole run threw and `perf-budgets` reported 6 of its 8 rows `not-available` for want of a
 * browser artifact. That gate is requiredInCi, so the default was making a required gate flaky for
 * a reason that has nothing to do with any budget.
 *
 * RAISING IT CANNOT LOOSEN A BUDGET, which is the only thing worth checking before touching a
 * number in a perf script. None of the three navigations below times the navigation: the first
 * reads `page.content()` for visible text, math and off-origin fonts; the second reads
 * layout-shift from a buffered PerformanceObserver after its own explicit 4000 ms and 2500 ms
 * waits; the third reads Event Timing entries after an explicit 3000 ms wait. Every budget is a
 * byte count, a shift score or a latency measured after the page has settled, and none of them is
 * "did it load inside the timeout".
 */
const NAV_TIMEOUT_MS = 90_000;

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
    await page.goto(base + route, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
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
    await page.goto(base + route, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
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
    await page.goto(base + route, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
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

/**
 * `instrument-feedback`: a real parameter change on a real laboratory, timed from the input to the
 * frame that displayed the accepted snapshot.
 *
 * THE ACTION IS DRIVEN THROUGH THE DOM CONTRACT, NOT THROUGH BUTTON COPY. `data-snapshot-version`
 * and `data-accepted-action-index` are the identity attributes every instrument root publishes
 * (src/experiments/store/identityAttributes.ts), validated at the browser boundary by
 * scripts/e2e/domContract.ts. So this nudges the laboratory's own numeric controls, submits, and
 * waits for THAT attribute to advance. A locator keyed on "Apply trial settings" would have to be
 * re-swept every time a caption is edited, which this repository has paid for before; an attribute
 * the DOM contract owns cannot drift without a gate noticing.
 *
 * THE SNAPSHOT VERSION ADVANCING IS ALSO THE NON-VACUITY CHECK, and it is independent of the thing
 * being measured. The marks come from the scheduler and the paint hook; the attribute comes from
 * the store through the rendered DOM. If the attribute never advances, no action happened, and this
 * returns null rather than a row -- which is what keeps a laboratory that silently refuses from
 * reading as "feedback within budget".
 */
async function measureInstrumentFeedback(base, browser) {
  let actionsMeasured = 0;
  let instrumentsOperated = 0;
  let supersededExcluded = 0;
  let maxFeedbackMs = 0;
  let worstRoute = "";
  let budgetMs = 0;
  let overBudget = false;
  const perRoute = [];

  for (const route of INSTRUMENT_ROUTES) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    let accepted = 0;
    try {
      await page.goto(base + route, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
      const root = page.locator("[data-accepted-action-index]").first();
      await root.waitFor({ state: "attached", timeout: 20_000 });

      // Three actions per laboratory: enough for a maximum to mean something, few enough that a
      // slow page does not dominate the run. Each is a separate parameter change, because the
      // budget is about the feedback of an action, not about a steady state.
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = Number((await root.getAttribute("data-snapshot-version")) ?? "0");
        const fields = await root.locator('input[type="number"], input[type="range"]').all();
        let nudged = false;
        for (const field of fields.slice(0, 2)) {
          try {
            const next = await field.evaluate((el) => {
              const step = Number(el.step) || 1;
              const value = Number(el.value);
              const max = el.max === "" ? Number.POSITIVE_INFINITY : Number(el.max);
              const min = el.min === "" ? Number.NEGATIVE_INFINITY : Number(el.min);
              const up = value + step;
              return String(up <= max ? up : Math.max(min, value - step));
            });
            // `fill` goes through the native setter, which is what a controlled React input reads;
            // assigning `.value` in the page would change the DOM and not the component.
            await field.fill(next, { timeout: 2000 });
            nudged = true;
          } catch {
            /* a disabled or detached control is not an action */
          }
        }
        if (!nudged) break;
        const submits = await root.locator('button[type="submit"], button:not([disabled])').all();
        for (const submit of submits.slice(0, 4)) {
          try {
            await submit.click({ timeout: 1500, noWaitAfter: true });
          } catch {
            /* ignore a control that will not take a click */
          }
          try {
            await page.waitForFunction(
              ([selector, previous]) => {
                const node = document.querySelector(selector);
                return (
                  node !== null &&
                  Number(node.getAttribute("data-snapshot-version") ?? "0") > previous
                );
              },
              ["[data-accepted-action-index]", before],
              { timeout: 4000 },
            );
            accepted += 1;
            break;
          } catch {
            /* that control did not produce a snapshot; try the next */
          }
        }
      }

      // One more frame pair, so the last action's paint mark is on the timeline before it is read.
      await page.waitForTimeout(250);
      const marks = await page.evaluate(() =>
        performance
          .getEntriesByType("mark")
          .filter(
            (e) => e.name === "am:input" || e.name === "am:accepted" || e.name === "am:painted",
          )
          .map((e) => ({ name: e.name, startTime: e.startTime, detail: e.detail })),
      );
      const usable = marks.filter((m) => m.detail && typeof m.detail.instanceId === "string");
      const result = evaluateInstrumentFeedback(usable);
      budgetMs = result.budgetMs;
      supersededExcluded += result.supersededExclusions.length;
      if (result.actions.length > 0) {
        instrumentsOperated += 1;
        actionsMeasured += result.actions.length;
        if (result.overBudget) overBudget = true;
        if (result.maxFeedbackMs > maxFeedbackMs) {
          maxFeedbackMs = result.maxFeedbackMs;
          worstRoute = route;
        }
      }
      perRoute.push({
        route,
        snapshotsAccepted: accepted,
        marks: usable.length,
        actions: result.actions.length,
        maxMs: result.maxFeedbackMs,
      });
    } catch (error) {
      perRoute.push({
        route,
        snapshotsAccepted: accepted,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  }

  console.log(`[browser-budgets] instrument feedback per route: ${JSON.stringify(perRoute)}`);
  if (actionsMeasured === 0) {
    // No row rather than a zero. `evaluateInstrumentFeedback` returns maxFeedbackMs 0 and
    // overBudget false over an empty action set, which would publish a budget met over nothing.
    console.log(
      "[browser-budgets] instrument feedback NOT MEASURED: no laboratory produced an input/accepted/painted triple",
    );
    return null;
  }
  return {
    maxFeedbackMs,
    actionsMeasured,
    instrumentsOperated,
    supersededExcluded,
    budgetMs,
    overBudget,
    worstRoute,
  };
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
    if (wanted("instrument-feedback")) {
      const row = await measureInstrumentFeedback(base, browser);
      if (row !== null) artifact.instrumentFeedback = row;
    }
  } finally {
    await browser.close();
    server.close();
  }

  const dir = join(ROOT, BROWSER_BUDGET_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${BROWSER_BUDGET_PREFIX}${artifact.toolRunId}.json`);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const rows = [
    "visibleTextMath",
    "layoutShift",
    "interactionLatency",
    "instrumentFeedback",
  ].filter((k) => artifact[k] !== undefined);
  const over = [
    artifact.visibleTextMath?.ok === false ? "visible-text-math" : null,
    artifact.layoutShift?.overBudget ? "layout-shift" : null,
    artifact.interactionLatency?.overBudget ? "interaction-latency-p75" : null,
    artifact.instrumentFeedback?.overBudget ? "instrument-feedback" : null,
  ].filter((x) => x !== null);
  /*
   * TWO CENSUS LINES IN THE GRAMMAR THE META-GATE PARSES (am-rc1001-bridge-plan-pcjk.9).
   *
   * This printed `[census] browser-budgets drove 5 built routes for 3 of 3 rows (minimum 1): ...`,
   * which LOOKS like a census line and is not one. `parsePopulationLines` returns it as MALFORMED --
   * "does not match [census] <gate> examined ..." -- for two reasons at once: the verb is `drove`
   * rather than `examined`, and the gate name is `browser-budgets` where the registry step is
   * `perf-browser-budgets`. A gate that appears to report its population and whose report nothing
   * can read is the defect that census exists for, wearing the census's own clothes.
   *
   * BOTH NUMBERS ARE KEPT, as two lines, because each catches an absence the other cannot and the
   * gate's consumer already prints two of its own:
   *   - the ROUTES are the surface. Driving one route instead of five still measures all three
   *     rows, so a lost route is invisible in the row count.
   *   - the ROWS are the budget set. Measuring five routes and producing one row is invisible in
   *     the route count.
   * `reportPopulation` writes both, so the wording is the uniform one and not this file's.
   */
  const vacuousRoutes = reportPopulation({
    gate: "perf-browser-budgets",
    examined: ROUTES.length + INSTRUMENT_ROUTES.length,
    noun: "built routes driven",
    minimum: ROUTES.length + INSTRUMENT_ROUTES.length,
  });
  const vacuousRows = reportPopulation({
    gate: "perf-browser-budgets",
    examined: rows.length,
    /*
     * FOUR ROWS ARE ATTEMPTED AND THE FLOOR IS THREE, which is a statement about which omissions
     * are honest rather than a rounding of the full set.
     *
     * The first two cannot legitimately be absent: `visible-text-math` reads served HTML and
     * `layout-shift` reads the browser's own entries, and both are produced by any run that
     * navigated. The other two can. `interaction-latency-p75` is omitted when fewer than 20
     * interactions were driven, because its catalogued method refuses a smaller sample, and
     * `instrument-feedback` is omitted when no laboratory accepted a snapshot. So a floor of 3
     * permits at most ONE such omission and still refuses a run that measured less than that.
     *
     * The line this replaced declared 3 as "the full set ... there is no condition under which a
     * smaller number is the correct answer", which was already untrue of the latency row when it
     * was written: that row's own driver returns null by design and says so in its comment.
     */
    noun: "browser-driven budget rows",
    minimum: 3,
  });
  console.log(`[browser-budgets] rows measured: ${rows.join(", ")}`);
  console.log(
    `[browser-budgets] build ${buildId}; ${artifact.visibleTextMath ? `visible-text-math ok=${artifact.visibleTextMath.ok}` : "visible-text-math not measured"}; ${
      artifact.layoutShift
        ? `layout-shift ${artifact.layoutShift.maxSessionWindowScore} (${artifact.layoutShift.worstRoute})`
        : "layout-shift not measured"
    }; ${
      artifact.interactionLatency
        ? `p75 ${artifact.interactionLatency.p75LatencyMs} ms over ${artifact.interactionLatency.interactionCount} interactions`
        : "interaction-latency not measured"
    }; ${
      artifact.instrumentFeedback
        ? `instrument-feedback ${artifact.instrumentFeedback.maxFeedbackMs} ms over ${artifact.instrumentFeedback.actionsMeasured} actions on ${artifact.instrumentFeedback.instrumentsOperated} laboratories`
        : "instrument-feedback not measured"
    }`,
  );
  console.log(`[browser-budgets] wrote ${path}`);
  // The gate already refused a run with NO row. The two censuses above widen that to a run with
  // FEWER rows or routes than it declares, which is the same proposition at a finer grain: one row
  // of three is not evidence either, and it used to pass because the floor was declared as 1.
  if (vacuousRoutes || vacuousRows) {
    console.error(
      "[browser-budgets] the run examined fewer routes or rows than this gate declares, so it is not evidence.",
    );
    process.exitCode = 1;
    return;
  }
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
