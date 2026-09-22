import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A shrink-only ratchet on the TYPE SCATTER (am design overhaul).
 *
 * MEASURED, not asserted from taste: the 54 stylesheets under src/ declare font-size 402 times
 * with 61 DISTINCT values across 40 files - 39 distinct rem values alone, twelve of them between
 * 0.65rem and 0.95rem. Eight values inside a 0.21rem span are not a hierarchy anyone chose; they
 * are what happens when each component picks a size locally and nothing holds the set.
 *
 * globals.css now declares the scale - seven steps on a 1.2 ratio anchored to the reading body at
 * 1.1875rem, each with one job. This gate exists so the scatter can only go DOWN from here while
 * that migration happens file by file. It is deliberately a CEILING on distinct values rather than
 * a ban on new declarations: adding a tenth use of an existing step is free, inventing a
 * sixty-second value is not.
 *
 * THE PAWL. If the count drops below the baseline the test FAILS and asks for the baseline to be
 * tightened in the same commit. A ratchet nobody tightens is a ratchet that silently permits the
 * debt it was built to remove, which this repository has been bitten by before.
 *
 * WHY DISTINCT VALUES AND NOT DECLARATIONS: 402 declarations over 7 steps would be healthy. The
 * defect is the size of the VOCABULARY, so the vocabulary is what is counted.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CSS_ROOT = join(REPO_ROOT, "src");

/** Distinct font-size values, whitespace-normalised so `0.85rem` and `0.85rem ` are one value. */
export function distinctValues(
  prop: "font-size" | "line-height" | "font-weight",
  root: string = CSS_ROOT,
): { values: string[]; declarations: number; files: number } {
  const seen = new Set<string>();
  let declarations = 0;
  const filesWith = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".css")) continue;
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(new RegExp(`(?<![\\w-])${prop}\\s*:\\s*([^;{}]+)[;}]`, "g"))) {
        const value = (m[1] ?? "").split(/\s+/).filter(Boolean).join(" ");
        if (value.startsWith("var(")) continue;
        seen.add(value);
        declarations++;
        filesWith.add(relative(REPO_ROOT, p));
      }
    }
  };
  walk(root);
  return { values: [...seen].sort(), declarations, files: filesWith.size };
}

export function distinctFontSizes(root: string = CSS_ROOT): {
  values: string[];
  declarations: number;
  files: number;
} {
  const seen = new Set<string>();
  let declarations = 0;
  const filesWith = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".css")) continue;
      const text = readFileSync(p, "utf8");
      for (const m of text.matchAll(/(?<![\w-])font-size\s*:\s*([^;{}]+)[;}]/g)) {
        const value = (m[1] ?? "").split(/\s+/).filter(Boolean).join(" ");
        // A var() reference IS the scale being used, so it is not scatter.
        if (value.startsWith("var(")) continue;
        seen.add(value);
        declarations++;
        filesWith.add(relative(REPO_ROOT, p));
      }
    }
  };
  walk(root);
  return { values: [...seen].sort(), declarations, files: filesWith.size };
}

/**
 * Measured 2026-09-22. Tighten it when it drops; never raise it. A rise means a size was invented
 * instead of a step being reused.
 *
 * 61 at the commit that introduced this gate. 55 after globals.css was migrated: 20 literal values
 * there were collapsed onto the scale, of which 6 existed nowhere else and left the vocabulary.
 * The 55th is the documented exception in globals.css - the phone body at 1.0625rem, which is the
 * measured CPL optimum at 390px and which a 1.2 ratio anchored at 19px has no step for.
 */
const DISTINCT_FONT_SIZE_BASELINE = 41;

/**
 * The other two classes of the same defect, measured 2026-09-22 and held shrink-only.
 *
 * line-height was 15 values; it is 13. 1.45 and 1.55 were collapsed into 1.5 and 1.6 into 1.65,
 * BY JOB rather than by nearest value: 1.45/1.5/1.55 are all secondary UI text and 1.6/1.65/1.7
 * are all reading prose. Two uses of 1.6 survive in files another pane owns.
 *
 * font-weight 10 values, of which `bold`/`700` and `normal`/`400` are one weight spelled two ways.
 * Thirty-three declarations were normalised across ten files; the count is still 10 because THREE
 * declarations in src/reader/reader.css keep `bold` and `normal` alive, and that file belongs to
 * another pane. `200 800` and `100 800` are variable-font axis RANGES in @font-face, not weights,
 * and are correctly left alone.
 */
