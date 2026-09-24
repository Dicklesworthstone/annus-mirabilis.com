/**
 * With JavaScript off, no button looks usable and does nothing (am-nojs-dead-controls-3agt).
 *
 * Measured on live on 2026-09-24 with JavaScript off: 267 enabled, laid-out buttons on 41 of the
 * 197 sitemap pages, every one wired by React, and no form on the site has an action, so none
 * could work. The fix is a rule in a <noscript> in the head that hides enabled buttons
 * (src/components/chrome/noScriptControls.ts); a button a component disables until hydration stays.
 *
 * WHAT COUNTS AS DEAD: a button, a button-like input or a role=button element that is enabled (not
 * :disabled, not aria-disabled) and laid out (a box, not display:none, not inside [hidden]).
 *
 * THE POSITIVE CONTROL is a real built page served without that rule and with a hydration-only
 * button planted in it. The detector must flag the planted button; if it cannot, a clean result on
 * the routes means nothing. It is also the fix's own planted negative: the page as it was.
 *
 * With JavaScript on: the rule does not apply, and two controls that were dead act as before.
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
const PLANTED = 'button "Planted, needs JavaScript"';

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

/** Every enabled, laid-out button on the page, described so a failure names it. */
function deadControls(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "button, input[type=button], input[type=submit], input[type=reset], [role=button]",
      ),
    ]
      .filter((el) => !(el.matches(":disabled") || el.getAttribute("aria-disabled") === "true"))
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

/** Clicks until hydration has wired the control (before it, a click does nothing), then reports. */
async function actsOn(
  page: Page,
  click: () => Promise<void>,
  changed: () => Promise<boolean>,
): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await click();
    await page.waitForTimeout(250);
    if (await changed()) return true;
  }
  return false;
}

const ENGINES = [
  { name: "chromium", launcher: chromium },
  { name: "webkit", launcher: webkit },
] as const;

test("with JavaScript off, no button on the bead's pages is enabled and shown; with it on, they work", async (t) => {
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
          `${name}: served without the rule, a planted hydration-only button is flagged`,
          async () => {
            const context = await browser.newContext({ javaScriptEnabled: false });
            const page = await context.newPage();
            await page.route(`${baseUrl}/lab/lq-08/`, async (route) => {
              const response = await route.fetch();
              const html = await response.text();
              const stripped = html.replace(/<noscript><style>[^<]*<\/style><\/noscript>/, "");
              assert.notEqual(stripped, html, "the served page carries no noscript rule to strip");
              const body = stripped.replace(
                '<main id="main">',
                '<main id="main"><button type="button" data-planted="1">Planted, needs JavaScript</button>',
              );
              await route.fulfill({ response, body });
            });
            await page.goto(`${baseUrl}/lab/lq-08/`);
            const dead = await deadControls(page);
            const flagged = dead.includes(PLANTED);
            log({
              testId: "planted",
              browser: name,
              jsEnabled: false,
              instrumentId: "lq-08",
              expected: "the planted button among the dead",
              actual: dead.length,
              outcome: flagged ? "pass" : "fail",
              message: dead.join("; "),
            });
            assert.ok(flagged, `the detector missed the planted button: ${dead.join("; ")}`);
            await context.close();
          },
        );

        await t.test(
          `${name}: JavaScript off, 0 dead buttons on ${ROUTES.length} pages`,
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
            assert.deepEqual(found, [], `${found.length} dead button(s) with JavaScript off`);
          },
        );

        await t.test(`${name}: JavaScript on, the buttons are shown and act`, async () => {
          const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          const page = await context.newPage();
          // The Brownian entrance's view switch was dead without JavaScript: it still switches.
          await page.goto(`${baseUrl}/papers/brownian-motion/`);
          const table = page.getByRole("button", { name: "Table and typed values" });
          const switched = await actsOn(
            page,
            () => table.click(),
            async () => (await table.getAttribute("aria-pressed")) === "true",
          );
          log({
            testId: "js-on-toggle",
            browser: name,
            jsEnabled: true,
            paper: "brownian-motion",
            expected: true,
            actual: switched,
            outcome: switched ? "pass" : "fail",
          });
          assert.ok(switched, "the Brownian view switch did not switch with JavaScript on");
          // LQ-08's presets were dead without JavaScript: one still changes the experiment.
          await page.goto(`${baseUrl}/lab/lq-08/`);
          const preset = page.getByRole("button", { name: /Red light, 450 THz/ });
          assert.ok(await preset.isVisible(), "with JavaScript on, the noscript rule hid a preset");
          const before = await page.locator("main").innerText();
          const acted = await actsOn(
            page,
            () => preset.click(),
            async () => (await page.locator("main").innerText()) !== before,
          );
          log({
            testId: "js-on-preset",
            browser: name,
            jsEnabled: true,
            instrumentId: "lq-08",
            expected: true,
            actual: acted,
            outcome: acted ? "pass" : "fail",
          });
          assert.ok(acted, "the LQ-08 preset changed nothing with JavaScript on");
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
