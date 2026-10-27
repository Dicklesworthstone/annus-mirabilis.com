/**
 * EVERY REGION RECORDED AS "MEASURED, DOES NOT OVERFLOW" IS RE-MEASURED IN A BROWSER (am-14at).
 *
 * `RECORDED_NON_OVERFLOWING` is the escape hatch of the scrollable-regions ratchet: a region that
 * has been MEASURED not to overflow may drop the `tabIndex={0}` that WCAG 2.1.1 otherwise demands,
 * because a tab stop on a box with nothing to scroll is a stop that wastes a keyboard reader's
 * time. Sixteen regions have taken it. Each is a hand measurement, taken once, against a build
 * that no longer exists, and written into a source file as a string.
 *
 * Nothing re-measured them. The ratchet's own staleness checks read the SOURCE -- the element is
 * still in the TSX, the numbers still parse, no record claims a region whose own figures show an
 * overflow -- and every one of those passes while the page is broken, because none of them loads
 * the page. Add a column to a recorded table tomorrow and the record still reads
 * "320px: 220px/220px (diff 0)" for ever. This file closes that, and it is the fourth acceptance
 * criterion of am-14at in its own words: "a browser check measures the listed regions at 320px and
 * 1280px and fails when one regresses to overflowing, so the result does not depend on anyone
 * re-running a script by hand".
 *
 * THE DISCOVERY THAT MADE IT WORTH WRITING, and it is a census blind spot rather than a layout
 * defect. Seven of the sixteen records name a laboratory's telemetry table, and with JavaScript
 * running NOT ONE OF THEM IS LAID OUT. Measured on /lab/lq-08/ at 320px:
 *
 *   js=true   .table-scroll "Values at these settings"   0/0    laid=false   gate=awaiting
 *   js=false  .table-scroll "Values at these settings"   254/254 laid=true   gate=awaiting
 *
 * The cause is predict mode (`PredictGate.tsx`): every element spread with `gate.response` carries
 * `data-predict-response="awaiting"` and is hidden until the reader predicts, says they have one in
 * mind, or skips. The server renders `awaiting` for every laboratory, so a browser that merely
 * LOADS a lab page sees none of its results. Without JavaScript the panel is what goes and the
 * result stays, deliberately, so the no-script reader is the one state in which these regions are
 * laid out without an interaction.
 *
 * The consequence is bigger than this file: any census that loads a lab page with scripts on and
 * does not interact has a population that EXCLUDES every laboratory results region. That includes
 * `unreachableScrollRegions.e2e.test.ts`, whose "1128 scrollable containers across 764 routes, 0
 * unreachable" is a true statement about a population these tables are not in. It is recorded on
 * am-unaudited-scroll-regions-r4jx rather than silently worked around here.
 *
 * SO BOTH STATES ARE MEASURED, ALWAYS, and the readings are unioned. An earlier draft took the
 * first state that laid the element out and stopped, which is cheaper and silently wrong: on
 * /papers/brownian-motion/ the class `formula` matches fourteen elements with scripts on, so that
 * record would have been reported "decided" while the two elements it is actually about -- which
 * the record says "render ONLY with JavaScript disabled" -- were never measured at all. A check
 * that stops at the first answer it can get is a check that chooses its own population.
 *
 * WHAT IT ASSERTS, and why it is a claim about the PAGE rather than about the file.
 *
 * A record is keyed by file plus class (plus accessible name where one file holds two). In a
 * browser there is no file: the built HTML carries the class and the name, and nothing says which
 * component emitted it. Rather than guess, the assertion is deliberately broader than the record:
 * ON THE ROUTE A RECORD NAMES, no element of that record's class may overflow unless it carries a
 * tab stop. Broader and true beats narrow and unverifiable, and the breadth is reported (the census
 * prints the match count per record, so `formula: 14 matched` is visible rather than implied).
 *
 * The `tabindex` exemption is not a loophole, it is the boundary with the other gate. What a record
 * licenses is DROPPING the tab stop; an element that overflows and still has one is correct markup
 * and is `unreachableScrollRegions.e2e.test.ts`'s subject, not this file's. Those are reported too,
 * with their numbers, so an overflowing tab-stopped sibling appears in the output instead of being
 * silently filtered -- that is how the sr-03 spacetime table showed up at 366/217.
 *
 * THE UNDECIDED SET IS DECLARED AND TWO-SIDED, which is this repository's ratchet shape. A record
 * whose element never lays out in either state at either width is a FAILURE unless it is in
 * `UNDECIDABLE_IN_A_BROWSER` with a measured reason, and a record in that map which DID lay out is
 * also a failure, so the list can only shrink. A silent skip would make this file green on the day
 * every record went stale at once.
 *
 * MEASURED ON THE BUILD OF 2026-10-27: 16 records, 13 decided, 3 declared undecidable, and the
 * three are worth reading because the ratchet's source-side checks cannot see any of them -- all
 * three elements ARE in their TSX, and none reaches a reader:
 *
 *   - `genealogy-graph-wrapper`: 0 of the built HTML pages and 0 of the shipped JS chunks.
 *     `Genealogy.tsx` is imported only by `Genealogy.render.test.tsx`.
 *   - `facsimile-canvas-container`: 0 and 0 likewise. The route the record names serves
 *     `FacsimilePanel.tsx` (class `facsimile-reader-plate`, 32 pages), and the record's
 *     `FacsimileViewer` is reached only through `FacsimileFace`, which is imported only by its own
 *     render test. Two facsimile implementations, one of them served.
 *   - `TrajectoryInspection`'s table: `/lab/brownian-data/` carries 0 `<table>` elements, because
 *     `MeasuredTrajectoryLab` renders it with `key={accepted.run}` and there is no accepted run
 *     until the reader pastes trajectory data into the lab's textarea.
 */

