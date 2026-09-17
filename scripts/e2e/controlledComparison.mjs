import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Run against a built, locally served site: BASE_URL=http://127.0.0.1:3000 bun scripts/e2e/controlledComparison.mjs
// This lane must load the real route; it never substitutes a mock page or a numeric fixture.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const url = new URL("/lab/bm-01/compare/", base).href;
const directory = resolve("artifacts/browser/controlled-comparison");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1280, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const root = page.locator("[data-controlled-comparison]");
    const ratio = async (id) => Number(await root.locator(`[data-comparison-output="${id}"] [data-comparison-ratio]`).innerText());
    async function idle() { await root.locator('button:has-text("Apply one change")').waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("[data-controlled-comparison]")?.getAttribute("data-pending") === "false"); }
    try {
      await page.goto(url);
      await root.waitFor();
      assert.equal(await root.getAttribute("data-comparison-phase"), "example");
      assert.equal(await ratio("diffusionCoefficient"), .5);
      assert.equal(await ratio("rmsDisplacement1d"), .70711);
      await root.getByRole("button", { name: "Start live comparison", exact: true }).click();
      await page.waitForFunction(() => document.querySelector("[data-controlled-comparison]")?.getAttribute("data-comparison-phase") === "live");
      await idle();
      await root.getByRole("button", { name: "Use twice the baseline value", exact: true }).click(); await idle();
      assert.equal(await ratio("diffusionCoefficient"), .5);
      assert.equal(await ratio("sampleRms"), .70711);
      const previous = await root.locator("[data-comparison-results]").getAttribute("data-variant-snapshot");
      await root.getByLabel("Input to vary", { exact: true }).selectOption("eta");
      await root.getByRole("button", { name: "Use twice the baseline value", exact: true }).click();
      assert.ok((await root.getByRole("alert").innerText()).includes("pin a new baseline"));
      assert.equal(await root.locator("[data-comparison-results]").getAttribute("data-variant-snapshot"), previous);
      await root.getByRole("button", { name: "Pin current result as new baseline", exact: true }).click();
      await root.getByLabel("Input to vary", { exact: true }).selectOption("interval");
      await root.getByRole("button", { name: "Observe at four times the baseline interval", exact: true }).click(); await idle();
      await root.locator("[data-recording-reuse]").waitFor();
      assert.equal(await ratio("rmsDisplacement1d"), 2);
      const pair = root.locator("[data-comparison-results]");
      assert.equal(await pair.getAttribute("data-baseline-run-id"), await pair.getAttribute("data-variant-run-id"));
      const points = await root.locator("polyline").evaluateAll((lines) => lines.map((line) => line.getAttribute("points")));
      assert.equal(points[0], points[1]);
      const input = root.getByRole("textbox");
      await input.fill("0.013"); await root.getByRole("button", { name: "Apply one change", exact: true }).click(); await idle();
      await root.getByRole("alert").waitFor();
      assert.equal(await ratio("rmsDisplacement1d"), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: resolve(directory, `comparison-${width}.png`), fullPage: true });
      results.push({ width, passed: true, checks: ["static-ratios", "live-start", "radius-scaling", "second-change-refused", "rebaseline", "recording-reuse", "off-grid-retains-pair", "no-page-overflow"] });
    } catch (error) {
      await page.screenshot({ path: resolve(directory, `failure-${width}.png`), fullPage: true });
      await writeFile(resolve(directory, `failure-${width}.html`), await page.content());
      throw error;
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage(); await page.goto(url);
    const root = page.locator("[data-controlled-comparison]");
    assert.equal(await root.locator("[data-comparison-output]").count(), 6);
    assert.equal(await root.locator("polyline").count(), 2);
    assert.ok((await root.innerText()).includes("Static worked comparison"));
    assert.equal(await root.getByRole("button", { name: "Start live comparison" }).isDisabled(), true);
    results.push({ javaScript: false, passed: true });
  } finally { await context.close(); }
} finally {
  await writeFile(resolve(directory, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
