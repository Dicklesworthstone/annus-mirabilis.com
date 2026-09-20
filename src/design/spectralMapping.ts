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
 *
 * EXEMPTION CONTRACT: This module is the single authorized home for
 * physically-derived data colors in the repository. It exports an explicit
 * allowlist of symbols that legitimately produce literal color values, enabling
 * the raw-hex ratchet gate (owned by pane16) to exempt call sites deriving
 * colors from physical optical properties rather than carving out file-level
 * exclusions.
 */

/**
 * Speed of light in vacuum (c) in metres per second.
 * Exact value by SI definition (17th CGPM, 1983; CODATA 2018).
 */
export const SPEED_OF_LIGHT_M_PER_S = 299792458;

/**
 * Speed of light in vacuum in kilometres per second:
 * c = 299792.458 km/s.
 * Used for direct cyclic frequency (THz) <-> wavelength (nm) conversions:
 * lambda (nm) = c (km/s) / nu (THz) = 299792.458 / nu (THz).
 */
export const SPEED_OF_LIGHT_KM_PER_S = 299792.458;

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
 * Converts cyclic frequency in THz (10^12 Hz) to wavelength in nanometres (nm).
 * c = 299792.458 km/s => lambda (nm) = 299792.458 / nu (THz).
 */
export function frequencyTHzToWavelengthNm(nuTHz: number): number {
  if (nuTHz <= 0 || !Number.isFinite(nuTHz)) {
    throw new RangeError(`Frequency must be a positive finite number in THz, received: ${nuTHz}`);
  }
  return SPEED_OF_LIGHT_KM_PER_S / nuTHz;
}

/**
 * Converts cyclic frequency in Hz (s^-1) to wavelength in nanometres (nm).
 * lambda (nm) = (c / nu) * 1e9.
 */
export function frequencyHzToWavelengthNm(nuHz: number): number {
  if (nuHz <= 0 || !Number.isFinite(nuHz)) {
    throw new RangeError(`Frequency must be a positive finite number in Hz, received: ${nuHz}`);
  }
  return (SPEED_OF_LIGHT_M_PER_S / nuHz) * 1e9;
}

/**
 * Converts wavelength in nanometres (nm) to cyclic frequency in THz (10^12 Hz).
 * nu (THz) = 299792.458 / lambda (nm).
 */
export function wavelengthNmToFrequencyTHz(wavelengthNm: number): number {
  if (wavelengthNm <= 0 || !Number.isFinite(wavelengthNm)) {
    throw new RangeError(
      `Wavelength must be a positive finite number in nm, received: ${wavelengthNm}`,
    );
  }
  return SPEED_OF_LIGHT_KM_PER_S / wavelengthNm;
}

/**
 * Converts wavelength in nanometres (nm) to cyclic frequency in Hz (s^-1).
 * nu (Hz) = c / (lambda * 1e-9).
 */
export function wavelengthNmToFrequencyHz(wavelengthNm: number): number {
  if (wavelengthNm <= 0 || !Number.isFinite(wavelengthNm)) {
    throw new RangeError(
      `Wavelength must be a positive finite number in nm, received: ${wavelengthNm}`,
    );
  }
  return SPEED_OF_LIGHT_M_PER_S / (wavelengthNm * 1e-9);
}

/**
 * The Bruton (1996) approximate display color for `wavelengthNm`, inside
 * the declared visible band, or a typed `outside-visible` result naming
 * the side -- never a color for a wavelength the eye cannot see, which is
 * exactly what forces a false-color legend rather than an implied one.
 */
export function spectralColor(wavelengthNm: number): SpectralColorResult {
  if (!Number.isFinite(wavelengthNm)) {
    throw new RangeError(`Wavelength must be a finite number in nm, received: ${wavelengthNm}`);
  }
  if (wavelengthNm < VISIBLE_BAND_NM.min) return { kind: "outside-visible", side: "ultraviolet" };
  if (wavelengthNm > VISIBLE_BAND_NM.max) return { kind: "outside-visible", side: "infrared" };
  const { r, g, b } = rawComponents(wavelengthNm);
  const factor = intensityFactor(wavelengthNm);
  const color = `#${toHex(toByte(r, factor))}${toHex(toByte(g, factor))}${toHex(toByte(b, factor))}`;
  return { kind: "visible", color };
}

