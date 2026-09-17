/**
 * The wavelength-to-color mapping (am-design-semantic-color-8vbq) is a
 * scientific mapping, not a theme token: the color of light at a
 * wavelength is a fact about human vision, not a design choice, so this
 * module is deliberately outside `src/design/semanticColor/` and imports
 * nothing from the theme token modules. `spectralColor` returns the same
 * value in all three themes (spectralMapping.test.ts asserts this
 * directly, not by screenshot).
 *
 * TRANSFORM: Bruton, D. (1996), "Approximate RGB values for Visible
 * Wavelengths" (http://www.physics.sfasu.edu/astro/color.html), a
 * documented closed-form piecewise-linear approximation to the CIE
 * standard observer's visible-spectrum response, with a linear intensity
 * taper near the vision limits and a gamma correction. It is a widely
 * reproduced approximation, not the CIE 1931 color-matching functions
 * exactly integrated against display primaries; its approximate character
 * is stated here, not hidden.
 *
 * VISIBLE_BAND_NM: 380-780 nm, the band Bruton's own transform is defined
 * over. "Visible" has no single universal edge (other sources give
 * 380-750 or 400-700); this module states its source rather than picking
 * a boundary silently, per this bead's requirement.
 */

export const VISIBLE_BAND_NM = Object.freeze({
  min: 380,
  max: 780,
  source: "Bruton (1996), the domain of its own piecewise transform.",
});

const GAMMA = 0.8;

export type SpectralColorResult =
  | Readonly<{ kind: "visible"; color: string }>
  | Readonly<{ kind: "outside-visible"; side: "ultraviolet" | "infrared" }>;

function rawComponents(wavelengthNm: number): { r: number; g: number; b: number } {
  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    return { r: -(wavelengthNm - 440) / (440 - 380), g: 0, b: 1 };
  }
  if (wavelengthNm >= 440 && wavelengthNm < 490) {
    return { r: 0, g: (wavelengthNm - 440) / (490 - 440), b: 1 };
  }
  if (wavelengthNm >= 490 && wavelengthNm < 510) {
    return { r: 0, g: 1, b: -(wavelengthNm - 510) / (510 - 490) };
  }
  if (wavelengthNm >= 510 && wavelengthNm < 580) {
    return { r: (wavelengthNm - 510) / (580 - 510), g: 1, b: 0 };
  }
  if (wavelengthNm >= 580 && wavelengthNm < 645) {
    return { r: 1, g: -(wavelengthNm - 645) / (645 - 580), b: 0 };
  }
  return { r: 1, g: 0, b: 0 }; // 645..780
}

function intensityFactor(wavelengthNm: number): number {
  if (wavelengthNm >= 380 && wavelengthNm < 420) {
    return 0.3 + (0.7 * (wavelengthNm - 380)) / (420 - 380);
  }
  if (wavelengthNm >= 420 && wavelengthNm < 700) return 1;
  if (wavelengthNm >= 700 && wavelengthNm <= 780) {
    return 0.3 + (0.7 * (780 - wavelengthNm)) / (780 - 700);
  }
  return 0;
}

function toByte(component: number, factor: number): number {
  if (component <= 0) return 0;
  return Math.round(255 * (component * factor) ** GAMMA);
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

/**
 * The Bruton (1996) approximate display color for `wavelengthNm`, inside
 * the declared visible band, or a typed `outside-visible` result naming
 * the side -- never a color for a wavelength the eye cannot see, which is
 * exactly what forces a false-color legend rather than an implied one.
 */
export function spectralColor(wavelengthNm: number): SpectralColorResult {
  if (wavelengthNm < VISIBLE_BAND_NM.min) return { kind: "outside-visible", side: "ultraviolet" };
  if (wavelengthNm > VISIBLE_BAND_NM.max) return { kind: "outside-visible", side: "infrared" };
  const { r, g, b } = rawComponents(wavelengthNm);
  const factor = intensityFactor(wavelengthNm);
  const color = `#${toHex(toByte(r, factor))}${toHex(toByte(g, factor))}${toHex(toByte(b, factor))}`;
  return { kind: "visible", color };
}
