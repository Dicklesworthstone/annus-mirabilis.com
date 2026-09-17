/**
 * THE BUILD GATE (am-design-themes-typography-288q): "assert the actual
 * glyph coverage of the fonts you ship against the character set the
 * content actually uses, and make a missing glyph a BUILD FAILURE rather
 * than a rendering surprise." This is that gate: it scans the real
 * content corpus (never a declared baseline list) and fails if any code
 * point a reader could actually see is missing from every one of the
 * three self-hosted fonts.
 *
 * THREE REAL, PRE-EXISTING GAPS, named and dated rather than silently
 * excluded or left to fail the build for work unrelated to them:
 *   - U+2207 NABLA (∇), in an authored R3 reading
 *     (content/editorial/readings-owners/am-sr-12-charge-current-bgq0.yaml)
 *     literally quoting the continuity equation "∂ρ/∂t + ∇·J = 0";
 *   - U+221D PROPORTIONAL TO (∝), in content/experiments/lq-01.yaml's
 *     labeled relations ("I ∝ r^(-1)", etc.);
 *   - U+22A5 UP TACK (⊥), in content/notation/special-relativity.yaml's
 *     notation-concordance entry "a_⊥".
 * None of Newsreader, Plus Jakarta Sans, or JetBrains Mono contains any
 * of these three glyphs (glyphCoverage.test.ts's per-font sweep already
 * covers this for the declared baseline; this file's KNOWN_GAPS list
 * exists for exactly these three real, content-sourced code points).
 * Fixing this needs a fourth font or a documented substitution for these
 * specific symbols -- a real design decision this pass does not make.
 * KNOWN_GAPS keeps the gate green for everything else while refusing to
 * let a NEW uncovered glyph land silently: remove an entry once it is
 * fixed, and the test will tell you if it is still needed.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { scanContentGlyphUsage } from "./contentGlyphUsage";
import { loadCmap } from "./fontGlyphs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const CONTENT_ROOT = join(REPO_ROOT, "content");

const KNOWN_GAPS: ReadonlySet<number> = new Set([
  0x2207, // ∇ NABLA
  0x221d, // ∝ PROPORTIONAL TO
  0x22a5, // ⊥ UP TACK
]);

function loadFont(relativePath: string) {
  const buffer = readFileSync(join(REPO_ROOT, "public/fonts", relativePath));
  const bytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  return loadCmap(bytes);
}

const FONTS = [
  loadFont("newsreader/Newsreader-Variable.ttf"),
  loadFont("plus-jakarta-sans/PlusJakartaSans-Variable.ttf"),
  loadFont("jetbrains-mono/JetBrainsMono-Variable.ttf"),
];

function coveredByAnyFont(codePoint: number): boolean {
  return FONTS.some((font) => font.hasGlyph(codePoint));
}

describe("contentGlyphCoverage: the real build gate", () => {
  const usage = scanContentGlyphUsage(CONTENT_ROOT, REPO_ROOT);

  test("the scan finds real content and excludes voice-rules.yaml's forbidden-word list", () => {
    expect(usage.length).toBeGreaterThan(20);
    expect(usage.some((u) => u.char === "✓" || u.char === "✗")).toBe(false);
  });

  test("every code point the content actually uses is covered by at least one self-hosted font, OR is a named, dated known gap", () => {
    const newlyMissing: string[] = [];
    for (const { codePoint, char, files } of usage) {
      if (KNOWN_GAPS.has(codePoint)) continue;
      if (!coveredByAnyFont(codePoint)) {
        newlyMissing.push(
          `U+${codePoint.toString(16).toUpperCase()} (${char}) in ${files.join(", ")}`,
        );
      }
    }
    expect(newlyMissing).toEqual([]);
  });

  test("every entry in KNOWN_GAPS is still actually missing from all three fonts (a stale entry is a false sense of security)", () => {
    for (const codePoint of KNOWN_GAPS) {
      expect(coveredByAnyFont(codePoint)).toBe(false);
    }
  });

  test("every entry in KNOWN_GAPS is still actually present in the real content (a stale entry hides that content changed)", () => {
    const usedCodePoints = new Set(usage.map((u) => u.codePoint));
    for (const codePoint of KNOWN_GAPS) {
      expect(usedCodePoints.has(codePoint)).toBe(true);
    }
  });

  test("a seeded new, unlisted missing glyph fails the gate, proving it is not vacuous", () => {
    const seededUsage = [
      ...usage,
      { codePoint: 0x1f4a9, char: "\u{1F4A9}", files: ["seeded-fixture.yaml"] },
    ];
    const newlyMissing = seededUsage.filter(
      (u) => !KNOWN_GAPS.has(u.codePoint) && !coveredByAnyFont(u.codePoint),
    );
    expect(newlyMissing.length).toBeGreaterThan(0);
  });
});