/**
 * Resolves the physical display color for a cyclic frequency given in THz (10^12 Hz).
 * Converts frequency to wavelength via lambda = c / nu and applies
 * the Bruton (1996) physical spectral transform.
 */
export function spectralColorFromFrequency(nuTHz: number): SpectralColorResult {
  const lambdaNm = frequencyTHzToWavelengthNm(nuTHz);
  return spectralColor(lambdaNm);
}

/**
 * Resolves the physical display color for a cyclic frequency given in Hz (s^-1).
 */
export function spectralColorFromFrequencyHz(nuHz: number): SpectralColorResult {
  const lambdaNm = frequencyHzToWavelengthNm(nuHz);
  return spectralColor(lambdaNm);
}

/**
 * Polymorphic input for spectral mapping: accepts wavelength in nm,
 * or cyclic frequency in THz or Hz.
 */
export type SpectralInput =
  | number
  | { readonly wavelengthNm: number }
  | { readonly frequencyTHz: number }
  | { readonly frequencyHz: number };

/**
 * Unified resolver: maps either a wavelength or frequency to its physical color result.
 */
export function resolveSpectralColor(input: SpectralInput): SpectralColorResult {
  if (typeof input === "number") {
    return spectralColor(input);
  }
  if ("wavelengthNm" in input) {
    return spectralColor(input.wavelengthNm);
  }
  if ("frequencyTHz" in input) {
    return spectralColorFromFrequency(input.frequencyTHz);
  }
  if ("frequencyHz" in input) {
    return spectralColorFromFrequencyHz(input.frequencyHz);
  }
  throw new TypeError(
    "Invalid spectral input: must specify wavelengthNm, frequencyTHz, or frequencyHz",
  );
}

/**
 * Spectroscopic spectral anchor representation.
 */
export interface SpectralAnchor {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly wavelengthNm: number;
  readonly frequencyTHz: number;
  readonly nominalBand:
    | "ultraviolet"
    | "violet"
    | "blue"
    | "cyan"
    | "green"
    | "yellow"
    | "orange"
    | "red"
    | "infrared";
  readonly citation: string;
  readonly description: string;
}

/**
 * Canonical physical spectral anchors from standard spectroscopic literature.
 * Real physical values with citable wavelengths, not invented numbers.
 */
