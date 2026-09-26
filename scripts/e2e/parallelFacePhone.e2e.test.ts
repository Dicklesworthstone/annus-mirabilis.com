/**
 * The parallel face on a phone reads as pairs, German then its English, in a real browser
 * (dispatch 237).
 *
 * Measured on a build of af83aecc at 390 on 2026-09-25: every half showed its language's name, 230
 * labels on relativity's parallel face; a German paragraph and its English stood 79px (4.63em)
 * apart and consecutive pairs 108px; a page label could sit flush against the word before it (0px
 * on every paper); and the masthead's divider stood between the German title and its English.
 *
 * The properties, on each paper's parallel face at 390, with JavaScript on in the light theme and
 * off in the dark theme:
 * - no half shows its language's name, and one key above the first pair names both languages, its
 *   English marked by the same left rule every English half carries and no German half does;
 * - every half keeps its lang and its name for a screen reader: a label in the accessibility tree
 *   ("Deutsch", "English"), visually hidden, not display: none;
 * - within every pair, the German's last box and the English's first stand at most 1.25em apart,
 *   in ems of the English box's own type (a heading's paragraph gap is its own 1em), and no rule is
 *   drawn between them;
 * - between consecutive pairs there is a rule and at least 1.75em;
 * - every page label has at least 0.75em of its own type between it and the word before it on its
 *   line;
 * - the page does not scroll sideways, and every display wider than its box scrolls inside a box
 *   that stays on the screen;
 * - every coloured term glyph in a printed equation stands at 4.5:1 or better against the background
 *   actually composited under it.
 * Each property is checked over every pair, label or glyph on the page, not a median, and each
 * reports its denominator; a lane that measured none of a population fails.
 *
 * A second test reads the narrowest width. At 320, until dispatch 237, a scaffold rule set every
 * sentence as a block, so each began a new line and a paragraph read as a list, on the parallel,
 * English and German faces alike: measured on a build of 716580b2, 0 of 168 sentence pairs on
 * relativity's parallel face shared a line, against 135 of 168 at 390. Each page with at least
 * ten pairs must have half of them sharing a line.
 *
 * By default this serves the built site (out/, which must be fresh); with AM_E2E_ORIGIN set to a
 * deployed origin it reads that site instead. A failing lane keeps a screenshot, trace, DOM
 * snapshot, console and network log, and every lane writes one JSON line to
 * artifacts/test-logs/parallel-face-phone/.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { retainE2EEvidence } from "./evidence.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUT_DIR = join(REPO_ROOT, "out");
const SUITE = "parallel-face-phone";
const PAPERS = ["special-relativity", "light-quanta", "brownian-motion", "mass-energy"] as const;
const WIDTH = 390;
const LANES = [
  { js: true, theme: "light" },
  { js: false, theme: "dark" },
] as const;
/** Within a pair, in ems of the English box's own type. The paragraph gap is 1em. */
const WITHIN_MAX_EM = 1.25;
/** Between pairs, in ems of the half's type. Two paragraph gaps and a rule measure 2.06em. */
const BETWEEN_MIN_EM = 1.75;
/** A page label's room, in ems of its own type. */
const LOCATOR_MIN_EM = 0.75;
const TERM_MIN_CONTRAST = 4.5;

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

interface PhoneReading {
  problems: string[];
  counts: {
    halves: number;
    pairs: number;
    breaks: number;
    locators: number;
    wideDisplays: number;
    terms: number;
  };
  summary: string;
}

