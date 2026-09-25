/**
 * The English faces keep the German face's paragraph rhythm and headings, and show no "Alternative
 * translations" disclosure, in a real browser (dispatch 210; dispatch 222).
 *
 * Measured on a local build at 1440 on 2026-09-25: English paragraphs stood 84px apart text to text
 * where the German face's stand 21-35px. The English list was a flex column, so each paragraph's
 * margins (1em each, from .reader-root p) did not collapse and a 1.5rem flex gap came on top: about
 * 3em between paragraph boxes against the German face's 1em.
 *
 * The properties, at 390 and 1440 on relativity, light quanta and Brownian:
 * - the English face's median gap between consecutive paragraph boxes, in ems of the paragraph's own
 *   type, is at most the German face's plus 0.25em. The German reference is the paper's own German
 *   face where its paragraphs stand as siblings (the draft face), and otherwise light quanta's at
 *   the same width: relativity's German face sets each paragraph in its own block wrapper beside
 *   its "Explained in" line, so it has no paragraph-to-paragraph gap to measure;
 * - no "Alternative translations" disclosure, by its class or by its summary's words, on the English
 *   or the parallel face (D-2026-09-25-one-best-translation). Until 2026-09-25 this checked that each
 *   was a quiet line operable by keyboard without JavaScript; the owner ruled the disclosure out;
 * - no child of the English text, or of a parallel row's English half, overlaps the next;
 * - the English face's heading of § 1 (and of part I, where the paper prints parts) is the German
 *   face's element at its size and weight, with the same space above it. Light quanta's German face
 *   set § 1 at 32.8px in weight 400 where its English face set 27.4px in weight 600;
 * - § 1 is that same heading in every paper, on each face at each width, and relativity's part I
 *   heading is larger than its § 1 in the same weight (dispatch 217). The space above is measured
 *   from the block above, not read from the margin, which was 40px on relativity's German face while
 *   § 1 stood 112px below its text. Mass-energy prints no headings, so the comparison is among light
 *   quanta, Brownian and relativity.
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

/** Any alternatives disclosure, and the stacking of the English text's children. */
async function englishLayout(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    // By class, and by the summary's words, so a renamed class cannot hide one.
    const disclosures = [...document.querySelectorAll<HTMLElement>("details")].filter(
      (d) =>
        d.classList.contains("unresolved-alternatives") ||
        /Alternative translations/.test(d.querySelector("summary")?.textContent ?? ""),
    );
    for (const d of disclosures)
      problems.push(`an alternatives disclosure is shown (${d.dataset.unitId ?? "no unit id"})`);
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

/** The first section's and first part's heading: element, size, weight and space above, by id. */
async function firstHeadings(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const h of document.querySelectorAll<HTMLElement>("main h1, main h2")) {
      if (h.closest(".parallel-row, .parallel-half-english, .parallel-half-german")) continue;
      const id = (h.id || h.querySelector("[id]")?.id || "").replace(/^en-/, "");
      if (id !== "s1" && id !== "part-1") continue;
      const cs = getComputedStyle(h);
      // The space a reader sees, not the margin: relativity's German face set a 40px margin inside
      // a wrapper in a flex column, and § 1 stood 112px below the block above it. So walk up to the
      // first ancestor with a laid-out previous sibling and measure from that sibling's bottom.
      let above: number | null = null;
      for (let el: Element | null = h; el && el.tagName !== "MAIN" && above === null; ) {
        let prev = el.previousElementSibling;
        while (prev && prev.getBoundingClientRect().height === 0)
          prev = prev.previousElementSibling;
        if (prev) above = h.getBoundingClientRect().top - prev.getBoundingClientRect().bottom;
        el = el.parentElement;
      }
      out[id] =
        `<${h.tagName.toLowerCase()}> ${Math.round(Number.parseFloat(cs.fontSize) * 10) / 10}px ` +
        `weight ${cs.fontWeight}, ${above === null ? "nothing" : `${Math.round(above)}px`} above`;
    }
    return out;
  });
}

/**
 * A failure found by comparing lanes has no page open: reopen one paper's face at § 1 and keep the
 * five evidence kinds a failing lane keeps. Returns the retained paths.
 */
async function keepFace(
  browser: Browser,
  url: string,
  width: number,
  userAgent: string | undefined,
  base: string,
  meta: { logRunId: string; testId: string; lane: string; message: string },
): Promise<Record<string, string>> {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    ...(userAgent ? { userAgent } : {}),
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const consoleLines: string[] = [];
  const network: string[] = [];
  page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`pageerror: ${String(e)}`));
  page.on("response", (r) => network.push(`${r.status()} ${r.url()}`));
  const capture = {
    screenshot: `${base}.png`,
    trace: `${base}.trace.zip`,
    dom: `${base}.dom.html`,
    console: `${base}.console.log`,
    network: `${base}.network.log`,
  };
  await page.goto(url, { waitUntil: "load" }).catch(() => {});
  await page
    .locator("#s1")
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.screenshot({ path: capture.screenshot }).catch(() => {});
  await context.tracing.stop({ path: capture.trace }).catch(() => {});
  writeFileSync(capture.dom, await page.content().catch(() => ""));
  writeFileSync(capture.console, consoleLines.join("\n"));
  writeFileSync(capture.network, network.join("\n"));
  await context.close();
  const retained = await retainE2EEvidence({ suite: SUITE, outcome: "failed", ...meta }, capture);
  const kept = (source: string) =>
    retained.copied.find((copy) => copy.endsWith(source.slice(source.lastIndexOf("/")))) ?? source;
  return Object.fromEntries(Object.entries(capture).map(([kind, source]) => [kind, kept(source)]));
}