export const PHYSICAL_SPECTRAL_ANCHORS = Object.freeze({
  /**
   * Sodium D doublet (Fraunhofer D lines):
   * Principal 3p -> 3s transition in neutral atomic sodium (Na I).
   * D2 (588.995 nm) and D1 (589.592 nm); standard yellow flame emission and refractometry standard.
   * Citation: NIST Atomic Spectra Database; Fraunhofer, J. (1817), Denkschriften der K. Akad. der Wiss. zu München.
   */
  sodiumD2: Object.freeze<SpectralAnchor>({
    id: "sodium-d2",
    name: "Sodium D₂ Line",
    symbol: "Na D₂",
    wavelengthNm: 588.995,
    frequencyTHz: 508.99,
    nominalBand: "yellow",
    citation:
      "NIST Atomic Spectra Database (Na I, 3s 2S1/2 - 3p 2P3/2, 588.995 nm air); Fraunhofer (1817)",
    description: "Principal yellow emission line of sodium doublet at 589.00 nm in standard air.",
  }),
  sodiumD1: Object.freeze<SpectralAnchor>({
    id: "sodium-d1",
    name: "Sodium D₁ Line",
    symbol: "Na D₁",
    wavelengthNm: 589.592,
    frequencyTHz: 508.48,
    nominalBand: "yellow",
    citation:
      "NIST Atomic Spectra Database (Na I, 3s 2S1/2 - 3p 2P1/2, 589.592 nm air); Fraunhofer (1817)",
    description: "Secondary yellow emission line of sodium doublet at 589.59 nm in standard air.",
  }),
  sodiumDMean: Object.freeze<SpectralAnchor>({
    id: "sodium-d-mean",
    name: "Sodium D Doublet Centroid",
    symbol: "Na D",
    wavelengthNm: 589.3,
    frequencyTHz: 508.73,
    nominalBand: "yellow",
    citation:
      "NIST ASD standard unresolved centroid; CRC Handbook of Chemistry and Physics (104th ed.)",
    description: "Standard spectroscopic centroid of unresolved sodium D doublet (589.3 nm).",
  }),

  /**
   * Hydrogen Balmer series (transitions ending at n = 2 in atomic hydrogen, H I).
   * Foundation of atomic spectroscopy and early quantum physics.
   * Citation: Balmer, J. J. (1885), 'Notiz über die Spectrallinien des Wasserstoffs',
   * Annalen der Physik und Chemie, 261(5), 80-87; NIST Atomic Spectra Database.
   */
  hydrogenAlpha: Object.freeze<SpectralAnchor>({
    id: "hydrogen-alpha",
    name: "Hydrogen Balmer Alpha (H-alpha)",
    symbol: "Hα",
    wavelengthNm: 656.28,
    frequencyTHz: 456.81,
    nominalBand: "red",
    citation:
      "Balmer (1885), Ann. Phys. 261, 80; Fraunhofer C line; NIST ASD (H I 2p - 3d, 656.279 nm air)",
    description:
      "Prominent deep red emission line from n=3 to n=2 transition in hydrogen (Fraunhofer C line).",
  }),
  hydrogenBeta: Object.freeze<SpectralAnchor>({
    id: "hydrogen-beta",
    name: "Hydrogen Balmer Beta (H-beta)",
    symbol: "Hβ",
    wavelengthNm: 486.13,
    frequencyTHz: 616.69,
    nominalBand: "cyan",
    citation:
      "Balmer (1885), Ann. Phys. 261, 80; Fraunhofer F line; NIST ASD (H I 2p - 4d, 486.133 nm air)",
    description:
      "Cyan/blue-green emission line from n=4 to n=2 transition in hydrogen (Fraunhofer F line).",
  }),
  hydrogenGamma: Object.freeze<SpectralAnchor>({
    id: "hydrogen-gamma",
    name: "Hydrogen Balmer Gamma (H-gamma)",
    symbol: "Hγ",
    wavelengthNm: 434.05,
    frequencyTHz: 690.69,
    nominalBand: "violet",
    citation:
      "Balmer (1885), Ann. Phys. 261, 80; Fraunhofer G' line; NIST ASD (H I 2p - 5d, 434.046 nm air)",
    description:
      "Violet/blue-violet emission line from n=5 to n=2 transition in hydrogen (Fraunhofer G' line).",
  }),
  hydrogenDelta: Object.freeze<SpectralAnchor>({
    id: "hydrogen-delta",
    name: "Hydrogen Balmer Delta (H-delta)",
    symbol: "Hδ",
    wavelengthNm: 410.17,
    frequencyTHz: 730.89,
    nominalBand: "violet",
    citation:
      "Balmer (1885), Ann. Phys. 261, 80; Fraunhofer h line; NIST ASD (H I 2p - 6d, 410.174 nm air)",
    description:
      "Violet emission line near the optical UV edge from n=6 to n=2 transition in hydrogen (Fraunhofer h line).",
  }),

  /**
   * Mercury green calibration line (Hg I 546.07 nm):
   * Universal laboratory calibration standard for optical metrology and interferometry.
   * Citation: NIST Atomic Spectra Database (Hg I, 6s6p 3P2 - 6s7s 3S1, 546.074 nm air).
   */
  mercuryGreen: Object.freeze<SpectralAnchor>({
    id: "mercury-green",
    name: "Mercury Green Calibration Line",
    symbol: "Hg 546",
    wavelengthNm: 546.07,
    frequencyTHz: 548.99,
    nominalBand: "green",
    citation:
      "NIST Atomic Spectra Database (Hg I 546.074 nm air); BIPM primary wavelength standard",
    description:
      "Primary green optical line in mercury discharge lamps, standard benchmark for optical metrology.",
  }),

  /**
   * Helium D3 yellow line (He I 587.56 nm):
   * Discovered in the solar chromosphere by Lockyer and Janssen in 1868 during a solar eclipse.
   * Citation: Lockyer, J. N. (1868), Proc. Roy. Soc. London 17, 91-92; NIST ASD (He I 2p 3P - 3d 3D, 587.562 nm air).
   */
  heliumD3: Object.freeze<SpectralAnchor>({
    id: "helium-d3",
    name: "Helium D₃ Line",
    symbol: "He D₃",
    wavelengthNm: 587.56,
    frequencyTHz: 510.23,
    nominalBand: "yellow",
    citation: "Lockyer (1868), Proc. Roy. Soc. 17; NIST ASD (He I 587.562 nm air)",
    description:
      "Historic solar chromospheric line leading to the discovery of helium before terrestrial isolation.",
  }),
});

