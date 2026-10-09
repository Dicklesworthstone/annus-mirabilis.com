/**
 * Live-class runtime-conformance runner (am-rt-browser-conformance-09i5).
 *
 *   bun scripts/e2e-paper-vertical-slices.ts --fixtures --journey runtime-conformance
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { getLogger, newRunIdentity } from "../../../src/testing/log/logger.ts";
import { reportPopulation } from "../../gate-census/population.ts";
import { bundleFixtureApp } from "../fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY } from "../fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "../fixtures/fixtureServer.ts";
import {
  type CheckResult,
  checkLargeSeedSurvivesUrlRoundTrip,
  checkNoLeakedWorkers,
  checkNoMislabeledPaint,
  checkNoWasmOnArrival,
  checkObserverChangePreservesWorld,
  checkPlantedLeakedWorkerFails,
  checkPlantedMarkMismatchFails,
  checkPlantedRandomnessFails,
  checkPlantedStaleTeardownFails,
  checkRouteTransitionDoesNotAdvanceRandomness,
  checkSchedulerMarksMatchAcceptedSnapshot,
  checkSnapshotIdentityAcrossViews,
  checkStaleAfterTeardownRejected,
  checkTwoPlacementsIndependent,
  recordNetworkKinds,
} from "./checks.ts";
import { assertRuntimeRegistration } from "./fixtureRegistration.ts";
import { openRuntimeFixture } from "./freshNavigation.ts";

export type RuntimeConformanceOptions = Readonly<{
  canary?: boolean;
  headed?: boolean;
}>;

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");

async function waitReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-reader-root][data-ready="true"]', { timeout: 15000 });
}

export async function runRuntimeConformance(
  options: RuntimeConformanceOptions = {},
): Promise<{ ok: boolean; logPath: string }> {
  const logRunId = newRunIdentity();
  const logger = getLogger("runtime-conformance", logRunId);
  const entry = assertRuntimeRegistration(
    FIXTURE_APP_REGISTRY.find((item) => item.id === "runtime"),
  );
  await bundleFixtureApp(entry);
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  let failed = 0;
  /** How many assertions actually executed, which is this gate's population. */
  let ran = 0;
  /**
   * How many it declares. Hoisted out of the `try` because the census line is printed after the
   * `finally`, where the assertion array itself is out of scope -- tsc caught that, and the fix is
   * to carry the number rather than to move the reporting inside the block that can throw.
   */
  let declared = 0;
  try {
    browser = await chromium.launch({ headless: options.headed !== true });
    const page = await browser.newPage();

    if (options.canary) {
      const evidenceDir = resolve(
        "artifacts/test-logs/runtime-conformance",
        logRunId,
        "evidence",
        "canary-forced-failure",
        "desktop",
      );
      await mkdir(evidenceDir, { recursive: true });
      await page.goto(`${server.url}/runtime-conformance.html#/runtime`);
      await waitReady(page);
      const screenshot = resolve(evidenceDir, "screenshot.png");
      const dom = resolve(evidenceDir, "dom.html");
      const consoleLog = resolve(evidenceDir, "console.log");
      const network = resolve(evidenceDir, "network.har");
      const trace = resolve(evidenceDir, "trace.zip");
      await page.screenshot({ path: screenshot });
      await writeFile(dom, await page.content());
      await writeFile(consoleLog, "canary\n");
      await writeFile(network, "{}\n");
      await writeFile(trace, "");
      logger.log({
        testId: "canary-forced-failure",
        beadId: "am-rt-browser-conformance-09i5",
        outcome: "failed",
        lane: "desktop",
        message: "canary forced failure retains evidence",
        evidence: { screenshot, trace, dom, console: consoleLog, network },
      });
      return { ok: false, logPath: logger.filePath };
    }

    const assertions: {
      id: string;
      provesBead: string;
      run: (page: Page) => Promise<CheckResult>;
    }[] = [
      {
        // The arrival contract: an instrument shows its static worked example and fetches no wasm.
        // The collector is attached BEFORE goto, since a listener added after it misses exactly the
        // requests this is about. Non-vacuous because RUNTIME_FIXTURE_ENTRY serves a wasm artifact
        // and a manifest, so the request is available to be made (am-xyxk).
        id: "no-wasm-on-arrival",
        provesBead: "am-rt-browser-conformance-09i5",
        run: async (p) => {
          const seen = recordNetworkKinds(p);
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkNoWasmOnArrival(seen());
        },
      },
      {
        // The 64-bit seed contract, end to end: built into a url, read back out of it, and compared
        // with the accepted snapshot's own seed. 2^64 - 1 is 2048 away from the nearest double, so a
        // layer that passed it through a number would be caught rather than rounding to itself.
        id: "large-seed-survives-url-round-trip",
        provesBead: "am-rt-browser-conformance-09i5",
        run: async (p) =>
          checkLargeSeedSurvivesUrlRoundTrip(p, `${server.url}/runtime-conformance.html#/runtime`),
      },
      {
        // Sampled across animation frames rather than read once after settling, because a frame that
        // paints an old number under a new label is invisible to a check that looks only at the end
        // state. Settled frames only: a pending frame is entitled to show the previous accepted value
        // while the requested revision is ahead of it (am-xyxk).
        id: "no-mislabeled-paint",
        provesBead: "am-rt-browser-conformance-09i5",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkNoMislabeledPaint(p, "#placement-a", "runtime-analytic-a");
        },
      },
      {
        id: "two-placements-independent",
        provesBead: "am-rt-snapshot-store-aft",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkTwoPlacementsIndependent(p);
        },
      },
      {
        id: "snapshot-identity-across-views",
        provesBead: "am-rt-snapshot-store-aft",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkSnapshotIdentityAcrossViews(p, "#placement-a");
        },
      },
      {
        id: "observer-change-preserves-world",
        provesBead: "am-rt-command-classes-dzp",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkObserverChangePreservesWorld(p);
        },
      },
      {
        id: "teardown-no-leaked-workers",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkNoLeakedWorkers(p);
        },
      },
      {
        id: "route-transition-does-not-advance-randomness",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkRouteTransitionDoesNotAdvanceRandomness(p);
        },
      },
      {
        id: "stale-after-teardown-rejected",
        provesBead: "am-rt-worker-protocol-gaq",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkStaleAfterTeardownRejected(p);
        },
      },
      {
        id: "scheduler-marks-match-accepted-snapshot",
        provesBead: "am-rt-worker-scheduler-7tl",
        run: async (p) => {
          await openRuntimeFixture(p, `${server.url}/runtime-conformance.html#/runtime`);
          return checkSchedulerMarksMatchAcceptedSnapshot(p, "#placement-a");
        },
      },
      {
        id: "planted-mark-mismatch-fails",
        provesBead: "am-rt-worker-scheduler-7tl",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-mark-mismatch.broken.html`, {
            waitUntil: "domcontentloaded",
          });
          return checkPlantedMarkMismatchFails(p);
        },
      },
      {
        id: "planted-leaked-worker-fails",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-leaked-worker.broken.html`, {
            waitUntil: "domcontentloaded",
          });
          return checkPlantedLeakedWorkerFails(p);
        },
      },
      {
        id: "planted-randomness-nav-fails",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-randomness-nav.broken.html`, {
            waitUntil: "domcontentloaded",
          });
          await p.waitForSelector("[data-latent-draws]", { timeout: 5000 });
          return checkPlantedRandomnessFails(p);
        },
      },
      {
        id: "planted-stale-teardown-fails",
        provesBead: "am-rt-worker-protocol-gaq",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-stale-teardown.broken.html`, {
            waitUntil: "domcontentloaded",
          });
          return checkPlantedStaleTeardownFails(p);
        },
      },
    ];

    declared = assertions.length;
    for (const assertion of assertions) {
      ran += 1;
      const started = performance.now();
      const result = await assertion.run(page);
      const outcome = result.ok ? "passed" : "failed";
      if (!result.ok) failed += 1;
      // EVIDENCE ON FAILURE, WHICH THIS LOOP DID NOT CAPTURE. The logger refuses a failing
      // browser event that carries no screenshot and no DOM snapshot, so until now ANY failing
      // assertion ended the run with that refusal and exit 2 instead of a reported failure. No
      // assertion had ever failed, so nobody had reached the path; it surfaced the first time a
      // planted negative was made to fail on purpose (am-xyxk item 4). AGENTS.md requires the
      // failure-reporting path to be tested, and it could not have been from here.
      const evidence = result.ok ? undefined : await captureEvidence(page, logRunId, assertion.id);
      logger.log({
        testId: assertion.id,
        beadId: "am-rt-browser-conformance-09i5",
        instrumentId: "rt-01",
        outcome,
        durationMs: performance.now() - started,
        browser: "chromium",
        viewport: "desktop",
        jsEnabled: true,
        lane: "desktop",
        message: result.message,
        ...(evidence ? { evidence } : {}),
        extra: { assertionId: assertion.id, provesBead: assertion.provesBead },
      });
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
    logger.flushSync();
  }
  /*
    THE POPULATION, IN THE CENSUS'S ONE GRAMMAR (am-rc1001-bridge-plan-pcjk.9).

    This gate reported only PASS/FAIL per assertion and a log path, with no total, so a run that
    executed FEWER assertions than it declares looked identical to a complete one: nothing printed
    the denominator. An assertion list that lost an entry -- a filter, an early `break`, a
    conditional that stopped constructing one -- would have gone unnoticed, and every surviving
    assertion would still have reported PASS.

    `ran` is incremented inside the loop rather than read from `assertions.length`, so the number is
    what EXECUTED and not what was declared; the minimum is `assertions.length`, so the two
    disagreeing is exactly the condition that prints VACUOUS. A `break` on failure would show up
    here as well, which is worth knowing when reading a failing run.
  */
  const censusVacuous = reportPopulation({
    gate: "browser-acceptance",
    examined: ran,
    noun: "runtime conformance assertions",
    minimum: declared,
  });
  if (censusVacuous) {
    console.error(
      `RUNTIME_CONFORMANCE_POPULATION_BELOW_FLOOR: ${ran} of ${declared} declared ` +
        "assertions executed, so a clean result would be a statement about a population this run " +
        "does not have.",
    );
    return { ok: false, logPath: logger.filePath };
  }
  return { ok: failed === 0, logPath: logger.filePath };
}

/**
 * Retains what a reader needs to diagnose a failed assertion: the rendered page and its DOM.
 * Mirrors the canary branch, which was the only path that captured anything.
 */
async function captureEvidence(
  page: Page,
  logRunId: string,
  assertionId: string,
): Promise<Readonly<{ screenshot: string; dom: string }>> {
  const dir = resolve(
    "artifacts/test-logs/runtime-conformance",
    logRunId,
    "evidence",
    assertionId,
    "desktop",
  );
  await mkdir(dir, { recursive: true });
  const screenshot = resolve(dir, "screenshot.png");
  const dom = resolve(dir, "dom.html");
  await page.screenshot({ path: screenshot });
  await writeFile(dom, await page.content());
  return { screenshot, dom };
}

export async function writeCanaryPlaceholder(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "");
}
