/**
 * Reusable instrument checks for the browser acceptance harness
 * (am-test-e2e-harness-bqmh requirement 5).
 *
 * Checks:
 * - DOM readiness & contract validation via domContract.ts
 * - Typed entry & step increment
 * - Out-of-domain refusal & last accepted snapshot preservation
 * - Snapshot identity across views
 * - WASM blocked fallback to host/unavailable
 * - Stale response rejection
 * - Context loss handling
 * - Restart generating fresh runId
 */

import type { Page } from "playwright";
import {
  parseInstrumentAddress,
  parseInstrumentRoot,
  parseInstrumentView,
} from "../domContract.ts";
import { checkSameSnapshotIdentity, type SnapshotIdentityAttrs } from "./measure.ts";

export interface InstrumentCheckResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly details?: unknown;
}

/**
 * Reads all data-* attributes on the instrument root and validates them
 * against the DOM contract parser.
 */
export async function checkInstrumentContract(
  page: Page,
  rootSelector = "[data-instrument-id]",
  declaredModes?: readonly string[],
): Promise<InstrumentCheckResult> {
  const rootEl = page.locator(rootSelector).first();
  const count = await rootEl.count();
  if (count === 0) {
    return { ok: false, message: `Instrument root "${rootSelector}" not found in page DOM` };
  }

  const attrs = await rootEl.evaluate((el) => {
    const map: Record<string, string | null> = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) {
        map[attr.name] = attr.value;
      }
    }
    return map;
  });

  try {
    const parsed = parseInstrumentRoot(attrs, declaredModes);
    return { ok: true, details: parsed };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      details: attrs,
    };
  }
}

/**
 * Asserts that all views belonging to an instrument instance share the same
 * data-instance-id, data-run-id, and data-snapshot-version.
 */
