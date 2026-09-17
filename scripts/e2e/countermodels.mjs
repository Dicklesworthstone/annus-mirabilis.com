import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Actual built route only. This runner never substitutes a DOM fixture for HTTP navigation.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const url = new URL("/lab/countermodels/", base).href;
const directory = resolve("artifacts/browser/countermodels");
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
      interactionRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      const a = page.locator('[data-countermodel-case="case-galilean-lorentz"]');
      const b = page.locator('[data-countermodel-case="case-ether-einstein"]');
      await page.waitForFunction(
        () => document.querySelectorAll('[data-countermodel-case][data-ready="true"]').length === 2,
      );
      page.on("request", (request) => interactionRequests.push(request.url()));
      assert.equal(await a.locator('[data-cell-outcome="violates"]').count(), 1);
      assert.equal(await b.locator('[data-cell-outcome="indistinguishable"]').count(), 8);
      const version = await a.getAttribute("data-snapshot-version"),
        run = await a.getAttribute("data-run-id");
      const light = a.getByLabel("Include Light-speed postulate", { exact: true });
      await light.focus();
      await page.keyboard.press("Space");
      assert.equal(await a.getAttribute("data-owner-evaluations"), "0");
      assert.equal(await a.getAttribute("data-snapshot-version"), version);
      assert.ok(
        (
          await a.locator('[data-candidate="galilean"] [data-candidate-conclusion]').innerText()
        ).includes("None of the selected"),
      );
      const input = a.getByLabel("Observer speed v/c (dimensionless)", { exact: true });
      await input.fill("0");
      await input.press("Enter");
      assert.equal(await a.getAttribute("data-owner-evaluations"), "1");
      assert.equal(await a.getAttribute("data-run-id"), run);
      assert.equal(await a.locator('[data-cell-outcome="violates"]').count(), 0);
      const accepted = await a.getAttribute("data-snapshot-version");
      for (const text of ["", "NaN", "1", "0x0"]) {
        await input.fill(text);
        await input.press("Enter");
        assert.equal(await a.getAttribute("data-snapshot-version"), accepted);
        assert.equal(await a.getByRole("alert").isVisible(), true);
      }
      await a.getByRole("button", { name: "Restore worked observer", exact: true }).click();
      const detail = a.locator('[data-candidate="lorentz"] [data-test-cell="inverse"] details');
      await detail.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await detail.locator("tbody tr").count(), 80);
      assert.equal(await detail.locator("tbody").isVisible(), true);
      await input.fill("0.9");
      await input.press("Enter");
      assert.notEqual(await detail.getAttribute("open"), null);
      assert.equal(await b.getAttribute("data-owner-evaluations"), "0");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(interactionRequests, []);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: resolve(directory, `workbench-${width}.png`), fullPage: true });
      results.push({
        width,
        passed: true,
        checks: [
          "computed-matrix",
          "keyboard-selection",
          "zero-toggle-evaluations",
          "observer-publication",
          "invalid-input-retention",
          "full-evidence",
          "independent-placements",
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
    assert.equal(await page.locator("[data-cell-outcome]").count(), 14);
    assert.equal(await page.locator("[data-observer-input]").first().isDisabled(), true);
    await page.locator("[data-cell-detail] summary").first().click();
    assert.equal(await page.locator("[data-cell-detail] tbody").first().isVisible(), true);
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
