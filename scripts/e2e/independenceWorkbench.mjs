/** Opt-in against a locally served scaffold build, not pure/fast test discovery.
 * node --experimental-strip-types --test scripts/e2e/independenceWorkbench.mjs
 * AM_E2E_BASE_URL defaults to http://127.0.0.1:3000. Does not start a server.
 */
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "playwright";

const base = new URL(process.env.AM_E2E_BASE_URL ?? "http://127.0.0.1:3000");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || !["http:", "https:"].includes(base.protocol))
  throw new Error("Serve the real build locally; this suite does not target a public deployment.");
const route = new URL("/lab/countermodels/independence/", base);
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function visit(run, { search = "", javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  try {
    const url = new URL(route); url.search = search;
    const response = await page.goto(url.href);
    assert.equal(response.status(), 200);
    await page.locator("[data-occupancy-workbench]").waitFor();
    if (javaScriptEnabled) await page.waitForFunction(() => document.querySelector(".occupancy-workbench fieldset")?.disabled === false);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
const outcome = page => page.locator("[data-distinction]").getAttribute("data-distinction");
async function openRecord(page) {
  await page.getByText("Test a count record against both models", { exact: true }).click();
}

test("mean alone is insufficient; adding variance distinguishes predictions", async () => visit(async page => {
  assert.equal(await outcome(page), "underdetermined");
  await page.getByLabel("Variance of the number inside", { exact: true }).check();
  assert.equal(await outcome(page), "different-predictions");
  await page.getByLabel("Variance of the number inside", { exact: true }).uncheck();
  assert.equal(await outcome(page), "underdetermined");
}));

test("a one-point experiment cannot test dependence between points", async () => visit(async page => {
  await page.getByLabel("Probability that all points are inside", { exact: true }).check();
  await page.getByLabel("Number of labeled points", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Apply model settings", exact: true }).click();
  assert.equal(await outcome(page), "underdetermined");
  assert.equal(await page.getByRole("region", { name: "Count probability distributions", exact: true }).locator("tbody tr").count(), 2);
}));

test("constructed examples distinguish an impossible event from a likelihood preference", async () => visit(async page => {
  await openRecord(page);
  await page.getByRole("button", { name: "Illustration: mixed counts", exact: true }).click();
  assert.equal(await page.locator("[data-evidence-status]").getAttribute("data-evidence-status"), "independent-only");
  await page.getByRole("button", { name: "Illustration: all-or-none counts", exact: true }).click();
  assert.equal(await page.locator("[data-evidence-status]").getAttribute("data-evidence-status"), "both-possible");
  assert.match(await page.locator("[data-evidence-status]").innerText(), /not a probability that either model is true/u);
}));

test("a malformed record leaves the accepted record intact", async () => visit(async page => {
  await openRecord(page);
  await page.getByRole("button", { name: "Illustration: mixed counts", exact: true }).click();
  const before = await page.locator("[data-evidence-status]").innerText();
  await page.getByLabel(/^Frequencies for K/u).fill("1,4,,4,1");
  await page.getByRole("button", { name: "Analyze count record", exact: true }).click();
  assert.match(await page.getByRole("alert").innerText(), /exactly 5/u);
  assert.equal(await page.locator("[data-evidence-status]").innerText(), before);
}));

test("unapplied settings cannot relabel evidence; accepting changed settings clears it", async () => visit(async page => {
  await openRecord(page);
  await page.getByRole("button", { name: "Illustration: mixed counts", exact: true }).click();
  await page.getByLabel("Number of labeled points", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Analyze count record", exact: true }).click();
  assert.match(await page.getByRole("alert").innerText(), /Apply or discard/u);
  assert.match(await page.locator("[data-evidence-status]").innerText(), /n = 4/u);
  await page.getByRole("button", { name: "Apply model settings", exact: true }).click();
  assert.equal(await page.locator("[data-evidence-status]").count(), 0);
  assert.equal(await page.getByLabel(/^Frequencies for K/u).inputValue(), "");
}));

test("accepted-settings links exclude private explanations and count records", async () => visit(async page => {
  await openRecord(page);
  await page.getByRole("button", { name: "Illustration: mixed counts", exact: true }).click();
  await page.getByLabel(/^Your explanation:/u).fill("private-reader-explanation");
  await page.getByRole("button", { name: "Copy accepted-settings link", exact: true }).click();
  const link = new URL(await page.getByLabel("Accepted-settings link", { exact: true }).inputValue());
  assert.deepEqual([...link.searchParams.keys()].sort(), ["checks", "n", "occupancy", "q"]);
  assert.ok(!link.href.includes("private-reader-explanation"));
}));

test("shared settings require explicit acceptance before replacing the worked example", async () => visit(async page => {
  assert.equal(await page.getByLabel("Number of labeled points", { exact: true }).inputValue(), "4");
  await page.getByRole("button", { name: "Apply shared question", exact: true }).click();
  assert.equal(await page.getByLabel("Number of labeled points", { exact: true }).inputValue(), "7");
  assert.equal(await page.getByLabel("Fraction of the volume", { exact: true }).inputValue(), "3");
  assert.equal(await page.locator("[data-evidence-status]").count(), 0);
}, { search: "occupancy=1&n=7&q=3&checks=all-inside" }));

test("an unsupported link has recovery and keeps the default results", async () => visit(async page => {
  assert.equal(await page.getByLabel("Number of labeled points", { exact: true }).inputValue(), "4");
  assert.equal(await page.getByRole("link", { name: "Open the clean example", exact: true }).getAttribute("href"), route.pathname);
  assert.equal(await outcome(page), "underdetermined");
}, { search: "occupancy=2&n=7&q=3&checks=all-inside" }));

test("the no-JavaScript page retains the worked statistics and probability table", async () => visit(async page => {
  assert.match(await page.locator("[data-occupancy-workbench] noscript").innerText(), /full worked comparison/u);
  assert.equal(await page.getByRole("region", { name: "Model prediction table", exact: true }).locator("tbody tr").count(), 4);
  assert.equal(await page.getByRole("region", { name: "Count probability distributions", exact: true }).locator("tbody tr").count(), 5);
  assert.equal(await page.getByRole("button", { name: "Apply model settings", exact: true }).isDisabled(), true);
}, { javaScriptEnabled: false }));
