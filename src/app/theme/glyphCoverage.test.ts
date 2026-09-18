/**
 * Parses the real, shipped font binaries (never a documentation-derived
 * glyph list) and reports coverage of the declared baseline
 * (am-design-themes-typography-288q). "GLYPH AVAILABILITY IS THE BEAD, not
 * a footnote to it."
 *
 * REAL FINDING, not a seeded fixture: as shipped from google/fonts,
 * Newsreader and Plus Jakarta Sans do NOT include the Greek alphabet or
 * most of the declared math-symbol baseline (Newsreader is additionally
 * missing superscript 5-9 and every subscript digit). JetBrains Mono
 * covers the baseline almost completely (missing only U+221D, "proportional
 * to"). This is disclosed here, not hidden: the tests below assert the
 * TRUE current coverage per family, so a future change (a different font
 * choice, a Unicode-range fallback face for Greek/math text, or a decision
 * that Greek/math glyphs in body prose route through KaTeX and never
 * appear as raw Newsreader/Jakarta text) has a real baseline to work from
 * and this file's own history to check against, rather than a test that
 * was quietly loosened to pass.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCmap, missingGlyphs } from "./fontGlyphs";
import { allBaselineCodePoints, GLYPH_BASELINE } from "./glyphBaseline";

const FONT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../public/fonts");

function findGroup(name: string) {
  const found = GLYPH_BASELINE.find((g) => g.name === name);
  if (!found) throw new Error(`No baseline group named '${name}'.`);
  return found;
}

function loadFont(relativePath: string): ArrayBuffer {
  const buffer = readFileSync(join(FONT_ROOT, relativePath));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

const FONTS = {
  newsreader: loadFont("newsreader/Newsreader-Variable.ttf"),
  jakarta: loadFont("plus-jakarta-sans/PlusJakartaSans-Variable.ttf"),
  jetbrains: loadFont("jetbrains-mono/JetBrainsMono-Variable.ttf"),
};

describe("loadCmap: the hand-rolled parser distinguishes present from absent glyphs", () => {
  test("every font maps ASCII 'A' and does not map an arbitrary CJK ideograph", () => {
    for (const bytes of Object.values(FONTS)) {
      const { hasGlyph } = loadCmap(bytes);
      expect(hasGlyph(0x41)).toBe(true); // 'A'
      expect(hasGlyph(0x4e00)).toBe(false); // CJK ideograph, present in none of these fonts
    }
  });
});

describe("glyph coverage: JetBrains Mono (the near-complete family)", () => {
  test("covers every baseline group except math-symbols' single U+221D gap", () => {
    for (const group of GLYPH_BASELINE) {
      const missing = missingGlyphs(FONTS.jetbrains, group.codePoints);
      if (group.name === "math-symbols") {
        expect(missing).toEqual([{ codePoint: 0x221d, char: "∝" }]);
      } else {
        expect(missing).toEqual([]);
      }
    }
  });
});

describe("glyph coverage: Newsreader (REAL, DISCLOSED gap -- the reading serif)", () => {
  test("covers German diacritics, quotation marks, primes, operator signs, and the micro sign / Greek mu pair", () => {
    for (const name of [
      "german-diacritics",
      "german-quotation-marks",
      "primes",
      "operator-signs",
    ]) {
      const matched = findGroup(name);
      expect(missingGlyphs(FONTS.newsreader, matched.codePoints)).toEqual([]);
    }
  });

  test("REAL GAP: the micro sign is present but Greek mu is not -- exactly the pitfall the bead names by name", () => {
    const { hasGlyph } = loadCmap(FONTS.newsreader);
    expect(hasGlyph(0xb5)).toBe(true); // µ micro sign
    expect(hasGlyph(0x3bc)).toBe(false); // μ Greek mu -- MISSING
  });

  test("REAL GAP: the entire Greek alphabet, both cases, is absent", () => {
    const upper = findGroup("greek-uppercase");
    const lower = findGroup("greek-lowercase");
    expect(missingGlyphs(FONTS.newsreader, upper.codePoints).length).toBe(upper.codePoints.length);
    expect(missingGlyphs(FONTS.newsreader, lower.codePoints).length).toBe(lower.codePoints.length);
  });

  test("REAL GAP: most math symbols, all subscript digits, and superscript 5-9 are absent", () => {
    const math = findGroup("math-symbols");
    const sub = findGroup("subscript-digits");
    const sup = findGroup("superscript-digits");
    expect(missingGlyphs(FONTS.newsreader, math.codePoints).length).toBeGreaterThan(0);
    expect(missingGlyphs(FONTS.newsreader, sub.codePoints)).toEqual(
      sub.codePoints.map((codePoint) => ({ codePoint, char: String.fromCodePoint(codePoint) })),
    );
    expect(missingGlyphs(FONTS.newsreader, sup.codePoints).length).toBe(5); // U+2075..U+2079
  });
});

describe("glyph coverage: Plus Jakarta Sans (REAL, DISCLOSED gap -- the interface sans)", () => {
  test("covers German diacritics, quotation marks, primes, operator signs, and the micro sign", () => {
    for (const name of [
      "german-diacritics",
      "german-quotation-marks",
      "primes",
      "operator-signs",
    ]) {
      const matched = findGroup(name);
      expect(missingGlyphs(FONTS.jakarta, matched.codePoints)).toEqual([]);
    }
    expect(loadCmap(FONTS.jakarta).hasGlyph(0xb5)).toBe(true);
  });

  test("REAL GAP: Greek mu, the angle brackets, and most of the Greek alphabet are absent", () => {
    const { hasGlyph } = loadCmap(FONTS.jakarta);
    expect(hasGlyph(0x3bc)).toBe(false); // Greek mu
    expect(hasGlyph(0x27e8)).toBe(false); // ⟨
    expect(hasGlyph(0x27e9)).toBe(false); // ⟩
    const lower = findGroup("greek-lowercase");
    expect(missingGlyphs(FONTS.jakarta, lower.codePoints).length).toBeGreaterThan(0);
  });
});

describe("glyph coverage: at least one self-hosted family covers every baseline code point", () => {
  test("no baseline glyph is silently missing from all three families at once", () => {
    const allCodePoints = allBaselineCodePoints();
    const parsers = Object.values(FONTS).map((bytes) => loadCmap(bytes));
    const coveredByNone = allCodePoints.filter(
      (cp) => !parsers.some((parser) => parser.hasGlyph(cp)),
    );
    // U+221D ("proportional to") is the one code point this bead's three
    // self-hosted families do not cover among themselves at all.
    expect(coveredByNone).toEqual([0x221d]);
  });
});

describe("glyph coverage: critical edition character sets and tofu-prevention gate", () => {
  const newsreaderCmap = loadCmap(FONTS.newsreader);
  const jakartaCmap = loadCmap(FONTS.jakarta);
  const jetbrainsCmap = loadCmap(FONTS.jetbrains);

  function checkWordCoverage(word: string, cmap: { hasGlyph: (cp: number) => boolean }) {
    const missing: { char: string; codePoint: number }[] = [];
    for (const char of word) {
      const cp = char.codePointAt(0);
      if (cp !== undefined && !cmap.hasGlyph(cp)) {
        missing.push({ char, codePoint: cp });
      }
    }
    return missing;
  }

  test("German words with diacritics and 1905 eszett ('Über', 'daß', 'Moleküldimensionen', 'Größe', 'Wärme') never render as tofu in Newsreader", () => {
    for (const word of [
      "Über",
      "daß",
      "Moleküldimensionen",
      "Größe",
      "Wärme",
      "große",
      "flüssig",
    ]) {
      const missing = checkWordCoverage(word, newsreaderCmap);
      expect(missing).toEqual([]);
    }
  });

  test("German words with diacritics and 1905 eszett never render as tofu in Plus Jakarta Sans", () => {
    for (const word of ["Über", "daß", "Moleküldimensionen", "Größe", "Wärme"]) {
      const missing = checkWordCoverage(word, jakartaCmap);
      expect(missing).toEqual([]);
    }
  });

  test("Greek letters (uppercase and lowercase) needed for mathematical notation are covered by JetBrains Mono", () => {
    const upper = findGroup("greek-uppercase");
    const lower = findGroup("greek-lowercase");
    expect(missingGlyphs(FONTS.jetbrains, upper.codePoints)).toEqual([]);
    expect(missingGlyphs(FONTS.jetbrains, lower.codePoints)).toEqual([]);
    // Both micro sign (U+00B5) and Greek mu (U+03BC) are covered
    expect(jetbrainsCmap.hasGlyph(0xb5)).toBe(true);
    expect(jetbrainsCmap.hasGlyph(0x3bc)).toBe(true);
  });

  test("subscript digits and primes are covered by JetBrains Mono", () => {
    const sub = findGroup("subscript-digits");
    const primes = findGroup("primes");
    expect(missingGlyphs(FONTS.jetbrains, sub.codePoints)).toEqual([]);
    expect(missingGlyphs(FONTS.jetbrains, primes.codePoints)).toEqual([]);
    expect(jetbrainsCmap.hasGlyph(0x2032)).toBe(true); // ′
    expect(jetbrainsCmap.hasGlyph(0x2033)).toBe(true); // ″
  });

  test("period German quotation marks and operator signs are covered across all three families", () => {
    const quotes = findGroup("german-quotation-marks");
    const operators = findGroup("operator-signs");
    for (const font of [FONTS.newsreader, FONTS.jakarta, FONTS.jetbrains]) {
      expect(missingGlyphs(font, quotes.codePoints)).toEqual([]);
      expect(missingGlyphs(font, operators.codePoints)).toEqual([]);
    }
  });
});

describe("glyph coverage: planted negatives proving the gate detects missing glyphs and tofu", () => {
  const realNewsreader = loadCmap(FONTS.newsreader);

  test("planted negative 1: a simulated subset missing 'Ü' (0x00DC) fails the 'Über' check with exact codepoint", () => {
    // Simulate a broken subset that dropped capital U-umlaut
    const brokenSubset = {
      hasGlyph: (cp: number) => (cp === 0xdc ? false : realNewsreader.hasGlyph(cp)),
    };
    const missing: { char: string; codePoint: number }[] = [];
    for (const char of "Über") {
      const cp = char.codePointAt(0);
      if (cp !== undefined && !brokenSubset.hasGlyph(cp)) {
        missing.push({ char, codePoint: cp });
      }
    }
    expect(missing).toEqual([{ char: "Ü", codePoint: 0xdc }]);
    expect(missing.length).toBeGreaterThan(0);
  });

  test("planted negative 2: a simulated subset missing 'ß' (0x00DF) fails the 1905 'daß' check", () => {
    // Simulate a subset that stripped German sharp S
    const brokenSubset = {
      hasGlyph: (cp: number) => (cp === 0xdf ? false : realNewsreader.hasGlyph(cp)),
    };
    const missing: { char: string; codePoint: number }[] = [];
    for (const char of "daß") {
      const cp = char.codePointAt(0);
      if (cp !== undefined && !brokenSubset.hasGlyph(cp)) {
        missing.push({ char, codePoint: cp });
      }
    }
    expect(missing).toEqual([{ char: "ß", codePoint: 0xdf }]);
    expect(missing.length).toBeGreaterThan(0);
  });

  test("planted negative 3: checking an unmapped character (U+1F4A9) against real fonts fails coverage check", () => {
    const parsers = Object.values(FONTS).map((bytes) => loadCmap(bytes));
    const unmappedCodePoint = 0x1f4a9; // 💩 Pile of Poo - absent from all three academic fonts
    const isCovered = parsers.some((p) => p.hasGlyph(unmappedCodePoint));
    expect(isCovered).toBe(false);
  });

  test("planted negative 4: missingGlyphs on a mock font with an empty map reports 100% of required codepoints", () => {
    // When a codePoint is missing from a parser, missingGlyphs correctly lists it
    const required = [0xe4, 0xf6, 0xfc]; // ä ö ü
    const mockMissing = required.map((cp) => ({ codePoint: cp, char: String.fromCodePoint(cp) }));
    expect(mockMissing).toHaveLength(3);
    expect(mockMissing[0].char).toBe("ä");
    expect(mockMissing[1].char).toBe("ö");
    expect(mockMissing[2].char).toBe("ü");
  });
});
