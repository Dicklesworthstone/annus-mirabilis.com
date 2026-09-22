import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";

/**
 * THE READING MATRIX, AS A GATE RATHER THAN AS PROSE (am design overhaul).
 *
 * layoutMatrix.test.ts records what the twelve reading-settings combinations render, but it is a
 * unit test over CSS TEXT: it can assert that each measure is declared in ch and it cannot lay out
 * a paragraph, so the numbers in it survived only as a comment. A matrix in a comment decays, and
 * it decayed once already - the recorded reason said "358px at every measure", which was true
 * before the measure moved to ch and wrong afterwards for narrow at 100%. It read as checked.
 *
 * This file closes both halves the orchestrator asked for:
 *
 *   1. A combination that moves OUT of the band fails.
 *   2. A RECORDED REASON that stops holding fails too. Which phone cells are viewport-bound is
 *      asserted, not narrated, so changing a measure token breaks the explanation rather than
 *      leaving a plausible sentence behind. (It did: when Narrow went from 36ch to 44ch, the one
 *      measure-bound cell became viewport-bound and this failed until the record was re-taken.)
 *
 * CPL is counted from TRUE line breaks - the character index at which the client rect's top
 * changes - not from an estimated advance. An earlier attempt used the font shorthand to measure
 * an average advance and reported CPL as constant across type sizes, which is impossible with a
 * fixed column; that method is what this one replaces.
 *
 * THE BAND IS 45-75 AND THE ANCHOR IS THE PLATE. Printed page 554 of ap-17-549 measures 57, 58,
 * 58, 55, 55, 56 characters per line. Desktop is held to the band. PHONE IS NOT, DELIBERATELY: at
 * 390px the column is at most 358px, so CPL is set by type size alone and 358px at 28.5px type IS
 * about 28 characters. Raising those rows would mean shrinking the type the reader just enlarged.
 * Those values are pinned as EXPECTED, so they cannot drift unnoticed in either direction.
 */

const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT = join(REPO_ROOT, "out");

/**
 * Served over HTTP, not file://. The static export references its CSS by absolute path, so under
 * file:// those resolve against the filesystem root, nothing loads, and the page renders unstyled
 * at 16px full width - which this gate read as 192 CPL and would have reported as twelve
 * out-of-band failures. An unstyled page is not a wide page.
 */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveOut(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let file = join(OUT, url);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}

const MEASURES = ["narrow", "default", "wide"] as const;
const TYPE_SCALES = ["100", "112", "125", "150"] as const;
const BAND = { min: 45, max: 75 } as const;

/**
 * Pinned: the phone rows and the column widths that explain them. Change one, and this fails.
 *
 * RE-TAKEN 2026-09-22 FROM BUILD 21 with this file's own measure(). The record of 03:54 had
 * narrow/100 measure-bound at 342px (36ch) and the rest at 46-49 / 43 / 38 / 31 CPL. Two things
 * moved:
 * - Narrow is now 44ch (41964faa), which is wider than a phone at every type size, so narrow/100
 *   is viewport-bound at 358px like the other eleven cells.
 * - The paragraph measured, the Brownian first encounter's "Now assume the displacements...", is
 *   set at the reading body's 19px (1ch = 10.47px, measured). The old record's own 342px for 36ch
 *   implies about 17.2px then (1ch = 9.5px). Which commit brought it to 19px was not identified;
 *   19px is --type-body, the site's stated reading size, so the new values are the intended ones.
 * The values follow the arithmetic: 358px / 10.47px per ch x ~1.27 characters per ch = 43.
 */
const PHONE_EXPECTED: Readonly<Record<string, { cpl: number; width: number }>> = {
  "narrow/100": { cpl: 43, width: 358 },
  "narrow/112": { cpl: 38, width: 358 },
  "narrow/125": { cpl: 34, width: 358 },
  "narrow/150": { cpl: 28, width: 358 },
  "default/100": { cpl: 43, width: 358 },
  "default/112": { cpl: 38, width: 358 },
  "default/125": { cpl: 34, width: 358 },
  "default/150": { cpl: 28, width: 358 },
  "wide/100": { cpl: 43, width: 358 },
  "wide/112": { cpl: 38, width: 358 },
  "wide/125": { cpl: 34, width: 358 },
  "wide/150": { cpl: 28, width: 358 },
};

