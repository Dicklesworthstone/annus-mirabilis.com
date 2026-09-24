import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { type BrowserContext, chromium, type Page } from "playwright";
import { ENTROPY_TEMPERATURE_CHECK } from "../foundations/lessonInstruments.ts";
import { OSMOTIC_ROWS } from "../foundations/osmoticRows.ts";
import { artifactsRoot, getLogger } from "./log/logger.ts";
import { logPlaywrightStep } from "./log/playwright.ts";
import { checkOutFreshness } from "./outFreshness.ts";

/**
 * am-found-transport-thermo-smv3, browser lane. Two journeys from the bead's test plan:
 *
 * - "From Brownian §1 (or its nearest existing passage in the reference slice), open
 *   foundation:free-energy-osmotic-pressure at 320 px with keyboard only and return to the exact
 *   sentence." Brownian §§1-3 have no routes; the nearest passage that opens this lesson is §5's
 *   arg-bm-diffusivity, on /papers/brownian-motion/s5/.
 * - "Open foundation:entropy-temperature standalone with JavaScript enabled and disabled, and
 *   assert the static worked example and the status line." The status line stood in for the
 *   laboratory until lq-04-derived-temperature was registered; it is registered, so the journey
 *   asserts the laboratory link in its place and that the line is absent.
 *
 * Target: a fresh out/, served here, or E2E_BASE_URL, the variable the vertical-slice harness
 * reads, for a deployed site. An absent out/ fails as not-available rather than skipping, and a
 * stale one is refused, as in foundCalculus.e2e.test.ts.
 */

const SUITE = "found-transport-e2e";
const BEAD = "am-found-transport-thermo-smv3";
const USER_AGENT = "OpenAI File Downloader, XaiImageApiFetch/1.0";
const LESSON = "free-energy-osmotic-pressure";
const PASSAGE = "/papers/brownian-motion/s5/";
const ANCHOR = "arg-bm-diffusivity";
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

type Target = Readonly<{ url: string; close: () => Promise<void> }>;

async function target(): Promise<Target> {
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

type JourneyMeta = Readonly<{
  testId: string;
  viewport: string;
  reducedMotion: boolean;
  jsEnabled: boolean;
}>;

/** Runs one journey; logs it; on failure keeps a screenshot, the DOM and the console. */
async function journey(page: Page, meta: JourneyMeta, body: () => Promise<string>) {
  const logger = getLogger(SUITE);
  const step = {
    suite: SUITE,
    logRunId: logger.logRunId,
    testId: meta.testId,
    beadId: BEAD,
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
    const dir = join(artifactsRoot(), SUITE, logger.logRunId);
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
}

/** Presses Tab until the element matching `selector` has focus; returns the number of presses. */
async function tabUntil(page: Page, selector: string, limit: number): Promise<number> {
  for (let presses = 1; presses <= limit; presses++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector))
      return presses;
  }
  return assert.fail(`${selector} did not receive focus within ${limit} presses of Tab`);
}

