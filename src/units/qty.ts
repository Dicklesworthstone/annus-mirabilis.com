/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/qty.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Preserved SI dimension vectors, port contracts, and unit parsing.
 */

/**
 * 6-dimensional SI base unit exponent vector:
 * [0]: Length [m] (L)
 * [1]: Mass [kg] (M)
 * [2]: Time [s] (T)
 * [3]: Temperature [K] (Θ)
 * [4]: Electric Current [A] (I)
 * [5]: Amount of Substance [mol] (N)
 */
export type SiDimensionVector = readonly [
  length: number,
  mass: number,
  time: number,
  temperature: number,
  current: number,
  amount: number,
];

// Canonical SI Dimensions
export const DIM_DIMENSIONLESS: SiDimensionVector = Object.freeze([0, 0, 0, 0, 0, 0]);
export const DIM_LENGTH: SiDimensionVector = Object.freeze([1, 0, 0, 0, 0, 0]);
export const DIM_MASS: SiDimensionVector = Object.freeze([0, 1, 0, 0, 0, 0]);
export const DIM_TIME: SiDimensionVector = Object.freeze([0, 0, 1, 0, 0, 0]);
export const DIM_TEMPERATURE: SiDimensionVector = Object.freeze([0, 0, 0, 1, 0, 0]);
export const DIM_CURRENT: SiDimensionVector = Object.freeze([0, 0, 0, 0, 1, 0]);
export const DIM_AMOUNT: SiDimensionVector = Object.freeze([0, 0, 0, 0, 0, 1]);

export const DIM_AREA: SiDimensionVector = Object.freeze([2, 0, 0, 0, 0, 0]);
export const DIM_VOLUME: SiDimensionVector = Object.freeze([3, 0, 0, 0, 0, 0]);
export const DIM_VELOCITY: SiDimensionVector = Object.freeze([1, 0, -1, 0, 0, 0]);
export const DIM_ACCELERATION: SiDimensionVector = Object.freeze([1, 0, -2, 0, 0, 0]);
export const DIM_FORCE: SiDimensionVector = Object.freeze([1, 1, -2, 0, 0, 0]);
export const DIM_PRESSURE: SiDimensionVector = Object.freeze([-1, 1, -2, 0, 0, 0]);
export const DIM_ENERGY: SiDimensionVector = Object.freeze([2, 1, -2, 0, 0, 0]);
export const DIM_POWER: SiDimensionVector = Object.freeze([2, 1, -3, 0, 0, 0]);
export const DIM_TORQUE: SiDimensionVector = Object.freeze([2, 1, -2, 0, 0, 0]);
export const DIM_MOMENT: SiDimensionVector = DIM_TORQUE;
export const DIM_VOLTAGE: SiDimensionVector = Object.freeze([2, 1, -3, 0, -1, 0]);
export const DIM_RESISTANCE: SiDimensionVector = Object.freeze([2, 1, -3, 0, -2, 0]);
export const DIM_CAPACITANCE: SiDimensionVector = Object.freeze([-2, -1, 4, 0, 2, 0]);
export const DIM_INDUCTANCE: SiDimensionVector = Object.freeze([2, 1, -2, 0, -2, 0]);
export const DIM_MAGNETIC_FLUX_DENSITY: SiDimensionVector = Object.freeze([0, 1, -2, 0, -1, 0]);
export const DIM_FREQUENCY: SiDimensionVector = Object.freeze([0, 0, -1, 0, 0, 0]);
export const DIM_ENERGY_DENSITY: SiDimensionVector = Object.freeze([-1, 1, -2, 0, 0, 0]); // J/m³
export const DIM_DENSITY: SiDimensionVector = Object.freeze([-3, 1, 0, 0, 0, 0]); // kg/m³
export const DIM_VOLUME_FLOW: SiDimensionVector = Object.freeze([3, 0, -1, 0, 0, 0]); // m³/s
export const DIM_ENTROPY_FLOW: SiDimensionVector = Object.freeze([2, 1, -3, -1, 0, 0]); // W/K

