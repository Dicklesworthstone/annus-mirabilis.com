/**
 * SR-04 constraint engine. Constructs the longitudinal map from enabled
 * constraints. Does not import gamma or any Lorentz-factor helper.
 * The transverse coefficient is `transverseScale` (glyph from the concordance).
 */
import { constantValue, getConstantSet } from "../constants.ts";
import type { OutsideDomain } from "./types.ts";
import { outsideDomain } from "./types.ts";

export type ConstraintId =
  | "right-moving-light"
  | "left-moving-light"
  | "reciprocity"
  | "isotropy"
  | "identity-branch"
  | "transverse-light";

export type CandidateMap = Readonly<{
  a: number;
  b: number;
  d: number;
  transverseScale: number;
}>;

export type ConstraintSolve =
  | Readonly<{
      status: "value";
      value: CandidateMap;
      family: string;
    }>
  | Readonly<{
      status: "underdetermined";
      compatibleFamily: string;
      neededInformation: readonly string[];
      relations: readonly string[];
    }>
  | Readonly<{
      status: "residual-report";
      residuals: Readonly<Record<string, number>>;
      notes: string;
    }>
  | OutsideDomain;

function cValue(): number {
  return constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
}

function lightSpeedResidual(
  a: number,
  b: number,
  d: number,
  v: number,
  c: number,
  sign: 1 | -1,
): number {
  const u = sign * c;
  const xpOverT = (a * (u - v)) / (b + d * u);
  return xpOverT - sign * c;
}

export function checkCandidateMap(
  candidate: CandidateMap,
  v: number,
): Readonly<{
  residuals: Readonly<Record<string, number>>;
  allHold: boolean;
  identifiesLongitudinalScale: boolean;
}> {
  const c = cValue();
  const { a, b, d, transverseScale } = candidate;
  const beta2 = (v * v) / (c * c);
  const residuals = Object.freeze({
    "right-moving-light": lightSpeedResidual(a, b, d, v, c, 1),
    "left-moving-light": lightSpeedResidual(a, b, d, v, c, -1),
    reciprocity: a * a * (1 - beta2) - 1,
    isotropy: 0,
    "identity-branch": a < 0 ? a : 0,
    "transverse-light": transverseScale * transverseScale - 1,
  });
  const allHold = Object.values(residuals).every((r) => Math.abs(r) < 1e-12);
  const identifiesLongitudinalScale = allHold && a > 0;
  return Object.freeze({ residuals, allHold, identifiesLongitudinalScale });
}

export function solveCandidateFamily(input: {
  v: number;
  enabledConstraints: readonly ConstraintId[];
  candidate?: CandidateMap;
}): ConstraintSolve {
  const { v, enabledConstraints, candidate } = input;
  if (!Number.isFinite(v))
    return outsideDomain("nonfinite-input", "Constraint engine needs a finite v.");
  const c = cValue();
  if (Math.abs(v) >= c) {
    return outsideDomain("superluminal-observer", "No inertial observer at |v| >= c.");
  }
  const enabled = new Set(enabledConstraints);
  if (candidate) {
    const checked = checkCandidateMap(candidate, v);
    return {
      status: "residual-report",
      residuals: checked.residuals,
      notes: checked.identifiesLongitudinalScale
        ? "All enabled constraints hold; longitudinal scale is the positive root of a^2 (1 - v^2/c^2) = 1."
        : "Hand-built candidate residuals; the map is not preinstalled.",
    };
  }
  if (enabled.size === 0) {
    const a = 1;
    const b = 1;
    const d = 0;
    const galilean = { a, b, d, transverseScale: 1 };
    const residuals = checkCandidateMap(galilean, v).residuals;
    return {
      status: "residual-report",
      residuals,
      notes: "Galilean candidate: slow objects pass; light x = ±ct fails (speeds c ∓ v).",
    };
  }
  const bothLight = enabled.has("right-moving-light") && enabled.has("left-moving-light");
  if (
    bothLight &&
    !enabled.has("reciprocity") &&
    !enabled.has("isotropy") &&
    !enabled.has("identity-branch")
  ) {
    return {
      status: "underdetermined",
      compatibleFamily: "b = a, d = -a v / c^2, free a(v)",
      neededInformation: ["reciprocity", "isotropy", "identity-branch"],
      relations: ["b = a", "d = -a*v/(c*c)"],
    };
  }
  if (bothLight && enabled.has("reciprocity") && !enabled.has("isotropy")) {
    return {
      status: "underdetermined",
      compatibleFamily: "a(v) a(-v) (1 - v^2/c^2) = 1",
      neededInformation: ["isotropy", "identity-branch"],
      relations: ["b = a", "d = -a*v/(c*c)", "a(v)*a(-v)*(1-v*v/(c*c)) = 1"],
    };
  }
  if (
    bothLight &&
    enabled.has("isotropy") &&
    !enabled.has("reciprocity") &&
    !enabled.has("identity-branch")
  ) {
    return {
      status: "underdetermined",
      compatibleFamily: "a(v) even, otherwise free",
      neededInformation: ["reciprocity", "identity-branch"],
      relations: ["a(v) = a(-v)"],
    };
  }
  if (
    bothLight &&
    enabled.has("reciprocity") &&
    enabled.has("isotropy") &&
    !enabled.has("identity-branch")
  ) {
    return {
      status: "underdetermined",
      compatibleFamily: "a = ± (1 - v^2/c^2)^{-1/2}",
      neededInformation: ["identity-branch"],
      relations: ["b = a", "d = -a*v/(c*c)", "a*a*(1-v*v/(c*c)) = 1"],
    };
  }
  if (
    bothLight &&
    enabled.has("reciprocity") &&
    enabled.has("isotropy") &&
    enabled.has("identity-branch")
  ) {
    const beta2 = (v * v) / (c * c);
    const a = 1 / Math.sqrt(1 - beta2);
    const map: CandidateMap = {
      a,
      b: a,
      d: (-a * v) / (c * c),
      transverseScale: enabled.has("transverse-light") ? 1 : Number.NaN,
    };
    if (enabled.has("transverse-light")) {
      return { status: "value", value: map, family: "longitudinal and transverse scales fixed" };
    }
    return {
      status: "value",
      value: { ...map, transverseScale: 1 },
      family: "longitudinal map; transverseScale not yet constrained",
    };
  }
  if (enabled.has("isotropy") && !enabled.has("reciprocity") && !bothLight) {
    return {
      status: "underdetermined",
      compatibleFamily: "a(v) even, otherwise free",
      neededInformation: ["right-moving-light", "left-moving-light", "reciprocity"],
      relations: ["a(v) = a(-v)"],
    };
  }
  return {
    status: "underdetermined",
    compatibleFamily: "enabled set does not close the family",
    neededInformation: [
      "right-moving-light",
      "left-moving-light",
      "reciprocity",
      "isotropy",
      "identity-branch",
    ],
    relations: [],
  };
}
