import type { Page } from "playwright";
import { parseInstrumentRoot } from "../domContract.ts";
import { missingIdentityAttribute } from "./identityReader.ts";
import { classifyNetworkRequest, type NetworkKind } from "./networkLogClassifier.ts";
import { readSchedulerMark } from "./performanceMarkReader.ts";
import { seedFromTapeUrl, tapeUrlWithSeed } from "./tapeUrlBuilder.ts";

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

/**
 * parseInstrumentRoot, with a DomContractError turned into a NAMED CHECK FAILURE (am-xyxk).
 *
 * This file had no try/catch anywhere, so a root missing a required data attribute threw out of
 * whichever check was parsing it and took the whole conformance run with it. A reader of the output
 * then saw a crash where the harness should have said which attribute was absent on which placement,
 * and the run's remaining checks never executed. missingIdentityAttribute was written for exactly
 * this and nothing called it: it is the one export of identityReader.ts that is not a pass-through to
 * parseInstrumentRoot, and it turns the error into the name of the attribute that was missing.
 *
 * Returning a CheckResult rather than throwing a tidier error is the point: a missing attribute is a
 * conformance FAILURE of the page, not a fault in the harness, so it belongs in the same channel as
 * every other failing check.
 */
function identityOrFailure(
  attrs: Record<string, string | null>,
  selector: string,
):
  | { ok: true; identity: ReturnType<typeof parseInstrumentRoot> }
  | { ok: false; failure: CheckResult } {
  try {
    return { ok: true, identity: parseInstrumentRoot(attrs) };
  } catch (error) {
    const attribute = missingIdentityAttribute(error);
    return {
      ok: false,
      failure: fail(
        attribute === undefined
          ? `${selector} does not satisfy the instrument root contract: ${error instanceof Error ? error.message : String(error)}`
          : `${selector} is missing the required root attribute ${attribute}`,
      ),
    };
  }
}

