/**
 * THE BUILD GATE (am-design-themes-typography-288q): "assert the actual
 * glyph coverage of the fonts you ship against the character set the
 * content actually uses, and make a missing glyph a BUILD FAILURE rather
 * than a rendering surprise." This is that gate: it scans the real
 * content corpus (never a declared baseline list) and fails if any code
 * point a reader could actually see is missing from every one of the
 * three self-hosted fonts.
 *
 * --------------------------------------------------------------------------
 * MEASURED FONT COVERAGE (CORRECTION RECORD - 2026-09-18)
 * --------------------------------------------------------------------------
 * Earlier claims that "the text fonts contain no Greek alphabet and no
 * subscript digits" were factually incorrect. Verified against the shipped
 * TTF cmap tables:
 *
 * | Repertoire Category  | Global (Any Face) | Newsreader (Serif) | Plus Jakarta (Sans) | JetBrains Mono |
 * |----------------------|-------------------|--------------------|---------------------|----------------|
 * | Greek lowercase      | 24/24             | 0/24 (0/22 core)   | 1/24                | 24/24          |
 * | Greek uppercase      | 10/10             | 0/10               | 2/10 (Δ, Ω only)*   | 10/10          |
 * | Subscript digits     | 10/10             | 0/10               | 10/10               | 10/10          |
 * | Superscript digits   | 10/10             | 5/10 (0–4 only)†   | 10/10               | 10/10          |
 * | German diacritics    | 7/7               | 7/7                | 7/7                 | 7/7            |
 *
 * * Plus Jakarta Sans Greek uppercase: covers exactly Delta (Δ) and Omega (Ω).
 *   These two exist as the mathematical delta and the ohm symbol rather than
 *   intentional Greek alphabet coverage, so a Greek word set in Plus Jakarta
 *   would still break on the other eight.
 *
 * † Newsreader superscript digits: covers exactly zero, one, two, three, and four,
 *   and is MISSING five through nine. Superscripts five to nine are absent from
 *   the reading serif, so an exponent in running prose — ten to the minus seven,
 *   c to the fifth — falls back mid-word to another face. For an edition of
 *   physics papers that is not an edge case, it is the common case, and it is
 *   a stronger argument for the font decision than the Greek line is.
 *
 * THE REAL FAILURE MODE:
 * The failure mode in running body prose is NOT tofu boxes (missing glyphs).
 * Because JetBrains Mono covers all Greek letters and subscripts, the browser
 * falls back to JetBrains Mono (or Plus Jakarta Sans for subscripts).
 * The risk is a TYPOGRAPHIC BREAK mid-sentence, where a Greek letter or an
 * exponent digit in running Newsreader serif prose suddenly renders in a
 * monospace or sans-serif face.
 *
 * UNIVERSALLY MISSING CHARACTERS:
 * Genuinely absent from ALL THREE shipped faces are exactly seven characters:
 *   1. U+2207 NABLA (∇)
 *   2. U+221D PROPORTIONAL TO (∝)
 *   3. U+22A5 UP TACK (⊥)
 *   4. U+2295 CIRCLED PLUS (⊕)
 *   5. U+2034 TRIPLE PRIME (‴)
 *   6. U+207F SUPERSCRIPT LATIN SMALL LETTER N (ⁿ)
 *   7. U+2071 SUPERSCRIPT LATIN SMALL LETTER I (ⁱ)
 *
 * Entries 6 and 7 were added 2026-09-19 after a direct cmap probe of the three
 * shipped TTFs. They are superscript LETTERS, not digits. The bead's declared
 * baseline asks only for "superscript and subscript digits used in prose", so a
 * superscript letter was never in the baseline and entered through content.
 * Measured the same day, for the record, because the digit picture is uneven:
 *   superscript 0-4  present in all three faces
 *   superscript 5-9  present in Plus Jakarta and JetBrains Mono, ABSENT in Newsreader
 *   superscript + (U+207A) and subscript 0 (U+2080): absent in Newsreader, present in the other two
 *   superscript n (U+207F) and i (U+2071): absent in ALL THREE
 * There is no subsetting step in the repo yet (no scripts/subset-fonts.ts), so these
 * are the upstream variable fonts as shipped. A missing glyph here is therefore a
 * typeface fact, not a subset artifact that a wider subset could recover.
 *
 * FOUR REAL, PRE-EXISTING GAPS IN CURRENT CONTENT:
 * Of the universally-missing characters, four currently appear in the
 * authored content corpus, named and dated rather than silently excluded:
 *   - U+2207 NABLA (∇), in an authored R3 reading
 *     (content/editorial/readings-owners/am-sr-12-charge-current-bgq0.yaml)
 *     literally quoting the continuity equation "∂ρ/∂t + ∇·J = 0";
 *   - U+221D PROPORTIONAL TO (∝), in content/experiments/lq-01.yaml's
 *     labeled relations ("I ∝ r^(-1)", etc.);
 *   - U+22A5 UP TACK (⊥), in content/notation/special-relativity.yaml's
 *     notation-concordance entry "a_⊥";
 *   - U+207F SUPERSCRIPT n (ⁿ), 3 occurrences in
 *     content/arguments/light-quanta/arg-lq-independent-configurations.json,
 *     written as "fⁿ" in the recap, the overview reading, and step 3.
 *     NAMED AND DATED 2026-09-19 by pane31 under am-design-themes-typography-288q.
 *     UNLIKE THE OTHER THREE, THIS ONE IS CHEAPLY RETIRABLE AND SHOULD BE RETIRED.
 *     It needs no fourth font and no substitution decision, because that same file
 *     already states the identical quantity in prose without the glyph: its
 *     "question" field reads "Why is the probability f to the power n, rather than
 *     just f?" while its "recap" reads "... is fⁿ". One file, one idea, two prose
 *     conventions. The exact algebra is already carried properly by the file's own
 *     formula node, latex "W=f^n". So the fix is an editorial consistency change in
 *     the content, owned by the light-quanta argument bead, not a typography change:
 *     spell it out in the three prose strings and delete this entry.
 *     It is recorded here rather than fixed here because editing reader-facing
 *     argument prose is not this bead's scope.
 * None of Newsreader, Plus Jakarta Sans, or JetBrains Mono contains any
 * of these four glyphs (glyphCoverage.test.ts's per-font sweep already
 * covers this for the declared baseline; this file's KNOWN_GAPS list
 * exists for exactly these four real, content-sourced code points).
 * Fixing the first three needs a fourth font or a documented substitution for
 * those specific symbols -- a real design decision this pass does not make.
 * The fourth, U+207F, needs neither; see its note above.
 * KNOWN_GAPS keeps the gate green for everything else while refusing to
 * let a NEW uncovered glyph land silently: remove an entry once it is
 * fixed, and the test will tell you if it is still needed.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanContentGlyphUsage } from "./contentGlyphUsage";
import { loadCmap } from "./fontGlyphs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const CONTENT_ROOT = join(REPO_ROOT, "content");

const KNOWN_GAPS: ReadonlySet<number> = new Set([
  0x2207, // ∇ NABLA
  0x221d, // ∝ PROPORTIONAL TO
  0x22a5, // ⊥ UP TACK
  // ⁿ SUPERSCRIPT LATIN SMALL LETTER N. Named and dated 2026-09-19 (pane31,
  // am-design-themes-typography-288q). Absent from all three shipped faces by
  // direct cmap probe; not a subset artifact (no subsetting step exists yet).
  // Retirable without a font decision: see the header note. Delete this entry
  // once arg-lq-independent-configurations.json spells the exponent out in prose,
  // and the staleness test below will confirm it is no longer needed.
  0x207f,
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
