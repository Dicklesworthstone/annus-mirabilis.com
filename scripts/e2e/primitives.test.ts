import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { type Browser, chromium } from "playwright";
import { bundleFixtureApps } from "./fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY } from "./fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "./fixtures/fixtureServer.ts";
import {
  enterDeepPassage,
  enterValue,
  openFoundation,
  operateInstrument,
  restoreFromUrl,
  returnToArgument,
  returnToSource,
  selectLinkedTerm,
  switchFace,
} from "./primitives.ts";

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");

test("primitives: executes vertical slice journey sequence against fixture section and selftest instrument", async () => {
  await bundleFixtureApps(FIXTURE_APP_REGISTRY);
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Enter deep passage at #s1-p2-s1
    await page.goto(`${server.url}/fixture-section.html#s1-p2-s1`);
    await page.waitForSelector("[data-reader-root]");

    // 2. Select linked term 'viscosity'
    await selectLinkedTerm(page, "viscosity");
    const termVisible = await page.locator('[data-active-term="viscosity"]').isVisible();
    assert.equal(termVisible, true);

    // 3. Switch reading face to parallel
    await switchFace(page, "parallel");
    const parallelView = await page.getAttribute("[data-reader-root]", "data-view");
    assert.equal(parallelView, "parallel");

    // 4. Return to source face
    await returnToSource(page);
    const sourceView = await page.getAttribute("[data-reader-root]", "data-view");
    assert.equal(sourceView, "source");

    // 5. Navigate to instrument page
    await page.goto(`${server.url}/harness-selftest.html?mode=apparatus`);
    await page.waitForSelector('[data-instrument-id="harness-selftest:apparatus"]');

    // 6. Operate instrument: enter value 42
    await operateInstrument(page, "harness-selftest:apparatus", async (laneActions) => {
      laneActions.type("42");
    });
    await enterValue(page, "selftest-input", "42");
    await page.waitForTimeout(50);

    const inputRev = await page.getAttribute(
      '[data-instrument-id="harness-selftest:apparatus"]',
      "data-input-revision",
    );
    assert.ok(Number(inputRev) >= 1);

    // 7. Restore from URL with ?tape=
    const shareLink = await page.getAttribute("#selftest-share-tape", "href");
    assert.ok(shareLink && shareLink.includes("tape="));
    await restoreFromUrl(page, `${server.url}/harness-selftest.html${shareLink}`);
    const restoredRoot = page.locator("[data-instrument-id]");
    assert.ok((await restoredRoot.count()) > 0);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
});