/** Coarse SI dimension tag for telemetry and HUDs. */
export function qtyDimension(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === "n" || u === "lbf" || u === "kn") return "ML/T²";
  if (u === "n·m" || u === "n.m" || u === "nm" || u === "lbf·ft") return "ML²/T²";
  if (u === "w" || u === "kw" || u === "mw" || u === "hp") return "ML²/T³";
  if (u === "j" || u === "kj" || u === "mj" || u === "kwh") return "ML²/T²";
  if (u === "v" || u === "kv" || u === "mv") return "ML²/IT³";
  if (u === "a" || u === "ma" || u === "µa" || u === "ua" || u === "ka") return "I";
  if (u === "ω" || u === "ohm" || u === "Ω" || u === "kω" || u === "mω") return "ML²/I²T³";
  if (u === "k" || u === "°c" || u === "c" || u === "°f") return "Θ";
  if (u === "m/s" || u === "mph" || u === "kts" || u === "km/h") return "L/T";
  if (u === "hz" || u === "khz" || u === "mhz" || u === "ghz" || u === "rpm" || u === "1/s")
    return "1/T";
  if (
    u === "s" ||
    u === "sec" ||
    u === "ms" ||
    u === "ns" ||
    u === "ps" ||
    u === "min" ||
    u === "hr"
  )
    return "T";
  if (
    u === "m" ||
    u === "mm" ||
    u === "µm" ||
    u === "um" ||
    u === "nm" ||
    u === "cm" ||
    u === "km" ||
    u === "in" ||
    u === "ft"
  )
    return "L";
  if (u === "kg" || u === "g" || u === "mg" || u === "lb" || u === "lbs" || u === "tonne")
    return "M";
  if (u === "pa" || u === "kpa" || u === "mpa" || u === "psi" || u === "atm" || u === "torr")
    return "M/LT²";
  if (u === "j/m³" || u === "j/m3" || u === "kj/m³") return "M/LT²";
  if (u === "t" || u === "tesla" || u === "gauss") return "M/IT²";
  if (u === "f" || u === "farad" || u === "µf" || u === "uf" || u === "pf") return "I²T⁴/ML²";
  if (u === "h" || u === "henry" || u === "mh" || u === "µh" || u === "uh") return "ML²/I²T²";
  if (u === "rad" || u === "deg" || u === "°" || u === "%" || u === "ratio" || u === "") return "1";
  return "1";
}

/** Multiply two SI dimension vectors (adds exponents). */
export function multiplyDimensions(a: SiDimensionVector, b: SiDimensionVector): SiDimensionVector {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4], a[5] + b[5]];
}

/** Divide two SI dimension vectors (subtracts exponents). */
export function divideDimensions(a: SiDimensionVector, b: SiDimensionVector): SiDimensionVector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3], a[4] - b[4], a[5] - b[5]];
}

/** Raise an SI dimension vector to a rational power (multiplies exponents). */
export function powerDimension(dim: SiDimensionVector, power: number): SiDimensionVector {
  return [
    dim[0] * power,
    dim[1] * power,
    dim[2] * power,
    dim[3] * power,
    dim[4] * power,
    dim[5] * power,
  ];
}

/** Check if two SI dimension vectors are identical. */
export function areDimensionsEqual(a: SiDimensionVector, b: SiDimensionVector): boolean {
  for (let i = 0; i < 6; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (Math.abs(ai - bi) > 1e-9) return false;
  }
  return true;
}

/** Check if a dimension vector is dimensionless [0,0,0,0,0,0]. */
export function isDimensionless(dim: SiDimensionVector): boolean {
  return areDimensionsEqual(dim, DIM_DIMENSIONLESS);
}

/**
 * Formats an SI dimension vector into standard [L^a M^b T^c Θ^d I^e N^f] representation.
 */
export function formatDimensionVector(dim: SiDimensionVector): string {
  const symbols = ["L", "M", "T", "Θ", "I", "N"];
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const exp = dim[i] ?? 0;
    const sym = symbols[i] ?? "";
    if (exp !== 0) {
      parts.push(exp === 1 ? sym : `${sym}^${exp}`);
    }
  }
  return parts.length === 0 ? "1" : parts.join("·");
}

/**
 * Parses common engineering and scientific unit strings into a canonical 6D SI dimension vector.
 */
