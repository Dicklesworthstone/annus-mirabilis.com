/**
 * Six-slot dimension basis in canonical upstream fs-qty order.
 *
 * Defined in docs/CONTENT_IDS.md, docs/FRANKENSIM_BINDING.md Finding 2.7,
 * and AGENTS.md ("Precision and tolerance", §11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-schemas-argument-llm / am-cm-dimension-validator-aoz
 */

export const DIMENSION_BASIS = [
  "length",
  "mass",
  "time",
  "temperature",
  "current",
  "amount",
] as const;

export type DimensionBasisName = (typeof DIMENSION_BASIS)[number];

export const DIMENSION_SI_UNITS = ["m", "kg", "s", "K", "A", "mol"] as const;
export type DimensionSiUnit = (typeof DIMENSION_SI_UNITS)[number];

export const DIMENSION_COUNT = 6;

export type RationalScale = Readonly<{
  num: number;
  den: number;
}>;

export class DimensionSchemaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, message: string, path = "dimension") {
    super(`[dimension] ${path}: ${message} (${code})`);
    this.name = "DimensionSchemaError";
    this.code = code;
    this.path = path;
  }
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function validateRationalScale(
  val: unknown,
  path = "scale",
  allowZero = true,
): RationalScale {
  if (!val || typeof val !== "object") {
    throw new DimensionSchemaError("invalid-rational", "Expected an exact rational scale {num, den}.", path);
  }
  const o = val as Record<string, unknown>;
  if (typeof o.num !== "number" || !Number.isInteger(o.num)) {
    throw new DimensionSchemaError("invalid-numerator", "Rational numerator must be an integer.", `${path}.num`);
  }
  if (typeof o.den !== "number" || !Number.isInteger(o.den)) {
    throw new DimensionSchemaError("invalid-denominator", "Rational denominator must be an integer.", `${path}.den`);
  }
  if (o.den === 0) {
    throw new DimensionSchemaError("invalid-denominator", "A rational denominator cannot be zero.", `${path}.den`);
  }
  if (o.den < 0) {
    throw new DimensionSchemaError("invalid-denominator", "Rational denominator must be strictly positive.", `${path}.den`);
  }
  if (!allowZero && o.num === 0) {
    throw new DimensionSchemaError("zero-scale-forbidden", "Scale factor cannot be zero.", `${path}.num`);
  }
  if (gcd(o.num, o.den) !== 1) {
    throw new DimensionSchemaError(
      "rational-not-reduced",
      `Rational fraction ${o.num}/${o.den} is not reduced to lowest terms.`,
      path,
    );
  }
  return { num: o.num, den: o.den };
}

export type RationalDimension = readonly RationalScale[];

export function validateRationalDimension(
  val: unknown,
  path = "dimension",
  isCgs = false,
): RationalDimension {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if ("luminousIntensity" in obj || "candela" in obj || "luminous_intensity" in obj || "cd" in obj) {
      throw new DimensionSchemaError(
        "luminous-intensity-forbidden",
        "Luminous intensity is not in the dimension basis: no quantity in the corpus needs it.",
        path,
      );
    }
  }

  if (!Array.isArray(val)) {
    throw new DimensionSchemaError("invalid-dimension-array", `Dimension must be an array of ${DIMENSION_COUNT} rational exponents.`, path);
  }
  if (val.length !== DIMENSION_COUNT) {
    if (val.length > DIMENSION_COUNT) {
      throw new DimensionSchemaError(
        "luminous-intensity-forbidden",
        `Dimension array has ${val.length} slots. Luminous intensity is not in the dimension basis: no quantity in the corpus needs it.`,
        path,
      );
    }
    throw new DimensionSchemaError("invalid-dimension-length", `Dimension array must have exactly ${DIMENSION_COUNT} exponents in basis order [${DIMENSION_BASIS.join(", ")}].`, path);
  }

  const result: RationalScale[] = val.map((slot, i) => {
    const slotPath = `${path}[${i}] (${DIMENSION_BASIS[i]})`;
    if (typeof slot === "string") {
      if (!/^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*)?$/.test(slot)) {
        throw new DimensionSchemaError("invalid-rational-string", `Invalid rational string "${slot}".`, slotPath);
      }
      const [numStr, denStr = "1"] = slot.split("/");
      const num = parseInt(numStr!, 10);
      const den = parseInt(denStr, 10);
      return validateRationalScale({ num, den }, slotPath, true);
    } else if (typeof slot === "number" && Number.isInteger(slot)) {
      return { num: slot, den: 1 };
    } else {
      return validateRationalScale(slot, slotPath, true);
    }
  });

  if (isCgs) {
    const currentSlot = result[4]!;
    if (currentSlot.num !== 0) {
      throw new DimensionSchemaError(
        "cgs-nonzero-current",
        `CGS dimension cannot have a nonzero current exponent (found ${currentSlot.num}/${currentSlot.den} for current). Neither Gaussian nor EMU CGS has a base current.`,
        `${path}[4]`,
      );
    }
  }

  return Object.freeze(result);
}

export function isDimensionless(dim: RationalDimension): boolean {
  return dim.every((slot) => slot.num === 0);
}
