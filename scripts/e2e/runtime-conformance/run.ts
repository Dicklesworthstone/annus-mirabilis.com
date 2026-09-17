/**
 * Live-class runtime-conformance runner (am-rt-browser-conformance-09i5).
 *
 *   bun scripts/e2e-paper-vertical-slices.ts --fixtures --journey runtime-conformance
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { getLogger, newRunIdentity } from "../../../src/testing/log/logger.ts";
import { bundleFixtureApp } from "../fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY } from "../fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "../fixtures/fixtureServer.ts";
import {
  type CheckResult,
  checkNoLeakedWorkers,
  checkObserverChangePreservesWorld,
  checkPlantedLeakedWorkerFails,
  checkPlantedRandomnessFails,
  checkPlantedStaleTeardownFails,
  checkRouteTransitionDoesNotAdvanceRandomness,
  checkSnapshotIdentityAcrossViews,
  checkStaleAfterTeardownRejected,
  checkTwoPlacementsIndependent,
} from "./checks.ts";
import { assertRuntimeRegistration } from "./fixtureRegistration.ts";

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
        id: "two-placements-independent",
        provesBead: "am-rt-snapshot-store-aft",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkTwoPlacementsIndependent(p);
        },
      },
      {
        id: "snapshot-identity-across-views",
        provesBead: "am-rt-snapshot-store-aft",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkSnapshotIdentityAcrossViews(p, "#placement-a");
        },
      },
      {
        id: "observer-change-preserves-world",
        provesBead: "am-rt-command-classes-dzp",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkObserverChangePreservesWorld(p);
        },
      },
      {
        id: "teardown-no-leaked-workers",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkNoLeakedWorkers(p);
        },
      },
      {
        id: "route-transition-does-not-advance-randomness",
        provesBead: "am-rt-memory-lifecycle-5ws",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkRouteTransitionDoesNotAdvanceRandomness(p);
        },
      },
      {
        id: "stale-after-teardown-rejected",
        provesBead: "am-rt-worker-protocol-gaq",
        run: async (p) => {
          await p.goto(`${server.url}/runtime-conformance.html#/runtime`);
          await waitReady(p);
          return checkStaleAfterTeardownRejected(p);
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

    for (const assertion of assertions) {
      const started = performance.now();
      const result = await assertion.run(page);
      const outcome = result.ok ? "passed" : "failed";
      if (!result.ok) failed += 1;
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
        extra: { assertionId: assertion.id, provesBead: assertion.provesBead },
      });
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
    logger.flushSync();
  }
  return { ok: failed === 0, logPath: logger.filePath };
}

export async function writeCanaryPlaceholder(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "");
}