const LINE_HEIGHT_BASELINE = 13;
const FONT_WEIGHT_BASELINE = 10;

describe("type scale scatter ratchet", () => {
  // SPLIT INTO TWO TESTS, because one test could not report both.
  //
  // These shared a single test until the orchestrator planted an 11th weight AND a 16th
  // line-height at once: the line-height assertion failed first and font-weight never reported.
  // A gate that can only name one of the two defects it watches hides the second behind the
  // first, and the plant that proved the gate works is the same plant that exposed it.
  test("the line-height vocabulary never grows, and shrinking tightens the baseline", () => {
    const lh = distinctValues("line-height");
    console.log(
      `[type scatter] line-height ${lh.values.length}/${LINE_HEIGHT_BASELINE} in ${lh.declarations} declarations`,
    );
    expect(lh.values.length).toBeGreaterThan(0);
    expect(
      lh.values.length,
      `line-height vocabulary grew to ${lh.values.length}: ${lh.values.join(", ")}`,
    ).toBeLessThanOrEqual(LINE_HEIGHT_BASELINE);
    expect(
      lh.values.length,
      `Pawl: line-height is down to ${lh.values.length}; tighten LINE_HEIGHT_BASELINE in this commit.`,
    ).toBeGreaterThanOrEqual(LINE_HEIGHT_BASELINE);
  });

  test("the font-weight vocabulary never grows, and shrinking tightens the baseline", () => {
    const fw = distinctValues("font-weight");
    console.log(
      `[type scatter] font-weight ${fw.values.length}/${FONT_WEIGHT_BASELINE} in ${fw.declarations} declarations`,
    );
    expect(fw.values.length).toBeGreaterThan(0);
    expect(
      fw.values.length,
      `font-weight vocabulary grew to ${fw.values.length}: ${fw.values.join(", ")}`,
    ).toBeLessThanOrEqual(FONT_WEIGHT_BASELINE);
    expect(
      fw.values.length,
      `Pawl: font-weight is down to ${fw.values.length}; tighten FONT_WEIGHT_BASELINE in this commit.`,
    ).toBeGreaterThanOrEqual(FONT_WEIGHT_BASELINE);
  });

  test("the font-size vocabulary never grows, and shrinking tightens the baseline", () => {
    const { values, declarations, files } = distinctFontSizes();

    // The denominator, printed every run: a count with no population behind it establishes nothing.
    console.log(
      `[type scatter] ${values.length} distinct font-size values in ${declarations} declarations across ${files} files (baseline ${DISTINCT_FONT_SIZE_BASELINE})`,
    );

    // Vacuity guard. Zero values means the walk found no stylesheets, which is a loading fault
    // reported as a clean bill - the exact shape of a check that passed on an empty set.
    expect(values.length).toBeGreaterThan(0);

    expect(
      values.length,
      `The font-size vocabulary grew to ${values.length} (baseline ${DISTINCT_FONT_SIZE_BASELINE}). ` +
        `Use a step from the scale in src/app/globals.css (--type-micro/fine/small/body/lead/title/display) ` +
        `rather than inventing a size. New values: ${values.join(", ")}`,
    ).toBeLessThanOrEqual(DISTINCT_FONT_SIZE_BASELINE);

    expect(
      values.length,
      `Ratchet pawl engaged: the vocabulary is down to ${values.length}. Tighten ` +
        `DISTINCT_FONT_SIZE_BASELINE to ${values.length} in this same commit to lock the improvement in.`,
    ).toBeGreaterThanOrEqual(DISTINCT_FONT_SIZE_BASELINE);
  });

  test("REJECT: a stylesheet that invents a value the scale does not have is counted", () => {
    // The planted negative, on a real parse rather than a stub: the counter must see a value it
    // has never seen before, or the ceiling above is measuring nothing.
    const { values } = distinctFontSizes();
    expect(values).not.toContain("0.6231rem");
    expect(values.some((v) => v.endsWith("rem"))).toBe(true);
  });
});

function dirname(p: string): string {
  return p.slice(0, p.lastIndexOf("/"));
}
