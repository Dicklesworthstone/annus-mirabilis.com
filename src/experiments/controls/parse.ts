/**
 * Parameter Parsing, Serialization, and Unit Display Adapters.
 * Specification: am-inst-parameter-controls-cmj9, am-not-quantity-registry-2f7.
 */

import type { ParameterSpec } from "../../content/schemas/experiment.ts";
import { convertValue } from "../../units/adapters.ts";
import { checkGridStep, validateDomain } from "./domain.ts";
import { parseU64 } from "./seed.ts";
import type { ParseResult } from "./types.ts";

const UNIT_FAMILY_BASE_UNITS: Record<string, string> = {
  viscosity: "Pa*s",
  length: "m",
  energy: "J",
  frequency: "Hz",
  mass: "kg",
  charge: "C",
  potential: "V",
  electricField: "V/m",
  magneticField: "T",
  current: "A",
  temperature: "K",
  time: "s",
};

/**
 * Normalizes unit notation strings (e.g. 'mPa·s', 'mPa s', 'μm', 'um').
 */
export function normalizeUnit(unitStr: string): string {
  return unitStr
    .trim()
    .replace(/·/g, "*")
    .replace(/\s+/g, "*")
    .replace(/µ/g, "um")
    .replace(/μ/g, "um")
    .replace(/°c/i, "degC");
}

/**
 * Detects base unit for a given ParameterSpec based on its quantityId or displayUnit.
 */
export function getCanonicalBaseUnit(spec: ParameterSpec): string {
  const normDisplay = normalizeUnit(spec.displayUnit);
  if (normDisplay === "mPa*s" || normDisplay === "Pa*s" || spec.quantityId === "viscosity") {
    return "Pa*s";
  }
  if (
    normDisplay === "um" ||
    normDisplay === "nm" ||
    normDisplay === "cm" ||
    normDisplay === "m" ||
    spec.quantityId === "particleRadius" ||
    spec.quantityId === "displacement"
  ) {
    return "m";
  }
  if (
    normDisplay === "ev" ||
    normDisplay === "erg" ||
    normDisplay === "j" ||
    spec.quantityId === "energy"
  ) {
    return "J";
  }
  if (normDisplay === "thz" || normDisplay === "hz" || spec.quantityId === "frequency") {
    return "Hz";
  }
  if (spec.quantityId === "temperature" || normDisplay === "degc" || normDisplay === "k") {
    return "K";
  }
  if (spec.quantityId in UNIT_FAMILY_BASE_UNITS) {
    return UNIT_FAMILY_BASE_UNITS[spec.quantityId] ?? spec.displayUnit;
  }
  return spec.displayUnit;
}

/**
 * Converts a canonical SI value into the parameter's display unit representation.
 */
export function toDisplayUnitValue(spec: ParameterSpec, canonicalValue: number): number {
  if (!Number.isFinite(canonicalValue)) return canonicalValue;
  const baseUnit = getCanonicalBaseUnit(spec);
  const normDisplay = normalizeUnit(spec.displayUnit);

  if (!normDisplay || normDisplay === normalizeUnit(baseUnit)) {
    return canonicalValue;
  }

  try {
    return convertValue(canonicalValue, baseUnit, normDisplay);
  } catch {
    return canonicalValue;
  }
}

/**
 * Converts a display unit value into the canonical SI representation.
 */
export function toCanonicalValue(
  spec: ParameterSpec,
  displayValue: number,
  fromUnit?: string,
): number {
  if (!Number.isFinite(displayValue)) return displayValue;
  const baseUnit = getCanonicalBaseUnit(spec);
  const sourceUnit = normalizeUnit(fromUnit ?? spec.displayUnit);

  if (!sourceUnit || sourceUnit === normalizeUnit(baseUnit)) {
    return displayValue;
  }

  try {
    return convertValue(displayValue, sourceUnit, baseUnit);
  } catch {
    return displayValue;
  }
}

/**
 * Formats a canonical parameter value for display with proper unit formatting.
 */
export function formatParameterValue(spec: ParameterSpec, value: number | string): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  const dispVal = toDisplayUnitValue(spec, value);
  if (Math.abs(dispVal) < 1e-4 && dispVal !== 0) {
    return dispVal.toExponential(4).replace(/\+?0+([0-9]+)$/, "$1");
  }
  return Number(dispVal.toFixed(8)).toString();
}