export async function checkTwoPlacementsIndependent(page: Page): Promise<CheckResult> {
  const aRead = identityOrFailure(await rootAttrs(page, "#placement-a"), "#placement-a");
  if (!aRead.ok) return aRead.failure;
  const bRead = identityOrFailure(await rootAttrs(page, "#placement-b"), "#placement-b");
  if (!bRead.ok) return bRead.failure;
  const a = aRead.identity;
  const b = bRead.identity;
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
  const beforeRead = identityOrFailure(await rootAttrs(page, "#placement-a"), "#placement-a");
  if (!beforeRead.ok) return beforeRead.failure;
  const before = beforeRead.identity;
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
  const afterRead = identityOrFailure(await rootAttrs(page, "#placement-a"), "#placement-a");
  if (!afterRead.ok) return afterRead.failure;
  const after = afterRead.identity;
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

/**
 * The scheduler's own telemetry must describe the snapshot the page is displaying
 * (am-xyxk item 4). `src/workers/scheduler/scheduler.ts` calls markInput at dispatch and
 * markAccepted at publication, and the runtime fixture drives that real scheduler, so an
 * `am:accepted` mark carrying { instanceId, actionIndex, snapshotVersion } is present in the
 * page during a conformance run - measured live before this check was written: four marks after
 * load, and am:accepted for runtime-analytic-a naming snapshotVersion 1 beside a DOM reporting 1.
 *
 * ASSERTING THAT A MARK EXISTS WOULD PROVE NOTHING. The property is agreement: a mark naming a
 * different instance, or a stale snapshotVersion, means the telemetry a reader or a profile
 * would trust is describing a state the page is not in. runtime-mark-mismatch.broken.html plants
 * exactly that and checkPlantedMarkMismatchFails confirms it is caught.
 */
export async function checkSchedulerMarksMatchAcceptedSnapshot(
  page: Page,
  selector: string,
): Promise<CheckResult> {
  const raw = await page.evaluate(() =>
    performance
      .getEntriesByType("mark")
      .filter((entry) => entry.name === "am:accepted")
      .map((entry) => ({
        name: entry.name,
        detail: ((entry as PerformanceMark).detail ?? {}) as Record<string, unknown>,
      })),
  );
  if (raw.length === 0) return fail("the scheduler emitted no am:accepted mark during this run");

  const root = page.locator(selector).first();
  const instanceId = await root.getAttribute("data-instance-id");
  const snapshotVersion = await root.getAttribute("data-snapshot-version");
  if (!instanceId || snapshotVersion === null) {
    return fail(`${selector} publishes no instance identity to compare a mark against`);
  }

  // readSchedulerMark REFUSES a detail missing any of the three fields. Caught rather than left
  // to propagate: checks.ts has no error handling anywhere, so an unhandled refusal here would
  // end the run with a stack trace instead of naming the mark that was malformed.
  let accepted: ReturnType<typeof readSchedulerMark>[];
  try {
    accepted = raw.map((mark) => readSchedulerMark(mark));
  } catch (error) {
    return fail(`an am:accepted mark was malformed: ${(error as Error).message}`);
  }

  const forInstance = accepted.filter((mark) => mark.instanceId === instanceId);
  if (forInstance.length === 0) {
    return fail(
      `no am:accepted mark names ${instanceId}; the scheduler marked ${[...new Set(accepted.map((m) => m.instanceId))].join(", ")}`,
    );
  }
  const latest = forInstance[forInstance.length - 1] as ReturnType<typeof readSchedulerMark>;
  if (String(latest.snapshotVersion) !== snapshotVersion) {
    return fail(
      `am:accepted for ${instanceId} names snapshotVersion ${latest.snapshotVersion} while the page displays ${snapshotVersion}`,
    );
  }
  return pass(
    `am:accepted for ${instanceId} agrees with the displayed snapshotVersion ${snapshotVersion}`,
  );
}

/** The planted page: a well-formed mark that names a version the page is not showing. */
export async function checkPlantedMarkMismatchFails(page: Page): Promise<CheckResult> {
  const result = await checkSchedulerMarksMatchAcceptedSnapshot(page, "#placement-a");
  if (result.ok) return fail("planted mark-mismatch page was accepted by the mark check");
  if (!result.message.includes("snapshotVersion 7")) {
    return fail(`planted page failed for the wrong reason: ${result.message}`);
  }
  return pass("planted page's am:accepted mark disagrees with its displayed snapshot, as required");
}

/**
 * WHAT THE PAGE FETCHES ON ARRIVAL, CLASSIFIED (am-xyxk, am-1nnj's sibling finding).
 *
 * `classifyNetworkRequest` sat in this directory with no caller: nothing watched the network during a
 * conformance run, and this file had zero references to network or fetch. The property worth asserting
 * is one the master plan states as design rather than as hope: on arrival an instrument shows its
 * static worked example and fetches NO WASM. A reader on a slow connection pays for that promise, and
 * nothing checked it anywhere in the browser lane.
 *
 * NON-VACUITY IS THE FIXTURE'S OWN DOING, which is why this check is worth having here rather than
 * against a page that could not fetch wasm if it tried. RUNTIME_FIXTURE_ENTRY serves
 * fs-annus-diffusion/.../fs_annus_diffusion_bg.wasm and public/wasm/manifest.json, so a wasm request
 * is available to be made and the app declining to make one is a fact about the app. A check that no
 * wasm arrives where none is servable would pass for ever and mean nothing.
 *
 * The collector is attached BEFORE navigation and returns a reader, because a listener added after
 * goto misses exactly the requests the arrival contract is about.
 */
export type ObservedRequest = Readonly<{ url: string; kind: NetworkKind }>;

export function recordNetworkKinds(page: Page): () => readonly ObservedRequest[] {
  const seen: ObservedRequest[] = [];
  page.on("request", (request) => {
    const url = request.url();
    seen.push({ url, kind: classifyNetworkRequest(url) });
  });
  return () => seen;
}

/**
 * The predicate, separated from the page so it is testable without a browser: no wasm, and something
 * was actually observed. An empty list is a FAILURE rather than a pass, because a page that fetched
 * nothing at all did not load and would otherwise satisfy "no wasm" perfectly.
 */
export function noWasmOnArrival(seen: readonly ObservedRequest[]): CheckResult {
  if (seen.length === 0) {
    return fail(
      "no requests were observed at all, so the page did not load and nothing was checked",
    );
  }
  const wasm = seen.filter((r) => r.kind === "wasm");
  if (wasm.length > 0) {
    return fail(
      `arrival fetched ${wasm.length} wasm request(s): ${wasm.map((r) => r.url).join(", ")}`,
    );
  }
  const page = seen.filter((r) => r.kind === "page").length;
  return pass(
    `arrival fetched ${seen.length} request(s), ${page} of them page assets, and no wasm`,
  );
}

export function checkNoWasmOnArrival(seen: readonly ObservedRequest[]): CheckResult {
  return noWasmOnArrival(seen);
}

/**
 * A SEED ABOVE 2^53 SURVIVES THE URL AND REACHES THE ACCEPTED SNAPSHOT (am-xyxk).
 *
 * tapeUrlBuilder sat here with no caller: nothing exercised a tape seed URL during a conformance run.
 * The runtime contract says a seed is an unsigned 64-bit value carried as a canonical decimal string,
 * because JavaScript's safe-integer range ends at 2^53 - 1, and it asks for a URL round trip that
 * identifies the same stream after reload. A seed that went through a double would come back changed
 * in its last digits and look entirely plausible.
 *
 * The seed used is 2^64 - 1, the largest the contract admits, which is 18446744073709551615 and is
 * 2048 away from the nearest double. If any layer converted it to a number and back the attribute
 * would read 18446744073709551616 instead, so this check cannot pass by accident.
 *
 * seedFromTapeUrl is used to read the seed back out of the URL the builder made, so the two halves of
 * that module are checked against each other rather than one of them being trusted.
 */
export async function checkLargeSeedSurvivesUrlRoundTrip(
  page: Page,
  basePath: string,
): Promise<CheckResult> {
  const seed = "18446744073709551615";
  const url = tapeUrlWithSeed(basePath, seed);
  const inUrl = seedFromTapeUrl(url);
  if (inUrl !== seed) {
    return fail(`the built url carries seed ${String(inUrl)} rather than ${seed}`);
  }
  await page.goto(url);
  await page.waitForSelector('[data-reader-root][data-ready="true"]', { timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("#placement-a");
    return el?.getAttribute("data-pending") === "false";
  });
  const accepted = await page.locator("#placement-a").getAttribute("data-seed");
  if (accepted === null) {
    return fail("#placement-a exposes no data-seed, so the accepted seed cannot be compared");
  }
  if (accepted !== seed) {
    return fail(`the accepted seed is ${accepted}, not the ${seed} the url carried`);
  }
  return pass(`a seed of ${seed}, above 2^53, reached the accepted snapshot unchanged`);
}