export function parseUnitToDimension(unit: string): SiDimensionVector {
  const u = unit.trim().toLowerCase();
  if (
    u === "1" ||
    u === "" ||
    u === "dimensionless" ||
    u === "normalized" ||
    u === "%" ||
    u === "ratio" ||
    u === "rad" ||
    u === "deg" ||
    u === "°" ||
    u === "count" ||
    u === "boolean" ||
    u === "state" ||
    u === "index" ||
    u === "fraction" ||
    u === "relative / %" ||
    u === "relative"
  ) {
    return DIM_DIMENSIONLESS;
  }

  // Force
  if (u === "n" || u === "kn" || u === "mn" || u === "lbf" || u === "dyn" || u === "dyne")
    return DIM_FORCE;

  // Power
  if (
    u === "w" ||
    u === "kw" ||
    u === "mw" ||
    u === "gw" ||
    u === "hp" ||
    u === "ft·lbf/s" ||
    u === "ft.lbf/s" ||
    u === "btu/h"
  )
    return DIM_POWER;

  // Energy
  if (
    u === "j" ||
    u === "kj" ||
    u === "mj" ||
    u === "kwh" ||
    u === "btu" ||
    u === "ev" ||
    u === "erg"
  )
    return DIM_ENERGY;

  // Torque / Moment
  if (u === "n·m" || u === "n.m" || u === "nm" || u === "lbf·ft" || u === "lbf.ft")
    return DIM_TORQUE;

  // Pressure
  if (
    u === "pa" ||
    u === "kpa" ||
    u === "mpa" ||
    u === "psi" ||
    u === "atm" ||
    u === "torr" ||
    u === "bar" ||
    u === "mbar"
  )
    return DIM_PRESSURE;

  // Energy density
  if (u === "j/m³" || u === "j/m3" || u === "kj/m³" || u === "mj/m³") return DIM_ENERGY_DENSITY;

  // Mass density
  if (u === "kg/m³" || u === "kg/m3" || u === "g/cm³" || u === "g/cm3") return DIM_DENSITY;

  // Voltage
  if (u === "v" || u === "kv" || u === "mv" || u === "µv" || u === "uv") return DIM_VOLTAGE;

  // Current
  if (u === "a" || u === "ma" || u === "µa" || u === "ua" || u === "ka") return DIM_CURRENT;

  // Resistance
  if (
    u === "ω" ||
    u === "ohm" ||
    u === "Ω" ||
    u === "kω" ||
    u === "kohm" ||
    u === "mω" ||
    u === "mohm"
  )
    return DIM_RESISTANCE;

  // Capacitance
  if (u === "f" || u === "farad" || u === "µf" || u === "uf" || u === "nf" || u === "pf")
    return DIM_CAPACITANCE;

  // Inductance
  if (u === "h" || u === "henry" || u === "mh" || u === "µh" || u === "uh" || u === "nh")
    return DIM_INDUCTANCE;

  // Magnetic flux density
  if (u === "t" || u === "tesla" || u === "gauss") return DIM_MAGNETIC_FLUX_DENSITY;

  // Velocity
  if (
    u === "m/s" ||
    u === "mps" ||
    u === "mph" ||
    u === "kts" ||
    u === "knot" ||
    u === "knots" ||
    u === "km/h"
  )
    return DIM_VELOCITY;

  // Acceleration
  if (u === "m/s²" || u === "m/s2" || u === "g") return DIM_ACCELERATION;

  // Frequency & Angular Velocity
  if (
    u === "hz" ||
    u === "khz" ||
    u === "mhz" ||
    u === "ghz" ||
    u === "rpm" ||
    u === "1/s" ||
    u === "rps" ||
    u === "rad/s" ||
    u === "rad/sec"
  )
    return DIM_FREQUENCY;

  // Volume Flow Rate
  if (u === "m³/s" || u === "m3/s" || u === "l/s" || u === "m3/sec") return DIM_VOLUME_FLOW;

  // Entropy Flow Rate / Thermal Conductance
  if (u === "w/k" || u === "w/kelvin") return DIM_ENTROPY_FLOW;

  // Temperature
  if (u === "k" || u === "°c" || u === "c" || u === "°f" || u === "f") return DIM_TEMPERATURE;

  // Length
  if (
    u === "m" ||
    u === "mm" ||
    u === "µm" ||
    u === "um" ||
    u === "nm" ||
    u === "cm" ||
    u === "km" ||
    u === "in" ||
    u === "ft" ||
    u === "inches" ||
    u === "feet"
  )
    return DIM_LENGTH;

  // Mass
  if (u === "kg" || u === "g" || u === "mg" || u === "lb" || u === "lbs" || u === "tonne")
    return DIM_MASS;

  // Time
  if (
    u === "s" ||
    u === "sec" ||
    u === "ms" ||
    u === "µs" ||
    u === "us" ||
    u === "ns" ||
    u === "ps" ||
    u === "min" ||
    u === "hr" ||
    u === "h"
  )
    return DIM_TIME;

  // Amount
  if (u === "mol" || u === "kmol" || u === "mmol") return DIM_AMOUNT;

  // Default fallback is dimensionless
  return DIM_DIMENSIONLESS;
}

export type PortRole =
  | "power-in"
  | "power-out"
  | "power-dissipated"
  | "stored-energy"
  | "energy-density"
  | "effort"
  | "flow"
  | "state"
  | "topology";

export interface PortDimensionContract {
  readonly portId: string;
  readonly declaredUnit: string;
  readonly expectedDimension: SiDimensionVector;
  readonly role: PortRole;
  readonly isDimensionless: boolean;
}

