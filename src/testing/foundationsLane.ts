import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { JSHandle, Page } from "playwright";
import { artifactsRoot, getLogger } from "./log/logger.ts";
import { logPlaywrightStep } from "./log/playwright.ts";
import { checkOutFreshness } from "./outFreshness.ts";

/**
 * What the foundations browser lanes share (foundTransport.e2e.test.ts, foundInference.e2e.test.ts):
 * where to point the browser, how a journey is logged and what a failure keeps, and the lesson
 * drawer's keyboard round trip from a passage and back.
 *
 * Target: a fresh out/, served here, or E2E_BASE_URL, the variable the vertical-slice harness
 * reads, for a deployed site. An absent out/ fails as not-available rather than skipping, and a
 * stale one is refused, as in foundCalculus.e2e.test.ts.
 */

export const LANE_USER_AGENT = "OpenAI File Downloader, XaiImageApiFetch/1.0";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

export type LaneTarget = Readonly<{ url: string; close: () => Promise<void> }>;

export async function laneTarget(): Promise<LaneTarget> {
  const base = process.env.E2E_BASE_URL;
  if (base) return { url: base.replace(/\/$/, ""), close: async () => {} };
  const freshness = checkOutFreshness("out");
  if (!freshness.present)
    assert.fail(
      "out/ is absent and E2E_BASE_URL is unset, so this lane has nothing to open. This is " +
        "not-available, not a pass. Run bun run build, or point E2E_BASE_URL at a deployment.",
    );
  if (!freshness.fresh) assert.fail(`out/ is STALE: ${freshness.reason}`);
  const root = resolve("out");
  const server: Server = createServer(async (req, res) => {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
    );
    if ((await stat(file).catch(() => null))?.isDirectory()) file = resolve(file, "index.html");
    try {
      res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", () => done()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

export type JourneyMeta = Readonly<{
  testId: string;
  viewport: string;
  reducedMotion: boolean;
  jsEnabled: boolean;
}>;

/**
 * A journey runner for one suite: each journey is logged, and a failure keeps a screenshot, the
 * DOM and the console under artifacts/test-logs/<suite>/<log-run-id>/evidence/.
 */
export function journeyRunner(suite: string, beadId: string) {
  return async function journey(page: Page, meta: JourneyMeta, body: () => Promise<string>) {
    const logger = getLogger(suite);
    const step = {
      suite,
      logRunId: logger.logRunId,
      testId: meta.testId,
      beadId,
      browser: "chromium",
      viewport: meta.viewport,
      reducedMotion: meta.reducedMotion,
      jsEnabled: meta.jsEnabled,
      lane: "foundations",
      journey: meta.testId,
    };
    const consoleLines: string[] = [];
    page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => consoleLines.push(`pageerror: ${e.message}`));
    const started = Date.now();
    try {
      const message = await body();
      logPlaywrightStep(step, "passed", { durationMs: Date.now() - started, message });
    } catch (error) {
      const dir = join(artifactsRoot(), suite, logger.logRunId, "evidence");
      await mkdir(dir, { recursive: true });
      const evidence = {
        screenshot: join(dir, `${meta.testId}.png`),
        dom: join(dir, `${meta.testId}.html`),
        console: join(dir, `${meta.testId}.console.txt`),
      };
      await page.screenshot({ path: evidence.screenshot }).catch(() => undefined);
      await writeFile(evidence.dom, await page.content().catch(() => ""), "utf8");
      await writeFile(evidence.console, consoleLines.join("\n"), "utf8");
      logPlaywrightStep(step, "failed", {
        durationMs: Date.now() - started,
        message: String(error).slice(0, 400),
        evidence,
      });
      throw error;
    } finally {
      await logger.flush();
    }
  };
}

/** Presses Tab (or Shift+Tab) until the element matching `selector` has focus; returns the presses. */
export async function tabUntil(
  page: Page,
  selector: string,
  limit: number,
  key: "Tab" | "Shift+Tab" = "Tab",
): Promise<number> {
  for (let presses = 1; presses <= limit; presses++) {
    await page.keyboard.press(key);
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector))
      return presses;
  }
  return assert.fail(`${selector} did not receive focus within ${limit} presses of ${key}`);
}

/**
 * From a passage's anchor, Tab to the first link that opens `lesson` and check it sits inside the
 * passage. Returns the link, its position, and the presses it took. Use reduced motion: the site
 * scrolls smoothly, so a position read mid-scroll measures a moment, not a place.
 */
export async function focusLessonLink(page: Page, url: string, anchor: string, lesson: string) {
  await page.goto(`${url}#${anchor}`, { waitUntil: "networkidle" });
  const presses = await tabUntil(page, `a[data-foundation="${lesson}"]`, 30);
  const link = await page.evaluateHandle(() => document.activeElement as HTMLElement);
  assert.equal(
    await link.evaluate((el, a) => el.closest(`#${a}`) !== null, anchor),
    true,
    `the link Tab reached is inside #${anchor}`,
  );
  const top = await link.evaluate((el) => el.getBoundingClientRect().top);
  return { link, top, presses };
}

/** Enter on the focused lesson link opens the modal drawer with focus on the lesson's heading. */
export async function openDrawer(page: Page, lesson: string) {
  await page.keyboard.press("Enter");
  await page.waitForSelector(`dialog[open] [data-foundation-construction="${lesson}"]`);
  const opened = await page.evaluate(() => ({
    modal: document.querySelector("dialog[open]")?.matches(":modal") ?? false,
    focus: document.activeElement?.id ?? "",
    open: new URLSearchParams(location.search).get("open"),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.deepEqual(opened, {
    modal: true,
    focus: `clarification-${lesson}`,
    open: `foundation:${lesson}`,
    overflow: 0,
  });
}

const CLOSE_BUTTON = 'dialog[open] button[aria-label*="return to the passage" i]';

/**
 * Close the drawer by Escape or by its close control (the dialog's first focusable, one Shift+Tab
 * before the heading), and check focus is back on the calling link, where it was, with the query
 * gone and the passage's hash kept.
 */
export async function closeDrawer(
  page: Page,
  how: "Escape" | "the close button",
  back: Readonly<{ link: JSHandle<HTMLElement>; top: number; anchor: string }>,
) {
  if (how === "Escape") await page.keyboard.press("Escape");
  else {
    // From the heading this is one press; from a control inside the lesson, a few more.
    await tabUntil(page, CLOSE_BUTTON, 60, "Shift+Tab");
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction(() => document.querySelector("dialog[open]") === null);
  const state = await back.link.evaluate((el) => ({
    focused: document.activeElement === el,
    top: el.getBoundingClientRect().top,
    search: location.search,
    hash: location.hash,
  }));
  assert.equal(state.focused, true, `after ${how}, focus is back on the calling link`);
  assert.ok(
    Math.abs(state.top - back.top) <= 1,
    `after ${how}, the link is where it was (${state.top} against ${back.top})`,
  );
  assert.equal(state.search, "");
  assert.equal(state.hash, `#${back.anchor}`);
}
