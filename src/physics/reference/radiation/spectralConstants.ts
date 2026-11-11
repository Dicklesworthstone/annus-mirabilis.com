/**
 * The two coefficients of rho_nu = A nu^3 / (exp(B nu / T) - 1), in SI.
 * The light paper supplies alpha and beta directly. Reconstructing alpha from its rounded N,
 * or borrowing a modern h, changes that spectrum. Only the display coordinates need c.
 */
import {
  type ConstantSet,
  ConstantSetError,
  constantValue,
  thermalConstant,
} from "../constants.ts";
import { thermalConstantSI } from "./quantumConstants.ts";

export type SpectralConstants = Readonly<{
  A: number;
  B: number;
  c: number;
  /** Retain supplied action/thermal scales to preserve the established peak arithmetic. */
  actionAndThermal?: Readonly<{ h: number; kB: number }>;
}>;

function readSI(
  set: ConstantSet,
  quantityId: string,
  factors: Readonly<Record<string, number>>,
): number {
  const entries = set.entries.filter((entry) => entry.quantityId === quantityId);
  const entry = entries[0];
  if (entries.length !== 1 || !entry || !Object.hasOwn(factors, entry.unit)) {
    throw new ConstantSetError(
      "spectral-constant-invalid",
      `${set.id} needs one ${quantityId} with a supported unit.`,
    );
  }
  const value = constantValue(set, quantityId).value * (factors[entry.unit] ?? Number.NaN);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConstantSetError(
      "spectral-constant-invalid",
      `${quantityId} must be positive and representable in SI.`,
    );
  }
  return value;
}

/** Coordinate conversion needs only c, even when no spectral law is specified. */
export function spectralSpeedOfLightSI(set: ConstantSet): number {
  return readSI(set, "speedOfLight", { "m/s": 1, "cm/s": 0.01 });
}

export function spectralConstantsSI(set: ConstantSet): SpectralConstants {
  const c = spectralSpeedOfLightSI(set);
  if (set.id === "einstein-1905-light-quanta-printed") {
    return Object.freeze({
      // 1 erg / cm^3 = 10^-7 J / 10^-6 m^3 = 0.1 J / m^3.
      A: readSI(set, "wienConstantAlpha", { "erg s4 / cm3": 0.1, "J s4 / m3": 1 }),
      B: readSI(set, "wienConstantBeta", { "s K": 1 }),
      c,
    });
  }
  const h = readSI(set, "planckConstant", { "J s": 1, "erg s": 1e-7 });
  const kB = set.entries.some((entry) => entry.quantityId === "boltzmannConstant")
    ? readSI(set, "boltzmannConstant", { "J/K": 1, "erg/K": 1e-7 })
    : thermalConstantSI(set, { read: constantValue, thermal: thermalConstant });
  return Object.freeze({
    A: (8 * Math.PI * h) / c ** 3,
    B: h / kB,
    c,
    actionAndThermal: Object.freeze({ h, kB }),
  });
}