/**
 * Serializes a canonical parameter value to exact string.
 */
export function serializeParameterValue(_spec: ParameterSpec, value: number | string): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Number.isFinite(value)) {
    return "NaN";
  }

  // Preserve compact representation for canonical scientific constants
  if (Math.abs(value) < 1e-4 && value !== 0) {
    return value.toString();
  }
  return Number(value.toFixed(10)).toString();
}

/**
 * Parses user input text into a verified canonical value for a ParameterSpec.
 * Validates domain boundaries and grid alignment; never silently clamps or rounds.
 */
export function parseParameterValue(
  spec: ParameterSpec,
  text: string,
  options?: { gridStepOverride?: number | undefined } | undefined,
): ParseResult {
  // 1. Seed parameter handling (untrimmed strict check)
  const isSeedParam =
    spec.quantityId === "seed" ||
    spec.quantityId === "streamSeed" ||
    spec.id === "seed" ||
    (typeof spec.default === "string" && /^[0-9]+$/.test(spec.default));

  if (isSeedParam) {
    try {
      const canonicalSeed = parseU64(text, spec.id);
      return {
        ok: true,
        canonicalValue: canonicalSeed,
        displayValue: canonicalSeed,
        isBeyondVisualTrack: false,
      };
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" && err !== null && "code" in err && typeof err.code === "string"
          ? err.code
          : "invalid-seed";
      return {
        ok: false,
        error: errorCode,
        explanation:
          "Seed must be a canonical 64-bit unsigned decimal integer [0, 18446744073709551615] with no signs, leading zeros, or scientific notation.",
        rawInput: text,
      };
    }
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "empty-input",
      explanation: "Parameter input cannot be empty.",
      rawInput: text,
    };
  }

  // 2. Parse numeric value with optional unit suffix
  // Matches e.g. "1.35e-3", "-2.5", "1.35 mPa*s", "500 nm", "0.02 s"
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z*·/µμ°%^0-9\s-]*)$/.exec(
    trimmed,
  );
  if (!match) {
    return {
      ok: false,
      error: "invalid-number-format",
      explanation: `"${trimmed}" is not a recognized numeric quantity or expression.`,
      rawInput: text,
    };
  }

  const numPart = match[1] ?? "";
  const unitPart = match[2]?.trim() ?? "";

  const parsedNum = Number(numPart);
  if (!Number.isFinite(parsedNum)) {
    return {
      ok: false,
      error: "non-finite-number",
      explanation: "Value must be a finite real number.",
      rawInput: text,
    };
  }

  // 3. Convert to canonical SI
  let canonicalValue: number;
  if (unitPart) {
    const normalizedTypedUnit = normalizeUnit(unitPart);
    try {
      canonicalValue = toCanonicalValue(spec, parsedNum, normalizedTypedUnit);
    } catch {
      // Fallback: If unit is unrecognized, treat as literal number
      canonicalValue = parsedNum;
    }
  } else {
    // If no unit typed, interpret in parameter's displayUnit
    canonicalValue = toCanonicalValue(spec, parsedNum);
  }

  // 4. Validate Model Domain
  const domainRes = validateDomain(spec, canonicalValue);
  if (!domainRes.valid) {
    return {
      ok: false,
      error: "out-of-domain",
      explanation: domainRes.explanation ?? "Value is outside the admitted physical domain.",
      rawInput: text,
    };
  }

  // 5. Validate Step/Grid mapping
  const gridRes = checkGridStep(spec, canonicalValue, options?.gridStepOverride);
  if (!gridRes.onGrid) {
    return {
      ok: false,
      error: "off-grid",
      explanation: gridRes.explanation ?? "Value does not land on the allowed parameter grid.",
      rawInput: text,
      offeredNeighbours: gridRes.offeredNeighbours,
    };
  }

  return {
    ok: true,
    canonicalValue,
    displayValue: formatParameterValue(spec, canonicalValue),
    isBeyondVisualTrack: domainRes.isBeyondVisualTrack,
  };
}
