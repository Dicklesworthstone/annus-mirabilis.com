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
        for (const entry of PAPER_JOURNEYS) {
          const rows = await runJourney(page, base, entry);
          steps += rows.length;
          const held = rows.filter((row) => row.ok).length;
          console.log(`   ${entry.journey.sliceId}: ${held} of ${rows.length} steps held`);
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
  return failures.length === 0 ? 0 : 1;
}

process.exit(await main());