/** Every property above, over the whole page, with the population each was checked on. */
async function readParallelFace(page: Page): Promise<PhoneReading> {
  return page.evaluate(
    ({ withinMax, betweenMin, locatorMin, termMin }) => {
      const problems: string[] = [];
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.clipPath === "none";
      };
      const leftRule = (el: Element) => {
        const cs = getComputedStyle(el);
        return cs.borderLeftStyle !== "none" && Number.parseFloat(cs.borderLeftWidth) >= 1;
      };

      // The language is named once: no half's label is shown, one key above the first pair.
      const labels = [...document.querySelectorAll(".parallel-half-label")];
      const shownLabels = labels.filter(shown);
      if (shownLabels.length > 0)
        problems.push(`${shownLabels.length} halves show their language's name`);
      const keys = [...document.querySelectorAll(".parallel-heads")].filter(shown);
      const firstRow = document.querySelector(".parallel-row");
      if (keys.length !== 1) problems.push(`${keys.length} language keys shown, not 1`);
      const key = keys[0];
      if (key && firstRow) {
        if (key.getBoundingClientRect().bottom > firstRow.getBoundingClientRect().top + 0.5)
          problems.push("the language key is not above the first pair");
        const entries = [...key.children].filter(shown);
        const words = entries.map((e) => (e.textContent ?? "").trim());
        if (!words.some((w) => /^Deutsch/.test(w)) || !words.some((w) => /^English/.test(w)))
          problems.push(`the key names ${JSON.stringify(words)}, not both languages`);
        const english = entries.find((e) => /^English/.test((e.textContent ?? "").trim()));
        if (english && !leftRule(english))
          problems.push("the key's English carries no rule to match the English halves");
      }

      // Every half keeps its lang and its name for a screen reader, and the English its rule.
      const halves = [...document.querySelectorAll(".parallel-half")];
      for (const half of halves) {
        const german = half.classList.contains("parallel-half-german");
        const lang = half.getAttribute("lang");
        const label = half.querySelector(":scope > .parallel-half-label");
        const name = (label?.textContent ?? "").trim();
        const where = half.closest<HTMLElement>(".parallel-row")?.dataset.parallelRow ?? "?";
        if (lang !== (german ? "de" : "en")) problems.push(`${where}: a half has lang ${lang}`);
        if (name !== (german ? "Deutsch" : "English"))
          problems.push(`${where}: a half is named ${JSON.stringify(name)}`);
        if (label) {
          const cs = getComputedStyle(label);
          if (cs.display === "none" || cs.visibility === "hidden")
            problems.push(`${where}: a half's name is out of the accessibility tree`);
        }
        const shownHalf = half.getBoundingClientRect().height > 0;
        if (shownHalf && !german && !leftRule(half))
          problems.push(`${where}: an English half has no rule`);
        if (shownHalf && german && leftRule(half))
          problems.push(`${where}: a German half has the English rule`);
      }

      // The pair as one unit, and a clear break between pairs.
      const TEXT = "p, li, h1, h2, h3, header, .katex-display, .equation-container, aside";
      const boxes = (el: Element) =>
        [...el.querySelectorAll(TEXT)].filter(
          (x) =>
            x.getBoundingClientRect().height > 0 && !x.classList.contains("parallel-half-label"),
        );
      let pairs = 0;
      let breaks = 0;
      let previous: { key: string; bottom: number; em: number } | null = null;
      for (const row of document.querySelectorAll<HTMLElement>(".parallel-row")) {
        const key = row.dataset.parallelRow ?? "?";
        const de = row.querySelector(".parallel-half-german");
        const en = row.querySelector(".parallel-half-english");
        const deBoxes = de ? boxes(de) : [];
        const enBoxes = en ? boxes(en) : [];
        const em = Number.parseFloat(getComputedStyle(en ?? de ?? row).fontSize);
        if (de && deBoxes.length > 0 && enBoxes.length > 0) {
          pairs++;
          const deBottom = Math.max(...deBoxes.map((b) => b.getBoundingClientRect().bottom));
          const first = enBoxes.reduce((a, b) =>
            b.getBoundingClientRect().top < a.getBoundingClientRect().top ? b : a,
          );
          const enTop = first.getBoundingClientRect().top;
          const ownEm = Number.parseFloat(getComputedStyle(first).fontSize);
          const gap = (enTop - deBottom) / ownEm;
          if (gap < -0.05) problems.push(`${key}: the English starts beside or above its German`);
          else if (gap > withinMax)
            problems.push(`${key}: German and English ${gap.toFixed(2)}em apart`);
          // A rule drawn across the pair, between the German's last text and the English's first:
          // a bottom border and no other, on a block-level box at least half the half's width.
          // A term's dotted underline is an inline box's, and a term chip under a German paragraph
          // is outlined on all four sides; neither is a rule.
          const across = de.getBoundingClientRect().width / 2;
          const side = (cs: CSSStyleDeclaration, edge: "Top" | "Right" | "Bottom" | "Left") =>
            cs.getPropertyValue(`border-${edge.toLowerCase()}-style`) !== "none" &&
            Number.parseFloat(cs.getPropertyValue(`border-${edge.toLowerCase()}-width`)) > 0;
          for (const x of de.querySelectorAll("*")) {
            const cs = getComputedStyle(x);
            const r = x.getBoundingClientRect();
            if (
              !cs.display.startsWith("inline") &&
              r.width >= across &&
              side(cs, "Bottom") &&
              !side(cs, "Top") &&
              !side(cs, "Left") &&
              !side(cs, "Right") &&
              r.bottom >= deBottom - 1 &&
              r.bottom <= enTop + 1
            )
              problems.push(
                `${key}: a rule (${x.tagName.toLowerCase()}.${x.className}) splits the pair`,
              );
          }
        }
        const all = [...deBoxes, ...enBoxes].map((b) => b.getBoundingClientRect());
        if (all.length === 0) continue;
        const top = Math.min(...all.map((r) => r.top));
        if (previous) {
          breaks++;
          const gap = (top - previous.bottom) / previous.em;
          if (gap < betweenMin)
            problems.push(`${key}: ${gap.toFixed(2)}em below the pair before it`);
        }
        // The rule that closes this pair, by whatever draws it.
        const cs = getComputedStyle(row);
        const after = getComputedStyle(row, "::after");
        const ruled =
          (cs.borderBottomStyle !== "none" && Number.parseFloat(cs.borderBottomWidth) >= 1) ||
          (after.content !== "none" &&
            after.borderTopStyle !== "none" &&
            Number.parseFloat(after.borderTopWidth) >= 1);
        if (!ruled) problems.push(`${key}: no rule closes the pair`);
        previous = { key, bottom: Math.max(...all.map((r) => r.bottom)), em };
      }

      // Page labels: room between a label and the word before it on its line.
      let locators = 0;
      for (const loc of document.querySelectorAll(".block-locator")) {
        const lr = loc.getBoundingClientRect();
        if (lr.width === 0 || !loc.parentElement) continue;
        const range = document.createRange();
        range.selectNodeContents(loc.parentElement);
        const beside = [...range.getClientRects()].filter(
          (r) =>
            r.width > 0 &&
            Math.abs(r.top - lr.top) < lr.height &&
            !(r.left >= lr.left - 0.5 && r.right <= lr.right + 0.5) &&
            r.right <= lr.left + 0.5,
        );
        if (beside.length === 0) continue;
        locators++;
        const room = Math.min(...beside.map((r) => lr.left - r.right));
        const ownEm = Number.parseFloat(getComputedStyle(loc).fontSize);
        if (room < locatorMin * ownEm)
          problems.push(
            `a page label (${(loc.textContent ?? "").trim()}) has ${room.toFixed(1)}px before it`,
          );
      }

      // Nothing widens the page; a wide display scrolls in a box on the screen.
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      if (overflow > 0) problems.push(`the page scrolls ${overflow}px sideways`);
      let wideDisplays = 0;
      for (const d of document.querySelectorAll<HTMLElement>(
        ".katex-display, .equation-body, .inline-display, .source-equation",
      )) {
        const r = d.getBoundingClientRect();
        if (r.width === 0) continue;
        if (d.scrollWidth <= d.clientWidth + 1 && r.right <= innerWidth + 0.5) continue;
        wideDisplays++;
        let box: HTMLElement | null = d;
        while (box && !/auto|scroll/.test(getComputedStyle(box).overflowX)) box = box.parentElement;
        if (!box || box.getBoundingClientRect().right > innerWidth + 0.5)
          problems.push(`${d.closest("[id]")?.id ?? "?"}: a display runs off the screen`);
      }

      // Term colours against what is composited under each glyph.
      const parse = (s: string): number[] | null => {
        let m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (m)
          return [+(m[1] ?? 0) / 255, +(m[2] ?? 0) / 255, +(m[3] ?? 0) / 255, m[4] ? +m[4] : 1];
        m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/);
        if (m) return [+(m[1] ?? 0), +(m[2] ?? 0), +(m[3] ?? 0), m[4] ? +m[4] : 1];
        return null;
      };
      const over = (top: number[], under: number[]) => {
        const [ta, ua] = [top[3] ?? 1, under[3] ?? 1];
        const a = ta + ua * (1 - ta);
        return [0, 1, 2]
          .map((i) => ((top[i] ?? 0) * ta + (under[i] ?? 0) * ua * (1 - ta)) / (a || 1))
          .concat(a);
      };
      const luminance = (c: number[]) => {
        const f = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
      };
      let terms = 0;
      let worst = Number.POSITIVE_INFINITY;
      for (const term of document.querySelectorAll(".katex [data-quantity-id]")) {
        if (term.getBoundingClientRect().width === 0) continue;
        const glyph =
          [...term.querySelectorAll("*")]
            .reverse()
            .find((x) => x.childElementCount === 0 && (x.textContent ?? "").trim()) ?? term;
        const fg = parse(getComputedStyle(glyph).color);
        if (!fg) continue;
        let bg = [1, 1, 1, 1];
        const chain: Element[] = [];
        for (let n: Element | null = glyph; n; n = n.parentElement) chain.push(n);
        for (const n of chain.reverse()) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && (c[3] ?? 0) > 0) bg = over(c, bg);
        }
        const [hi, lo] = [luminance(over(fg, bg)), luminance(bg)].sort((a, b) => b - a);
        const ratio = ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
        terms++;
        worst = Math.min(worst, ratio);
        if (ratio < termMin)
          problems.push(
            `${term.closest("[id]")?.id ?? "?"}: term ${(term as HTMLElement).dataset.quantityId} at ${ratio.toFixed(2)}:1`,
          );
      }

      return {
        problems,
        counts: { halves: halves.length, pairs, breaks, locators, wideDisplays, terms },
        summary:
          `${shownLabels.length} labels shown, ${keys.length} key; ${pairs} pairs, ${breaks} breaks; ` +
          `${locators} page labels; ${wideDisplays} wide displays; ${terms} terms, worst ` +
          `${Number.isFinite(worst) ? worst.toFixed(2) : "none"}:1; overflow ${overflow}px`,
      };
    },
    {
      withinMax: WITHIN_MAX_EM,
      betweenMin: BETWEEN_MIN_EM,
      locatorMin: LOCATOR_MIN_EM,
      termMin: TERM_MIN_CONTRAST,
    },
  );
}