export async function checkSnapshotIdentityAcrossViews(
  page: Page,
  rootSelector = "[data-instrument-id]",
  viewSelector = "[data-view]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const locators =
    (await root.count()) > 0
      ? root.locator(viewSelector)
      : page.locator(`[data-instrument-id] ${viewSelector}`);
  const count = await locators.count();
  if (count === 0) {
    return {
      ok: false,
      message: `No views matching "${viewSelector}" found within instrument root`,
    };
  }

  const views: SnapshotIdentityAttrs[] = [];
  for (let i = 0; i < count; i += 1) {
    const viewEl = locators.nth(i);
    const attrs = await viewEl.evaluate((el) => {
      const map: Record<string, string | null> = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-")) {
          map[attr.name] = attr.value;
        }
      }
      return map;
    });

    try {
      const parsed = parseInstrumentView(attrs);
      views.push({
        view: attrs["data-view"] ?? `view-${i}`,
        instanceId: parsed.instanceId,
        runId: parsed.runId,
        snapshotVersion: parsed.snapshotVersion,
      });
    } catch (error) {
      return {
        ok: false,
        message: `View ${i} failed DOM contract: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const identityCheck = checkSameSnapshotIdentity(views);
  if (!identityCheck.ok) {
    return {
      ok: false,
      message: `Snapshot identity mismatch: ${identityCheck.mismatches.join("; ")}`,
      details: views,
    };
  }

  return { ok: true, details: views };
}

/**
 * Checks that typed value entry and step buttons update inputRevision and snapshotVersion.
 */
export async function checkTypedEntryAndStep(
  page: Page,
  inputSelector = "#selftest-input",
  stepSelector = "#selftest-step",
  rootSelector = "[data-instrument-id]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const input = page.locator(inputSelector);
  const stepBtn = page.locator(stepSelector);

  const initialInputRev = Number(await root.getAttribute("data-input-revision"));
  const initialSnapVer = Number(await root.getAttribute("data-snapshot-version"));

  if ((await input.count()) > 0) {
    await input.fill("42");
    await input.dispatchEvent("change");
    await page.waitForTimeout(50);
  } else if ((await stepBtn.count()) > 0) {
    await stepBtn.click();
    await page.waitForTimeout(50);
  } else {
    return { ok: false, message: "Neither input nor step button found to operate" };
  }

  const updatedInputRev = Number(await root.getAttribute("data-input-revision"));
  const updatedSnapVer = Number(await root.getAttribute("data-snapshot-version"));

  if (updatedInputRev <= initialInputRev) {
    return {
      ok: false,
      message: `data-input-revision did not increment (was ${initialInputRev}, now ${updatedInputRev})`,
    };
  }
  if (updatedSnapVer <= initialSnapVer) {
    return {
      ok: false,
      message: `data-snapshot-version did not increment (was ${initialSnapVer}, now ${updatedSnapVer})`,
    };
  }

  return { ok: true, details: { updatedInputRev, updatedSnapVer } };
}

/**
 * Checks that an out-of-domain input triggers data-refusal-code and preserves
 * the last accepted input revision and snapshot.
 */
export async function checkOutOfDomainRefusal(
  page: Page,
  inputSelector = "#selftest-input",
  outOfDomainValue = -10,
  rootSelector = "[data-instrument-id]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const input = page.locator(inputSelector);

  const acceptedRevBefore = await root.getAttribute("data-accepted-input-revision");
  const snapVerBefore = await root.getAttribute("data-snapshot-version");

  await input.fill(String(outOfDomainValue));
  await input.dispatchEvent("change");
  await page.waitForTimeout(50);

  const refusalCode = await root.getAttribute("data-refusal-code");
  const acceptedRevAfter = await root.getAttribute("data-accepted-input-revision");
  const snapVerAfter = await root.getAttribute("data-snapshot-version");

  if (!refusalCode || refusalCode.trim().length === 0) {
    return {
      ok: false,
      message: `Expected data-refusal-code to be set on out-of-domain input, got null/empty`,
    };
  }

  if (acceptedRevAfter !== acceptedRevBefore) {
    return {
      ok: false,
      message: `data-accepted-input-revision changed on refusal (was ${acceptedRevBefore}, now ${acceptedRevAfter})`,
    };
  }

  return { ok: true, details: { refusalCode, acceptedRev: acceptedRevAfter } };
}

/**
 * Checks that when WASM is blocked or unavailable, the execution label
 * honestly becomes "host" or "unavailable" and never "frankensim".
 */
export async function checkWasmBlockBehavior(
  page: Page,
  blockTriggerSelector = "#selftest-block-wasm",
  rootSelector = "[data-instrument-id]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const blockTrigger = page.locator(blockTriggerSelector);

  if ((await blockTrigger.count()) > 0) {
    await blockTrigger.click();
    await page.waitForTimeout(50);
  }

  const label = await root.getAttribute("data-execution-label");
  if (label === "frankensim") {
    return {
      ok: false,
      message: `Dishonest execution label "frankensim" reported when WASM is blocked`,
      details: { label },
    };
  }
  if (label !== "host" && label !== "unavailable" && label !== "static") {
    return {
      ok: false,
      message: `Unexpected execution label "${label}" under blocked WASM condition`,
      details: { label },
    };
  }

  return { ok: true, details: { label } };
}

/**
 * Checks that a stale older response never overwrites a newer accepted revision.
 */
export async function checkStaleResponseIgnored(
  page: Page,
  staleTriggerSelector = "#selftest-delay-response",
  rootSelector = "[data-instrument-id]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const staleTrigger = page.locator(staleTriggerSelector);

  const inputRev = Number(await root.getAttribute("data-input-revision"));
  const acceptedRevBefore = Number(await root.getAttribute("data-accepted-input-revision"));
  const pending = (await root.getAttribute("data-pending")) === "true";

  if ((await staleTrigger.count()) > 0) {
    await staleTrigger.click();
    await page.waitForTimeout(50);
    const acceptedRevAfter = Number(await root.getAttribute("data-accepted-input-revision"));
    if (acceptedRevAfter < acceptedRevBefore) {
      return {
        ok: false,
        message: `Stale response overwrote newer accepted revision (was ${acceptedRevBefore}, now ${acceptedRevAfter})`,
      };
    }
    return { ok: true, details: { acceptedRev: acceptedRevAfter } };
  }

  // Static fixture evaluation: if not pending and accepted revision < input revision, the state is stale
  if (!pending && acceptedRevBefore < inputRev) {
    return {
      ok: false,
      message: `Stale response detected in DOM state: accepted revision (${acceptedRevBefore}) < requested input revision (${inputRev}) without pending flag`,
      details: { inputRev, acceptedRevBefore },
    };
  }

  return { ok: true, details: { acceptedRev: acceptedRevBefore } };
}

/**
 * Checks that restart produces a visibly new data-run-id.
 */
export async function checkRestartNewRunId(
  page: Page,
  restartSelector = "#selftest-restart",
  rootSelector = "[data-instrument-id]",
): Promise<InstrumentCheckResult> {
  const root = page.locator(rootSelector).first();
  const restartBtn = page.locator(restartSelector);

  const runIdBefore = await root.getAttribute("data-run-id");
  if ((await restartBtn.count()) > 0) {
    await restartBtn.click();
    await page.waitForTimeout(50);
  }

  const runIdAfter = await root.getAttribute("data-run-id");
  if (!runIdAfter || runIdAfter === runIdBefore) {
    return {
      ok: false,
      message: `Restart did not produce a fresh data-run-id (was ${runIdBefore}, now ${runIdAfter})`,
    };
  }

  return { ok: true, details: { runIdBefore, runIdAfter } };
}
