/**
 * CIEDE2000 color-difference formula (Sharma, Wu & Dalal, "The CIEDE2000
 * Color-Difference Formula: Implementation Notes, Supplementary Test Data,
 * and Mathematical Observations", Color Research & Application 30(1), 2005),
 * over sRGB input converted to CIE L*a*b* (D65 white point, IEC 61966-2-1
 * sRGB transfer function). am-design-semantic-color-8vbq requires every
 * role-token distance to be a measured CIEDE2000 difference, never an
 * eyeballed "looks different enough."
 */

export interface Lab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

function hexToSrgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  if (value.length !== 6) throw new Error(`Expected #rrggbb, got "${hex}".`);
  const n = Number.parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbChannelToLinear(byte: number): number {
  const s = byte / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

// D65 white point, sRGB primaries (IEC 61966-2-1).
const WHITE_X = 95.047;
const WHITE_Y = 100.0;
const WHITE_Z = 108.883;

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

/** Converts a `#rrggbb` sRGB color to CIE L*a*b* (D65). */
export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToSrgb(hex);
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);
  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) * 100;
  const y = (0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl) * 100;
  const z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) * 100;
  const fx = labF(x / WHITE_X);
  const fy = labF(y / WHITE_Y);
  const fz = labF(z / WHITE_Z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const DEG = Math.PI / 180;

/** The CIEDE2000 color-difference (ΔE00) between two CIE L*a*b* colors, with Kl=Kc=Kh=1. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { l: L1, a: a1raw, b: b1 } = lab1;
  const { l: L2, a: a2raw, b: b2 } = lab2;

  const C1raw = Math.sqrt(a1raw ** 2 + b1 ** 2);
  const C2raw = Math.sqrt(a2raw ** 2 + b2 ** 2);
  const Cbar = (C1raw + C2raw) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));

  const a1 = a1raw * (1 + G);
  const a2 = a2raw * (1 + G);
  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);

  const h1 = C1 === 0 ? 0 : (Math.atan2(b1, a1) / DEG + 360) % 360;
  const h2 = C2 === 0 ? 0 : (Math.atan2(b2, a2) / DEG + 360) % 360;

  const deltaL = L2 - L1;
  const deltaC = C2 - C1;

  let deltah: number;
  if (C1 * C2 === 0) {
    deltah = 0;
  } else if (Math.abs(h2 - h1) <= 180) {
    deltah = h2 - h1;
  } else if (h2 - h1 > 180) {
    deltah = h2 - h1 - 360;
  } else {
    deltah = h2 - h1 + 360;
  }
  const deltaH = 2 * Math.sqrt(C1 * C2) * Math.sin((deltah / 2) * DEG);

  const Lbar = (L1 + L2) / 2;
  const Cbar2 = (C1 + C2) / 2;

  let hbar: number;
  if (C1 * C2 === 0) {
    hbar = h1 + h2;
  } else if (Math.abs(h1 - h2) <= 180) {
    hbar = (h1 + h2) / 2;
  } else if (h1 + h2 < 360) {
    hbar = (h1 + h2 + 360) / 2;
  } else {
    hbar = (h1 + h2 - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbar - 30) * DEG) +
    0.24 * Math.cos(2 * hbar * DEG) +
    0.32 * Math.cos((3 * hbar + 6) * DEG) -
    0.2 * Math.cos((4 * hbar - 63) * DEG);

  const deltaTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbar2 ** 7 / (Cbar2 ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbar2;
  const Sh = 1 + 0.015 * Cbar2 * T;
  const Rt = -Math.sin(2 * deltaTheta * DEG) * Rc;

  return Math.sqrt(
    (deltaL / Sl) ** 2 +
      (deltaC / Sc) ** 2 +
      (deltaH / Sh) ** 2 +
      Rt * (deltaC / Sc) * (deltaH / Sh),
  );
}

/** CIEDE2000 distance directly between two `#rrggbb` hex colors. */
export function hexDeltaE2000(hex1: string, hex2: string): number {
  return deltaE2000(hexToLab(hex1), hexToLab(hex2));
}
