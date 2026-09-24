/**
 * A printed page carries every equation its step drawers hold (am-plat-print-3orn).
 *
 * Measured on live on 2026-09-24 under print emulation: closed step drawers printed nothing, so
 * /papers/brownian-motion/s4/ printed 50 of the 233 equations a reader brings on screen by opening
 * them; relativity s3, 69 of 109; light quanta s8, 26 of 37; mass and energy, 76 of 160. The print
 * stylesheet (src/platform/print/sitePrint.css) now opens the step drawers, and the drawers that
 * hold the missing-step explorer's transitions, through ::details-content.
 *
 * THE MEASURE: equations (top-level .katex in main) laid out on screen with those drawers opened,
 * against equations laid out under print media with them closed, as a reader would leave them.
 * The companion column is left out of both sides: print hides it on purpose, because its symbol
 * key repeats the legend every formula already carries.
 *
 * SECTION PAGES, because they are the pages that print whole. On a whole-paper page the "Explore
 * the equations in this step" cards load on first opening (LazyArgumentEquations.tsx, a budget
 * decision), so until a reader opens one, the page holds a link to the section page instead of the
 * cards, and that link is what prints. Measured on /papers/mass-energy/ on a build: opening every
 * drawer brought 4 equations on screen that the unopened page cannot print.
 *
 * THE PLANTED NEGATIVE is the stylesheet as it was, with the step-drawer block removed: the same
 * pages must then print fewer equations than they show, or the measure cannot see the defect.
 *
 * Runs against out/ (freshness checked; out/print.css must be sitePrint.css), Chromium and WebKit.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, type Page, webkit } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");
const SOURCE = join(REPO_ROOT, "src", "platform", "print", "sitePrint.css");
const ROUTES = [
  "/papers/brownian-motion/s4/",
  "/papers/special-relativity/s3/",
  "/papers/light-quanta/s8/",
  "/papers/mass-energy/s0/",
] as const;
/** The drawers print opens, as the reader would open them on screen. */
const STEP_DRAWERS = "main details.local-steps, main details:has(.missing-step-math)";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function startStaticServer(): Promise<{ baseUrl: string; server: Server }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const direct = resolve(OUT_DIR, `.${requested}`);
    if (direct !== OUT_DIR && !direct.startsWith(`${OUT_DIR}/`)) {
      res.writeHead(400);
      res.end();
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
    res.writeHead(404);
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

/** Indices of the top-level equations in main, outside the companion column, that are laid out. */
function laidOut(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("main .katex")]
      .filter((e) => !e.parentElement?.closest(".katex"))
      .filter((e) => !e.closest(".reader-companion-column"))
      .map((e, i) =>
        e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0 ? i : -1,
      )
      .filter((i) => i >= 0),
  );
}

async function measure(page: Page, url: string) {
  await page.emulateMedia({ media: "screen" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate((selector) => {
    for (const d of document.querySelectorAll<HTMLDetailsElement>(selector)) d.open = true;
  }, STEP_DRAWERS);
  const screen = await laidOut(page);
  await page.evaluate((selector) => {
    for (const d of document.querySelectorAll<HTMLDetailsElement>(selector)) d.open = false;
  }, STEP_DRAWERS);
  await page.emulateMedia({ media: "print" });
  const printed = await laidOut(page);
  return { screen, printed, missing: screen.filter((i) => !printed.includes(i)) };
}

/** The stylesheet as it was before the step drawers printed open. */
function withoutStepDrawers(css: string): string {
  const start = css.indexOf("/* The step drawers print open");
  const end = css.indexOf("/* --- The reading layout");
  assert.ok(start > 0 && end > start, "the step-drawer block was not found to remove");
  return css.slice(0, start) + css.slice(end);
}

for (const { name, launcher } of [
  { name: "chromium", launcher: chromium },
  { name: "webkit", launcher: webkit },
] as const) {
  test(`${name}: a printed page carries every equation its step drawers hold`, async (t) => {
    assertOutFreshness(OUT_DIR, REPO_ROOT);
    const source = readFileSync(SOURCE, "utf8");
    assert.equal(
      readFileSync(join(OUT_DIR, "print.css"), "utf8"),
      source,
      "out/print.css is not src/platform/print/sitePrint.css: rebuild",
    );
    const { baseUrl, server } = await startStaticServer();
    const browser = await launcher.launch();
    try {
      await t.test("printed equals on screen, with the drawers the reader would open", async () => {
        const page = await (
          await browser.newContext({ viewport: { width: 1440, height: 900 } })
        ).newPage();
        const report: string[] = [];
        for (const route of ROUTES) {
          const { screen, printed, missing } = await measure(page, `${baseUrl}${route}`);
          assert.ok(screen.length > 0, `${route}: no equations on screen, so nothing was measured`);
          report.push(`${route} printed ${printed.length} of ${screen.length}`);
          assert.deepEqual(
            missing,
            [],
            `${route}: ${missing.length} equation(s) on screen do not print`,
          );
        }
        t.diagnostic(report.join("; "));
      });

      await t.test("planted negative: the stylesheet as it was drops equations", async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await context.route(`${baseUrl}/print.css`, (route) =>
          route.fulfill({ status: 200, contentType: "text/css", body: withoutStepDrawers(source) }),
        );
        const page = await context.newPage();
        const { screen, missing } = await measure(page, `${baseUrl}${ROUTES[0]}`);
        t.diagnostic(
          `${ROUTES[0]} without the block: ${missing.length} of ${screen.length} do not print`,
        );
        assert.ok(
          missing.length > 0,
          "the old stylesheet printed every equation: the measure is blind",
        );
      });
    } finally {
      await browser.close();
      server.close();
    }
  });
}
