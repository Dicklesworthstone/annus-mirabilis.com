/**
 * THE PAPER VERTICAL-SLICE HARNESS, IN A LANE, RUNNING A REAL JOURNEY (am-test-e2e-harness-bqmh).
 *
 * WHAT WAS MISSING, measured 2026-10-07 and not what the bead's last note says. That note, from
 * 2026-09-24, quotes `scripts/e2e-paper-vertical-slices.ts:274` printing "Paper vertical-slice scenarios
 * are not wired in yet". That stub is gone: `scripts/e2e/journeys/index.ts` registers all four papers and
 * `runPaperJourney` walks the seven steps. The premise went stale.
 *
 * What is still true is the other half of the same note - "it was found reporting green when all eleven
 * lanes fail". The harness has NO package.json script, where every sibling browser lane has one
 * (test:search:browser, test:offline:browser, test:ui-extraction:browser and five more). So nothing in
 * the lane matrix ran it, and a harness nothing runs reports nothing: its green is the green of a command
 * never issued. That is the vacuity this file closes.
 *
 * WHY A LANE FILE AND NOT A PACKAGE SCRIPT ALONE. A script would run the harness; it would not ASSERT
 * anything about the result, and the harness's own exit path is a run record rather than a verdict. This
 * file runs one paper's continuous journey against the built site, asserts every declared step was
 * performed and none failed, and plants a break that must turn it red. The package script points here.
 *
 * MASS-ENERGY, for the reason its own journey file gives: all four papers afford all seven steps, and
 * mass-energy is the smallest corpus, so every step's target is named exactly rather than found by
 * pattern. The other three are registered and run by the harness's own CLI; adding them here is a
 * separate decision about lane cost, and the bead asks for AT LEAST one.
 *
 * AGAINST THE BUILT SITE, and `assertOutFreshness` is what makes that a claim rather than a hope: a stale
 * out/ fails loudly instead of walking yesterday's HTML. This lane never builds out/ for you, on purpose,
 * which is the convention the node lane already uses.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { PAPER_JOURNEYS } from "./journeys/index.ts";
import {
  createPaperE2EEvent,
  type PaperE2EEvent,
  type PaperE2EViewportName,
} from "./paper-e2e-contract.ts";
import { type PaperJourneyRecorder, runPaperJourney } from "./paperJourney.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(REPO_ROOT, "out");

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * The plant. `hide-term` serves the journey's own entry page with the term markup the
 * select-linked-term step depends on stripped, so ONE declared step becomes unperformable while every
 * other byte of the site is what the build produced. A plant that broke the whole page would prove only
 * that the journey needs a page.
 */
type ServerPlant = "none" | "hide-term";

function startStaticServer(plant: ServerPlant): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(OUT_DIR, decodeURIComponent(rawUrl));
    if (existsSync(filePath) && statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
    if (!filePath.startsWith(OUT_DIR) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    const ext = extname(filePath);
    let body = readFileSync(filePath);
    if (plant === "hide-term" && ext === ".html") {
      // The attribute the term step selects on, removed from the served bytes only.
      body = Buffer.from(body.toString("utf8").replaceAll("data-term-id", "data-term-gone"));
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
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
 * The smallest recorder the journey runner's own interface admits. The harness's RunRecorder writes JSONL
 * into artifacts/; a lane wants the events in memory so it can ASSERT on them, which is the whole reason
 * `PaperJourneyRecorder` is an interface rather than that class.
 */
function laneRecorder(): PaperJourneyRecorder & { readonly collected: PaperE2EEvent[] } {
  const collected: PaperE2EEvent[] = [];
  return {
    collected,
    runDirectory: join(REPO_ROOT, "artifacts", "test-logs", "paper-journey-lane"),
    logRunId: "paper-journey-lane",
    emit(event) {
      // The contract's own factory, not a hand-built literal: it is what fills schemaVersion, the
      // timestamp and the diagnostic arrays, and a cast would let this lane drift from the shape the
      // harness writes to JSONL.
      const full = createPaperE2EEvent({ ...event, sequence: collected.length + 1 });
      collected.push(full);
      return full;
    },
    registerDiagnostics(_sliceId: string, _viewport: PaperE2EViewportName) {
      // The lane asserts on the journey's own verdict, not on console noise; the harness's CLI retains
      // diagnostics and this lane deliberately does not duplicate that.
    },
  };
}

const MASS_ENERGY = PAPER_JOURNEYS.find((entry) => entry.journey.paperSlug === "mass-energy");

test("the registry offers mass-energy's journey, so the run below is not over an empty selection", () => {
  // Non-vacuity first. A `find` that returned undefined would make every assertion below unreachable,
  // and a lane that silently ran zero journeys is exactly what this bead exists to end.
  assert.ok(MASS_ENERGY, "PAPER_JOURNEYS must register a mass-energy entry");
  assert.equal(MASS_ENERGY.journey.sliceId, "mass-energy-continuous-journey");
  assert.ok(
    MASS_ENERGY.journey.steps.length >= 7,
    `the continuous journey must declare at least the seven steps; it declares ${MASS_ENERGY.journey.steps.length}`,
  );
  assert.equal(PAPER_JOURNEYS.length, 4, "all four papers are registered");
});

test("mass-energy's continuous journey runs against the built site with no failed step", async () => {
  assertOutFreshness("out", REPO_ROOT);
  assert.ok(MASS_ENERGY);
  const { server, origin } = await startStaticServer("none");
  try {
    const recorder = laneRecorder();
    const result = await runPaperJourney({ entry: MASS_ENERGY, recorder, baseUrl: origin });
    const declared = MASS_ENERGY.journey.steps.length;
    console.log(
      `[paper journey] ${result.sliceId}: ${result.performedSteps} of ${declared} declared step(s) performed, ${result.failedSteps} failed, ${recorder.collected.length} event(s)`,
    );
    assert.equal(result.failedSteps, 0, "no declared step may fail");
    // Performed, not merely attempted: a runner that threw on step one would report 0 failures too.
    assert.equal(
      result.performedSteps,
      declared,
      `every declared step must be performed, not skipped`,
    );
    assert.ok(recorder.collected.length > 0, "the run must emit events");
  } finally {
    server.close();
  }
});

test("PLANTED: stripping the term markup makes the journey's term step fail", async () => {
  assert.ok(MASS_ENERGY);
  const { server, origin } = await startStaticServer("hide-term");
  try {
    const recorder = laneRecorder();
    const result = await runPaperJourney({ entry: MASS_ENERGY, recorder, baseUrl: origin });
    console.log(
      `[paper journey] PLANT: ${result.performedSteps} performed, ${result.failedSteps} failed`,
    );
    // The journey must NOTICE. Without this the lane above would pass against any site at all, which is
    // the condition this bead was reopened for: a harness reporting green while eleven lanes fail.
    assert.ok(
      result.failedSteps > 0,
      "a site missing the term markup must fail the journey, or the lane proves nothing",
    );
  } finally {
    server.close();
  }
});
