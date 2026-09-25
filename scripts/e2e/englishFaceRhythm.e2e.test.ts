/**
 * The English faces keep the German face's paragraph rhythm, and an "Alternative translations"
 * disclosure is a quiet line under its paragraph, in a real browser (dispatch 210).
 *
 * Measured on a local build at 1440 on 2026-09-25: English paragraphs stood 84px apart text to text
 * where the German face's stand 21-35px. The English list was a flex column, so each paragraph's
 * margins (1em each, from .reader-root p) did not collapse and a 1.5rem flex gap came on top: about
 * 3em between paragraph boxes against the German face's 1em. Each disclosure was a full-width grey
 * box 62px tall standing 67px below its paragraph and 68px above the next.
 *
 * The properties, at 390 and 1440 on relativity, light quanta and Brownian:
 * - the English face's median gap between consecutive paragraph boxes, in ems of the paragraph's own
 *   type, is at most the German face's plus 0.25em. The German reference is the paper's own German
 *   face where its paragraphs stand as siblings (the draft face), and otherwise light quanta's at
 *   the same width: relativity's German face sets each paragraph in its own block wrapper beside
 *   its "Explained in" line, so it has no paragraph-to-paragraph gap to measure;
 * - every disclosure has no fill and no border, and one that follows a paragraph starts within half
 *   a line of it;
 * - no child of the English text, or of a parallel row's English half, overlaps the next;
 * - with JavaScript off, the English face's first disclosure is in the Tab order, and Enter opens it
 *   and closes it.
 * Box gaps rather than text: a paragraph holding a display formula reports KaTeX's tall glyph boxes
 * among its text rects, which read as a negative gap.
 *
 * By default this serves the built site (out/, which must be fresh); with AM_E2E_ORIGIN set to a
 * deployed origin it reads that site instead. A failing lane keeps a screenshot, trace and DOM
 * snapshot, and every lane writes one JSON line to artifacts/test-logs/english-face-rhythm/.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { retainE2EEvidence } from "./evidence.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const SUITE = "english-face-rhythm";
const PAPERS = ["special-relativity", "light-quanta", "brownian-motion"] as const;
const WIDTHS = [390, 1440] as const;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
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

/** Median gap between consecutive paragraph boxes that share a parent, in ems of their type. */
async function paragraphGapEm(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const ps = [...document.querySelectorAll<HTMLElement>(sel)].filter(
      (p) => (p.textContent ?? "").trim().length > 40 && p.getBoundingClientRect().height > 0,
    );
    const gaps: number[] = [];
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i] as HTMLElement;
      const b = ps[i + 1] as HTMLElement;
      if (a.nextElementSibling !== b) continue;
      const em = Number.parseFloat(getComputedStyle(a).fontSize);
      gaps.push((b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) / em);
    }
    gaps.sort((x, y) => x - y);
    return { n: gaps.length, median: gaps.length ? (gaps[gaps.length >> 1] ?? 0) : null };
  }, selector);
}

/** The disclosures and the stacking of the English text's children. */
async function englishLayout(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const disclosures = [
      ...document.querySelectorAll<HTMLElement>("details.unresolved-alternatives"),
    ];
    for (const d of disclosures) {
      const cs = getComputedStyle(d);
      const alpha = cs.backgroundColor.match(/rgba?\(([^)]+)\)/)?.[1]?.split(",")[3];
      const filled =
        cs.backgroundColor !== "transparent" && (alpha === undefined || Number(alpha) > 0);
      if (filled) problems.push(`${d.dataset.unitId}: disclosure filled ${cs.backgroundColor}`);
      if (Number.parseFloat(cs.borderTopWidth) > 0)
        problems.push(`${d.dataset.unitId}: disclosure bordered ${cs.borderTopWidth}`);
      const prev = d.previousElementSibling as HTMLElement | null;
      if (prev?.classList.contains("translation-paragraph")) {
        const lh = Number.parseFloat(getComputedStyle(prev).lineHeight);
        const gap = d.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
        if (gap > lh / 2)
          problems.push(`${d.dataset.unitId}: disclosure ${Math.round(gap)}px below its paragraph`);
      }
    }
    let pairs = 0;
    for (const parent of document.querySelectorAll(
      "[data-translation-body], .parallel-half-english",
    )) {
      const kids = [...parent.children].filter((k) => k.getBoundingClientRect().height > 0);
      for (let i = 0; i + 1 < kids.length; i++) {
        pairs++;
        const a = (kids[i] as Element).getBoundingClientRect();
        const b = (kids[i + 1] as Element).getBoundingClientRect();
        if (b.top < a.bottom - 0.5)
          problems.push(
            `${(kids[i] as Element).className} overlaps the next by ${Math.round(a.bottom - b.top)}px`,
          );
      }
    }
    return { problems, disclosures: disclosures.length, pairs };
  });
}

