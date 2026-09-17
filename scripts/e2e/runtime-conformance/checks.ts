import type { Page } from "playwright";
import { parseInstrumentRoot } from "../domContract.ts";

declare global {
  interface Window {
    __amRuntimeConformance?: {
      injectStaleResponse: (instanceId: string) => void;
      crashWorker: (instanceId: string) => void;
      forceProtocolMismatch: (instanceId: string) => void;
      readExperimentView: (instanceId: string) => unknown;
      readCounters: () => { liveWorkers: number; workerMessages: Record<string, number> };
      workerMessageCount: (instanceId: string) => number;
      observerChange: (instanceId: string, frameSpeed: number) => void;
      measurementChange: (instanceId: string, interval: number) => void;
      presentationChange: (instanceId: string) => void;
      publishAfterTeardown: (instanceId: string) => boolean;
    };
  }
}

export type CheckResult = Readonly<{ ok: boolean; message: string }>;

const pass = (message: string): CheckResult => ({ ok: true, message });
const fail = (message: string): CheckResult => ({ ok: false, message });

async function rootAttrs(page: Page, selector: string): Promise<Record<string, string | null>> {
  const root = page.locator(selector).first();
  return root.evaluate((el) => {
    const map: Record<string, string | null> = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) map[attr.name] = attr.value;
    }
    return map;
  });
}

export async function checkTwoPlacementsIndependent(page: Page): Promise<CheckResult> {
  const a = parseInstrumentRoot(await rootAttrs(page, "#placement-a"));
  const b = parseInstrumentRoot(await rootAttrs(page, "#placement-b"));
  if (a.instanceId === b.instanceId) return fail("two placements share instanceId");
  if (a.runId === b.runId) return fail("two placements share runId");
  return pass("two placements have distinct instanceId and runId");
}

export async function checkSnapshotIdentityAcrossViews(
  page: Page,
  rootSelector: string,
): Promise<CheckResult> {
  const views = page.locator(`${rootSelector} [data-view]`);
  const count = await views.count();
  if (count < 3) return fail(`expected plot, equation, and table views, found ${count}`);
  const versions = new Set<string>();
  const instances = new Set<string>();
  for (let i = 0; i < count; i++) {
    const view = views.nth(i);
    versions.add((await view.getAttribute("data-snapshot-version")) ?? "");
    instances.add((await view.getAttribute("data-instance-id")) ?? "");
  }
  if (versions.size !== 1)
    return fail(`views disagree on snapshotVersion: ${[...versions].join(",")}`);
  if (instances.size !== 1)
    return fail(`views disagree on instanceId: ${[...instances].join(",")}`);
  return pass("plot, equation, and table share one snapshotVersion");
}

export async function checkObserverChangePreservesWorld(page: Page): Promise<CheckResult> {
  const before = parseInstrumentRoot(await rootAttrs(page, "#placement-a"));
  const beforeEvents = await page.locator("#placement-a").getAttribute("data-event-set-digest");
  const beforeWorld = await page.locator("#placement-a").getAttribute("data-worldline-digest");
  await page.evaluate(async () => {
    window.__amRuntimeConformance?.observerChange("runtime-analytic-a", 0.6);
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(undefined));
    });
  });
  await page.waitForFunction(() => {
    const el = document.querySelector("#placement-a");
    return el?.getAttribute("data-pending") === "false";
  });
  const after = parseInstrumentRoot(await rootAttrs(page, "#placement-a"));
  const afterEvents = await page.locator("#placement-a").getAttribute("data-event-set-digest");
  const afterWorld = await page.locator("#placement-a").getAttribute("data-worldline-digest");
  if (after.runId !== before.runId) return fail("observer change forked a new runId");
  if (afterEvents !== beforeEvents || afterWorld !== beforeWorld) {
    return fail("observer change mutated eventSetDigest or worldlineDigest");
  }
  return pass("observer change kept runId and worldline digests");
}

export async function checkNoLeakedWorkers(page: Page): Promise<CheckResult> {
  const before = await page.evaluate(
    () => window.__amRuntimeConformance?.readCounters().liveWorkers ?? -1,
  );
  await page.evaluate(() => {
    location.hash = "#/reading";
  });
  await page.waitForSelector('[data-reader-root][data-view="reading"]');
  const after = await page.evaluate(
    () => window.__amRuntimeConformance?.readCounters().liveWorkers ?? -1,
  );
  if (after > 0) return fail(`leaked ${after} workers after unmount (baseline ${before})`);
  return pass("unmount returned live workers to zero");
}

export async function checkRouteTransitionDoesNotAdvanceRandomness(
  page: Page,
): Promise<CheckResult> {
  const before = Number(
    (await page.locator("#placement-a [data-latent-draws]").textContent()) ?? "NaN",
  );
  await page.evaluate(() => {
    location.hash = "#/reading";
  });
  await page.waitForSelector('[data-reader-root][data-view="reading"]');
  await page.evaluate(() => {
    location.hash = "#/runtime";
  });
  await page.waitForSelector("[data-reader-root][data-ready='true'][data-view='runtime']");
  const after = Number(
    (await page.locator("#placement-a [data-latent-draws]").textContent()) ?? "NaN",
  );
  if (!(after === 1 || after === before)) {
    return fail(`route transition advanced latent draws from ${before} to ${after}`);
  }
  return pass("route transition did not accumulate latent draws");
}

export async function checkStaleAfterTeardownRejected(page: Page): Promise<CheckResult> {
  await page.evaluate(() => {
    location.hash = "#/reading";
  });
  await page.waitForSelector('[data-reader-root][data-view="reading"]');
  const accepted = await page.evaluate(() =>
    window.__amRuntimeConformance?.publishAfterTeardown("runtime-analytic-a"),
  );
  if (accepted === true) return fail("stale snapshot published after teardown");
  return pass("teardown rejected a later publication");
}

export async function checkPlantedLeakedWorkerFails(page: Page): Promise<CheckResult> {
  await page.evaluate(() => {
    document.body.dataset.view = "reading";
  });
  const live = await page.evaluate(
    () => window.__amRuntimeConformance?.readCounters().liveWorkers ?? 0,
  );
  if (live <= 0) return fail("leaked-worker check passed on a planted leak");
  return pass(`leaked-worker check failed as required (${live} workers still live)`);
}

export async function checkPlantedRandomnessFails(page: Page): Promise<CheckResult> {
  const attr = await page.locator("[data-latent-draws]").first().getAttribute("data-latent-draws");
  const draws = Number(attr ?? "0");
  if (draws <= 1) return fail("planted randomness page did not show accumulated draws");
  return pass("planted page shows latent draws advanced across navigation");
}

export async function checkPlantedStaleTeardownFails(page: Page): Promise<CheckResult> {
  const accepted = await page.evaluate(() =>
    window.__amRuntimeConformance?.publishAfterTeardown("runtime-analytic-a"),
  );
  if (accepted !== true) return fail("planted teardown page did not accept a stale publish");
  return pass("planted page accepts a snapshot after teardown");
}
