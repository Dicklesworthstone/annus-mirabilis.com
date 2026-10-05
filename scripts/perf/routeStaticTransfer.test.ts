/**
 * THE REPORTED TRANSFER IS MEASURED, AND SAYS WHAT IT COVERS
 * (am-perf-total-transfer-is-a-constant-qfe1).
 *
 * The bead's defect was `totalBytes = scriptBytes + 25_000; // estimated HTML/CSS transfer`: a
 * constant printed in a column labelled as a measurement. The constant went on 2026-09-24. What
 * stayed was a field named "total transfer" with nothing stating its scope, while the code comment
 * beside it claimed "Fonts and images are excluded, and a note says so" -- and no note said so. The
 * bead measured live cold totals of 0.82-1.34 MB per paper page against a reported figure 4-10x
 * smaller, dominated by the self-hosted Newsreader faces at 265 KB + 295 KB brotli.
 *
 * The planted negative is the bead's third acceptance item, and it is what distinguishes a
 * measurement from a constant: a constant does not move when the page grows.
 */

import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  builtRouteDir,
  readRouteStaticTransfer,
  STATIC_TRANSFER_SCOPE,
} from "./routeStaticTransfer.ts";

/** A built tree with one page, one stylesheet and one font, written where the reader expects them. */
function fixture(options: { extraCssBytes?: number; withFont?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "route-static-transfer-"));
  mkdirSync(resolve(root, "out/probe"), { recursive: true });
  mkdirSync(resolve(root, "out/fonts"), { recursive: true });
  const fontLink = options.withFont
    ? '<link rel="preload" as="font" href="/fonts/reading.woff2"/>'
    : "";
  writeFileSync(
    resolve(root, "out/probe/index.html"),
    `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"/>${fontLink}</head><body><p>${"page text ".repeat(200)}</p></body></html>`,
  );
  // Random bytes so brotli cannot compress the plant away: the point is that the measured total
  // moves by about the size added, which a compressible filler would hide.
  const css = `body{color:#000}\n/* ${options.extraCssBytes ? randomBytes(options.extraCssBytes).toString("base64") : ""} */`;
  writeFileSync(resolve(root, "out/styles.css"), css);
  if (options.withFont) {
    writeFileSync(resolve(root, "out/fonts/reading.woff2"), randomBytes(120_000));
  }
  return root;
}

