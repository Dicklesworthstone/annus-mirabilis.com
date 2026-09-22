/** Run against a built local edition:
 * TOUR_BASE_URL=http://127.0.0.1:3000 node --experimental-strip-types --test scripts/e2e/guidedTours.mjs
 * Browser dependencies and a running edition are required; unavailable execution is not a pass.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { GUIDED_TOURS } from "../../src/discovery/tours/catalogue.ts";
import { tourDestination, tourPosition } from "../../src/discovery/tours/navigation.ts";

const base = process.env.TOUR_BASE_URL ?? "http://127.0.0.1:3000";
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const tour of GUIDED_TOURS) {
  test(`${tour.id}: follow every real destination and finish from the last stop`, { timeout: 180000 }, async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(`${base}/tours/${tour.id}/`);
      assert.equal(response.status(), 200);
      assert.equal(await page.locator(".guided-tour-stops > li").count(), tour.stops.length);
      await page.getByRole("link", { name: "Begin at the first encounter", exact: true }).click();
      for (const [index, stop] of tour.stops.entries()) {
        const guide = page.locator(`[data-guided-tour="${tour.id}"][data-tour-stop="${stop.id}"]`);
        await guide.waitFor();
        assert.equal(new URL(page.url()).pathname, new URL(stop.href, base).pathname);
        assert.equal(new URL(page.url()).searchParams.get("tourStop"), stop.id);
        assert.equal(await guide.getByRole("heading", { level: 2 }).textContent(), stop.title);
        await guide.getByText("Read the explanation at any time", { exact: true }).click();
        assert.equal(await guide.getByText(stop.explanation, { exact: true }).isVisible(), true);
        const navigation = page.getByRole("navigation", { name: "Continue guided reading after this page", exact: true });
        await navigation.getByRole("link", { name: index < tour.stops.length - 1 ? "Next stop" : "Finish this route", exact: true }).click();
      }
      await page.locator("#tour-finish").waitFor();
      assert.equal(new URL(page.url()).hash, "#tour-finish");
      assert.deepEqual(errors, [], "A guide must not introduce a page execution error.");
    } finally { await page.close(); }
  });

  test(`${tour.id}: the entire outline and native disclosures work without JavaScript`, async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      assert.equal((await page.goto(`${base}/tours/${tour.id}/`)).status(), 200);
      for (const stop of tour.stops) {
        const entry = page.locator(`#tour-stop-${stop.id}`);
        assert.equal(await entry.getByRole("heading", { level: 2 }).textContent(), stop.title);
        await entry.locator("summary").click();
        assert.equal(await entry.getByText(stop.explanation, { exact: true }).isVisible(), true);
        const destination = entry.getByRole("link", { name: `Open this stop: ${stop.title}`, exact: true });
        assert.equal(await destination.getAttribute("href"), tourDestination(tourPosition(tour, stop)));
      }
      assert.equal(await page.locator("[data-guided-tour]").count(), 0);
    } finally { await context.close(); }
  });
}

test("leaving a guide preserves the open page and non-tour parameters without reloading", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/lab/me-01/?tour=mass-energy&tourStop=ledgers&tourRevision=1&readerOption=keep#main`);
    const guide = page.locator('[data-guided-tour="mass-energy"]');
    await guide.waitFor();
    await page.evaluate(() => { window.__tourVisitToken = "must-survive"; });
    await guide.getByText("Pause, bookmark or leave this route", { exact: true }).click();
    await guide.getByRole("button", { name: "Leave tour, keep this page", exact: true }).click();
    await guide.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.__tourVisitToken), "must-survive");
    const url = new URL(page.url());
    assert.equal(url.pathname, "/lab/me-01/");
    assert.equal(url.searchParams.get("readerOption"), "keep");
    assert.equal(url.searchParams.has("tour"), false);
    assert.equal(url.hash, "#main");
  } finally { await page.close(); }
});

test("an invalid revision shows recovery rather than replacing the experiment", async () => {
  const page = await browser.newPage();
  try {
    assert.equal((await page.goto(`${base}/lab/me-01/?tour=mass-energy&tourStop=ledgers&tourRevision=999`)).status(), 200);
    await page.locator("[data-tour-error]").waitFor();
    assert.ok(await page.locator("main").textContent());
    assert.equal(await page.locator("[data-guided-tour]").count(), 0);
  } finally { await page.close(); }
});

test("a valid position on a different page offers return instead of advancing", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/lab/me-03/?tour=mass-energy&tourStop=ledgers&tourRevision=1`);
    const detour = page.locator("[data-tour-detour]");
    await detour.waitFor();
    const href = await detour.getByRole("link", { name: "Return to Write the same emission twice", exact: true }).getAttribute("href");
    assert.equal(new URL(href, base).pathname, "/lab/me-01/");
    assert.equal(new URL(page.url()).pathname, "/lab/me-03/");
  } finally { await page.close(); }
});