import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import {
  type NonOverflowingRecord,
  RECORDED_NON_OVERFLOWING,
} from "../../src/testing/a11y/recordedRegions.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const WIDTHS = [320, 1280] as const;

/** The two states a recorded region can be laid out in, named as a reader would experience them. */
type ScriptState = "script" | "no-script";
const STATES: readonly ScriptState[] = ["script", "no-script"];

/**
 * Records no browser can decide, with what was measured instead. Two-sided: a key here that DOES
 * lay out fails the test, so paying one of these down is forced rather than optional.
 */
const UNDECIDABLE_IN_A_BROWSER: ReadonlyMap<string, string> = new Map([
  [
    "src/equations/genealogy/Genealogy.tsx::genealogy-graph-wrapper",
    "Mounted by no route: `genealogy-graph-wrapper` appears in 0 built HTML pages and 0 shipped JS chunks, and Genealogy.tsx is imported only by Genealogy.render.test.tsx. The record's own url says so in words ('Genealogy component'), which is honest and is also why there is nothing to load.",
  ],
  [
    "src/reader/faces/FacsimileViewer.tsx::facsimile-canvas-container",
    "The url this record names serves FacsimilePanel.tsx (class facsimile-reader-plate, 32 pages), not FacsimileViewer. The recorded class appears in 0 built HTML pages and 0 shipped JS chunks; FacsimileViewer is reached only through FacsimileFace, which is imported only by FacsimileFace.render.test.tsx.",
  ],
  [
    "src/components/lab/TrajectoryInspection.tsx::table-scroll",
    "/lab/brownian-data/ carries 0 table elements and one scrolling box (a textarea at 218/218). MeasuredTrajectoryLab renders TrajectoryInspection with key={accepted.run}, and there is no accepted run until the reader pastes trajectory data, so the table exists only after data entry this file does not perform.",
  ],
]);

/**
 * The one record that needs an interaction, and gets it rather than an excuse.
 *
 * Its own reason field already says the element is "reached only through the 'Table and typed
 * values' tab", so the preparation is that sentence executed. It runs only with scripts on, since
 * without them the control cannot work -- which is the honest asymmetry rather than a gap.
 */
