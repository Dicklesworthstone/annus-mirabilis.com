/**
 * Mapping exact rational dimensions to the integer fs-qty runtime model.
 *
 * Enforces integer SI exponents (i8 range), refuses fractional exponents (e.g. 1/2),
 * refuses Gaussian/EMU dimensions, and refuses state-dependent quantities.
 *
 * Defined in docs/FRANKENSIM_BINDING.md Finding 2.7 and AGENTS.md (§11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import { type Dimension, runtimeDimension } from "./rational.ts";
import type { UnitSystemContext } from "./unitSystems.ts";

export interface RuntimeMappingResult {
  readonly ok: true;
  readonly runtimeExponents: readonly number[];
}

export type RuntimeMappingError =
  | { readonly ok: false; readonly code: "non-si-context"; readonly message: string }
  | { readonly ok: false; readonly code: "state-dependent"; readonly message: string }
  | { readonly ok: false; readonly code: "fractional-exponent"; readonly message: string }
  | { readonly ok: false; readonly code: "out-of-range"; readonly message: string };

/**
 * Maps an exact rational dimension vector to an integer fs-qty Dims([i8; 6]) representation.
 */
export function mapToRuntimeDimension(
  d: Dimension,
  context: UnitSystemContext = "si",
  isStateDependent = false,
): RuntimeMappingResult | RuntimeMappingError {
  if (context !== "si") {
    return {
      ok: false,
      code: "non-si-context",
      message: `Cannot map ${context} dimensions to upstream runtime model; runtime model transport is strictly canonical SI.`,
    };
  }

  if (isStateDependent) {
    return {
      ok: false,
      code: "state-dependent",
      message: "State-dependent quantities cannot be mapped to static runtime dimensions.",
    };
  }

  if (d.some((v) => v.den !== 1n)) {
    return {
      ok: false,
      code: "fractional-exponent",
      message:
        "Runtime dimensions require integer exponents; fractional exponents (e.g. 1/2) cannot be mapped to fs-qty.",
    };
  }

  if (d.some((v) => v.num < -128n || v.num > 127n)) {
    return {
      ok: false,
      code: "out-of-range",
      message: "Exponent exceeds i8 range [-128, 127] supported by fs-qty Dims([i8; 6]).",
    };
  }

  return {
    ok: true,
    runtimeExponents: runtimeDimension(d),
  };
}
