/**
 * WHAT A ROUTE'S REPORTED TRANSFER ACTUALLY COVERS (am-perf-total-transfer-is-a-constant-qfe1).
 *
 * The bead's defect was `totalBytes = scriptBytes + 25_000; // estimated HTML/CSS transfer`: a
 * constant printed in a column labelled as a measurement, beside real ones. That constant is gone --
 * the total is the route's own HTML plus every stylesheet it links, brotli-compressed, read from the
 * built `out/`.
 *
 * WHAT WAS STILL WRONG, and why this module exists. The docblock beside that code said "Fonts and
 * images are excluded, and a note says so". No note said so. `RouteTransferSummary` carried
 * `totalTransferBytes` and nothing stating its scope, and `byteAccounting` describes the SCRIPT
 * bytes, so a reader of the report saw a field named "total transfer" whose value excludes the
 * largest thing a cold load fetches. The bead measured live cold totals of 0.82-1.34 MB per paper
 * page, dominated by the self-hosted Newsreader faces at 265 KB + 295 KB brotli, against a reported
 * figure 4-10x smaller.
 *
 * So the number keeps its honest definition and gains two things that travel with it: a scope
 * sentence saying what it covers and what it does not, and the referenced FONT bytes measured the
 * same way, so the dominant excluded term is a figure in the artifact rather than an absence. Fonts
 * are immutable-cached and ship whole by decision (docs/DECISIONS.md D-2026-09-24-fonts-ship-whole);
 * this is about saying so, not about subsetting them.
 *
 * WHAT THIS IS NOT. It is not a cold-load network measurement. It reads the built tree, so it counts
 * what the HTML references and cannot see a request made by script at runtime. Anything claiming to
 * be a cold transfer total needs a browser network log, and the scope sentence says as much rather
 * than letting the reader assume it.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";

/**
 * HTML and CSS are compressed at brotli quality 9, not the default 11, matching the runner's own
 * helper: measured on 2026-09-24, a 1,578 KB page is 73,438 B at q11 in 1,629 ms and 80,948 B at q9
 * in 26 ms. So this figure is up to about 10% ABOVE the q11 size and never below it.
 */
function brotliStaticBytes(buf: Buffer): number {
  return brotliCompressSync(buf, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 } }).length;
}

/** The sentence that travels with every reported total, so the field cannot be read as a cold load. */
export const STATIC_TRANSFER_SCOPE =
  "Brotli bytes of the route's own HTML, its linked stylesheets and its initial JavaScript, read from the built out/. Excludes images, anything requested by script at runtime, and fonts, which are reported separately: preloadedFontBytes are fetched unconditionally, declaredFontBytes is the @font-face payload a browser draws from ON DEMAND and is therefore an UPPER BOUND, not a cold-load cost. Not a cold-load network measurement.";

export interface RouteStaticTransfer {
  /** Brotli bytes of the HTML plus every stylesheet the HTML links. */
  readonly htmlCssBytes: number;
  /**
   * Fonts the HTML PRELOADS, which a browser fetches whether or not the text needs them. This is a
   * real cold-load cost and is excluded from the total only because the total is about HTML, CSS and
   * JavaScript.
   */
  readonly preloadedFontBytes: number;
  readonly preloadedFontCount: number;
  /**
   * The @font-face payload the route's stylesheets DECLARE, which a browser draws from on demand: it
   * downloads the faces the rendered text needs and no others.
   *
   * SO THIS IS AN UPPER BOUND AND MUST NEVER BE READ AS A COLD-LOAD COST, which is the same mistake
   * this bead exists to fix, one field over. Measured on out/papers/brownian-motion: 66 @font-face
   * urls totalling 1,710,324 brotli bytes and ZERO preloads, while the bead's live cold measurement
   * found the Newsreader faces actually fetched at 265 KB + 295 KB. Reporting 1.71 MB as the font
   * cost would overstate it threefold.
   */
  readonly declaredFontBytes: number;
  readonly declaredFontCount: number;
  /** The built page this was measured on, relative to out/, for a pattern route's first instance. */
  readonly measuredPage: string;
}