/**
 * Consecutive sentences of one paragraph, and how many share a line: the next sentence's first
 * word on the line where the previous one's last word stands. Read from the rects of each
 * sentence's plain text only, because an element's box (a formula's strut, the visually hidden
 * "Show the German source" button, 1px wide and 44px tall) reaches past its line and made
 * sentences set as blocks read as sharing one. A pair is not counted where either sentence holds
 * an in-flow block, a display printed inside it, which stands on its own line by design.
 */
async function readSentenceFlow(page: Page) {
  return page.evaluate(() => {
    const textRects = (el: Element) => {
      const out: DOMRect[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.textContent ?? "").trim()) continue;
        if (n.parentElement?.closest(".katex, button, sup, [class*='visually-hidden']")) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        out.push(...[...range.getClientRects()].filter((r) => r.width >= 2 && r.height > 0.5));
      }
      return out;
    };
    // In-flow boxes only: an absolutely positioned element computes as display: block without
    // taking a line of its own.
    const holdsBlock = (el: Element) =>
      [...el.querySelectorAll("*")].some((x) => {
        const cs = getComputedStyle(x);
        return (
          !/^(inline|none|contents)/.test(cs.display) &&
          !/absolute|fixed/.test(cs.position) &&
          x.getBoundingClientRect().height > 0 &&
          !x.closest(".katex")
        );
      });
    let pairs = 0;
    let shared = 0;
    let skipped = 0;
    for (const para of document.querySelectorAll("p")) {
      const sentences = [...para.querySelectorAll(".source-sentence, .translation-unit")].filter(
        (s) => s.closest("p") === para && s.getBoundingClientRect().height > 0,
      );
      for (let i = 0; i + 1 < sentences.length; i++) {
        const [a, b] = [sentences[i] as Element, sentences[i + 1] as Element];
        if (holdsBlock(a) || holdsBlock(b)) {
          skipped++;
          continue;
        }
        const before = textRects(a);
        const after = textRects(b);
        if (before.length === 0 || after.length === 0) continue;
        pairs++;
        const last = before.reduce((m, r) => (r.bottom > m.bottom ? r : m));
        const first = after.reduce((m, r) => (r.top < m.top ? r : m));
        if (first.top < last.bottom - 2) shared++;
      }
    }
    return { pairs, shared, skipped };
  });
}

