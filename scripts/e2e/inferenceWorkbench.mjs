import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// The actual built route. No replacement DOM, owner, generated example, or runtime.
const url = new URL("/lab/what-can-you-infer/", process.env.BASE_URL ?? "http://127.0.0.1:3000")
  .href;
const directory = resolve("artifacts/browser/inference-workbench");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-infer-workbench][data-ready="true"]');
      page.on("request", (request) => requests.push(request.url()));
      const radius = page.locator('[data-infer-case="radius"]'),
        camera = page.locator('[data-infer-case="camera"]');
      const a = radius.locator("[data-infer-results]"),
        b = camera.locator("[data-infer-results]");
      const run = await radius.getAttribute("data-run-id"),
        digest = await radius.getAttribute("data-observation-digest");
      assert.equal(
        await a.locator('[data-output="molecularInterval"]').getAttribute("data-result-status"),
        "underdetermined",
      );
      await radius
        .getByRole("button", { name: "Use the synthetic worked radius", exact: true })
        .click();
      assert.notEqual(
        await a.locator('[data-output="molecularInterval"]').getAttribute("data-lower"),
        null,
      );
      assert.equal(await radius.getAttribute("data-run-id"), run);
      assert.equal(await radius.getAttribute("data-observation-digest"), digest);
      const version = await radius.getAttribute("data-snapshot-version");
      await radius.getByLabel("Radius point value (μm)", { exact: true }).fill("-1");
      await radius.getByRole("button", { name: "Apply independent radius", exact: true }).click();
      assert.equal(await radius.getAttribute("data-snapshot-version"), version);
      assert.equal(await radius.getByRole("alert").isVisible(), true);
      await radius.getByLabel("Radius point value (μm)", { exact: true }).fill("0.5");
      await radius.getByLabel("Declared radius interval coverage (%)", { exact: true }).fill("95");
      await radius.getByRole("button", { name: "Apply independent radius", exact: true }).click();
      assert.equal(
        await a.locator('[data-output="molecularInterval"]').getAttribute("data-result-status"),
        "not-applicable",
      );
      await radius.getByRole("button", { name: "Remove radius information", exact: true }).click();
      assert.equal(
        await a.locator('[data-output="molecularInterval"]').getAttribute("data-result-status"),
        "underdetermined",
      );
      const variance = await b.locator('[data-output="sampleVariance"]').getAttribute("data-value");
      const cameraRun = await camera.getAttribute("data-run-id");
      await camera.getByLabel("Add neighboring covariance", { exact: true }).focus();
      await page.keyboard.press("Space");
      assert.notEqual(
        await b.locator('[data-output="diffusionEstimate"]').getAttribute("data-value"),
        null,
      );
      assert.equal(
        await b
          .locator('[data-output="diffusionConfidenceInterval"]')
          .getAttribute("data-result-status"),
        "not-applicable",
      );
      await camera.getByLabel("Add variance at twice the spacing", { exact: true }).check();
      assert.notEqual(
        await b.locator('[data-output="secondVariance"]').getAttribute("data-value"),
        null,
      );
      assert.equal(
        await b.locator('[data-output="sampleVariance"]').getAttribute("data-value"),
        variance,
      );
      assert.equal(await camera.getAttribute("data-run-id"), cameraRun);
      await b.locator('[data-preserve-detail="camera-family"] summary').click();
      assert.equal(await b.locator('[data-preserve-detail="camera-family"] tbody tr').count(), 41);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      await page.screenshot({ path: resolve(directory, `workbench-${width}.png`), fullPage: true });
      results.push({
        width,
        passed: true,
        checks: [
          "fixed-data",
          "conditional-interval",
          "refusal-retention",
          "coverage-not-inflated",
          "covariance",
          "second-spacing",
          "keyboard",
          "table",
          "no-overflow",
          "no-interaction-network",
        ],
      });
    } catch (error) {
      results.push({ width, passed: false, message: String(error), errors });
      await page.screenshot({ path: resolve(directory, `failure-${width}.png`), fullPage: true });
      await writeFile(resolve(directory, `failure-${width}.html`), await page.content());
      throw error;
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    assert.equal(
      await page
        .getByRole("button", { name: "Apply independent radius", exact: true })
        .isDisabled(),
      true,
    );
    await page.locator("[data-static-radius] summary").click();
    await page.locator("[data-static-camera] summary").click();
    assert.equal(await page.locator("[data-static-radius] [data-lower]").isVisible(), true);
    assert.equal(
      await page.locator('[data-static-camera] [data-output="diffusionEstimate"]').isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    results.push({ javaScript: false, passed: true });
  } finally {
    await context.close();
  }
} finally {
  await writeFile(resolve(directory, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
