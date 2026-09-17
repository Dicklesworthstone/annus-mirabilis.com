/**
 * The declared baseline glyph set (am-design-themes-typography-288q's own
 * Requirements list), named by group so a coverage report can say which
 * kind of glyph is missing, not just how many. `scripts/subset-fonts.ts`
 * (not yet built) is meant to read this same list as one of its three
 * subset sources; declaring it once here keeps the test and that future
 * script from drifting apart.
 */

export interface GlyphGroup {
  readonly name: string;
  readonly codePoints: readonly number[];
}

function range(start: number, end: number, exclude: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let cp = start; cp <= end; cp++) if (!exclude.includes(cp)) out.push(cp);
  return out;
}

export const GLYPH_BASELINE: readonly GlyphGroup[] = Object.freeze([
  {
    name: "german-diacritics",
    codePoints: [0xe4, 0xf6, 0xfc, 0xdf, 0xc4, 0xd6, 0xdc, 0x1e9e], // ä ö ü ß Ä Ö Ü ẞ
  },
  {
    name: "german-quotation-marks",
    codePoints: [0x201e, 0x201c, 0x201a, 0x2018], // „ " ‚ '
  },
  {
    name: "greek-uppercase",
    codePoints: range(0x391, 0x3a9, [0x3a2]), // Α–Ω, excluding the unassigned U+03A2
  },
  {
    name: "greek-lowercase",
    codePoints: range(0x3b1, 0x3c9), // α–ω
  },
  {
    name: "micro-and-mu",
    codePoints: [0xb5, 0x3bc], // µ micro sign, μ Greek mu -- distinct code points, both required
  },
  {
    name: "primes",
    codePoints: [0x2032, 0x2033], // ′ ″
  },
  {
    name: "operator-signs",
    codePoints: [0x2212, 0xd7, 0xb7], // − minus, × multiplication, · middle dot
  },
  {
    name: "math-symbols",
    codePoints: [0x2248, 0x2264, 0x2265, 0x221d, 0x221a, 0x222b, 0x2202, 0x221e, 0x27e8, 0x27e9], // ≈ ≤ ≥ ∝ √ ∫ ∂ ∞ ⟨ ⟩
  },
  {
    name: "superscript-digits",
    codePoints: [0x2070, 0xb9, 0xb2, 0xb3, 0x2074, 0x2075, 0x2076, 0x2077, 0x2078, 0x2079],
  },
  {
    name: "subscript-digits",
    codePoints: range(0x2080, 0x2089),
  },
]);

export function allBaselineCodePoints(): readonly number[] {
  return GLYPH_BASELINE.flatMap((group) => group.codePoints);
}