/** The site under test: a deployed origin, or out/ served locally. */
async function siteUnderTest() {
  const remote = process.env.AM_E2E_ORIGIN?.replace(/\/$/, "");
  if (remote) return { origin: remote, remote, server: null, note: `deployed site ${remote}` };
  const note = `out/ ${assertOutFreshness("out", REPO_ROOT).reason ?? "fresh"}`;
  assert.ok(existsSync(join(OUT_DIR, "papers")), "out/ has no /papers/");
  const { server, origin } = await startStaticServer(OUT_DIR);
  return { origin, remote: undefined, server, note };
}

/**
 * A failing lane keeps the five evidence kinds; returns the retained paths. Only a failing lane
 * writes anything: a passing one leaves its JSON line and nothing else (TanElk 40506, when this
 * suite's runs had filled 3.3 GB). The captures are made in a temporary directory, from which
 * retainE2EEvidence copies them into the run's evidence directory; they were made in
 * artifacts/e2e-scratch/ until then, which kept every failing lane twice. The trace carries DOM
 * snapshots and no screenshot film strip, since the lane's screenshot is kept beside it, and the DOM
 * snapshot is gzipped: relativity's parallel page is 10 MB of HTML, so a run failing on all eight
 * lanes kept 42 MB, most of it four DOM files.
 */
async function keepLaneEvidence(
  page: Page,
  context: BrowserContext,
  logs: { consoleLines: string[]; network: string[] },
  meta: { logRunId: string; testId: string; lane: string; message: string },
): Promise<Record<string, string>> {
  const base = join(mkdtempSync(join(tmpdir(), `am-${SUITE}-`)), meta.lane);
  const capture = {
    screenshot: `${base}.png`,
    trace: `${base}.trace.zip`,
    dom: `${base}.dom.html.gz`,
    console: `${base}.console.log`,
    network: `${base}.network.log`,
  };
  await page.screenshot({ path: capture.screenshot, fullPage: false }).catch(() => {});
  await context.tracing.stop({ path: capture.trace }).catch(() => {});
  writeFileSync(capture.dom, gzipSync(await page.content().catch(() => "")));
  writeFileSync(capture.console, logs.consoleLines.join("\n"));
  writeFileSync(capture.network, logs.network.join("\n"));
  const retained = await retainE2EEvidence(
    {
      suite: SUITE,
      logRunId: meta.logRunId,
      testId: meta.testId,
      lane: meta.lane,
      outcome: "failed",
      message: meta.message,
    },
    capture,
  );
  const kept = (source: string) =>
    retained.copied.find((copy) => copy.endsWith(source.slice(source.lastIndexOf("/")))) ?? source;
  return Object.fromEntries(Object.entries(capture).map(([kind, source]) => [kind, kept(source)]));
}

