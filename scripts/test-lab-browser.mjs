import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { checkCameraBrowser } from "./test-camera-browser.mjs";
import { checkEquationBrowser } from "./test-equation-browser.mjs";
import { checkInferenceBrowser } from "./test-inference-browser.mjs";
import { checkKitchenBrowser } from "./test-kitchen-browser.mjs";
import { checkReaderBrowser } from "./test-reader-browser.mjs";
import { checkTracerBrowser } from "./test-tracer-browser.mjs";
import { checkTrajectoryBrowser } from "./test-trajectory-browser.mjs";
import { checkWalkBrowser } from "./test-walk-browser.mjs";

const root = resolve("out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
    );
    if (file !== root && !file.startsWith(root + sep)) throw new Error("outside root");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; worker-src 'self'; connect-src 'self'",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const evidence = [];
const check = (name, details = {}) => {
  const item = { check: name, outcome: "passed", ...details };
  evidence.push(item);
  console.log(JSON.stringify(item));
};
await mkdir("artifacts/browser", { recursive: true });
try {
  await checkTrajectoryBrowser(browser, url, check);
  await checkKitchenBrowser(browser, url, check);
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${url}/lab/bm-06/`);
  assert.match(
    await staticPage.locator('[data-output="diffusionCoefficient"]').first().innerText(),
    /0\.42944/,
  );
  assert.ok(
    await staticPage.getByRole("button", { name: "Apply settings", exact: true }).isDisabled(),
  );
  assert.ok((await staticPage.locator("math").count()) >= 2);
  assert.ok(
    await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  );
  await staticPage.screenshot({ path: "artifacts/browser/no-js-320.png", fullPage: true });
  check("static example and mathematics readable without JavaScript at 320px");
  await noJs.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  let workerCount = 0;
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("worker", () => workerCount++);
  await page.goto(`${url}/lab/bm-06/`);
  const lab = page.locator('[data-instrument-id="bm-06"]').first();
  const apply = lab.getByRole("button", { name: "Apply settings", exact: true });
  await apply.waitFor();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  assert.equal(workerCount, 0);
  assert.equal(errors.length, 0);
  check("hydration preserves the static example and creates no worker");
  await lab.locator('input[name="eta"]').fill("2");
  assert.match(await lab.locator('[data-output="diffusionCoefficient"]').innerText(), /0\.42944/);
  await apply.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-output="diffusionCoefficient"]').textContent.includes("0.21472"),
  );
  assert.equal(workerCount, 1);
  const versions = await lab
    .locator("[data-snapshot-version]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.snapshotVersion));
  assert.ok(versions.every((v) => v === versions[0]));
  check("apply creates one worker and plot/table publish the same viscosity result");

  await lab.locator('input[name="T"]').fill("abc");
  await apply.click();
  assert.match(await lab.getByRole("alert").innerText(), /Temperature/);
  assert.match(await lab.locator('[data-output="diffusionCoefficient"]').innerText(), /0\.21472/);
  await lab.getByRole("button", { name: "Try a step that is too large", exact: true }).click();
  await apply.click();
  await lab.locator('[data-refusal-code="ftcs-unstable"]').waitFor();
  assert.match(await lab.locator('[data-output="diffusionCoefficient"]').innerText(), /0\.21472/);
  await lab.getByRole("button", { name: /Use \d+ time steps for this elapsed time/ }).click();
  await lab.getByRole("heading", { name: "Compare probabilities, not heights" }).waitFor();
  assert.equal(await lab.locator("[data-refusal-code]").count(), 0);
  check("invalid inputs and unstable grids preserve accepted results; the offered repair succeeds");

  const runId = await lab.getAttribute("data-run-id");
  await lab.locator('input[name="lower"]').fill("0");
  await apply.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-output="intervalProbability"]').textContent.includes("35.971"),
  );
  assert.equal(await lab.getAttribute("data-run-id"), runId);
  check("interval remeasurement preserves the identified physical run");

  await page
    .getByRole("button", { name: "Open an independent second laboratory", exact: true })
    .click();
  const second = page.locator('[data-instrument-id="bm-06"]').nth(1);
  await second.locator('input[name="eta"]').fill("2");
  await second.getByRole("button", { name: "Apply settings", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelectorAll('[data-output="diffusionCoefficient"]')[1]
      .textContent.includes("0.21472"),
  );
  assert.match(await lab.locator('[data-output="diffusionCoefficient"]').innerText(), /0\.42944/);
  assert.equal(workerCount, 2);
  check("two real browser workers remain independent");
  await page.getByRole("button", { name: "Close the second laboratory", exact: true }).click();
  const audit = await new AxeBuilder({ page })
    .include("#main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const serious = audit.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  assert.deepEqual(
    serious.map((v) => ({ id: v.id, description: v.description })),
    [],
  );
  check("automated accessibility supplement", {
    violations: audit.violations.map((v) => v.id),
    manualScreenReaderReview: "not performed",
  });
  await page.setViewportSize({ width: 320, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "artifacts/browser/lab-320.png", fullPage: true });
  assert.deepEqual(errors, []);
  check("interactive laboratory reflows at 320px without uncaught page errors");
  await context.close();
  await checkTracerBrowser(browser, url, check);
  await checkWalkBrowser(browser, url, check);
  await checkReaderBrowser(browser, url, check);
  await checkEquationBrowser(browser, url, check);
  await checkInferenceBrowser(browser, url, check);
  await checkCameraBrowser(browser, url, check);
} finally {
  await writeFile("artifacts/browser/checks.json", JSON.stringify(evidence, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
