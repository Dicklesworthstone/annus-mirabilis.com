/**
 * The paper journeys, run in the lanes the journey runner does not drive (dispatch 471).
 *
 * scripts/e2e/journeys knows what a reader DOES: four continuous journeys, seven canonical steps
 * each, naming their own instrument, control and term chip. runPaperJourney drives them in one lane,
 * default Chromium at the journey's declared viewport. This drives the same steps in the conditions
 * a reader is in: a 320px phone, 400% zoom, and WebKit.
 *
 * NOTHING UNDER scripts/e2e/ IS WRITTEN. PAPER_JOURNEYS and its actions are imported read-only and
 * each step is invoked as `actions[kind](page, baseUrl)`, so these are their steps in my conditions
 * rather than my paraphrase of them. runPaperJourney itself cannot be reused, because it launches
 * its own browser at the journey's own viewport, which is the single lane already covered; the
 * actions are the reusable part.
 *
 * A STEP PASSES WHEN THE ACTION DOES NOT THROW, which is the runner's own criterion: paperJourney.ts
 * records status "pass" immediately after awaiting the action, and records `expected` and `actual`
 * as evidence WITHOUT comparing them. `expected` is a human-readable readiness description ("me-01
 * accepts a new state") and `actual` is what was seen ("Accepted: a body emits 1 L of light ..."),
 * so they are never equal. Comparing them, as the first version of this did, reported 0 of 7 in
 * every journey while every step had in fact succeeded.
 *
 * WHAT THIS CANNOT DRIVE, and it is a finding rather than a gap in the lanes: the journeys are
 * pointer-driven. steps.ts makes seven .click() calls and no key presses, so the keyboard lane
 * cannot reuse these actions without editing them, and that file is another pane's. Reported.
 *
 * Usage:
 *   bun scripts/journeys-in-lanes.ts [--out <dir>] [--base-url http://host:port]
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page, webkit } from "playwright";
import { PAPER_JOURNEYS } from "./e2e/journeys/index.ts";
import { retainLaneRun } from "./gate-census/laneEvidence.ts";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const OUT = flag("--out") ?? join(ROOT, "out");

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function serveExport(port: number): Promise<Server> {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname));
    for (const candidate of [
      join(OUT, path),
      join(OUT, path, "index.html"),
      `${join(OUT, path)}.html`,
    ]) {
      if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
      response.writeHead(200, {
        "content-type": TYPES[extname(candidate)] ?? "application/octet-stream",
      });
      response.end(readFileSync(candidate));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });
  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok(server));
  });
}

type Lane = Readonly<{
  name: string;
  engine: typeof chromium | typeof webkit;
  width: number;
  height: number;
}>;

/** 400% of 1280x1024 is 320x256: the width matches a phone and the height does not. */
const LANES: readonly Lane[] = [
  { name: "320px phone", engine: chromium, width: 320, height: 568 },
  { name: "400% zoom", engine: chromium, width: 320, height: 256 },
  { name: "WebKit 1280", engine: webkit, width: 1280, height: 900 },
];

type StepRow = { kind: string; ok: boolean; detail: string };

async function runJourney(
  page: Page,
  base: string,
  entry: (typeof PAPER_JOURNEYS)[number],
): Promise<StepRow[]> {
  const rows: StepRow[] = [];
  for (const step of entry.journey.steps) {
    const action = entry.actions[step.kind];
    try {
      const outcome = await action(page, base);
      rows.push({
        kind: step.kind,
        ok: true,
        detail: `${JSON.stringify(outcome.actual)}`.replace(/\s+/g, " ").slice(0, 70),
      });
    } catch (error) {
      rows.push({
        kind: step.kind,
        ok: false,
        detail: `${error}`.replace(/\s+/g, " ").slice(0, 150),
      });
    }
  }
  return rows;
}

/**
 * ONE THROWAWAY NAVIGATION PER LANE, EXCLUDED FROM THE COUNTS, AND IT IS NOT HIDING A FAILURE.
 *
 * Measured 2026-10-11 before this existed: 83 of 84 steps held, and the single failure was
 * `320px phone / mass-energy-continuous-journey / enter-source-passage`, a 30s `goto` timeout on
 * the FIRST navigation of the entire run. The same journey's same step then passed in the 400% zoom
 * lane and again in WebKit, which is what identifies it as startup cost rather than a defect: a
 * freshly created server serving its first large static page, into a freshly launched browser's
 * first context.
 *
 * So the first navigation of each lane is paid before the journeys begin and its duration is
 * printed. A gate that reddens on a cold start is a flaky gate, and the alternative -- a longer
 * timeout on the first step only -- would hide which step paid it.
 */