describe("a route's static transfer is read from the build", () => {
  test("the scope sentence travels with the number and names what it excludes", () => {
    // The field used to be called a total with no scope anywhere in the artifact. Whatever else
    // changes, a reader must be able to tell this is not a cold-load network measurement.
    expect(STATIC_TRANSFER_SCOPE).toContain("HTML");
    expect(STATIC_TRANSFER_SCOPE).toContain("stylesheets");
    expect(STATIC_TRANSFER_SCOPE).toContain("fonts");
    expect(STATIC_TRANSFER_SCOPE).toContain("UPPER BOUND");
    expect(STATIC_TRANSFER_SCOPE).toContain("images");
    expect(STATIC_TRANSFER_SCOPE).toContain("Not a cold-load network measurement");
  });

  test("html and css are measured, and a built page is found", () => {
    const root = fixture();
    const measured = readRouteStaticTransfer(root, "/probe");
    expect(measured).not.toBeNull();
    expect(measured?.htmlCssBytes).toBeGreaterThan(0);
    expect(measured?.measuredPage).toBe("probe");
  });

  test("PLANTED NEGATIVE: adding a 200 KB asset raises the measured total by about 200 KB", () => {
    // The bead's third acceptance item, and the test a constant cannot pass. 200 KB of random bytes
    // is incompressible, so the brotli figure must move by roughly the amount added.
    const before = readRouteStaticTransfer(fixture(), "/probe");
    const after = readRouteStaticTransfer(fixture({ extraCssBytes: 200_000 }), "/probe");
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    const delta = (after?.htmlCssBytes ?? 0) - (before?.htmlCssBytes ?? 0);
    console.log(
      `[route static transfer] plant: ${before?.htmlCssBytes} -> ${after?.htmlCssBytes} bytes, delta ${delta}`,
    );
    // base64 of 200,000 random bytes is about 266,667 characters and barely compresses, so the
    // bound is generous on the high side and firm on the low: the number must MOVE with the page.
    expect(delta).toBeGreaterThan(180_000);
    expect(delta).toBeLessThan(400_000);
  });

  test("a PRELOADED font is reported separately and never folded into the total", () => {
    // A preload is fetched whatever the page renders, so it is a real cold-load cost and belongs in
    // its own figure rather than inside a number labelled html+css.
    const withFont = readRouteStaticTransfer(fixture({ withFont: true }), "/probe");
    const withoutFont = readRouteStaticTransfer(fixture(), "/probe");
    expect(withFont?.preloadedFontCount).toBe(1);
    expect(withFont?.preloadedFontBytes ?? 0).toBeGreaterThan(100_000);
    // And it is NOT in the html/css figure: the two pages differ only by the font.
    const htmlCssDelta = (withFont?.htmlCssBytes ?? 0) - (withoutFont?.htmlCssBytes ?? 0);
    expect(htmlCssDelta).toBeLessThan(2_000);
    // A page with no font reports zero AND a zero count, so "none referenced" is distinguishable
    // from "fonts not found".
    expect(withoutFont?.preloadedFontCount).toBe(0);
    expect(withoutFont?.preloadedFontBytes).toBe(0);
  });

  test("an unbuilt route is null, which is unmeasured rather than small", () => {
    // A gate that cannot measure must say so rather than guess low; this is the shape that lets the
    // runner report "out/ holds no HTML for this route" instead of a number.
    expect(readRouteStaticTransfer(fixture(), "/not-built")).toBeNull();
    expect(builtRouteDir(fixture(), "/not-built")).toBeNull();
  });

  test("a [param] route is measured on its first built instance, in sorted order", () => {
    const root = mkdtempSync(join(tmpdir(), "route-static-transfer-param-"));
    for (const name of ["zulu", "alpha"]) {
      mkdirSync(resolve(root, `out/papers/${name}`), { recursive: true });
      writeFileSync(resolve(root, `out/papers/${name}/index.html`), "<!doctype html><p>x</p>");
    }
    const measured = readRouteStaticTransfer(root, "/papers/[paper]");
    // Sorted, so the figure is always one real page and always the same one.
    expect(measured?.measuredPage).toBe("papers/alpha");
  });
});

describe("the real build, so the fixtures are not the only population", () => {
  test("the paper route reports html/css bytes and the fonts it excludes", () => {
    const measured = readRouteStaticTransfer(process.cwd(), "/papers/[paper]");
    if (measured === null) {
      // out/ is not built in this working tree; say so rather than passing quietly.
      console.log("[route static transfer] out/ holds no /papers/[paper]; skipped the real build");
      return;
    }
    console.log(
      `[route static transfer] ${measured.measuredPage}: ${measured.htmlCssBytes} bytes html+css; fonts excluded from the total -- ${measured.preloadedFontBytes} bytes preloaded in ${measured.preloadedFontCount}, ${measured.declaredFontBytes} bytes declared in ${measured.declaredFontCount} (an upper bound, fetched on demand)`,
    );
    expect(measured.htmlCssBytes).toBeGreaterThan(10_000);
    // The bead's own finding: the fonts dominate. If this ever reads 0 with a positive count, the
    // reference scan has stopped finding them and the exclusion would be invisible again.
    // The real page declares its faces and preloads none, which is exactly why the two figures are
    // kept apart: reporting the declared payload as the font cost would overstate it threefold.
    expect(measured.declaredFontCount).toBeGreaterThan(0);
    expect(measured.declaredFontBytes).toBeGreaterThan(measured.htmlCssBytes);
    expect(measured.preloadedFontCount).toBe(0);
    expect(measured.preloadedFontBytes).toBe(0);
  });
});
