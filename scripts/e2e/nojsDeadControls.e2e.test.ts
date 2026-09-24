/**
 * With JavaScript off, no button looks usable and does nothing (am-nojs-dead-controls-3agt).
 *
 * Measured on live on 2026-09-24 with JavaScript off: 267 enabled, laid-out buttons on 41 of the
 * 197 sitemap pages, every one wired by React, and no form on the site has an action, so none
 * could work. The fix is one fieldset around the page content, disabled in the served HTML and
 * lifted by hydration (src/components/chrome/HydrationGate.tsx).
 *
 * WHAT COUNTS AS DEAD: a button, input, select or textarea that is enabled (not :disabled, not
 * aria-disabled) and laid out (a box, not display:none, not inside [hidden]). A control hidden
 * without JavaScript (.enhanced-only) is not seen, so it is not counted.
 *
 * THE POSITIVE CONTROL is a hydration-only button planted into a real built page, outside the
 * gate, by rewriting the served HTML. If the detector cannot see that one, a clean result on the
 * routes means nothing.
 *
 * With JavaScript on: the gate lifts, and two controls that were dead act as they did before.
 *
 * Runs against out/ (freshness checked), in Chromium and WebKit.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page, webkit } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");
const BEAD = "am-nojs-dead-controls-3agt";
const SUITE = "nojs-dead-controls";

/** The bead's ten pages: four papers, three sections, three labs. */
const ROUTES = [
  "/papers/light-quanta/",
  "/papers/brownian-motion/",
  "/papers/special-relativity/",
  "/papers/mass-energy/",
  "/papers/brownian-motion/s4/",
  "/papers/special-relativity/s3/",
  "/papers/light-quanta/s8/",
  "/lab/bm-01/",
  "/lab/sr-03/",
  "/lab/lq-08/",
] as const;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const direct = resolve(OUT_DIR, `.${requested}`);
    if (direct !== OUT_DIR && !direct.startsWith(`${OUT_DIR}/`)) {
      res.writeHead(400, { "content-type": CONTENT_TYPES[".txt"] as string });
      res.end("path escapes the build directory");
      return;
    }
    for (const candidate of [direct, `${direct}.html`, join(direct, "index.html")]) {
      if (existsSync(candidate) && !candidate.endsWith("/")) {
        try {
          const body = readFileSync(candidate);
          res.writeHead(200, {
            "content-type": CONTENT_TYPES[extname(candidate)] ?? "application/octet-stream",
          });
          res.end(body);
          return;
        } catch {
          // a directory: try the next candidate
        }
      }
    }
    res.writeHead(404, { "content-type": CONTENT_TYPES[".txt"] as string });
    res.end("Not Found");
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      done({ baseUrl: `http://127.0.0.1:${port}`, server });
    });
  });
}

const logRunId = `${new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d+Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
const logDir = join(REPO_ROOT, "artifacts", "test-logs", SUITE);
function log(event: Record<string, unknown>): void {
  mkdirSync(logDir, { recursive: true });
  appendFileSync(
    join(logDir, `${logRunId}.jsonl`),
    `${JSON.stringify({ timestamp: new Date().toISOString(), suite: SUITE, logRunId, beadId: BEAD, ...event })}\n`,
  );
}

/** Every enabled, laid-out form control on the page, described so a failure names it. */
function deadControls(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, input, select, textarea, [role=button]")]
      .filter((el) => !(el.matches(":disabled") || el.getAttribute("aria-disabled") === "true"))
      .filter((el) => (el as HTMLInputElement).type !== "hidden")
      .filter((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          el.closest("[hidden]") === null &&
          box.width > 0 &&
          box.height > 0
        );
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`),
  );
}

const ENGINES = [
  { name: "chromium", launcher: chromium },
  { name: "webkit", launcher: webkit },
] as const;

