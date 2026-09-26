/**
 * No row label on an /instruments/ table plate is cut short (TanElk, mail 40667).
 *
 * Live at 1440 on 2026-09-26 (55023d5c), lq-02's plate read "Share of that energy above the probe…":
 * the label ran past its two-line clamp (-webkit-line-clamp: 2) because the value column beside it
 * took a fixed share of the plate even for short numbers. 257cfa51 gives the labels room first
 * (at least 58% of a one-column plate, 46% of a two-column one) and lets the values wrap in the rest.
 * That left the band near 1280, where a 17rem minimum fitted four plates of 286px and two labels ran
 * to three lines; ac45d248 makes the minimum 18.5rem. A clamp is layout, so only a browser can see
 * it, and this reads the built pages.
 *
 * How a cut is measured: each label is laid out again unclamped, as a clone at the same width, and
 * its lines are counted from that clone's height and line height. A label that needs more than two
 * lines is cut. scrollHeight is not used: a subscript that overhangs its line (lq-06's "n_eff") makes
 * scrollHeight exceed the box by a pixel while every word shows.
 *
 * The properties, at 1024, 1280, 1440 and 390:
 * - no table-plate label needs more than two lines;
 * - non-vacuity: there are labels to measure, and at least one of them takes two lines, so wrapping
 *   is exercised and the measurement can count past one line;
 * - the label named in mail 40667 is present and whole.
 *
 * By default this serves the built site (out/, which must be fresh); with AM_E2E_ORIGIN set to a
 * deployed origin it reads that site instead. A failing lane keeps a screenshot, trace and DOM
 * snapshot, and every lane writes one JSON line to artifacts/test-logs/instrument-plates/.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { retainE2EEvidence } from "./evidence.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const SUITE = "instrument-plates";
const WIDTHS = [1024, 1280, 1440, 390] as const;
const NAMED = "Share of that energy above the probe frequency";
const REMOTE_USER_AGENT = "OpenAI File Downloader, XaiImageApiFetch/1.0";
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(rootDir: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(rootDir, decodeURIComponent(rawUrl));
    if (existsSync(filePath) && statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolveServer({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

test("no row label on an /instruments/ table plate is cut short", async (t) => {
  const deployed = process.env.AM_E2E_ORIGIN;
  if (!deployed && !existsSync(OUT_DIR)) {
    t.skip("out/ is absent and AM_E2E_ORIGIN is unset: nothing is built to read");
    return;
  }
  if (!deployed) assertOutFreshness("out", REPO_ROOT);
  const local = deployed ? undefined : await startStaticServer(OUT_DIR);
  const origin = deployed ?? local?.origin ?? "";
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const scratch = join(REPO_ROOT, "artifacts", "e2e-scratch", SUITE, logRunId);
  const browser = await chromium.launch();
  const failures: string[] = [];
  try {
    for (const width of WIDTHS) {
      const lane = `w${width}`;
      const start = performance.now();
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(deployed ? { userAgent: REMOTE_USER_AGENT } : {}),
      });
      await context.tracing.start({ screenshots: true, snapshots: true });
      const page = await context.newPage();
      const consoleLines: string[] = [];
      page.on("console", (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
      await page.goto(`${origin}/instruments/`, { waitUntil: "load", timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".plate-table-label")].map((label) => {
          const clone = label.cloneNode(true) as HTMLElement;
          const width = label.getBoundingClientRect().width;
          clone.style.cssText = `display:block;-webkit-line-clamp:unset;line-clamp:none;overflow:visible;position:absolute;visibility:hidden;width:${width}px`;
          label.parentElement?.appendChild(clone);
          const lineHeight = Number.parseFloat(getComputedStyle(clone).lineHeight);
          const lines = Math.round(clone.getBoundingClientRect().height / lineHeight);
          clone.remove();
          return {
            text: (label.textContent ?? "").trim(),
            lines,
            plate: label.closest("a")?.getAttribute("href") ?? "",
          };
        }),
      );
      const found: string[] = [];
      if (labels.length === 0) found.push("no table-plate labels to measure");
      if (!labels.some((l) => l.lines === 2)) found.push("no label wraps to two lines");
      for (const l of labels.filter((l) => l.lines > 2))
        found.push(`${l.plate}: "${l.text}" needs ${l.lines} lines and is cut at two`);
      if (!labels.some((l) => l.text === NAMED)) found.push(`"${NAMED}" is not on the page`);
      let evidence: Record<string, string> | undefined;
      if (found.length > 0) {
        mkdirSync(scratch, { recursive: true });
        const base = join(scratch, lane);
        const capture = {
          screenshot: `${base}.png`,
          trace: `${base}.trace.zip`,
          dom: `${base}.dom.html`,
          console: `${base}.console.log`,
          network: `${base}.network.log`,
        };
        await page.screenshot({ path: capture.screenshot, fullPage: true }).catch(() => {});
        await context.tracing.stop({ path: capture.trace }).catch(() => {});
        writeFileSync(capture.dom, await page.content().catch(() => ""));
        writeFileSync(capture.console, consoleLines.join("\n"));
        writeFileSync(capture.network, "");
        const retained = await retainE2EEvidence(
          {
            suite: SUITE,
            logRunId,
            testId: `instrument-plates-${lane}`,
            lane,
            outcome: "failed",
            message: found.join("; "),
          },
          capture,
        );
        evidence = Object.fromEntries(
          Object.entries(capture).map(([kind, source]) => [
            kind,
            retained.copied.find((copy) => copy.endsWith(source.slice(source.lastIndexOf("/")))) ??
              source,
          ]),
        );
        failures.push(`${lane}: ${found.join("; ")}`);
      } else {
        await context.tracing.stop();
      }
      const summary = `${labels.length} labels, ${labels.filter((l) => l.lines === 2).length} on two lines, most ${Math.max(0, ...labels.map((l) => l.lines))}`;
      logger.log({
        testId: `instrument-plates-${lane}`,
        expected: "every table-plate label fits its two lines; at least one takes two",
        // Line counts are integers compared exactly.
        comparisonKind: "bitwise",
        actual: found.length === 0 ? summary : found.join("; "),
        outcome: found.length === 0 ? "passed" : "failed",
        durationMs: Math.round(performance.now() - start),
        browser: "chromium",
        viewport: `${width}x900`,
        jsEnabled: true,
        message: `${lane}: ${found.length === 0 ? summary : found.join("; ")}`,
        ...(evidence ? { evidence } : {}),
      });
      await context.close();
    }
  } finally {
    await browser.close();
    local?.server.close();
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