/**
 * THE SAME REGIONS, MEASURED WITHOUT SCRIPTS, where four of them do NOT fit.
 *
 * CORRECTED 2026-10-27, after the prompt-skipping above made the script state visible for the first
 * time. This docblock said "the markup does not vary: an element that fits hydrated and overflows
 * un-hydrated carries no tab stop in EITHER state". Both halves were wrong, and the run that
 * disproved them is this file's own:
 *
 *   sr-12 `.table-scroll`  354px/252px  (script)     tabindex=0  "Charge and current density ..."
 *   sr-12 `.table-scroll`  354px/252px  (no-script)  no tabindex
 *
 * IDENTICAL GEOMETRY, DIFFERENT TAB STOP. So these regions do not "fit hydrated" at all -- they
 * overflow in both states -- and what varies is not the markup but whether a script has run.
 * `initFormulaOverflow` in `src/components/edition/formulaOverflow.inline.ts` walks
 * `querySelectorAll("*")`, by its own comment "every region that can scroll, not only formulas",
 * and gives each overflowing scroll region a `tabindex="0"` and a derived name at runtime.
 *
 * That is one mechanism for all four entries rather than a special case for `formula`, and it has a
 * consequence larger than this list: `unreachableScrollRegions.e2e.test.ts` reports 0 unreachable
 * regions across 764 routes BECAUSE that script repairs them all, so its result is a statement
 * about the scripted reader. Nothing adds a tab stop for the reader without JavaScript, and
 * AGENTS.md's sixth product outcome is that the reading experience works without it. Measured on
 * am-14at rather than silently carried here.
 *
 * Measured on the build of 2026-10-27 at 320px, with every prompt skipped and every disclosure
 * open.
 *
 * This list is a debt, not a budget (AGENTS.md). Repairing one means striking its line out.
 */
/**
 * RECORDS WHOSE OWN NUMBER NO LONGER HOLDS, each attributed to exactly one element.
 *
 * These are not no-script quirks and not ambiguous attributions: on each of these three routes the
 * recorded class matches ONE element, it overflows at 320px in BOTH script states, and the record
 * says it fits. So the licence each record grants -- drop the tab stop, this box scrolls nothing --
 * rests on a measurement that is no longer true.
 *
 * WHY NOBODY NOTICED, and it is the reason this arm exists. `initFormulaOverflow` walks
 * `querySelectorAll("*")` and gives every overflowing scroll region a `tabindex="0"` and a derived
 * name at runtime. A recorded region that comes to overflow therefore ACQUIRES a tab stop, the
 * scrollable-regions ratchet counts it as reachable, `unreachableScrollRegions` reports 0
 * unreachable, and this file's own first draft exempted it for having one. Four green signals over
 * a stale record. The runtime repair is good for the reader with scripts and it is not evidence
 * about the record.
 *
 * All three were repaired under am-6iz4 by letting identifier columns wrap below 480px and
 * replacing inline cell padding with `--table-cell-x`, and measured fitting then. Whether they
 * regressed since or were measured in a state this file cannot reproduce is NOT established here;
 * the figures are, and they are on am-14at.
 *
 * A debt, not a budget: repairing one means striking its lines out, and the comparison is
 * two-sided, so it cannot be left behind.
 *
 * EMPTY AS OF 2026-10-27, and the three it held were paid the same day rather than waived. Each of
 * sr-12, lq-05 and lq-07 now AUTHORS the `tabIndex={0}` that `initFormulaOverflow` was supplying at
 * runtime, so their records are gone (a region that overflows may not hold a
 * RECORDED_NON_OVERFLOWING entry; the ratchet refuses one whose own numbers show an overflow) and
 * the keyboard route no longer depends on a script having run. Whether those three tables should
 * instead be made to FIT at 320px is open on am-14at and is the better outcome; a tab stop is the
 * floor, not the repair.
 */
const RECORDS_FALSIFIED: ReadonlyMap<string, string> = new Map([]);

const NO_SCRIPT_OVERFLOWING: ReadonlyMap<string, string> = new Map([
  [
    "src/reader/entrances/BrownianFirstEncounter.tsx::formula@320px",
    '309px/288px, 21px hidden. Same element, same geometry with scripts, where initFormulaOverflow gives it tabindex=0 and the name "Formula, scrolls sideways".',
  ],
]);

