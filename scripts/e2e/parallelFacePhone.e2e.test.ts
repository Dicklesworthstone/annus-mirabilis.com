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
 * By default this serves the built site (out/, which must be fresh); with AM_E2E_ORIGIN set to a
 * deployed origin it reads that site instead. A failing lane keeps a screenshot, trace, DOM
 * snapshot, console and network log, and every lane writes one JSON line to
 * artifacts/test-logs/parallel-face-phone/.
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

test("the parallel face on a phone reads as pairs, with one key, room for page labels, and legible terms (dispatch 237)", {
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
              testId: `parallel-face-phone-${lane}`,
              lane,
              outcome: "failed",
              message: found.slice(0, 20).join("; "),
            },
            capture,
          );
          const kept = (source: string) =>
            retained.copied.find((copy) => copy.endsWith(source.slice(source.lastIndexOf("/")))) ??
            source;
          evidence = Object.fromEntries(
            Object.entries(capture).map(([kind, source]) => [kind, kept(source)]),
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