test("from Brownian §5, the osmotic lesson opens and closes by keyboard at 320 px, and focus returns to the calling link", async () => {
  const site = await target();
  const browser = await chromium.launch();
  let context: BrowserContext | undefined;
  try {
    // Reduced motion: the site scrolls smoothly, so a position read mid-scroll measures a moment,
    // not a place. Measured on live: with smooth scrolling the link read 947 px down before it
    // had finished arriving.
    context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 320, height: 700 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const meta = {
      testId: "osmotic-lesson-keyboard-round-trip-320",
      viewport: "320x700",
      reducedMotion: true,
      jsEnabled: true,
    };
    await journey(page, meta, async () => {
      await page.goto(`${site.url}${PASSAGE}#${ANCHOR}`, { waitUntil: "networkidle" });
      const presses = await tabUntil(page, `a[data-foundation="${LESSON}"]`, 20);
      const link = await page.evaluateHandle(() => document.activeElement as HTMLElement);
      assert.equal(
        await link.evaluate((el, anchor) => el.closest(`#${anchor}`) !== null, ANCHOR),
        true,
        `the link Tab reached is inside #${ANCHOR}`,
      );
      const topBefore = await link.evaluate((el) => el.getBoundingClientRect().top);

      for (const close of ["Escape", "the close button"] as const) {
        await page.keyboard.press("Enter");
        await page.waitForSelector(
          `dialog[open] [data-foundation-construction="${LESSON}"] table tbody tr`,
        );
        const opened = await page.evaluate((lesson) => {
          const dialog = document.querySelector("dialog[open]");
          const table = dialog?.querySelector(`[data-foundation-construction="${lesson}"] table`);
          return {
            modal: dialog?.matches(":modal") ?? false,
            focus: document.activeElement?.id ?? "",
            rows: table?.querySelectorAll("tbody tr").length ?? 0,
            open: new URLSearchParams(location.search).get("open"),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, LESSON);
        assert.deepEqual(opened, {
          modal: true,
          focus: `clarification-${LESSON}`,
          rows: OSMOTIC_ROWS.length,
          open: `foundation:${LESSON}`,
          overflow: 0,
        });

        if (close === "Escape") await page.keyboard.press("Escape");
        else {
          // The close control is the dialog's first focusable, one Shift+Tab before the heading.
          await page.keyboard.press("Shift+Tab");
          const label = await page.evaluate(() =>
            document.activeElement?.tagName === "BUTTON"
              ? document.activeElement.getAttribute("aria-label")
              : null,
          );
          assert.match(label ?? "", /return to the passage/i);
          await page.keyboard.press("Enter");
        }
        await page.waitForFunction(() => document.querySelector("dialog[open]") === null);
        const back = await link.evaluate((el) => ({
          focused: document.activeElement === el,
          top: el.getBoundingClientRect().top,
          search: location.search,
          hash: location.hash,
        }));
        assert.equal(back.focused, true, `after ${close}, focus is back on the calling link`);
        assert.ok(
          Math.abs(back.top - topBefore) <= 1,
          `after ${close}, the link is where it was (${back.top} against ${topBefore})`,
        );
        assert.equal(back.search, "");
        assert.equal(back.hash, `#${ANCHOR}`);
      }
      return `Tab reached the lesson link in #${ANCHOR} after ${presses}; opened twice, closed by Escape and by the close button, focus and position restored each time`;
    });
  } finally {
    await context?.close();
    await browser.close();
    await site.close();
  }
});

test("entropy-temperature, standalone, with JavaScript on and off: the worked check, the laboratory link, and a disclosure that is never empty", async () => {
  const site = await target();
  const browser = await chromium.launch();
  const { instrumentId, temperatureK } = ENTROPY_TEMPERATURE_CHECK;
  try {
    for (const jsEnabled of [true, false]) {
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 320, height: 800 },
        reducedMotion: "reduce",
        javaScriptEnabled: jsEnabled,
      });
      const page = await context.newPage();
      const meta = {
        testId: `entropy-temperature-standalone-js-${jsEnabled ? "on" : "off"}`,
        viewport: "320x800",
        reducedMotion: true,
        jsEnabled,
      };
      try {
        await journey(page, meta, async () => {
          await page.goto(`${site.url}/foundations/entropy-temperature/`, {
            waitUntil: "networkidle",
          });
          const root = page.locator('[data-foundation-construction="entropy-temperature"]');
          const worked = await root.evaluate((r) => ({
            steps: r.querySelectorAll(".derivation-steps li").length,
            text: (r.textContent ?? "").replace(/\s+/g, " "),
            labLinks: [...r.querySelectorAll("a[href]")]
              .filter((a) => !a.closest("details"))
              .map((a) => a.getAttribute("href")),
            status: r.querySelector(".construction-status")?.textContent ?? null,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }));
          assert.equal(worked.steps, 4);
          assert.ok(worked.text.includes(`1 ÷ ${temperatureK} = 3.333 × 10⁻⁴ per kelvin`));
          assert.deepEqual(worked.labLinks, [`/lab/${instrumentId}/`]);
          assert.equal(worked.status, null, "the preset is registered, so no status line");
          assert.equal(worked.overflow, 0);

          await root.locator("summary").press("Enter");
          if (jsEnabled) {
            const frame = root.locator("details iframe");
            await frame.waitFor();
            assert.equal(await frame.getAttribute("src"), `/embed/lab/${instrumentId}/`);
            const inside = await page
              .frameLocator('[data-foundation-construction="entropy-temperature"] details iframe')
              .locator("body")
              .innerText({ timeout: 15_000 });
            assert.ok(inside.includes(String(temperatureK)), "the workbench shows the state");
            return `worked check and laboratory link present; the disclosure loaded /embed/lab/${instrumentId}/ showing ${temperatureK} K`;
          }
          const opened = await root.locator("details").evaluate((d, id) => {
            const link = d.querySelector(`a[href="/lab/${id}/"]`);
            return {
              open: (d as HTMLDetailsElement).open,
              linkHeight: link?.getBoundingClientRect().height ?? 0,
            };
          }, instrumentId);
          assert.equal(opened.open, true);
          assert.ok(
            opened.linkHeight > 0,
            "without JavaScript the opened disclosure holds a visible link to the laboratory",
          );
          return "worked check and laboratory link present; without JavaScript the opened disclosure links to the laboratory's page";
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await site.close();
  }
});