export interface PortValidationResult {
  readonly valid: boolean;
  readonly portId: string;
  readonly declaredUnit: string;
  readonly actualUnit: string;
  readonly expectedDimension: SiDimensionVector;
  readonly actualDimension: SiDimensionVector;
  readonly refusalReason?: string | undefined;
}

export class DimensionContractError extends Error {
  constructor(
    public readonly portId: string,
    public readonly reason: string,
    public readonly expectedDimension: SiDimensionVector,
    public readonly actualDimension: SiDimensionVector,
  ) {
    super(`Dimension Contract Violation on port "${portId}": ${reason}`);
    this.name = "DimensionContractError";
  }
}

/**
 * Creates an immutable port contract defining expected dimensions and role.
 * Topology ports are enforced to be dimensionless.
 */
export function createPortContract(
  portId: string,
  declaredUnit: string,
  role: PortRole,
  customExpectedDimension?: SiDimensionVector | undefined,
): PortDimensionContract {
  let expectedDimension: SiDimensionVector;
  if (customExpectedDimension) {
    expectedDimension = customExpectedDimension;
  } else {
    switch (role) {
      case "power-in":
      case "power-out":
      case "power-dissipated":
        expectedDimension = DIM_POWER;
        break;
      case "stored-energy":
        expectedDimension = DIM_ENERGY;
        break;
      case "energy-density":
        expectedDimension = DIM_ENERGY_DENSITY;
        break;
      case "topology":
      case "state":
        expectedDimension = DIM_DIMENSIONLESS;
        break;
      default:
        expectedDimension = parseUnitToDimension(declaredUnit);
        break;
    }
  }

  const declaredDim = parseUnitToDimension(declaredUnit);
  if (!areDimensionsEqual(declaredDim, expectedDimension)) {
    throw new DimensionContractError(
      portId,
      `Declared unit "${declaredUnit}" (${formatDimensionVector(declaredDim)}) does not match contract dimension (${formatDimensionVector(expectedDimension)})`,
      expectedDimension,
      declaredDim,
    );
  }

  return Object.freeze({
    portId,
    declaredUnit,
    expectedDimension,
    role,
    isDimensionless: isDimensionless(expectedDimension),
  });
}

/**
 * Validates that a runtime port value and unit conform strictly to the contract.
 * Catches deliberate unit mismatches, unphysical inputs, and topology/SI confusion.
 */
export function validatePortValue(
  contract: PortDimensionContract,
  value: number,
  actualUnit: string,
): PortValidationResult {
  const actualDim = parseUnitToDimension(actualUnit);

  if (!Number.isFinite(value)) {
    return {
      valid: false,
      portId: contract.portId,
      declaredUnit: contract.declaredUnit,
      actualUnit,
      expectedDimension: contract.expectedDimension,
      actualDimension: actualDim,
      refusalReason: `Non-finite numeric value (${value}) on port "${contract.portId}".`,
    };
  }

  // Topology ports must NEVER pretend to have physical SI dimensions
  if (contract.role === "topology" && !isDimensionless(actualDim)) {
    return {
      valid: false,
      portId: contract.portId,
      declaredUnit: contract.declaredUnit,
      actualUnit,
      expectedDimension: contract.expectedDimension,
      actualDimension: actualDim,
      refusalReason: `Topology port "${contract.portId}" must be dimensionless; received unit "${actualUnit}" (${formatDimensionVector(actualDim)}).`,
    };
  }

  // Non-topology ports must match expected physical dimension
  if (!areDimensionsEqual(actualDim, contract.expectedDimension)) {
    return {
      valid: false,
      portId: contract.portId,
      declaredUnit: contract.declaredUnit,
      actualUnit,
      expectedDimension: contract.expectedDimension,
      actualDimension: actualDim,
      refusalReason: `Dimension mismatch on port "${contract.portId}": expected ${formatDimensionVector(contract.expectedDimension)} (${contract.declaredUnit}), received ${formatDimensionVector(actualDim)} (${actualUnit}).`,
    };
  }

  return {
    valid: true,
    portId: contract.portId,
    declaredUnit: contract.declaredUnit,
    actualUnit,
    expectedDimension: contract.expectedDimension,
    actualDimension: actualDim,
  };
}

/**
 * Asserts port dimension compatibility, throwing a typed error if invalid.
 */
export function assertPortValue(
  contract: PortDimensionContract,
  value: number,
  actualUnit: string,
): void {
  const res = validatePortValue(contract, value, actualUnit);
  if (!res.valid) {
    throw new DimensionContractError(
      contract.portId,
      res.refusalReason ?? "Invalid port value or unit",
      contract.expectedDimension,
      res.actualDimension,
    );
  }
}