async function warmUp(page: Page, base: string): Promise<number> {
  const started = Date.now();
  try {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch {
    // A warm-up that cannot load says nothing on its own; the journeys below will report it.
  }
  return Date.now() - started;
}

async function main(): Promise<number> {
  const external = flag("--base-url") ?? process.env.E2E_BASE_URL;
  let server: Server | undefined;
  let base = external ?? "";
  if (!base) {
    if (!existsSync(join(OUT, "papers", "mass-energy", "index.html"))) {
      console.error(`${OUT} holds no built papers. Run a build, or pass --base-url.`);
      return 2;
    }
    for (const port of [48151, 48152, 48153]) {
      try {
        server = await serveExport(port);
        base = `http://127.0.0.1:${port}`;
        break;
      } catch {
        // A peer may hold the port; try the next.
      }
    }
    if (!server) {
      console.error("could not bind a local port; pass --base-url instead.");
      return 2;
    }
  }

  const failures: string[] = [];
  const record: {
    lane: string;
    warmUpMs: number;
    journey: string;
    steps: number;
    held: number;
    failed: { kind: string; detail: string }[];
  }[] = [];
  let steps = 0;
  console.log(`${PAPER_JOURNEYS.length} journeys x ${LANES.length} lanes, export ${OUT}\n`);
  try {
    for (const lane of LANES) {
      let browser: Browser | undefined;
      try {
        browser = await lane.engine.launch();
        const context = await browser.newContext({
          viewport: { width: lane.width, height: lane.height },
        });
        const page = await context.newPage();
        console.log(`== ${lane.name}`);
        const warmMs = await warmUp(page, base);
        console.log(`   (warm-up navigation ${warmMs}ms, not counted)`);
        for (const entry of PAPER_JOURNEYS) {
          const rows = await runJourney(page, base, entry);
          steps += rows.length;
          const held = rows.filter((row) => row.ok).length;
          console.log(`   ${entry.journey.sliceId}: ${held} of ${rows.length} steps held`);
          record.push({
            lane: lane.name,
            warmUpMs: warmMs,
            journey: entry.journey.sliceId,
            steps: rows.length,
            held,
            failed: rows
              .filter((row) => !row.ok)
              .map((row) => ({ kind: row.kind, detail: row.detail })),
          });
          for (const row of rows) {
            if (row.ok) continue;
            console.log(`     FAIL ${row.kind}  ${row.detail}`);
            failures.push(`${lane.name} / ${entry.journey.sliceId} / ${row.kind}: ${row.detail}`);
          }
        }
        await context.close();
      } finally {
        await browser?.close();
      }
    }
  } finally {
    server?.close();
  }

  console.log(
    `\n${failures.length === 0 ? `every journey held in every lane: ${steps} steps` : `${failures.length} of ${steps} steps failed`}`,
  );
  for (const failure of failures) console.log(`  ${failure}`);

  /**
   * THE RETAINED RUN, which this lane did not write before (am-rc1001-bridge-plan-pcjk.18).
   *
   * That bead's finding, re-measured by the owner on 2026-10-09 and holding: five lane scripts
   * including this one have "0 each" of writeFileSync / mkdirSync / appendFileSync, so "their only
   * evidence is commit messages". A summary naming the commit, the lanes, the population and every
   * failure is the difference between a run and a claim about one.
   *
   * The population is printed as well as stored, and the floor is stated: 4 journeys x 3 lanes x 7
   * steps is 84, and a run that examined fewer has lost a lane or a journey rather than passed.
   */
  /**
   * THE RETAINED RUN, through the shared writer (am-rc1001-bridge-plan-pcjk.18).
   *
   * This block used to build the summary and print the census by hand, and its census line DID NOT
   * PARSE: measured 2026-10-11, `parsePopulationLines` returned 0 reports and 1 malformed for
   * `[census] journeys-in-lanes examined 84 steps (4 journeys x 3 lanes, floor 84) at commit ...`,
   * with the reason "does not match [census] <gate> examined <n> <noun> (minimum <m>)". It said
   * "floor" where the grammar says "minimum" and put the commit after the closing parenthesis. So
   * the one lane that did print a census printed one the census reader could not count, which is
   * the case population.ts says it reports rather than drops.
   *
   * The commit now rides on the "Retained run:" line instead, which keeps the census line to the
   * one grammar, and the lane-specific fields come through `extra`.
   */
  const { vacuous } = retainLaneRun({
    lane: "journeys-in-lanes",
    root: ROOT,
    examined: steps,
    noun: "journey steps",
    minimum: PAPER_JOURNEYS.length * LANES.length * 7,
    failures,
    export: OUT,
    baseUrl: base,
    extra: {
      lanes: LANES.map((lane) => lane.name),
      journeys: PAPER_JOURNEYS.map((entry) => entry.journey.sliceId),
      stepsExamined: steps,
      stepsExpected: PAPER_JOURNEYS.length * LANES.length * 7,
      rows: record,
    },
  });
  return failures.length === 0 && !vacuous ? 0 : 1;
}

process.exit(await main());