/**
 * Answers the prediction prompt the only way a check honestly can: by skipping it.
 *
 * WITHOUT THIS THE SCRIPT STATE IS NOT THE STATE THE RECORDS DESCRIBE, and the first run of this
 * file proved it rather than reasoning about it. With scripts on and no interaction, seven lab
 * records reported `laidOut=0` at both widths, so every verdict about them came from the no-script
 * reading alone, and the message read "a recorded non-overflowing region overflows" while the state
 * the measurement was taken in had never been loaded. A gate that cannot reach the claim it is
 * checking is the failure AGENTS.md calls self-concealing.
 *
 * Skipping is the right control of the three. "I have one in mind" stores nothing and reveals,
 * which would do; choosing a candidate would record a prediction, which writes to the reader's own
 * storage port and changes what the panel then says. `PredictGate.skip` reveals the result and is
 * the documented escape ("Skipping always shows the result"), so it is the smallest action that
 * puts the page in the state a reader who declined to predict is in.
 *
 * It returns the number of prompts dismissed, which the census prints: a run where this silently
 * clicked nothing would otherwise be indistinguishable from one where it worked.
 */
async function dismissPredictMode(page: Page): Promise<number> {
  const skips = page.locator('button[aria-label^="Skip prediction"]');
  const count = await skips.count();
  for (let index = 0; index < count; index++) {
    // Each click re-renders the panel, so the first button is re-resolved rather than held.
    const first = page.locator('button[aria-label^="Skip prediction"]').first();
    if ((await first.count()) === 0) break;
    await first.click({ timeout: 5000 });
  }
  return count;
}

const PREPARATIONS: ReadonlyMap<string, (page: Page) => Promise<void>> = new Map([
  [
    "src/reader/entrances/BrownianFirstEncounter.tsx::table-scroll",
    async (page: Page) => {
      const button = page.locator('button:text-is("Table and typed values")').first();
      if ((await button.count()) > 0) await button.click({ timeout: 5000 });
    },
  ],
]);

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
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

/** One element, as the browser reports it. */
export interface Reading {
  readonly state: ScriptState;
  readonly width: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly laidOut: boolean;
  readonly tabindex: string | null;
  readonly name: string | null;
}

export interface RecordVerdict {
  /** At least one laid-out element was measured somewhere, so the record was really checked. */
  readonly decided: boolean;
  /** Laid out, overflowing, and carrying no tab stop: the thing a record licenses and must not be. */
  readonly violations: readonly Reading[];
  /** Laid out and overflowing WITH a tab stop: correct markup, and the other gate's subject. */
  readonly tabStopped: readonly Reading[];
  readonly laidOutCount: number;
  /** Exactly one element matched in every reading, so the record's OWN number is checkable. */
  readonly unambiguous: boolean;
  /**
   * An unambiguously attributed element that overflows, whatever its tabindex.
   *
   * THE TAB-STOP EXEMPTION BELONGS TO THE PAGE-LEVEL CLAIM AND NOT TO THIS ONE, and keeping it
   * here cost this file a false green on its first real run. A record says "this element does not
   * overflow, so it needs no tab stop". `initFormulaOverflow` walks `querySelectorAll("*")` and
   * gives EVERY overflowing scroll region a tabindex at runtime, so a recorded region that has
   * come to overflow acquires one automatically -- and the exemption then read that rescue as
   * evidence the record was still true. Three records are falsified exactly that way.
   */
  readonly falsified: readonly Reading[];
}

/**
 * The predicate, pure and separately proven.
 *
 * Extracted because a verdict reachable only through a browser cannot be shown to fire: the plant
 * below drives these four cases directly, which is the cheap half of the proof that this file can
 * go red at all (AGENTS.md, "a sweep that cannot fail and a sweep with nothing to find look
 * identical").
 */
export function verdict(readings: readonly Reading[]): RecordVerdict {
  const laidOut = readings.filter((r) => r.laidOut);
  const overflowing = laidOut.filter((r) => r.scrollWidth > r.clientWidth);
  return {
    decided: laidOut.length > 0,
    violations: overflowing.filter((r) => r.tabindex === null),
    tabStopped: overflowing.filter((r) => r.tabindex !== null),
    laidOutCount: laidOut.length,
    unambiguous: isUnambiguous(readings),
    falsified: isUnambiguous(readings) ? overflowing : [],
  };
}

