import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { loadOfflineManifest } from "../../src/platform/offline/server.ts";

// Exercise real generated files. A denied file:// navigation fails this test;
// never replace it with setContent and call that a cold offline success.
const root = process.cwd();
const manifest = await loadOfflineManifest(root);
assert.ok(
  manifest && manifest.chapters.length > 0,
  "Run prepare:content, prepare:lab, and prepare:offline first.",
);
const chapter =
  manifest.chapters.find((entry) => entry.paper === "brownian-motion" && entry.section === "s4") ??
  manifest.chapters[0];
const path = resolve(root, "generated", chapter.path.slice(1));
const original = await readFile(path, "utf8");
assert.equal(Buffer.byteLength(original), chapter.bytes);
const output = resolve(
  root,
  "artifacts/browser/offline-chapters",
  new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(output, { recursive: true });
const checks = [];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
);
async function check(name, operation) {
  await test(name, async () => {
    try {
      await operation();
      checks.push({ name, passed: true });
    } catch (error) {
      checks.push({ name, passed: false, message: String(error) });
      throw error;
    }
  });
}
try {
  for (const javaScriptEnabled of [true, false]) {
    const lane = javaScriptEnabled ? "interactive" : "no-javascript";
    const context = await browser.newContext({
      javaScriptEnabled,
      offline: true,
      viewport: { width: 320, height: 800 },
    });
    const page = await context.newPage();
    const network = [],
      errors = [],
      violations = [];
    page.on("request", (request) => {
      if (/^https?:/u.test(request.url())) network.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await context.route(/^https?:/u, (route) => route.abort());
    if (javaScriptEnabled) {
      await page.exposeFunction("recordOfflineViolation", (directive) =>
        violations.push(directive),
      );
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          void window.recordOfflineViolation(event.violatedDirective);
        });
      });
    }
    try {
      await check(`${lane}: cold file navigation`, async () => {
        await page.goto(pathToFileURL(path).href, { waitUntil: "load" });
        assert.ok(await page.locator('main [data-reading="1"]').count());
        assert.ok(await page.locator('main [data-reading="1"]').first().isVisible());
      });
      await check(`${lane}: default reading and static mathematics`, async () => {
        assert.equal(await page.locator('[data-reading="0"]').first().isVisible(), false);
        assert.ok(await page.locator(".katex math").count());
        assert.ok(await page.locator("header[data-print-header]").isVisible());
        assert.ok(await page.locator("footer[data-print-footer]").isVisible());
      });
      await check(`${lane}: all local anchors resolve`, async () => {
        const broken = await page
          .locator('a[href^="#"]')
          .evaluateAll((links) =>
            links
              .map((link) => link.getAttribute("href").slice(1))
              .filter((anchor) => !document.getElementById(anchor)),
          );
        assert.deepEqual(broken, []);
      });
      await check(`${lane}: no page-wide overflow at 320 pixels`, async () => {
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
          true,
        );
      });
      if (javaScriptEnabled) {
        await check("automated accessibility check passes", async () => {
          const audit = await new AxeBuilder({ page }).analyze();
          assert.deepEqual(audit.violations, []);
        });
        await check("reading controls work with the hash-authorized inline script", async () => {
          await page.locator("[data-offline-detail]").selectOption("2");
          assert.ok(await page.locator('[data-reading="2"]').first().isVisible());
          assert.equal(await page.locator('[data-reading="1"]').first().isVisible(), false);
          await page.locator("[data-offline-modern]").check();
          assert.ok(await page.locator('[data-reading="3"]').first().isVisible());
        });
      } else {
        await check(
          "no-JavaScript controls remain disabled without hiding the full explanation",
          async () => {
            assert.ok(await page.locator("[data-offline-detail]").isDisabled());
            assert.ok(await page.locator("noscript").first().isVisible());
          },
        );
      }
      await page.emulateMedia({ media: "print" });
      await check(`${lane}: print keeps the selected reading and hides controls`, async () => {
        const detail = javaScriptEnabled ? "2" : "1";
        assert.ok(await page.locator(`[data-reading="${detail}"]`).first().isVisible());
        assert.equal(await page.locator("[data-screen-only]").isVisible(), false);
      });
      await page.emulateMedia({ media: "screen" });
      await check(`${lane}: no network requests or script errors`, async () => {
        assert.deepEqual(network, []);
        assert.deepEqual(errors, []);
        assert.deepEqual(violations, []);
      });
      await page.screenshot({ path: resolve(output, `${lane}-320.png`), fullPage: true });
    } finally {
      await writeFile(resolve(output, `${lane}-dom.html`), await page.content());
      await writeFile(resolve(output, `${lane}-network.json`), JSON.stringify(network, null, 2));
      await writeFile(
        resolve(output, `${lane}-errors.json`),
        JSON.stringify({ errors, violations }, null, 2),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ chapter: chapter.path, checks }, null, 2),
  );
}
console.log(JSON.stringify({ passed: checks.length, chapter: chapter.path, evidence: output }));
