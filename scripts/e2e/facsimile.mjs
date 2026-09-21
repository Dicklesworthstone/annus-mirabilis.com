import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Actual built routes only: BASE_URL must serve `bun run build`'s output.
// Run: node --experimental-strip-types scripts/e2e/facsimile.mjs
// A navigation/environment failure is a failure, never replaced by a fixture pass.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const directory = resolve("artifacts/browser/facsimile");
await mkdir(directory, { recursive: true });
const papers = [
  { slug: "light-quanta", first: 132, count: 17 },
  { slug: "brownian-motion", first: 549, count: 12 },
  { slug: "special-relativity", first: 891, count: 31 },
  { slug: "mass-energy", first: 639, count: 3 },
];
const browser = await chromium.launch();
const results = [];
try {
  for (const paper of papers) {
    for (const width of [1440, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      try {
        const url = new URL(`/papers/${paper.slug}/view/facsimile/#facsimile-page-${paper.first + 1}`, base);
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        const root = page.locator("[data-facsimile-reader]");
        await root.waitFor();
        await page.waitForFunction(() => !document.querySelector("[data-facsimile-controls]")?.disabled);
        assert.equal(await root.getAttribute("data-facsimile-pdf-page"), "2");
        assert.equal(await root.locator("[data-facsimile-page-link]").count(), paper.count);
        assert.match(await root.locator("iframe").getAttribute("src"), /#page=2$/);
        const input = root.getByLabel("Printed journal page", { exact: true });
        for (const value of ["", "NaN", "1e3", `${paper.first}.5`, String(paper.first - 1), String(paper.first + paper.count)]) {
          await input.fill(value);
          await input.press("Enter");
          assert.equal(await root.getAttribute("data-facsimile-pdf-page"), "2");
          assert.equal(await input.getAttribute("aria-invalid"), "true");
        }
        await input.fill(String(paper.first));
        await input.press("Enter");
        assert.equal(await root.getAttribute("data-facsimile-pdf-page"), "1");
        assert.equal(await root.getByRole("button", { name: "Previous page", exact: true }).isDisabled(), true);
        await root.getByRole("button", { name: "Next page", exact: true }).click();
        assert.equal(await root.getAttribute("data-facsimile-pdf-page"), "2");
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("[data-facsimile-reader]")?.getAttribute("data-facsimile-pdf-page") === "1");
        assert.match(await root.locator("[data-facsimile-direct]").getAttribute("href"), /#page=1$/);
        assert.match(await root.locator("[data-facsimile-share-url]").inputValue(), new RegExp(`#facsimile-page-${paper.first}$`));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: resolve(directory, `${paper.slug}-${width}.png`), fullPage: true });
        results.push({ paper: paper.slug, width, passed: true });
      } catch (error) {
        results.push({ paper: paper.slug, width, passed: false, message: String(error), errors });
        await writeFile(resolve(directory, `${paper.slug}-${width}-failure.html`), await page.content());
        throw error;
      } finally {
        await context.close();
      }
    }
  }
  const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
  try {
    const page = await noScript.newPage();
    await page.goto(new URL("/papers/mass-energy/view/facsimile/", base).href, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-facsimile-controls]").evaluate(element => element.disabled), true);
    for (const number of [1, 2, 3]) assert.ok(await page.locator(`a[href$="#page=${number}"]`).count() > 0);
    assert.equal(await page.locator("[data-facsimile-directory]").isVisible(), true);
    assert.equal(await page.getByRole("link", { name: "Download the complete pinned PDF" }).isVisible(), true);
    results.push({ mode: "no-javascript", passed: true });
  } finally {
    await noScript.close();
  }
  const failedViewer = await browser.newContext();
  try {
    // Failure of browser PDF loading must not remove independently server-rendered source links.
    await failedViewer.route("**/papers/pdfs/*.pdf*", route => route.abort());
    const page = await failedViewer.newPage();
    await page.goto(new URL("/papers/mass-energy/view/facsimile/", base).href, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-facsimile-direct]").isVisible(), true);
    assert.ok(await page.locator('a[href$="#page=3"]').count() > 0);
    results.push({ mode: "pdf-load-failure", passed: true });
  } finally {
    await failedViewer.close();
  }
} finally {
  await writeFile(resolve(directory, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: true, results }, null, 2));