/**
 * Does every state-and-width reading of this record see exactly ONE element?
 *
 * This decides whether the record can be held to ITS OWN NUMBER or only to the weaker page-level
 * claim, and the distinction is load-bearing rather than tidy. A record names a file, a class and
 * sometimes an accessible name; the built page offers no file, so when several elements of the
 * class are on the route there is no way to say which one the record measured. On
 * /papers/brownian-motion/ the class `formula` matches thirty-three elements per reading, and
 * asserting any of their widths against this record's "288px/288px" would be asserting about
 * elements it never claimed anything about.
 *
 * Where exactly one matches, the attribution is certain and the record's number is checkable.
 */
export function isUnambiguous(readings: readonly Reading[]): boolean {
  const perReading = new Map<string, number>();
  for (const r of readings) {
    if (!r.laidOut) continue;
    const slot = `${r.state}@${r.width}`;
    perReading.set(slot, (perReading.get(slot) ?? 0) + 1);
  }
  if (perReading.size === 0) return false;
  return [...perReading.values()].every((count) => count === 1);
}

export function recordSelector(record: NonOverflowingRecord): string {
  const classes = record.className.trim().split(/\s+/).filter(Boolean);
  const base = classes.map((c) => `.${c}`).join("");
  if (record.ariaLabel === undefined) return base;
  // No escaping, a refusal: an accessible name with a double quote would need it and none has one,
  // so a guard that fails loudly beats an escape nobody ever exercises.
  assert.ok(
    !record.ariaLabel.includes('"'),
    `a recorded accessible name contains a double quote and cannot be put in a selector: ${record.ariaLabel}`,
  );
  return `${base}[aria-label="${record.ariaLabel}"]`;
}

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  return new Promise((resolveServer, rejectServer) => {
    const server = createServer((request, response) => {
      const requested = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
      const candidate = join(rootDir, normalize(requested));
      if (!candidate.startsWith(rootDir)) {
        response.writeHead(403).end("outside the served root");
        return;
      }
      let file = candidate;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file) && existsSync(`${candidate}.html`)) file = `${candidate}.html`;
      if (!existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404, { "content-type": "text/plain" }).end("not built");
        return;
      }
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
        "content-length": statSync(file).size,
      });
      createReadStream(file).pipe(response);
    });
    server.on("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        rejectServer(new Error("the static server reported no port"));
        return;
      }
      resolveServer({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

const SETTLE_FLOOR_MS = 1400;
const SETTLE_POLLS = 10;
const SETTLE_INTERVAL_MS = 200;

/**
 * Reads the selectors repeatedly until two consecutive readings agree, and reports that it never
 * settled rather than returning the last one.
 *
 * The sibling file learned this the expensive way: with fonts settled and nothing else it reported
 * four overflowing regions that a longer wait could not reproduce, because a box overflows
 * transiently between the webfont arriving and the layout settling, and `formulaOverflow.inline.ts`
 * schedules its own last re-check at 1200ms for exactly that reason. Sampling before then is
 * sampling in transit.
 */
async function readAtRest(
  page: Page,
  selectors: readonly string[],
): Promise<{ settled: boolean; byIndex: readonly (readonly RawReading[])[] }> {
  const script = `(() => ${JSON.stringify(selectors)}.map((sel) => [...document.querySelectorAll(sel)].map((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    laidOut: el.getClientRects().length > 0,
    tabindex: el.getAttribute("tabindex"),
    name: el.getAttribute("aria-label"),
  }))))()`;
  await page.waitForTimeout(SETTLE_FLOOR_MS);
  let previous = JSON.stringify(await page.evaluate(script));
  for (let poll = 0; poll < SETTLE_POLLS; poll++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const current = await page.evaluate(script);
    const serialised = JSON.stringify(current);
    if (serialised === previous) {
      return { settled: true, byIndex: current as (readonly RawReading[])[] };
    }
    previous = serialised;
  }
  return { settled: false, byIndex: [] };
}

interface RawReading {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly laidOut: boolean;
  readonly tabindex: string | null;
  readonly name: string | null;
}

test("every region recorded as non-overflowing still fits, measured in a browser", async (t) => {
  assertOutFreshness();
  assert.ok(existsSync(OUT_DIR), "out/ is missing; run bun run build");

  const keyed = [...RECORDED_NON_OVERFLOWING.entries()];
  assert.ok(keyed.length > 0, "no recorded regions: this check would pass on an empty population");

  const routable = keyed.filter(([, record]) => record.url.startsWith("/"));
  const byUrl = new Map<string, [string, NonOverflowingRecord][]>();
  for (const entry of routable) {
    const list = byUrl.get(entry[1].url) ?? [];
    list.push(entry);
    byUrl.set(entry[1].url, list);
  }

  const readings = new Map<string, Reading[]>();
  for (const [key] of keyed) readings.set(key, []);

  const { server, origin } = await startStaticServer(OUT_DIR);
  const browser = await chromium.launch();
  const unsettled: string[] = [];
  const loadFailures: string[] = [];
  let revealed = 0;
  try {
    for (const [url, records] of byUrl) {
      const selectors = records.map(([, record]) => recordSelector(record));
      for (const width of WIDTHS) {
        for (const state of STATES) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: "reduce",
            javaScriptEnabled: state === "script",
          });
          const page = await context.newPage();
          try {
            const response = await page.goto(`${origin}${url}`, {
              waitUntil: "load",
              timeout: 45_000,
            });
            if (response === null || !response.ok()) {
              loadFailures.push(
                `${url} at ${width}px (${state}): HTTP ${response === null ? "no response" : response.status()}`,
              );
              continue;
            }
            if (state === "script") {
              revealed += await dismissPredictMode(page);
              for (const [key] of records) {
                const prepare = PREPARATIONS.get(key);
                if (prepare !== undefined) await prepare(page);
              }
            }
            // Every disclosure open before measuring. A formula inside a closed <details> keeps its
            // layout box in Chromium, so this adds the regions that render only when opened rather
            // than correcting the ones already counted.
            await page.evaluate(`(() => {
              for (const d of document.querySelectorAll("details")) d.open = true;
            })()`);
            try {
              await page.evaluate("document.fonts.ready");
            } catch {
              // A page served without a webfont has no fonts to wait for; the quiescence loop below
              // is what actually decides when the layout has stopped moving.
            }
            const rest = await readAtRest(page, selectors);
            if (!rest.settled) {
              unsettled.push(`${url} at ${width}px (${state})`);
              continue;
            }
            records.forEach(([key], index) => {
              for (const raw of rest.byIndex[index] ?? []) {
                readings.get(key)?.push({
                  state,
                  width,
                  scrollWidth: raw.scrollWidth,
                  clientWidth: raw.clientWidth,
                  laidOut: raw.laidOut,
                  tabindex: raw.tabindex,
                  name: raw.name,
                });
              }
            });
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.close(() => done()));
  }

  const verdicts = new Map<string, RecordVerdict>();
  for (const [key] of keyed) verdicts.set(key, verdict(readings.get(key) ?? []));

  const scriptViolations: string[] = [];
  const noScriptViolations: string[] = [];
  const noScriptIdentities: string[] = [];
  const falsifiedIdentities: string[] = [];
  const falsifiedDetail: string[] = [];
  const tabStopped: string[] = [];
  const undecided: string[] = [];
  let laidOutTotal = 0;
  const lines: string[] = [];
  for (const [key, record] of keyed) {
    const v = verdicts.get(key) as RecordVerdict;
    laidOutTotal += v.laidOutCount;
    const states = [
      ...new Set((readings.get(key) ?? []).filter((r) => r.laidOut).map((r) => r.state)),
    ];
    lines.push(
      `  ${key}\n    url=${record.url} matched=${(readings.get(key) ?? []).length} laidOut=${v.laidOutCount}` +
        ` state(s)=${states.length === 0 ? "none" : states.join("+")} recorded="${record.measurements}"`,
    );
    if (!v.decided) undecided.push(key);
    for (const r of v.falsified) {
      // The record's own number, held to the one element it can only be about.
      falsifiedIdentities.push(`${key}@${r.width}px@${r.state}`);
      falsifiedDetail.push(
        `${key}: ${r.scrollWidth}px/${r.clientWidth}px at ${r.width}px (${r.state})` +
          ` hides ${r.scrollWidth - r.clientWidth}px, while the record says "${record.measurements}"` +
          `${r.tabindex === null ? " and no tab stop" : ` (tabindex=${r.tabindex}, which initFormulaOverflow adds at runtime to any overflowing region)`}.`,
      );
    }
    // The weaker page-level arms apply ONLY where attribution is impossible; an unambiguous record
    // is judged above, on its own number, and must not also be judged by the looser rule.
    if (v.unambiguous) continue;
    for (const r of v.violations) {
      const described =
        `${key}: ${r.scrollWidth}px/${r.clientWidth}px at ${r.width}px (${r.state})` +
        ` hides ${r.scrollWidth - r.clientWidth}px with no tab stop. The record says "${record.measurements}".`;
      if (r.state === "script") scriptViolations.push(described);
      else {
        noScriptViolations.push(described);
        noScriptIdentities.push(`${key}@${r.width}px`);
      }
    }
    for (const r of v.tabStopped) {
      tabStopped.push(
        `${key}: an element of this class at ${r.width}px (${r.state}) is ${r.scrollWidth}px/${r.clientWidth}px` +
          ` and HAS tabindex=${r.tabindex} (name="${r.name ?? ""}") - reachable, so not a violation here.`,
      );
    }
  }

  t.diagnostic(
    `[recorded regions] ${keyed.length} record(s); ${keyed.length - undecided.length} decided in a browser; ` +
      `${undecided.length} declared undecidable; ${laidOutTotal} laid-out element(s) measured across ` +
      `${byUrl.size} route(s), ${WIDTHS.length} width(s) and ${STATES.length} script state(s).`,
  );
  for (const line of lines) t.diagnostic(line);
  for (const line of tabStopped) t.diagnostic(`[overflowing WITH a tab stop] ${line}`);

  assert.deepEqual(
    loadFailures,
    [],
    `a recorded region's route did not load:\n${loadFailures.join("\n")}`,
  );
  assert.deepEqual(
    unsettled,
    [],
    `a page never stopped moving, so its numbers are a measurement in transit:\n${unsettled.join("\n")}`,
  );

  // The population floor, so a run that measured almost nothing cannot read as a clean one.
  assert.ok(
    laidOutTotal >= 20,
    `only ${laidOutTotal} laid-out element(s) measured; the build of 2026-10-27 gave 60. ` +
      "A collapse here means the pages loaded and the regions were not found, which is a finding, not a pass.",
  );

  // With scripts, the state every record was measured in, the property holds unconditionally.
  assert.deepEqual(
    scriptViolations,
    [],
    `a recorded non-overflowing region overflows WITH SCRIPTS, which is the state its own measurement names:\n${scriptViolations.join("\n")}`,
  );

  // The record's own number, where exactly one element can be meant by it. This is the arm that
  // actually checks what a record claims; the two below are the weaker page-level property, kept
  // for the records no browser can attribute.
  assert.deepEqual(
    falsifiedIdentities.sort(),
    [...RECORDS_FALSIFIED.keys()].sort(),
    "the set of records whose own measurement no longer holds is not the recorded set. A new " +
      "member means a recorded region has come to overflow and its licence to drop the tab stop " +
      "has lapsed; a member that now fits must be struck off.\n" +
      `  measured: ${falsifiedIdentities.join(", ") || "(none)"}\n` +
      `  declared: ${[...RECORDS_FALSIFIED.keys()].join(", ")}\n${falsifiedDetail.join("\n")}`,
  );

  // Without scripts it does not hold yet, so it is held to the measured set BY IDENTITY and
  // two-sided, exactly as phoneOverflow holds its own: a new member is a regression that names the
  // record and the width, and a member that now fits must be struck off, so repairing one lowers
  // the ceiling instead of leaving slack for the next regression to hide in.
  assert.deepEqual(
    noScriptIdentities.sort(),
    [...NO_SCRIPT_OVERFLOWING.keys()].sort(),
    "the set of recorded regions that overflow WITHOUT SCRIPTS is not the recorded set.\n" +
      `  measured: ${noScriptIdentities.join(", ") || "(none)"}\n` +
      `  declared: ${[...NO_SCRIPT_OVERFLOWING.keys()].join(", ")}\n${noScriptViolations.join("\n")}`,
  );

  const declared = [...UNDECIDABLE_IN_A_BROWSER.keys()].sort();
  assert.deepEqual(
    undecided.sort(),
    declared,
    "the set of records no browser could decide is not the declared set. " +
      "A new one needs a measured reason in UNDECIDABLE_IN_A_BROWSER; one that now lays out must be " +
      `removed from it.\n  measured undecidable: ${undecided.join(", ") || "(none)"}\n  declared: ${declared.join(", ")}`,
  );
});

test("the predicate fires, in every direction it can be wrong in", () => {
  const base = { state: "script" as ScriptState, width: 320, laidOut: true, name: null };

  // A region that fits is clean.
  assert.deepEqual(verdict([{ ...base, scrollWidth: 254, clientWidth: 254, tabindex: null }]), {
    decided: true,
    violations: [],
    tabStopped: [],
    laidOutCount: 1,
    unambiguous: true,
    falsified: [],
  });

  // The defect: overflowing, laid out, no tab stop. This is what a record licenses and must not be.
  const overflowing = { ...base, scrollWidth: 366, clientWidth: 217, tabindex: null };
  const caught = verdict([overflowing]);
  assert.equal(caught.violations.length, 1);
  assert.equal(caught.tabStopped.length, 0);
  assert.equal(caught.falsified.length, 1);

  // THE ARM THIS FILE GOT WRONG FIRST TIME. One element, overflowing, WITH a tab stop. The
  // page-level arm exempts it, because a reachable scrolling region is the other gate's subject --
  // and the record's own arm must NOT, because `initFormulaOverflow` hands out that tab stop at
  // runtime to anything that overflows, so treating it as evidence would read the rescue as proof
  // the record was still true. Three real records were being passed over exactly here.
  const rescued = verdict([{ ...overflowing, tabindex: "0" }]);
  assert.deepEqual(rescued.violations, []);
  assert.equal(rescued.tabStopped.length, 1);
  assert.equal(rescued.falsified.length, 1, "a runtime tab stop does not make a record true");

  // And the other side of that arm: where TWO elements answer one reading, the record cannot be
  // attributed, so its own number is not checkable and only the page-level arm applies.
  const ambiguous = verdict([
    { ...overflowing, tabindex: "0" },
    { ...base, scrollWidth: 254, clientWidth: 254, tabindex: null },
  ]);
  assert.equal(ambiguous.unambiguous, false);
  assert.deepEqual(ambiguous.falsified, []);
  assert.equal(ambiguous.tabStopped.length, 1);

  // Two readings of one element each is still unambiguous: the count is per state and width, not
  // per record, or measuring a second width would silently stop checking the number.
  assert.equal(
    verdict([
      { ...overflowing, tabindex: "0" },
      { ...overflowing, width: 1280, tabindex: "0" },
    ]).falsified.length,
    2,
  );

  // Not laid out decides nothing, and must not read as clean: an element inside a closed predict
  // gate reports 0/0, which passes every width comparison there is.
  const hidden = verdict([
    { ...base, laidOut: false, scrollWidth: 0, clientWidth: 0, tabindex: null },
  ]);
  assert.equal(hidden.decided, false);
  assert.deepEqual(hidden.violations, []);
  assert.deepEqual(hidden.falsified, []);
  assert.equal(hidden.unambiguous, false, "nothing laid out cannot be unambiguously attributed");
  assert.equal(verdict([]).decided, false);
});

test("a recorded selector names the class, and the accessible name when the record gives one", () => {
  assert.equal(
    recordSelector({
      file: "f.tsx",
      className: "table-scroll",
      url: "/x/",
      measurements: "320px: 1px/1px",
      reason: "r",
      measuredBy: "m",
    }),
    ".table-scroll",
  );
  assert.equal(
    recordSelector({
      file: "f.tsx",
      className: "table-scroll sr03-interval",
      ariaLabel: "Values at these settings",
      url: "/x/",
      measurements: "320px: 1px/1px",
      reason: "r",
      measuredBy: "m",
    }),
    '.table-scroll.sr03-interval[aria-label="Values at these settings"]',
  );
  assert.throws(
    () =>
      recordSelector({
        file: "f.tsx",
        className: "c",
        ariaLabel: 'a "quoted" name',
        url: "/x/",
        measurements: "320px: 1px/1px",
        reason: "r",
        measuredBy: "m",
      }),
    /double quote/,
  );
});
