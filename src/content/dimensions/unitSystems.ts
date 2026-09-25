/**
 * Dual unit system contexts (SI, Gaussian-CGS, Electromagnetic-CGS) and resolution rules.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md (§4.7, §11.2, §11.5).
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-dimension-validator-aoz
 */

import { type Dimension, dimension } from "./rational.ts";

export type UnitSystemContext = "si" | "gaussian-cgs" | "emu-cgs";

/**
 * Quantity fields this validator reads. Binding is by `id`, never by a printed
 * glyph. Exactness of a numeric value belongs on a constant-set entry, so this
 * descriptor has no value, uncertainty, or precision field.
 */
export interface QuantityDescriptor {
  readonly id: string;
  readonly dimension: readonly string[];
  readonly gaussianDimension?: readonly string[];
  readonly emuDimension?: readonly string[];
  readonly dimensionStatus?:
    | "exact"
    | "declared"
    | "state-dependent"
    | "undefined-in-source"
    | "unsupported";
  readonly semanticKind?: string;
  readonly dimensionlessKind?:
    | "angle"
    | "hyperbolic-angle"
    | "ratio"
    | "count"
    | "probability"
    | "pure-number";
}

export type QuantityDimensionResolution =
  | { readonly ok: true; readonly dimension: Dimension }
  | {
      readonly ok: false;
      readonly status: "unsupported-check";
      readonly reason: string;
    };

/**
 * Resolves a quantity's dimension vector under the active unit system context.
 *
 * Rules:
 * 1. SI context always uses `quantity.dimension`.
 * 2. In Gaussian-CGS:
 *    - Pure mechanical/thermal/amount quantities (current exponent == 0 in SI) share their SI dimension.
 *    - Electrodynamic quantities (current exponent != 0 in SI) require `quantity.gaussianDimension`.
 *      If missing, resolution fails with `unsupported-check`. Never falls back to SI.
 * 3. In Electromagnetic-CGS (`emu-cgs`):
 *    - Quantities with zero current exponent use their SI dimension (retaining amount exponents).
 *    - Electrodynamic quantities require `quantity.emuDimension`.
 *      If missing, resolution fails with `unsupported-check`. Never falls back to SI or Gaussian.
 */
export function resolveQuantityDimension(
  q: QuantityDescriptor,
  context: UnitSystemContext = "si",
): QuantityDimensionResolution {
  if (q.dimensionStatus === "state-dependent") {
    return {
      ok: false,
      status: "unsupported-check",
      reason: `Quantity '${q.id}' has state-dependent dimensions and requires manual physical review.`,
    };
  }

  // A quantity the source names without defining (argument.ts, sourceUndefinedDimensionNote):
  // there is no dimension to check, and a zero or guessed vector would pass silently.
  if (q.dimensionStatus === "undefined-in-source") {
    return {
      ok: false,
      status: "unsupported-check",
      reason: `Quantity '${q.id}' is named in the source without a definition, so its dimension is unknown; the check waits for a sourced definition.`,
    };
  }

  if (q.dimensionStatus === "unsupported") {
    return {
      ok: false,
      status: "unsupported-check",
      reason: `Quantity '${q.id}' has unsupported dimension status.`,
    };
  }

  const siDim = dimension(q.dimension);

  if (context === "si") {
    return { ok: true, dimension: siDim };
  }

  // Current slot is index 4 in [length, mass, time, temperature, current, amount]
  const currentExp = siDim[4];
  const hasCurrent = currentExp !== undefined && currentExp.num !== 0n;

  if (!hasCurrent) {
    // Pure mechanical/thermal quantities share dimensions across systems
    return { ok: true, dimension: siDim };
  }

  if (context === "gaussian-cgs") {
    if (q.gaussianDimension?.length !== 6) {
      return {
        ok: false,
        status: "unsupported-check",
        reason: `Quantity '${q.id}' used in Gaussian context lacks required 'gaussianDimension'.`,
      };
    }
    return { ok: true, dimension: dimension(q.gaussianDimension) };
  }

  if (context === "emu-cgs") {
    if (q.emuDimension?.length !== 6) {
      return {
        ok: false,
        status: "unsupported-check",
        reason: `Quantity '${q.id}' used in electromagnetic-CGS context lacks required 'emuDimension'.`,
      };
    }
    return { ok: true, dimension: dimension(q.emuDimension) };
  }

  return {
    ok: false,
    status: "unsupported-check",
    reason: `Unsupported unit system context '${String(context)}'.`,
  };
}
