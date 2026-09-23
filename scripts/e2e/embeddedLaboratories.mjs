/** Opt-in against a locally served REAL build, never part of pure/fast test discovery.
 * AM_EMBED_TEST_BASE_URL=http://127.0.0.1:3000 node --experimental-strip-types scripts/e2e/embeddedLaboratories.mjs
 * The caller builds/serves the site. This suite does not publish or change an external site.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { EMBED_INSTRUMENTS } from "../../src/experiments/embed/catalogue.ts";
import { DEFAULT_EMBED_OPTIONS, embedPath } from "../../src/experiments/embed/contract.ts";

const base = process.env.AM_EMBED_TEST_BASE_URL;
if (!base) throw new Error("Set AM_EMBED_TEST_BASE_URL to the local server for a built edition.");
const origin = new URL(base);
if (
  !["http:", "https:"].includes(origin.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
) {
  throw new Error("Browser acceptance is restricted to a local test server.");
}
const browser = await chromium.launch({ headless: true });
let passed = 0;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const item of EMBED_INSTRUMENTS) {
    errors.length = 0;
    const response = await page.goto(
      new URL(embedPath(item.id, { theme: "dark", detail: "steps", motion: "reduce" }), origin)
        .href,
    );
    assert.ok(response?.ok(), `${item.id}: route returned an error`);
    await page.locator(`[data-embed-lab="${item.id}"][data-embed-ready="true"]`).waitFor();
    await page.locator(".embed-instrument [data-instrument-id]").first().waitFor();
    const mounted = await page
      .locator(".embed-instrument [data-instrument-id]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-instrument-id")));
    assert.ok(
      mounted.every((id) => id === item.id),
      `${item.id}: mounted the wrong instrument`,
    );
    assert.equal(await page.locator(".site-header").isVisible(), false);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "kramgasse-night");
    assert.equal(await page.locator("html").getAttribute("data-embed-motion"), "reduce");
    assert.equal(await page.locator(".embed-guidance details[open]").count(), 2);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(new URL(canonical).pathname, `/lab/${item.id}/`);
    assert.ok(
      (await page.locator('meta[name="robots"]').first().getAttribute("content")).includes(
        "noindex",
      ),
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Read the source context in a new tab" })
        .getAttribute("href"),
      item.source,
    );
    assert.ok((await page.locator(".embed-instrument").innerText()).length > 80);
    assert.deepEqual(errors, [], `${item.id}: runtime error`);
    console.log(`PASS ${item.id}: real owner view, attribution, presentation and metadata`);
    passed++;
  }

  await page.goto(new URL("/embed/lab/bm-03/?embed=1&theme=dark&theme=light", origin).href);
  await page.locator("[data-embed-invalid]").waitFor();
  assert.equal(await page.locator(".embed-instrument").count(), 0);
  await page.getByRole("link", { name: "Open a clean worked example" }).click();
  await page.locator(".embed-instrument").waitFor();
  console.log("PASS malformed configuration has visible recovery, not a substituted experiment");
  passed++;

  await page.goto(new URL("/embed/?instrument=me-01", origin).href);
  await page.locator('[data-embed-builder][data-ready="true"]').waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  const before = await page.getByLabel("Iframe code and fallback link").inputValue();
  assert.ok(before.includes("/embed/lab/me-01/"));
  await page.getByRole("button", { name: "Load or update preview" }).click();
  const preview = page.locator("iframe");
  const oldSrc = await preview.getAttribute("src");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  assert.equal(await preview.getAttribute("src"), oldSrc);
  await page.getByRole("button", { name: "Load or update preview" }).click();
  assert.notEqual(await page.locator("iframe").getAttribute("src"), oldSrc);
  await page.getByRole("button", { name: "Close preview" }).click();
  assert.equal(await page.locator("iframe").count(), 0);
  console.log("PASS builder stages preview changes and never auto-loads an iframe");
  passed++;

  await page.goto(new URL("/embed/?instrument=not-a-lab", origin).href);
  await page.locator('[data-embed-builder][data-ready="true"]').waitFor();
  assert.equal(await page.getByLabel("Iframe code and fallback link").inputValue(), "");
  assert.equal(await page.locator("iframe").count(), 0);
  console.log("PASS unknown builder selection cannot produce a plausible wrong embed");
  passed++;

  // Two genuine browsing contexts isolate root presentation and editable controls.
  await page.goto(new URL("/embed/", origin).href);
  await page.evaluate(
    (paths) => {
      for (const [name, src] of paths) {
        const frame = document.createElement("iframe");
        frame.name = name;
        frame.src = src;
        document.body.append(frame);
      }
    },
    [
      ["left-test", embedPath("sr-04", { ...DEFAULT_EMBED_OPTIONS, theme: "dark" })],
      ["right-test", embedPath("sr-04", { ...DEFAULT_EMBED_OPTIONS, theme: "light" })],
    ],
  );
  await page
    .frameLocator('iframe[name="left-test"]')
    .locator('[data-embed-ready="true"]')
    .waitFor();
  await page
    .frameLocator('iframe[name="right-test"]')
    .locator('[data-embed-ready="true"]')
    .waitFor();
  const left = page.frameLocator('iframe[name="left-test"]');
  const right = page.frameLocator('iframe[name="right-test"]');
  const untouched = await right
    .locator('.embed-instrument input[type="number"]')
    .first()
    .inputValue();
  await left.locator('.embed-instrument input[type="number"]').first().fill("0.2");
  assert.equal(
    await right.locator('.embed-instrument input[type="number"]').first().inputValue(),
    untouched,
  );
  assert.equal(await left.locator("html").getAttribute("data-theme"), "kramgasse-night");
  assert.equal(await right.locator("html").getAttribute("data-theme"), "annalen");
  console.log("PASS independent frame controls and presentation");
  passed++;
  await context.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const book = await noJs.newPage();
  for (const item of EMBED_INSTRUMENTS) {
    const response = await book.goto(new URL(`/embed/lab/${item.id}/`, origin).href);
    assert.ok(response?.ok());
    assert.ok(
      (await book.locator(".embed-instrument [data-instrument-id]").count()) > 0,
      `${item.id}: no server-rendered example`,
    );
    assert.ok((await book.locator(".embed-instrument").innerText()).length > 80);
    assert.equal(await book.locator(".embed-guidance summary").count(), 2);
    console.log(`PASS ${item.id}: no-JavaScript example and explanations`);
    passed++;
  }
  await noJs.close();
  console.log(`${passed} embedded laboratory browser cases passed.`);
} finally {
  await browser.close();
}