test("with JavaScript off, no control on the bead's pages is enabled; with it on, they work", async (t) => {
  assertOutFreshness(OUT_DIR, REPO_ROOT);
  for (const route of ROUTES) {
    assert.ok(
      existsSync(join(OUT_DIR, route, "index.html")),
      `out/ has no ${route}: the build is incomplete`,
    );
  }
  const { baseUrl, server } = await startStaticServer();
  try {
    for (const { name, launcher } of ENGINES) {
      const browser: Browser = await launcher.launch();
      try {
        await t.test(
          `${name}: the detector sees a hydration-only button planted in a real page`,
          async () => {
            const context = await browser.newContext({ javaScriptEnabled: false });
            const page = await context.newPage();
            // Planted inside <main> but outside the gate, as a component that renders its own
            // button past the fieldset would be.
            await page.route(`${baseUrl}/lab/lq-08/`, async (route) => {
              const response = await route.fetch();
              const body = (await response.text()).replace(
                '<main id="main">',
                '<main id="main"><button type="button" data-planted="1">Planted, needs JavaScript</button>',
              );
              await route.fulfill({ response, body });
            });
            await page.goto(`${baseUrl}/lab/lq-08/`);
            const dead = await deadControls(page);
            log({
              testId: "planted",
              browser: name,
              jsEnabled: false,
              instrumentId: "lq-08",
              expected: 1,
              actual: dead.length,
              outcome: dead.length === 1 ? "pass" : "fail",
              message: dead.join("; "),
            });
            assert.deepEqual(dead, ['button "Planted, needs JavaScript"']);
            await context.close();
          },
        );

        await t.test(
          `${name}: JavaScript off, 0 dead controls on ${ROUTES.length} pages`,
          async () => {
            const context = await browser.newContext({
              javaScriptEnabled: false,
              viewport: { width: 1440, height: 900 },
            });
            const found: string[] = [];
            for (const route of ROUTES) {
              const page = await context.newPage();
              await page.goto(`${baseUrl}${route}`);
              const dead = await deadControls(page);
              log({
                testId: "js-off",
                browser: name,
                jsEnabled: false,
                anchor: route,
                expected: 0,
                actual: dead.length,
                outcome: dead.length === 0 ? "pass" : "fail",
                message: dead.join("; "),
              });
              for (const control of dead) found.push(`${route} ${control}`);
              await page.close();
            }
            await context.close();
            assert.deepEqual(found, [], `${found.length} dead control(s) with JavaScript off`);
          },
        );

        await t.test(`${name}: JavaScript on, the gate lifts and the controls act`, async () => {
          const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const page = await context.newPage();
          for (const route of ROUTES) {
            await page.goto(`${baseUrl}${route}`);
            await page.waitForSelector("fieldset.hydration-gate:not([disabled])", {
              timeout: 20000,
            });
          }
          // The Brownian entrance's view switch was dead without JavaScript: it still switches.
          await page.goto(`${baseUrl}/papers/brownian-motion/`);
          await page.waitForSelector("fieldset.hydration-gate:not([disabled])");
          const table = page.getByRole("button", { name: "Table and typed values" });
          await table.click();
          const pressed = await table.getAttribute("aria-pressed");
          log({
            testId: "js-on-toggle",
            browser: name,
            jsEnabled: true,
            paper: "brownian-motion",
            expected: "true",
            actual: pressed,
            outcome: pressed === "true" ? "pass" : "fail",
          });
          assert.equal(pressed, "true");
          // LQ-08's first preset was dead without JavaScript: it still changes the experiment.
          await page.goto(`${baseUrl}/lab/lq-08/`);
          await page.waitForSelector("fieldset.hydration-gate:not([disabled])");
          const before = await page.locator("main").innerText();
          await page.getByRole("button", { name: /Red light, 450 THz/ }).click();
          await page.waitForFunction(
            (was) => document.querySelector("main")?.innerText !== was,
            before,
          );
          const changed = (await page.locator("main").innerText()) !== before;
          log({
            testId: "js-on-preset",
            browser: name,
            jsEnabled: true,
            instrumentId: "lq-08",
            expected: true,
            actual: changed,
            outcome: changed ? "pass" : "fail",
          });
          assert.ok(changed, "the LQ-08 preset changed nothing with JavaScript on");
          await context.close();
        });
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
});