export type SpectralBandId =
  | "ultraviolet"
  | "violet"
  | "blue"
  | "cyan"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "infrared";

export interface SpectralBandInfo {
  readonly band: SpectralBandId;
  readonly name: string;
  readonly wavelengthNm: number;
  readonly frequencyTHz: number;
  readonly color: string;
  readonly isVisible: boolean;
  readonly isFalseColor: boolean;
  readonly falseColorReason?: string;
}

/**
 * Standard false-color representations for non-visible spectral bands.
 * Used when visualising UV or IR radiation on a 2D display, accompanied by
 * a mandatory FalseColorLegend per am-inst-2d-view-kit-u75r.
 */
export const FALSE_COLOR_BANDS = Object.freeze({
  ultraviolet: Object.freeze({
    hex: "#7c3aed",
    label: "Ultraviolet (UV)",
    reason: "Standard false-color display mapping for UV (> 789 THz, < 380 nm).",
  }),
  infrared: Object.freeze({
    hex: "#b91c1c",
    label: "Infrared (IR)",
    reason: "Standard false-color display mapping for IR (< 384 THz, > 780 nm).",
  }),
});

/**
 * Classifies a physical wavelength or frequency into its canonical optical spectral band.
 * For visible light (380-780 nm), the color is computed dynamically via the Bruton (1996)
 * physical transform (isFalseColor = false).
 * For invisible light (UV or IR), returns a standardized false-color representation with
 * isFalseColor = true, requiring a visible FalseColorLegend.
 */