test("the parallel face on a phone reads as pairs, with one key, room for page labels, and legible terms (dispatch 237)", {
  timeout: 300_000,
}, async () => {
  const site = await siteUnderTest();
  const { origin, remote, server } = site;
  const freshnessNote = site.note;
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const failures: string[] = [];
  const totals = { halves: 0, pairs: 0, breaks: 0, locators: 0, wideDisplays: 0, terms: 0 };
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    for (const paper of PAPERS)
      for (const { js, theme } of LANES) {
        const lane = `${paper}-${WIDTH}-${theme}-js-${js ? "on" : "off"}`;
        const context = await browser.newContext({
          viewport: { width: WIDTH, height: 844 },
          colorScheme: theme,
          javaScriptEnabled: js,
          ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
        });
        await context.tracing.start({ snapshots: true });
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
          await page.goto(`${origin}/papers/${paper}/view/parallel/`, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          const reading = await readParallelFace(page);
          summary = reading.summary;
          found.push(...reading.problems);
          for (const [name, n] of Object.entries(reading.counts))
            totals[name as keyof typeof totals] += n;
          // A lane that measured no pair, break or half has proved nothing about them.
          for (const name of ["halves", "pairs", "breaks"] as const)
            if (reading.counts[name] === 0) found.push(`no ${name} were measured`);
        } catch (error) {
          found.push(`could not measure: ${String(error)}`);
        }
        let evidence: Record<string, string> | undefined;
        if (found.length > 0) {
          evidence = await keepLaneEvidence(
            page,
            context,
            { consoleLines, network },
            {
              logRunId,
              testId: `parallel-face-phone-${lane}`,
              lane,
              message: found.slice(0, 20).join("; "),
            },
          );
          failures.push(
            `${lane}: ${found.slice(0, 12).join("; ")}${found.length > 12 ? ` (+${found.length - 12} more)` : ""}`,
          );
        } else {
          await context.tracing.stop();
        }
        logger.log({
          testId: `parallel-face-phone-${lane}`,
          paper,
          expected: `no label shown, one key; within a pair <= ${WITHIN_MAX_EM}em; between pairs a rule and >= ${BETWEEN_MIN_EM}em; page labels >= ${LOCATOR_MIN_EM}em of room; no sideways scroll; terms >= ${TERM_MIN_CONTRAST}:1`,
          actual: summary || found.join("; "),
          comparisonKind: "tolerance",
          tolerance: { absolute: WITHIN_MAX_EM - 1 },
          outcome: found.length === 0 ? "passed" : "failed",
          durationMs: Math.round(performance.now() - start),
          browser: "chromium",
          viewport: `${WIDTH}x844`,
          reducedMotion: false,
          jsEnabled: js,
          message: found.length === 0 ? `${lane}: ${summary}` : found.slice(0, 20).join("; "),
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
    `[parallel face phone] ${totals.halves} halves, ${totals.pairs} pairs, ${totals.breaks} pair breaks, ${totals.locators} page labels, ${totals.wideDisplays} wide displays, ${totals.terms} coloured terms (${freshnessNote})`,
  );
  // Each population once more across every lane, so a selector that stopped matching fails here
  // rather than passing on nothing.
  assert.ok(totals.pairs > 0, "no German-English pair was measured");
  assert.ok(totals.breaks > 0, "no break between pairs was measured");
  assert.ok(totals.locators > 0, "no page label was measured");
  assert.ok(totals.wideDisplays > 0, "no display wider than its box was found to check");
  assert.ok(totals.terms > 0, "no coloured term was measured");
  assert.deepEqual(failures, []);
});

/** Sentence flow at the narrowest width, on each face that sets sentences as their own elements. */
const FLOW_WIDTH = 320;
const FLOW_FACES = ["parallel", "english", "german"] as const;
/** A page is judged on at least this many pairs; the German draft faces carry no sentence spans. */
const FLOW_MIN_PAIRS = 10;
/** Share of a page's pairs on one line. Set as blocks, 0; running on, 74-84% at 320, 80-88% at 390. */
const FLOW_MIN_SHARE = 0.5;

test("a paragraph's sentences run on at 320 on the parallel, English and German faces (dispatch 237)", {
  timeout: 300_000,
}, async () => {
  const site = await siteUnderTest();
  const { origin, remote, server } = site;
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const failures: string[] = [];
  let pairs = 0;
  let judged = 0;
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    for (const paper of PAPERS)
      for (const face of FLOW_FACES) {
        const lane = `${paper}-${face}-${FLOW_WIDTH}`;
        const testId = `sentence-flow-${lane}`;
        const context = await browser.newContext({
          viewport: { width: FLOW_WIDTH, height: 844 },
          ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
        });
        await context.tracing.start({ snapshots: true });
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
          await page.goto(`${origin}/papers/${paper}/view/${face}/`, { waitUntil: "load" });
          await page.evaluate(() => document.fonts.ready);
          const flow = await readSentenceFlow(page);
          pairs += flow.pairs;
          const share = flow.pairs === 0 ? null : flow.shared / flow.pairs;
          summary = `${flow.shared} of ${flow.pairs} sentence pairs share a line (${flow.skipped} beside a display, not counted)`;
          if (flow.pairs >= FLOW_MIN_PAIRS) {
            judged++;
            if ((share ?? 0) < FLOW_MIN_SHARE) found.push(`sentences stand apart: ${summary}`);
          } else summary += `; fewer than ${FLOW_MIN_PAIRS}, not judged`;
        } catch (error) {
          found.push(`could not measure: ${String(error)}`);
        }
        let evidence: Record<string, string> | undefined;
        if (found.length > 0) {
          evidence = await keepLaneEvidence(
            page,
            context,
            { consoleLines, network },
            { logRunId, testId, lane, message: found.join("; ") },
          );
          failures.push(`${lane}: ${found.join("; ")}`);
        } else {
          await context.tracing.stop();
        }
        logger.log({
          testId,
          paper,
          expected: `at least ${FLOW_MIN_SHARE * 100}% of a paragraph's consecutive sentences share a line`,
          actual: summary || found.join("; "),
          comparisonKind: "tolerance",
          tolerance: { absolute: 1 - FLOW_MIN_SHARE },
          outcome: found.length === 0 ? "passed" : "failed",
          durationMs: Math.round(performance.now() - start),
          browser: "chromium",
          viewport: `${FLOW_WIDTH}x844`,
          reducedMotion: false,
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
    `[sentence flow] ${pairs} sentence pairs, ${judged} pages judged at ${FLOW_WIDTH} (${site.note})`,
  );
  assert.ok(judged > 0, "no page had enough sentence pairs to judge");
  assert.deepEqual(failures, []);
});

/** Inline formulas at the narrowest width, on each face that sets them in running text. */
const INLINE_WIDTH = 320;
const INLINE_FACES = ["english", "parallel", "gloss"] as const;
/** A formula that scrolls hides at least half a character, or its scroll box is noise and a tab stop. */
const INLINE_MIN_SCROLL_EM = 0.5;

/**
 * Inline formulas stay inside their line (40462). Brownian § 2 ¶ 4 prints
 * d x_1 d y_1 d z_1, d x_2 d y_2 d z_2 … d x_n d y_n d z_n, one formula with no break in it, 309 to
 * 345px wide; at 320 it widened the English face by 59px, the parallel face by 21px and the gloss
 * face by 75px (phoneOverflow, 42 route and width pairs). Each formula is now a scroll box held to
 * its line, which is easy to get wrong in three ways, each measured on the way here:
 * - an inline-block scroll box sits on its bottom edge, not its baseline, and lifted formulas up to
 *   12px off the line;
 * - a scroll box around every formula made 30-plus small ones such as t_A scroll by 1 to 5px, each
 *   a tab stop, because KaTeX's glyph boxes reach a little past the formula's own box;
 * - the same overhang, clipped vertically, cut into primes and accents.
 * So, per page: no sideways scroll; no formula scrolls by less than half a character; no glyph box
 * reaches outside its formula's clip; and no formula moves off the text baseline, compared with the
 * same formula with its scroll box (overflow, padding, margins) switched off in place.
 */
async function readInlineFormulas(page: Page) {
  return page.evaluate((minScrollEm) => {
    const problems: string[] = [];
    const formulas = [...document.querySelectorAll<HTMLElement>(".inline-math")].filter(
      (m) => m.getBoundingClientRect().width > 0,
    );
    const where = (m: Element) => m.closest("[id]")?.id ?? "?";
    // A zero-size inline-block after a formula sits on its line's baseline; a glyph inside the
    // formula sits a fixed distance from KaTeX's own baseline. Their difference is the offset.
    const markers = formulas.map((m) => {
      const mark = document.createElement("span");
      mark.style.cssText = "display:inline-block;width:0;height:0;";
      m.after(mark);
      return mark;
    });
    const offsets = () =>
      formulas.map((m, i) => {
        const glyph = m.querySelector(
          ".katex-html .katex-base .mord, .katex-html .katex-base .mopen",
        );
        const baseline = (markers[i] as HTMLElement).getBoundingClientRect().bottom;
        const box = m.getBoundingClientRect();
        const sameLine = baseline >= box.top - 1 && baseline <= box.bottom + 1;
        return glyph && sameLine ? glyph.getBoundingClientRect().top - baseline : null;
      });
    let scrolling = 0;
    let clipped = 0;
    for (const m of formulas) {
      const cs = getComputedStyle(m);
      const box = m.getBoundingClientRect();
      const em = Number.parseFloat(cs.fontSize);
      if (box.right > innerWidth + 0.5) problems.push(`${where(m)}: a formula runs off the screen`);
      const range = m.scrollWidth - m.clientWidth;
      if (/auto|scroll/.test(cs.overflowX) && range > 0) {
        scrolling++;
        if (range < minScrollEm * em)
          problems.push(`${where(m)}: a formula scrolls by ${range}px, less than half a character`);
      }
      if (/hidden|auto|scroll|clip/.test(cs.overflowY)) {
        for (const d of m.querySelectorAll(".katex-html *")) {
          const r = d.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) {
            clipped++;
            problems.push(`${where(m)}: a glyph box reaches outside its formula's clip`);
            break;
          }
        }
      }
    }
    const before = offsets();
    // The same formulas with the scroll box switched off in place: overflow, and the padding and
    // margins that give the glyphs room, go; the display stays. Switching the display too (to
    // inline) let a long formula break across lines, and its first glyph then stood a line away
    // from the marker after it, which read as a 26 to 34px shift where nothing had moved.
    const saved = formulas.map((m) => m.getAttribute("style"));
    for (const m of formulas) m.style.cssText += ";overflow:visible;padding:0;margin:0;";
    const after = offsets();
    formulas.forEach((m, i) => {
      const s = saved[i];
      if (s === null || s === undefined) m.removeAttribute("style");
      else m.setAttribute("style", s);
    });
    let compared = 0;
    let worst = 0;
    before.forEach((b, i) => {
      const a = after[i];
      if (b === null || a === null || b === undefined || a === undefined) return;
      compared++;
      const shift = Math.abs(b - a);
      worst = Math.max(worst, shift);
      if (shift > 0.5)
        problems.push(
          `${where(formulas[i] as Element)}: a formula sits ${shift.toFixed(1)}px off the baseline`,
        );
    });
    for (const mark of markers) mark.remove();
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (overflow > 0) problems.push(`the page scrolls ${overflow}px sideways`);
    return {
      problems,
      formulas: formulas.length,
      scrolling,
      clipped,
      compared,
      summary: `${formulas.length} formulas, ${scrolling} scrolling, ${compared} compared on the baseline (worst ${worst.toFixed(2)}px), overflow ${overflow}px`,
    };
  }, INLINE_MIN_SCROLL_EM);
}

test("inline formulas stay inside their line at 320 on the English, parallel and gloss faces (40462)", {
  timeout: 300_000,
}, async () => {
  const site = await siteUnderTest();
  const { origin, remote, server } = site;
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const failures: string[] = [];
  let formulas = 0;
  let compared = 0;
  let scrolling = 0;
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    for (const paper of PAPERS)
      for (const face of INLINE_FACES) {
        const lane = `${paper}-${face}-${INLINE_WIDTH}`;
        const testId = `inline-formulas-${lane}`;
        const context = await browser.newContext({
          viewport: { width: INLINE_WIDTH, height: 844 },
          ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
        });
        await context.tracing.start({ snapshots: true });
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
          const response = await page.goto(`${origin}/papers/${paper}/view/${face}/`, {
            waitUntil: "load",
          });
          if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          const reading = await readInlineFormulas(page);
          formulas += reading.formulas;
          compared += reading.compared;
          scrolling += reading.scrolling;
          summary = reading.summary;
          found.push(...reading.problems);
        } catch (error) {
          found.push(`could not measure: ${String(error)}`);
        }
        let evidence: Record<string, string> | undefined;
        if (found.length > 0) {
          evidence = await keepLaneEvidence(
            page,
            context,
            { consoleLines, network },
            { logRunId, testId, lane, message: found.slice(0, 20).join("; ") },
          );
          failures.push(
            `${lane}: ${found.slice(0, 8).join("; ")}${found.length > 8 ? ` (+${found.length - 8} more)` : ""}`,
          );
        } else {
          await context.tracing.stop();
        }
        logger.log({
          testId,
          paper,
          expected: `no sideways scroll; no formula scrolling by less than ${INLINE_MIN_SCROLL_EM}em; no glyph clipped; no formula off the baseline by more than 0.5px`,
          actual: summary || found.join("; "),
          comparisonKind: "tolerance",
          tolerance: { absolute: 0.5 },
          outcome: found.length === 0 ? "passed" : "failed",
          durationMs: Math.round(performance.now() - start),
          browser: "chromium",
          viewport: `${INLINE_WIDTH}x844`,
          reducedMotion: false,
          jsEnabled: true,
          message: found.length === 0 ? `${lane}: ${summary}` : found.slice(0, 20).join("; "),
          ...(evidence ? { evidence } : {}),
        });
        await context.close();
      }
  } finally {
    await browser.close();
    logger.flushSync();
    server?.close();
  }
  // Reported, not asserted: whether any formula is wide enough to scroll is a fact about the
  // content, and a line break added to the Brownian formula would rightly leave none.
  console.log(
    `[inline formulas] ${formulas} formulas, ${scrolling} scrolling, ${compared} compared on the baseline at ${INLINE_WIDTH} (${site.note})`,
  );
  assert.ok(formulas > 0, "no inline formula was measured");
  assert.ok(compared > 0, "no inline formula was compared on the baseline");
  assert.deepEqual(failures, []);
});

