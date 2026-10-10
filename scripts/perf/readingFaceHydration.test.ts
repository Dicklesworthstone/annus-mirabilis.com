import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { faceHydration, measureFaces, READING_FACE_GZIP_BUDGET } from "./readingFaceHydration.ts";

/**
 * THE BASELINE pcjk.52 ASKS FOR, AND WHAT MEASURING IT CORRECTED.
 *
 * Step 1 of that bead is "measure the current per-face bytes and hydration payload as the baseline",
 * and its Tests and logging section asks for a before-and-after measurement per face. The census
 * below is that baseline, printed so a later run can be diffed against it.
 *
 * `perf/readingFaceRecords.json` attributes "about 64% of the bytes to React's hydration payload",
 * and that holds: the flight payload is 62.2% of special-relativity/view/parallel. Of THAT payload,
 * rendered mathematics -- the same HTML the page already contains, serialised again as a `T` text
 * row because it crosses a client boundary as a string prop -- is 47.1% on that face, 47.4% on
 * brownian-motion/view/german and 17.0% on mass-energy/view/german.
 *
 * SO THE SHARE IS NOT UNIFORM AND IS NOT ASSERTED AS IF IT WERE. Per-SECTION faces range from 0.0%
 * to 50.0%: a section with no displayed mathematics carries none. The assertion below is scoped to
 * the faces that are over budget, which is the population the bead is about, and every share is
 * printed rather than summarised.
 *
 * TWO INSTRUMENTS OF MINE WERE WRONG BEFORE THESE NUMBERS WERE WRITTEN DOWN, and both were caught
 * by a synthetic case rather than by review: a greedy `\\u003cspan class=\\"katex...` match ran to
 * the end of the concatenated payload and reported 99.6% where the row-precise figure is 47.1%, and
 * a "400 kB of incompressible noise" fixture was periodic with period 90, so gzip crushed it and
 * the over-budget case passed for the wrong reason.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "out");

/** A flight text row carrying rendered KaTeX, in the form React emits. */
const katexRow = (id: number) =>
  `${id}:T100,\\u003cspan class=\\"katex\\"\\u003ex\\u003c/span\\u003e`;

describe("reading-face hydration baseline (am-rc1001-bridge-plan-pcjk.52)", () => {
  test("a synthetic face: a math text row is counted, a plain prop row is not", () => {
    const html =
      "<html><body><p>text</p>" +
      `<script>self.__next_f.push([1,"${katexRow(70)}"])</script>` +
      `<script>self.__next_f.push([1,"\\n71:{\\"name\\":\\"plain\\"}"])</script>` +
      "</body></html>";
    const m = faceHydration("probe/view/german", html);
    expect(m.flightBytes).toBeGreaterThan(0);
    expect(m.katexFlightBytes).toBeGreaterThan(0);
    // The plain row is in the payload and is NOT math, so the share is strictly below one. This is
    // the assertion that caught the greedy matcher, which reported the two rows as one math run.
    expect(m.katexFlightBytes).toBeLessThan(m.flightBytes);
    expect(m.katexShareOfFlight).toBeLessThan(1);
    expect(m.overBudget).toBe(false);
  });

  test("a page with no payload reports zero rather than dividing by zero", () => {
    const none = faceHydration("probe/view/plain", "<html><body><p>text</p></body></html>");
    expect(none.flightBytes).toBe(0);
    expect(none.flightShare).toBe(0);
    expect(none.katexShareOfFlight).toBe(0);
    expect(none.katexFlightBytes).toBe(0);
  });

  test("a face gzip cannot bring under the budget is reported over", () => {
    // INCOMPRESSIBLE, AND THE FIRST ATTEMPT WAS NOT: `String.fromCharCode(32 + (i * 7919) % 90)` has
    // period 90, so gzip reduced 400,000 characters to a few hundred bytes and the page read as
    // within budget. A seeded xorshift gives bytes gzip cannot model.
    let x = 0x9e3779b9;
    const noise = Array.from({ length: 1_200_000 }, () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return String.fromCharCode(33 + (Math.abs(x) % 90));
    }).join("");
    const big = faceHydration("probe/view/big", `<html><body>${noise}</body></html>`);
    console.log(
      `[reading face hydration] plant: ${big.htmlBytes} B of noise -> ${big.gzipBytes} gzip`,
    );
    expect(READING_FACE_GZIP_BUDGET).toBe(250_000);
    expect(big.gzipBytes).toBeGreaterThan(READING_FACE_GZIP_BUDGET);
    expect(big.overBudget).toBe(true);
  });

  test("the built faces, measured, with the ones over budget named", () => {
    if (!existsSync(OUT)) {
      console.log("[reading face hydration] out/ absent; run bun run build");
      expect(existsSync(OUT)).toBe(false);
      return;
    }
    const faces = measureFaces(OUT);
    const over = [...faces].filter((f) => f.overBudget).sort((a, b) => b.gzipBytes - a.gzipBytes);
    console.log(
      `[reading face hydration] measured ${faces.length} built face(s); ${over.length} over the ` +
        `${READING_FACE_GZIP_BUDGET}-byte gzip budget`,
    );
    for (const f of over)
      console.log(
        `  ${f.face}: ${f.htmlBytes} B html, ${f.gzipBytes} gzip, ${f.flightBytes} flight ` +
          `(${(100 * f.flightShare).toFixed(1)}% of html), ${f.katexFlightBytes} of it rendered math ` +
          `(${(100 * f.katexShareOfFlight).toFixed(1)}% of the payload)`,
      );
    // The denominators first: a walk that found no face, or found none over budget, would read
    // exactly like a site within its budgets. 224 faces on the build of 2026-10-10 -- the 28
    // whole-paper faces plus every per-section one, which is the population am-snn0 asked for.
    expect(faces.length).toBeGreaterThanOrEqual(100);
    expect(over.length).toBeGreaterThan(0);
    // On the faces that are over budget, the payload is a large share of the page and a substantial
    // part of it is duplicated mathematics. Scoped to those faces because per-section faces range
    // from 0.0% to 50.0% and a section with no displayed mathematics carries none.
    for (const f of over) {
      expect(f.flightShare).toBeGreaterThan(0.4);
      expect(f.katexShareOfFlight).toBeGreaterThan(0.1);
    }
  });
});