export function getSpectralBand(
  input: number | { readonly wavelengthNm: number } | { readonly frequencyTHz: number },
): SpectralBandInfo {
  let lambdaNm: number;
  let nuTHz: number;

  if (typeof input === "number") {
    lambdaNm = input;
    nuTHz = wavelengthNmToFrequencyTHz(lambdaNm);
  } else if ("wavelengthNm" in input) {
    lambdaNm = input.wavelengthNm;
    nuTHz = wavelengthNmToFrequencyTHz(lambdaNm);
  } else {
    nuTHz = input.frequencyTHz;
    lambdaNm = frequencyTHzToWavelengthNm(nuTHz);
  }

  // Ultraviolet: lambda < 380 nm
  if (lambdaNm < VISIBLE_BAND_NM.min) {
    return Object.freeze({
      band: "ultraviolet",
      name: FALSE_COLOR_BANDS.ultraviolet.label,
      wavelengthNm: Math.round(lambdaNm),
      frequencyTHz: Math.round(nuTHz * 10) / 10,
      color: FALSE_COLOR_BANDS.ultraviolet.hex,
      isVisible: false,
      isFalseColor: true,
      falseColorReason: FALSE_COLOR_BANDS.ultraviolet.reason,
    });
  }

  // Infrared: lambda > 780 nm
  if (lambdaNm > VISIBLE_BAND_NM.max) {
    return Object.freeze({
      band: "infrared",
      name: FALSE_COLOR_BANDS.infrared.label,
      wavelengthNm: Math.round(lambdaNm),
      frequencyTHz: Math.round(nuTHz * 10) / 10,
      color: FALSE_COLOR_BANDS.infrared.hex,
      isVisible: false,
      isFalseColor: true,
      falseColorReason: FALSE_COLOR_BANDS.infrared.reason,
    });
  }

  // Visible spectrum: compute physical color via Bruton transform
  const res = spectralColor(lambdaNm);
  const color = res.kind === "visible" ? res.color : "#888888";

  let band: SpectralBandId;
  let name: string;

  if (lambdaNm < 450) {
    band = "violet";
    name = "Violet";
  } else if (lambdaNm < 485) {
    band = "blue";
    name = "Blue";
  } else if (lambdaNm < 500) {
    band = "cyan";
    name = "Cyan (Blue-Green)";
  } else if (lambdaNm < 565) {
    band = "green";
    name = "Green";
  } else if (lambdaNm < 590) {
    band = "yellow";
    name = "Yellow";
  } else if (lambdaNm < 625) {
    band = "orange";
    name = "Orange";
  } else {
    band = "red";
    name = "Red";
  }

  return Object.freeze({
    band,
    name,
    wavelengthNm: Math.round(lambdaNm),
    frequencyTHz: Math.round(nuTHz * 10) / 10,
    color,
    isVisible: true,
    isFalseColor: false,
  });
}

/**
 * Canonical module path for spectral mapping.
 */
export const SPECTRAL_MAPPING_MODULE_SPECIFIER = "src/design/spectralMapping.ts";

/**
 * Allowlist of exported symbols that are authorized to produce literal data colors.
 * The rawHexRatchet gate consumes this allowlist to permit call sites or data structures
 * that derive colors from physical optical properties (wavelength/frequency) rather than
 * UI theme tokens.
 */
export const LEGITIMATE_SPECTRAL_COLOR_SYMBOLS = Object.freeze([
  "spectralColor",
  "spectralColorFromFrequency",
  "spectralColorFromFrequencyHz",
  "resolveSpectralColor",
  "getSpectralBand",
  "PHYSICAL_SPECTRAL_ANCHORS",
  "FALSE_COLOR_BANDS",
  "VISIBLE_BAND_NM",
] as const);

export type LegitimateSpectralColorSymbol = (typeof LEGITIMATE_SPECTRAL_COLOR_SYMBOLS)[number];

/**
 * Type guard / validator to test whether an exported symbol or identifier name
 * is an authorized producer of physical data colors.
 */
export function isLegitimateSpectralColorSymbol(symbolName: string): boolean {
  return (LEGITIMATE_SPECTRAL_COLOR_SYMBOLS as readonly string[]).includes(symbolName);
}

/**
 * Call-site exemption descriptor for the raw-hex ratchet gate.
 * Enables pane16's ratchet to exempt call sites that invoke legitimate spectral color
 * producers, rather than carving out broad file-level exclusions.
 */
export interface SpectralCallSiteExemption {
  readonly module: typeof SPECTRAL_MAPPING_MODULE_SPECIFIER;
  readonly symbol: LegitimateSpectralColorSymbol;
  readonly rationale: string;
}

export const SPECTRAL_CALL_SITE_EXEMPTIONS: readonly SpectralCallSiteExemption[] = Object.freeze(
  LEGITIMATE_SPECTRAL_COLOR_SYMBOLS.map((symbol) =>
    Object.freeze({
      module: SPECTRAL_MAPPING_MODULE_SPECIFIER,
      symbol,
      rationale: `Authorized physical data-color generator '${symbol}' representing empirical optical spectrum values.`,
    }),
  ),
);