/** The Results face: the phone width, and the desktop width where its measure shows. */
const RESULTS_LANES = [
  { width: 390, js: true, theme: "light" },
  { width: 1440, js: false, theme: "dark" },
] as const;
/** The German faces set 62 to 63 characters a line at 1440 and the English 71 to 74. */
const RESULTS_MAX_CPL = 76;
/** On a phone a card's text keeps this share of the screen; it was 262 of 390px (67%). */
const RESULTS_MIN_TEXT_SHARE = 0.8;
/** A link a reader presses, in CSS pixels (WCAG 2.2 target size). */
const RESULTS_MIN_TARGET = 24;

/**
 * The Results face reads like the reading faces (dispatch 244). Measured on live 0c6777c7: an 860px
 * box centred in the frame, so at 1440 the cards stood 246px right of the page column and set their
 * prose 74 to 81 characters a line (up to 133); on a phone the face's own padding sat inside the
 * gutter and left the text 262 of 390px; each card drew six to eight rules, one per layer, under
 * bold labels the size of its prose, with its title the prose's size too; no printed equation was
 * coloured, on any card; one card named two different links "Text on page 555 of the German
 * source"; and the wrong turns were 13px-tall links. So, per page:
 * - no sideways scroll, and every display wider than its box scrolls inside it;
 * - the cards start at the page column, within 2px;
 * - at 1440 the cards' prose runs at most 76 characters a line; on a phone a card's text keeps 80%
 *   of the screen's width;
 * - the title is larger than the sentence under it, cards stand at one even gap of at least 24px,
 *   and a card draws one full-width rule, under its header;
 * - the printed layers are coloured somewhere: a paper whose cards quote displays colours at least
 *   one (how many is reported; two of the 200 printed displays have no bindings);
 * - one link name, one destination, over every link on the face (am-jmma);
 * - every "used later" and wrong-turn link is at least 24px tall.
 */
