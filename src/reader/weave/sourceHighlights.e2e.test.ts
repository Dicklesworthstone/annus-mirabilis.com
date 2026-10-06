import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import ts from "typescript";
import type { connectSourceHighlights, SourceWeavePointer } from "./sourceHighlights.ts";
type BrowserHarness = Window & {
  connect: typeof connectSourceHighlights;
  entries: readonly SourceWeavePointer[];
  connection: ReturnType<typeof connectSourceHighlights>;
};

// Real Chromium DOM tests of the production controller. No deployed site or generated corpus
// is needed; canonical variants are inputs, whose grammar is tested by contentIds.test.ts.
const compiled = ts.transpileModule(
  readFileSync(new URL("./sourceHighlights.ts", import.meta.url), "utf8"),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  },
).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
let browser: Browser;
let page: Page;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  page = await browser.newPage();
});
after(async () => {
  await browser?.close();
});
beforeEach(async () => {
  await page.setContent(`<main id="paper">
    <p><span class="source-sentence" id="s4-p6-s9" data-sentence-id="s4-p6-s9" aria-describedby="existing" data-aligned-active="true">German <b>source</b>.</span></p>
    <article class="translation-unit" id="en-s4-p6-s9a" data-translation-unit-id="s4-p6-s9a">English first half.</article>
    <article class="translation-unit" id="en-s4-p6-s9b" data-translation-unit-id="s4-p6-s9b">English second half.</article>
    <span class="source-sentence" id="unrelated" data-sentence-id="s4-p7-s1">Unrelated.</span>
    <div data-sentence-id="s4-p6-s9" id="not-source">Not source markup.</div>
    <p id="pointer">This agreement is a pointer, not a proof.</p>
  </main><aside id="other"><span class="source-sentence" data-sentence-id="s4-p6-s9">Another instance.</span></aside>`);
  await page.evaluate(async (url) => {
    const module = await import(url);
    const w = window as unknown as BrowserHarness;
    w.connect = module.connectSourceHighlights;
    w.entries = ["s4-p6-s9", "s4-p6-s9a", "s4-p6-s9b"].map((contentId) => ({
      contentId,
      meaning: "agreement-within-stated-bound",
      descriptionId: "pointer",
    }));
    w.connection = w.connect(document.querySelector("#paper") as Element, "primary", w.entries);
  }, moduleUrl);
});

test("German and both English split units share the pointer, regardless of DOM id prefix", async () => {
  assert.equal(await page.locator("#paper [data-live-weave-owner=primary]").count(), 3);
  for (const id of ["s4-p6-s9", "en-s4-p6-s9a", "en-s4-p6-s9b"]) {
    assert.equal(
      await page.locator(`[id="${id}"]`).getAttribute("data-live-weave-meaning"),
      "agreement-within-stated-bound",
    );
  }
  assert.equal(await page.locator("#not-source").getAttribute("data-live-weave-owner"), null);
  assert.equal(await page.locator("#unrelated").getAttribute("data-live-weave-owner"), null);
});
test("source text, ids, alignment state and an existing accessible description are preserved", async () => {
  const element = page.locator('[id="s4-p6-s9"]');
  assert.equal(await element.innerHTML(), "German <b>source</b>.");
  assert.equal(await element.getAttribute("data-aligned-active"), "true");
  assert.equal(await element.getAttribute("aria-describedby"), "existing pointer");
});
test("another root with the same content id is untouched", async () => {
  assert.equal(await page.locator("#other [data-live-weave-owner]").count(), 0);
});
test("pending or unlit updates clear pointers instead of leaving stale highlights", async () => {
  await page.evaluate(() => (window as unknown as BrowserHarness).connection.update([]));
  assert.equal(await page.locator("[data-live-weave-owner]").count(), 0);
  assert.equal(await page.locator('[id="s4-p6-s9"]').getAttribute("aria-describedby"), "existing");
});
test("a face inserted after evaluation is annotated by its declared content id", async () => {
  await page.evaluate(() => {
    const element = document.createElement("article");
    element.className = "translation-unit";
    element.id = "late";
    element.setAttribute("data-translation-unit-id", "s4-p6-s9a");
    element.textContent = "Late face.";
    document.querySelector("#paper")?.append(element);
  });
  await page.waitForFunction(
    () => document.querySelector("#late")?.getAttribute("data-live-weave-owner") === "primary",
  );
  assert.equal(await page.locator("#late").textContent(), "Late face.");
});
test("disposal removes only this feature's descriptions and leaves concurrent additions", async () => {
  await page.evaluate(() => {
    const element = document.querySelector('[id="s4-p6-s9"]');
    element?.setAttribute("aria-describedby", "existing pointer later-description");
    (window as unknown as BrowserHarness).connection.dispose();
    (window as unknown as BrowserHarness).connection.dispose();
  });
  assert.equal(await page.locator("[data-live-weave-owner]").count(), 0);
  assert.equal(
    await page.locator('[id="s4-p6-s9"]').getAttribute("aria-describedby"),
    "existing later-description",
  );
});
test("another annotator cannot steal or clear an existing owner's source marks", async () => {
  await page.evaluate(() => {
    const w = window as unknown as BrowserHarness;
    const other = w.connect(document.querySelector("#paper") as Element, "second", w.entries);
    other.dispose();
  });
  assert.equal(await page.locator("#paper [data-live-weave-owner=primary]").count(), 3);
});
test("a disposed connection cannot annotate later faces or apply a later update", async () => {
  await page.evaluate(() => {
    const w = window as unknown as BrowserHarness;
    w.connection.dispose();
    w.connection.update(w.entries);
    document.querySelector("#paper")?.append(document.createElement("p"));
  });
  assert.equal(await page.locator("[data-live-weave-owner]").count(), 0);
});