/** Resolves a route, including a `[param]` segment, to its first built directory in sorted order. */
export function builtRouteDir(rootDir: string, route: string): string | null {
  let dir = resolve(rootDir, "out");
  for (const segment of route.split("/").filter(Boolean)) {
    if (/^\[.+\]$/.test(segment)) {
      const instances = existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && existsSync(resolve(dir, e.name, "index.html")))
            .map((e) => e.name)
            .sort()
        : [];
      const first = instances.find((name) => !name.startsWith("_"));
      if (first === undefined) return null;
      dir = resolve(dir, first);
    } else {
      dir = resolve(dir, segment);
    }
  }
  return existsSync(resolve(dir, "index.html")) ? dir : null;
}

const FONT_EXTENSION = /\.(woff2?|ttf|otf)(\?|$)/i;

/** An `out/`-relative path for a reference, or null when it points outside the build. */
function outPath(rootDir: string, reference: string): string | null {
  const cleaned = reference.replace(/^\//, "").split("?")[0] ?? "";
  if (cleaned === "" || /^https?:/i.test(reference) || reference.startsWith("data:")) return null;
  const path = resolve(rootDir, "out", cleaned);
  return existsSync(path) ? path : null;
}

/**
 * Measures a route's static transfer from the built tree.
 *
 * Returns null when the page was not built, so an absent page is reported as unmeasured rather than
 * as a small number. That distinction is the whole point of the row: a gate that cannot measure must
 * say so rather than guess low.
 */
export function readRouteStaticTransfer(
  rootDir: string,
  route: string,
): RouteStaticTransfer | null {
  const dir = builtRouteDir(rootDir, route);
  if (dir === null) return null;
  const htmlBuffer = readFileSync(resolve(dir, "index.html"));
  const html = htmlBuffer.toString("utf8");
  let htmlCssBytes = brotliStaticBytes(htmlBuffer);

  const stylesheets = new Set<string>();
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    if (m[1]) stylesheets.add(m[1]);
  }
  // PRELOADED AND DECLARED ARE COUNTED APART, because a browser treats them apart: a preload is
  // fetched whatever the page renders, an @font-face is fetched only if the text needs that face.
  const preloaded = new Set<string>();
  const declared = new Set<string>();
  for (const m of html.matchAll(/<link[^>]+rel="preload"[^>]*>/g)) {
    const href = /href="([^"]+)"/.exec(m[0])?.[1];
    if (href && FONT_EXTENSION.test(href)) preloaded.add(href);
  }
  for (const href of stylesheets) {
    const cssPath = outPath(rootDir, href);
    if (cssPath === null) continue;
    const css = readFileSync(cssPath);
    htmlCssBytes += brotliStaticBytes(css);
    for (const m of css.toString("utf8").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (m[1] && FONT_EXTENSION.test(m[1])) declared.add(m[1]);
    }
  }

  /** Fonts are compressed containers already, so brotli over them is near-identity; one unit. */
  function sumFonts(references: ReadonlySet<string>): { bytes: number; count: number } {
    let bytes = 0;
    let count = 0;
    for (const reference of references) {
      const fontPath = outPath(rootDir, reference);
      if (fontPath === null) continue;
      count += 1;
      bytes += brotliStaticBytes(readFileSync(fontPath));
    }
    return { bytes, count };
  }
  // A preloaded face is not counted twice if a stylesheet also declares it.
  for (const reference of preloaded) declared.delete(reference);
  const pre = sumFonts(preloaded);
  const dec = sumFonts(declared);

  return {
    htmlCssBytes,
    preloadedFontBytes: pre.bytes,
    preloadedFontCount: pre.count,
    declaredFontBytes: dec.bytes,
    declaredFontCount: dec.count,
    measuredPage: dir.slice(resolve(rootDir, "out").length + 1) || ".",
  };
}