test("the English faces keep the German rhythm and headings, and show no alternatives (dispatch 210, 222)", {
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
  let headingsCompared = 0;
  let crossPaperCompared = 0;
  let partsCompared = 0;
  /** "<width> <face> <heading id>" to each paper's heading there, for the comparison across papers. */
  const acrossPapers = new Map<string, { paper: string; value: string }[]>();
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
          const germanHeadings = await firstHeadings(page);
          await page.goto(`${origin}/papers/${paper}/view/english/`, { waitUntil: "load" });
          const english = await paragraphGapEm(
            page,
            "[data-translation-body] > p.translation-paragraph",
          );
          const englishHeadings = await firstHeadings(page);
          for (const [face, found] of [
            ["german", germanHeadings],
            ["english", englishHeadings],
          ] as const)
            for (const [id, value] of Object.entries(found)) {
              const key = `${width} ${face} ${id}`;
              acrossPapers.set(key, [...(acrossPapers.get(key) ?? []), { paper, value }]);
            }
          for (const [id, de] of Object.entries(germanHeadings)) {
            const en = englishHeadings[id];
            if (en === undefined) continue; // an untranslated section
            headingsCompared++;
            if (en !== de) found.push(`heading ${id}: English ${en}, German ${de}`);
          }
          const layout = await englishLayout(page);
          await page.goto(`${origin}/papers/${paper}/view/parallel/`, { waitUntil: "load" });
          const parallel = await englishLayout(page);
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
            "English gap <= German + 0.25em; no alternatives disclosure; no overlap; headings as the German",
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
    // One edition, one § heading: at each width and on each face, § 1 is the same element at the
    // same size and weight, with the same space above, in every paper that prints one, and a part
    // heading sits a step above it in the same weight (dispatch 217). Relativity's German face set
    // § 1 at 27.4px in weight 600 where the other papers set 32.8px in weight 400.
    const size = (v: string) => Number(v.match(/ ([\d.]+)px /)?.[1]);
    const weight = (v: string) => v.match(/weight (\d+)/)?.[1];
    for (const [key, seen] of acrossPapers) {
      const [width, face, id] = key.split(" ");
      const problems: string[] = [];
      /** The papers that differ: from the most common heading, or every one when none is. */
      let odd: string[] = [];
      if (id === "s1") {
        if (seen.length > 1) crossPaperCompared++;
        const counts = new Map<string, number>();
        for (const s of seen) counts.set(s.value, (counts.get(s.value) ?? 0) + 1);
        if (counts.size > 1) {
          problems.push(
            `§ 1 differs across papers: ${seen.map((s) => `${s.paper} ${s.value}`).join("; ")}`,
          );
          const top = Math.max(...counts.values());
          const common = [...counts].filter(([, n]) => n === top);
          odd = seen
            .filter((s) => common.length > 1 || s.value !== common[0]?.[0])
            .map((s) => s.paper);
        }
      } else {
        const section = acrossPapers.get(`${width} ${face} s1`) ?? [];
        for (const part of seen) {
          const s1 = section.find((s) => s.paper === part.paper)?.value;
          if (s1 === undefined) continue;
          partsCompared++;
          if (!(size(part.value) > size(s1)) || weight(part.value) !== weight(s1)) {
            problems.push(`${part.paper} ${id} is ${part.value}, not a step above § 1 (${s1})`);
            odd.push(part.paper);
          }
        }
      }
      failures.push(...problems.map((p) => `${width} ${face}: ${p}`));
      const testId = `english-face-rhythm-headings-${width}-${face}-${id}`;
      // This comparison has no page of its own, so a failure reopens each differing paper's face and
      // keeps its evidence, as a failing lane does.
      let evidence: Record<string, string> | undefined;
      for (const paper of odd) {
        const kept = await keepFace(
          browser,
          `${origin}/papers/${paper}/view/${face}/`,
          Number(width),
          remote ? "OpenAI File Downloader, XaiImageApiFetch/1.0" : undefined,
          join(scratch, `headings-${width}-${face}-${id}-${paper}`),
          { logRunId, testId, lane: `${paper}-${face}-${width}`, message: problems.join("; ") },
        );
        evidence ??= kept;
      }
      logger.log({
        testId,
        expected:
          id === "s1"
            ? "§ 1 is one element, size, weight and space above in every paper"
            : "a part heading is larger than § 1 in the same weight",
        actual: seen.map((s) => `${s.paper} ${s.value}`).join("; "),
        comparisonKind: "formatted",
        outcome: problems.length === 0 ? "passed" : "failed",
        browser: "chromium",
        viewport: `${width}x900`,
        jsEnabled: true,
        message: problems.length === 0 ? `${key}: consistent` : problems.join("; "),
        ...(evidence ? { evidence } : {}),
      });
    }
  } finally {
    await browser.close();
    logger.flushSync();
    server?.close();
  }
  console.log(
    `[english face rhythm] ${gapsMeasured} English paragraph gaps, ${disclosures} disclosures, ${pairs} sibling pairs, ${headingsCompared} headings compared, § 1 compared across papers on ${crossPaperCompared} width-and-face pairs, ${partsCompared} part headings against their § 1 (${freshnessNote})`,
  );
  assert.ok(headingsCompared > 0, "no English heading was compared with its German heading");
  assert.ok(crossPaperCompared > 0, "§ 1 was never compared across two papers");
  assert.ok(partsCompared > 0, "no part heading was compared with its § 1");
  assert.ok(gapsMeasured > 0, "no English paragraph gap was measured");
  // The absence of a disclosure is asserted per lane (englishLayout); this says the faces it looked
  // at were laid out at all.
  assert.ok(pairs > 0, "no English or parallel face was laid out");
  assert.deepEqual(failures, []);
});