async function readResultsFace(page: Page) {
  return page.evaluate(
    ({ maxCpl, minShare, minTarget }) => {
      const problems: string[] = [];
      const face = document.querySelector(".results-face");
      const cards = [...document.querySelectorAll<HTMLElement>(".result-card")];
      if (!face || cards.length === 0)
        return {
          problems: ["no result cards"],
          cards: 0,
          printed: 0,
          coloured: 0,
          links: 0,
          summary: "",
        };
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      if (overflow > 0) problems.push(`the page scrolls ${overflow}px sideways`);
      for (const d of face.querySelectorAll<HTMLElement>(
        ".katex-display, .equation-body, .source-equation",
      )) {
        const r = d.getBoundingClientRect();
        if (r.width === 0 || (d.scrollWidth <= d.clientWidth + 1 && r.right <= innerWidth + 0.5))
          continue;
        let box: HTMLElement | null = d;
        while (box && !/auto|scroll/.test(getComputedStyle(box).overflowX)) box = box.parentElement;
        if (!box || box.getBoundingClientRect().right > innerWidth + 0.5)
          problems.push(`${d.closest("[id]")?.id ?? "?"}: a display runs off the screen`);
      }
      // The page column: the page title's left edge.
      const column = document.querySelector("main h1")?.getBoundingClientRect().left ?? 0;
      const left = (cards[0] as HTMLElement).getBoundingClientRect().left;
      if (Math.abs(left - column) > 2)
        problems.push(`the cards start ${Math.round(left - column)}px from the page column`);
      // Characters per line of the cards' prose, from each paragraph's plain text and line boxes.
      const cpl: number[] = [];
      for (const para of face.querySelectorAll<HTMLElement>(
        ".result-card p, .result-card li, .result-card dd",
      )) {
        const text = (para.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text.length < 120 || para.querySelector(".katex-display, .source-equation")) continue;
        const range = document.createRange();
        range.selectNodeContents(para);
        const bottoms = [...range.getClientRects()]
          .filter((r) => r.width >= 2)
          .map((r) => r.bottom)
          .sort((a, b) => a - b);
        let lines = bottoms.length ? 1 : 0;
        for (let i = 1; i < bottoms.length; i++)
          if ((bottoms[i] ?? 0) - (bottoms[i - 1] ?? 0) > 8) lines++;
        if (lines > 1) cpl.push(text.length / lines);
      }
      cpl.sort((a, b) => a - b);
      const median = cpl.length ? (cpl[cpl.length >> 1] ?? 0) : 0;
      if (innerWidth >= 1000 && median > maxCpl)
        problems.push(
          `card prose runs ${Math.round(median)} characters a line (median of ${cpl.length})`,
        );
      const first = cards[0] as HTMLElement;
      const cs = getComputedStyle(first);
      const textWidth =
        first.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
      if (innerWidth < 600 && textWidth < minShare * innerWidth)
        problems.push(`a card's text is ${Math.round(textWidth)}px of a ${innerWidth}px screen`);
      // Rhythm: the title a step above its sentence, one even gap, one rule per card.
      const gaps: number[] = [];
      cards.forEach((card, i) => {
        const id = card.id;
        const title = card.querySelector("h3");
        const sentence = card.querySelector('[data-result-layer="one-sentence"]');
        if (title && sentence) {
          const t = Number.parseFloat(getComputedStyle(title).fontSize);
          const s = Number.parseFloat(getComputedStyle(sentence).fontSize);
          if (!(t > s)) problems.push(`${id}: the title is ${t}px beside its sentence's ${s}px`);
        }
        if (i > 0)
          gaps.push(
            card.getBoundingClientRect().top -
              (cards[i - 1] as HTMLElement).getBoundingClientRect().bottom,
          );
        const width = card.getBoundingClientRect().width;
        let rules = 0;
        // A fraction's bar is a bottom border too, as wide as the card on a phone: not a rule.
        for (const el of card.querySelectorAll("*")) {
          if (el.closest(".katex")) continue;
          const e = getComputedStyle(el);
          const top = e.borderTopStyle !== "none" && Number.parseFloat(e.borderTopWidth) > 0;
          const bottom =
            e.borderBottomStyle !== "none" && Number.parseFloat(e.borderBottomWidth) > 0;
          const sides = [e.borderLeftStyle, e.borderRightStyle].some((b) => b !== "none");
          if ((top || bottom) && !sides && el.getBoundingClientRect().width >= 0.8 * width) rules++;
        }
        if (rules > 1) problems.push(`${id}: ${rules} full-width rules in one card`);
      });
      if (gaps.length > 0) {
        const lo = Math.min(...gaps);
        const hi = Math.max(...gaps);
        if (lo < 24 || hi - lo > 1)
          problems.push(`cards stand ${Math.round(lo)} to ${Math.round(hi)}px apart`);
      }
      // Printed layers in colour.
      const printed = [...face.querySelectorAll(".result-printed .source-equation")];
      const coloured = printed.filter((d) => d.querySelector("[data-quantity-id]")).length;
      if (printed.length > 0 && coloured === 0)
        problems.push(`none of ${printed.length} printed displays is coloured`);
      // One name, one destination.
      const byName = new Map<string, Set<string>>();
      const links = [...face.querySelectorAll<HTMLAnchorElement>("a[href]")];
      for (const a of links) {
        const name = (a.getAttribute("aria-label") ?? a.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const set = byName.get(name) ?? new Set<string>();
        set.add(a.getAttribute("href") ?? "");
        byName.set(name, set);
      }
      for (const [name, hrefs] of byName)
        if (hrefs.size > 1) problems.push(`"${name}" names ${hrefs.size} destinations`);
      // Targets.
      for (const a of face.querySelectorAll<HTMLElement>(
        ".result-used-by a, .result-misconceptions a",
      )) {
        const h = a.getBoundingClientRect().height;
        if (h > 0 && h < minTarget)
          problems.push(`a link is ${Math.round(h)}px tall: ${(a.textContent ?? "").slice(0, 40)}`);
      }
      return {
        problems,
        cards: cards.length,
        printed: printed.length,
        coloured,
        links: links.length,
        summary: `${cards.length} cards; prose ${Math.round(median)} cpl (${cpl.length}); text ${Math.round(textWidth)}px; gaps ${gaps.length ? Math.round(Math.min(...gaps)) : "-"}px; ${coloured} of ${printed.length} printed displays coloured; ${links.length} links; overflow ${overflow}px`,
      };
    },
    { maxCpl: RESULTS_MAX_CPL, minShare: RESULTS_MIN_TEXT_SHARE, minTarget: RESULTS_MIN_TARGET },
  );
}

test("the Results face reads at the reading measure, in a clear card rhythm, with coloured printed equations (dispatch 244)", {
  timeout: 300_000,
}, async () => {
  const site = await siteUnderTest();
  const { origin, remote, server } = site;
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);
  const failures: string[] = [];
  let cards = 0;
  let printed = 0;
  let coloured = 0;
  let links = 0;
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    for (const paper of PAPERS)
      for (const { width, js, theme } of RESULTS_LANES) {
        const lane = `${paper}-results-${width}-${theme}-js-${js ? "on" : "off"}`;
        const testId = `results-face-${lane}`;
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
          javaScriptEnabled: js,
          ...(remote ? { userAgent: "OpenAI File Downloader, XaiImageApiFetch/1.0" } : {}),
        });
        await context.tracing.start({ snapshots: true });
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
          const response = await page.goto(`${origin}/papers/${paper}/view/results/`, {
            waitUntil: "load",
          });
          if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          const reading = await readResultsFace(page);
          cards += reading.cards;
          printed += reading.printed;
          coloured += reading.coloured;
          links += reading.links;
          summary = reading.summary;
          found.push(...reading.problems);
        } catch (error) {
          found.push(`could not measure: ${String(error)}`);
        }
        let evidence: Record<string, string> | undefined;
        if (found.length > 0) {
          evidence = await keepLaneEvidence(
            page,
            context,
            { consoleLines, network },
            { logRunId, testId, lane, message: found.slice(0, 20).join("; ") },
          );
          failures.push(
            `${lane}: ${found.slice(0, 8).join("; ")}${found.length > 8 ? ` (+${found.length - 8} more)` : ""}`,
          );
        } else {
          await context.tracing.stop();
        }
        logger.log({
          testId,
          paper,
          expected: `cards at the page column; prose <= ${RESULTS_MAX_CPL} cpl at 1440, text >= ${RESULTS_MIN_TEXT_SHARE * 100}% of a phone; title above its sentence; even gaps >= 24px; one rule a card; printed displays coloured; one name, one destination; list links >= ${RESULTS_MIN_TARGET}px`,
          actual: summary || found.join("; "),
          comparisonKind: "tolerance",
          tolerance: { absolute: 2 },
          outcome: found.length === 0 ? "passed" : "failed",
          durationMs: Math.round(performance.now() - start),
          browser: "chromium",
          viewport: `${width}x900`,
          reducedMotion: false,
          jsEnabled: js,
          message: found.length === 0 ? `${lane}: ${summary}` : found.slice(0, 20).join("; "),
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
    `[results face] ${cards} cards, ${coloured} of ${printed} printed displays coloured, ${links} links (${site.note})`,
  );
  assert.ok(cards > 0, "no result card was measured");
  assert.ok(links > 0, "no link on a Results face was checked");
  assert.deepEqual(failures, []);
});