/**
 * With JavaScript off, the first disclosure's summary takes focus and Enter opens it and closes it
 * again: the line is a native <details>, not a hydrated button. Null when the face has none.
 */
async function keyboardWithoutScript(page: Page): Promise<string | null> {
  const summary = page.locator("details.unresolved-alternatives > summary").first();
  if ((await summary.count()) === 0) return null;
  await summary.focus();
  const state = () =>
    summary.evaluate((s) => ({
      focused: document.activeElement === s,
      open: (s.parentElement as HTMLDetailsElement).open,
    }));
  if (!(await state()).focused) return "the alternatives line does not take focus";
  // focus() reaches an element with tabindex -1 too; Tab order is what a keyboard reader has.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const before = await state();
  if (!before.focused) return "the alternatives line is not in the Tab order";
  if (before.open) return "the alternatives line starts open";
  await page.keyboard.press("Enter");
  if (!(await state()).open) return "Enter does not open the alternatives line without JavaScript";
  await page.keyboard.press("Enter");
  if ((await state()).open) return "Enter does not close the alternatives line again";
  return "";
}

test("the English faces keep the German rhythm, and alternatives are a quiet line (dispatch 210)", {
  timeout: 300_000,
}, async () => {
  const remote = process.env.AM_E2E_ORIGIN?.replace(/\/$/, "");
  let freshnessNote = `deployed site ${remote}`;
  let server: Server | null = null;
  let origin = remote ?? "";
  if (!remote) {
    freshnessNote = `out/ ${assertOutFreshness("out", REPO_ROOT).reason ?? "fresh"}`;
    assert.ok(existsSync(join(OUT_DIR, "papers")), "out/ has no /papers/");
    ({ server, origin } = await startStaticServer(OUT_DIR));
  }
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const scratch = join(REPO_ROOT, "artifacts", "e2e-scratch", SUITE, logRunId);
  mkdirSync(scratch, { recursive: true });
  const failures: string[] = [];
  let gapsMeasured = 0;
  let disclosures = 0;
  let pairs = 0;
  let keyboardChecked = 0;
  const browser: Browser = await chromium.launch({ headless: true });
  /** Light quanta's German paragraph gap at each width: the reference where a paper has none. */
  const reference = new Map<number, number | null>();
  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
      });
      const page = await context.newPage();
      await page.goto(`${origin}/papers/light-quanta/view/german/`, { waitUntil: "load" });
      reference.set(width, (await paragraphGapEm(page, "[data-german-draft] p")).median);
      await context.close();
    }
    for (const paper of PAPERS)
      for (const width of WIDTHS) {
        const lane = `${paper}-${width}`;
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
        });
        await context.tracing.start({ screenshots: true, snapshots: true });
        const page = await context.newPage();
        const consoleLines: string[] = [];
        const network: string[] = [];
        page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
        page.on("pageerror", (e) => consoleLines.push(`pageerror: ${String(e)}`));
        page.on("response", (r) => network.push(`${r.status()} ${r.url()}`));
        const start = performance.now();
        const found: string[] = [];
        let summary = "";
        try {
          await page.goto(`${origin}/papers/${paper}/view/german/`, { waitUntil: "load" });
          const own = await paragraphGapEm(page, "[data-german-draft] p, p.source-paragraph");
          const german = { n: own.n, median: own.median ?? reference.get(width) ?? null };
          await page.goto(`${origin}/papers/${paper}/view/english/`, { waitUntil: "load" });
          const english = await paragraphGapEm(
            page,
            "[data-translation-body] > p.translation-paragraph",
          );
          const layout = await englishLayout(page);
          await page.goto(`${origin}/papers/${paper}/view/parallel/`, { waitUntil: "load" });
          const parallel = await englishLayout(page);
          const noScript = await browser.newContext({
            viewport: { width, height: 900 },
            javaScriptEnabled: false,
            ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
          });
          const plain = await noScript.newPage();
          await plain.goto(`${origin}/papers/${paper}/view/english/`, { waitUntil: "load" });
          const keyboard = await keyboardWithoutScript(plain);
          await noScript.close();
          if (keyboard !== null) keyboardChecked++;
          if (keyboard) found.push(`no-js: ${keyboard}`);
          gapsMeasured += english.n;
          disclosures += layout.disclosures + parallel.disclosures;
          pairs += layout.pairs + parallel.pairs;
          if (english.median === null || german.median === null)
            found.push(`no paragraph gap to compare (English ${english.n}, German ${german.n})`);
          else if (english.median > german.median + 0.25)
            found.push(
              `English paragraphs ${english.median.toFixed(2)}em apart, German ${german.median.toFixed(2)}em`,
            );
          found.push(...layout.problems.map((p) => `english: ${p}`));
          found.push(...parallel.problems.map((p) => `parallel: ${p}`));
          summary = `gap English ${english.median?.toFixed(2)}em, German ${german.median?.toFixed(2)}em; ${layout.disclosures + parallel.disclosures} disclosures; ${layout.pairs + parallel.pairs} sibling pairs`;
        } catch (error) {
          found.push(`could not measure: ${String(error)}`);
        }
        let evidence: Record<string, string> | undefined;
        if (found.length > 0) {
          const base = join(scratch, lane);
          const capture = {
            screenshot: `${base}.png`,
            trace: `${base}.trace.zip`,
            dom: `${base}.dom.html`,
            console: `${base}.console.log`,
            network: `${base}.network.log`,
          };
          await page.screenshot({ path: capture.screenshot, fullPage: false }).catch(() => {});
          await context.tracing.stop({ path: capture.trace }).catch(() => {});
          writeFileSync(capture.dom, await page.content().catch(() => ""));
          writeFileSync(capture.console, consoleLines.join("\n"));
          writeFileSync(capture.network, network.join("\n"));
          const retained = await retainE2EEvidence(
            {
              suite: SUITE,
              logRunId,
              testId: `english-face-rhythm-${lane}`,
              lane,
              outcome: "failed",
              message: found.join("; "),
            },
            capture,
          );
          const kept = (source: string) =>
            retained.copied.find((copy) => copy.endsWith(source.slice(source.lastIndexOf("/")))) ??
            source;
          evidence = Object.fromEntries(
            Object.entries(capture).map(([kind, source]) => [kind, kept(source)]),
          );
          failures.push(`${lane}: ${found.join("; ")}`);
        } else {
          await context.tracing.stop();
        }
        logger.log({
          testId: `english-face-rhythm-${lane}`,
          paper,
          expected:
            "English gap <= German + 0.25em; disclosures unfilled, unbordered, within half a line; no overlap",
          actual: summary || found.join("; "),
          comparisonKind: "tolerance",
          tolerance: { absolute: 0.25 },
          outcome: found.length === 0 ? "passed" : "failed",
          durationMs: Math.round(performance.now() - start),
          browser: "chromium",
          viewport: `${width}x900`,
          jsEnabled: true,
          message: found.length === 0 ? `${lane}: ${summary}` : found.join("; "),
          ...(evidence ? { evidence } : {}),
        });
        await context.close();
      }
  } finally {
    await browser.close();
    logger.flushSync();
    server?.close();
  }
  console.log(
    `[english face rhythm] ${gapsMeasured} English paragraph gaps, ${disclosures} disclosures, ${pairs} sibling pairs, ${keyboardChecked} lanes opened a disclosure by keyboard without JavaScript (${freshnessNote})`,
  );
  assert.ok(gapsMeasured > 0, "no English paragraph gap was measured");
  assert.ok(disclosures > 0, "no alternatives disclosure was examined");
  assert.ok(keyboardChecked > 0, "no disclosure was operated by keyboard without JavaScript");
  assert.deepEqual(failures, []);
});
