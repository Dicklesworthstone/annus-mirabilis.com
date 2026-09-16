/**
 * Journey Contract Primitives for the browser acceptance harness
 * (am-test-e2e-harness-bqmh requirement 4).
 *
 * Each primitive waits on the semantic DOM contract, never on fixed sleeps.
 * Operates through lane actions and parses instrument addresses via domContract.ts.
 */

import type { Page } from "playwright";
import { parseInstrumentAddress } from "./domContract.ts";
import { createLaneActions, type LaneActions, type LaneDefinition } from "./lanes.ts";

export interface PrimitiveOptions {
  timeoutMs?: number;
  lane?: LaneDefinition;
}

/**
 * Enters a deep source passage on a paper route and waits for the reader root
 * to be ready and the requested anchor to be present in DOM.
 */
export async function enterDeepPassage(
  page: Page,
  paper: string,
  anchor: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  const targetUrl = `/paper/${paper}#${anchor}`;
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: options.timeoutMs ?? 15000,
  });
  await page.waitForSelector(`[data-reader-root]`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
  await page.waitForSelector(`[data-anchor="${anchor}"], #${anchor}`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Switches the reading face (e.g. parallel, translation, gloss, facsimile)
 * and waits for the reader root's data-view attribute to reflect the change.
 */
export async function switchFace(
  page: Page,
  view: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  const switchLink = page.locator(`a[href*="view=${view}"]`).first();
  if ((await switchLink.count()) > 0) {
    await switchLink.click();
  } else {
    const currentUrl = new URL(page.url());
    currentUrl.searchParams.set("view", view);
    await page.goto(currentUrl.toString(), { waitUntil: "domcontentloaded" });
  }
  await page.waitForSelector(`[data-reader-root][data-view="${view}"]`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Opens a foundation concept drawer/link and waits for the foundation content.
 */
export async function openFoundation(
  page: Page,
  concept: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  const foundationLink = page
    .locator(`[data-foundation="${concept}"], a[href*="/foundations/${concept}"]`)
    .first();
  await foundationLink.click();
  await page.waitForSelector(`[data-foundation="${concept}"], [data-concept="${concept}"]`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Returns from a foundation or side journey back to the argument anchor.
 */
export async function returnToArgument(
  page: Page,
  argumentAnchor = "argument-anchor",
  options: PrimitiveOptions = {},
): Promise<void> {
  const returnBtn = page
    .locator(`[data-action="return-to-argument"], a[href*="#${argumentAnchor}"]`)
    .first();
  if ((await returnBtn.count()) > 0) {
    await returnBtn.click();
  }
  await page.waitForSelector(`[data-anchor="${argumentAnchor}"], #${argumentAnchor}`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Locates an instrument root by bare catalogue id or mode address,
 * resolves it via parseInstrumentAddress, and executes the provided actions.
 */
export async function operateInstrument(
  page: Page,
  idOrAddress: string,
  actions: (laneActions: LaneActions) => Promise<void> | void,
  options: PrimitiveOptions = {},
): Promise<void> {
  const parsed = parseInstrumentAddress(idOrAddress);
  const selector = `[data-instrument-id="${parsed.raw}"]`;
  await page.waitForSelector(selector, { state: "attached", timeout: options.timeoutMs ?? 15000 });

  const delegate = {
    press: (key: string) => {
      void page.keyboard.press(key);
    },
    type: (text: string) => {
      void page.keyboard.type(text);
    },
    click: () => {
      void page.click(selector);
    },
    drag: () => {
      void page.mouse.down();
      void page.mouse.up();
    },
  };

  const lane = options.lane ?? {
    name: "default",
    description: "Default desktop",
    browser: "chromium",
    viewport: { width: 1440, height: 900 },
  };

  const laneActions = createLaneActions(lane, delegate);
  await actions(laneActions);
}

/**
 * Types a value into an input control with semantic waiting.
 */
export async function enterValue(
  page: Page,
  controlId: string,
  text: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  const input = page
    .locator(`#${controlId}, [data-control-id="${controlId}"], input[name="${controlId}"]`)
    .first();
  await input.waitFor({ state: "visible", timeout: options.timeoutMs ?? 15000 });
  await input.fill(text);
  await input.dispatchEvent("change");
}

/**
 * Selects a linked term in the text and waits for its term details to open.
 */
export async function selectLinkedTerm(
  page: Page,
  termId: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  const termEl = page.locator(`[data-term-id="${termId}"]`).first();
  await termEl.waitFor({ state: "visible", timeout: options.timeoutMs ?? 15000 });
  await termEl.click();
  await page.waitForSelector(`[data-active-term="${termId}"], #term-details-${termId}`, {
    state: "visible",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Returns to the source face and waits for data-view="source".
 */
export async function returnToSource(page: Page, options: PrimitiveOptions = {}): Promise<void> {
  const returnBtn = page.locator(`a[href*="view=source"], #return-to-source-btn`).first();
  if ((await returnBtn.count()) > 0) {
    await returnBtn.click();
  } else {
    const currentUrl = new URL(page.url());
    currentUrl.searchParams.set("view", "source");
    await page.goto(currentUrl.toString(), { waitUntil: "domcontentloaded" });
  }
  await page.waitForSelector(`[data-reader-root][data-view="source"]`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}

/**
 * Restores page state from a deep-link URL containing query state (e.g. ?tape=...).
 */
export async function restoreFromUrl(
  page: Page,
  url: string,
  options: PrimitiveOptions = {},
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? 15000 });
  await page.waitForSelector(`[data-reader-root]`, {
    state: "attached",
    timeout: options.timeoutMs ?? 15000,
  });
}