async function measure(
  page: import("playwright").Page,
  measureValue: string,
  scale: string,
): Promise<{ cpl: number; width: number; fontSize: number } | null> {
  await page.evaluate(
    ([m, s]) => {
      document.documentElement.setAttribute("data-measure", m as string);
      document.documentElement.setAttribute("data-type-scale", s as string);
    },
    [measureValue, scale],
  );
  return page.evaluate(() => {
    const el = [...document.querySelectorAll("section > p")].find(
      (n) => !n.className && (n as HTMLElement).innerText.trim().length > 300,
    );
    if (!el) return null;
    const node = [...el.childNodes].find(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 100,
    );
    if (!node) return null;
    const range = document.createRange();
    const text = node.textContent ?? "";
    const counts: number[] = [];
    let lineStart = 0;
    let prevTop: number | null = null;
    for (let i = 1; i <= Math.min(text.length, 600); i++) {
      range.setStart(node, i - 1);
      range.setEnd(node, i);
      const rect = range.getBoundingClientRect();
      if (rect.height === 0) continue;
      const top = Math.round(rect.top);
      if (prevTop === null) prevTop = top;
      else if (top !== prevTop) {
        counts.push(i - 1 - lineStart);
        lineStart = i - 1;
        prevTop = top;
      }
    }
    const full = counts.slice(0, -1).sort((a, b) => a - b);
    if (!full.length) return null;
    return {
      cpl: full[Math.floor(full.length / 2)] as number,
      width: Math.round(el.getBoundingClientRect().width),
      fontSize: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10,
    };
  });
}

test("the twelve reading combinations: desktop holds the band, phone holds its recorded reason", async () => {
  // A stale out/ would measure a build nobody is looking at. Absent is refused for the same reason.
  //
  // IT CANNOT TELL CORRUPT FROM STALE, and that limit is worth knowing rather than discovering.
  // A half-written out/ - a build killed mid-flight, which happens here because concurrent
  // `next build` runs in one checkout clobber .next/ - surfaces as the SAME refusal as an
  // out-of-date one. That is the safe direction: it declines instead of reporting numbers from a
  // partial build. But "this gate refused" means "do not trust out/", never "out/ is merely old".
  assertOutFreshness();

  const site = await serveOut();
  const PAGE = `${site.origin}/papers/brownian-motion/`;
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await desktop.goto(PAGE, { waitUntil: "domcontentloaded" });
    await desktop.evaluate(() => document.fonts.ready);

    const outOfBand: string[] = [];
    for (const m of MEASURES) {
      for (const s of TYPE_SCALES) {
        const r = await measure(desktop, m, s);
        assert.ok(r, `no reading paragraph found at ${m}/${s}; this gate would prove nothing`);
        if (r.cpl < BAND.min || r.cpl > BAND.max) {
          outOfBand.push(`${m}/${s}: ${r.cpl} CPL (width ${r.width}, ${r.fontSize}px)`);
        }
      }
    }
    assert.deepEqual(
      outOfBand,
      [],
      `desktop combinations outside ${BAND.min}-${BAND.max} characters per line:\n  ${outOfBand.join("\n  ")}`,
    );
    await desktop.close();

    // THE RECORDED REASON, ASSERTED. All twelve cells are viewport-bound at 358px.
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(PAGE, { waitUntil: "domcontentloaded" });
    await phone.evaluate(() => document.fonts.ready);

    const drift: string[] = [];
    let viewportBound = 0;
    for (const m of MEASURES) {
      for (const s of TYPE_SCALES) {
        const key = `${m}/${s}`;
        const r = await measure(phone, m, s);
        assert.ok(r, `no reading paragraph found at phone ${key}`);
        const want = PHONE_EXPECTED[key];
        assert.ok(want, `no expectation recorded for ${key}`);
        if (r.width === 358) viewportBound++;
        if (r.cpl !== want.cpl || r.width !== want.width) {
          drift.push(
            `${key}: ${r.cpl} CPL at ${r.width}px, recorded ${want.cpl} at ${want.width}px`,
          );
        }
      }
    }
    assert.equal(
      viewportBound,
      12,
      `the recorded reason says all TWELVE phone cells are viewport-bound at 358px (every measure is wider than a 390px phone); ${viewportBound} are. The explanation in layoutMatrix.test.ts is now wrong and must be re-measured, not re-worded.`,
    );
    assert.deepEqual(
      drift,
      [],
      `phone rows moved away from their recorded values:\n  ${drift.join("\n  ")}\nRe-measure with the same method and update the record; do NOT cap the type scale to make these look better.`,
    );
    await phone.close();
  } finally {
    await browser.close();
    await site.close();
  }
});
