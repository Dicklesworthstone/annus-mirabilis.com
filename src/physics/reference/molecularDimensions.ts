/**
 * Joint diffusion/viscosity inversion for the molecular-dimensions companion.
 * Plan §§3.7, 14.2: this is a dilute-sphere model, not a fit to historical data.
 * Inputs are independently supplied; neither k_B nor a target N enters the inference.
 *
 * With molar concentration c_m, specific viscosity s = eta_solution/eta - 1,
 * s = b (4 pi/3) c_m N a^3 and D = RT/(6 pi eta a N).
 * Set A = a N. Then a^2 = s/[b (4 pi/3) c_m A], and N = A/a.
 * b=1 is the original coefficient; b=2.5 is the corrected coefficient.
 */
import type { ResultPayload, ScientificResult } from "../../experiments/results/types.ts";

export const MOLECULAR_DIMENSIONS_OWNER = "molecular-dimensions";
/** An explicit admission ceiling, not a universal accuracy certificate. */
export const MAX_DILUTE_VOLUME_FRACTION = 0.05;

export type MolecularDimensionsInputs = Readonly<{
  temperature: number; // K
  viscosity: number; // solvent, Pa s
  diffusion: number; // m^2/s
  molarConcentration: number; // mol/m^3 of solution, not mass concentration
  specificViscosity: number; // eta_solution/eta_solvent - 1
  gasConstant: number; // J/(mol K), supplied independently
  viscosityCoefficient: 1 | 2.5;
}>;

export type MolecularDimensionsSnapshot = Readonly<{
  radius: ScientificResult;
  molecularNumber: ScientificResult;
  radiusTimesMolecularNumber: ScientificResult;
  volumeFraction: ScientificResult;
}>;

const IDENTITIES = Object.freeze({
  radius: { quantityId: "molecularRadius", unit: "m", semanticKind: "length" },
  molecularNumber: { quantityId: "molecularNumber", unit: "mol^-1", semanticKind: "molecular-number" },
  radiusTimesMolecularNumber: {
    quantityId: "radiusTimesMolecularNumber", unit: "m/mol", semanticKind: "identifiability-product",
  },
  volumeFraction: { quantityId: "soluteVolumeFraction", unit: "1", semanticKind: "volume-fraction" },
} as const);
type Key = keyof typeof IDENTITIES;

function result(key: Key, payload: ResultPayload): ScientificResult {
  return Object.freeze({ ...IDENTITIES[key], ownerId: MOLECULAR_DIMENSIONS_OWNER, ...payload });
}

function refuse(condition: string, reason: string, domainKind: "input" | "model" | "numerical"): MolecularDimensionsSnapshot {
  const payload = {
    status: "outside-domain" as const, condition, domainKind, reason,
    boundary: Object.freeze({ alternativeModel: "positive finite inputs in the dilute-sphere regime" }),
  };
  return Object.freeze({
    radius: result("radius", payload), molecularNumber: result("molecularNumber", payload),
    radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", payload),
    volumeFraction: result("volumeFraction", payload),
  });
}

export function inferMolecularDimensions(p: MolecularDimensionsInputs): MolecularDimensionsSnapshot {
  if (![p.temperature, p.viscosity, p.diffusion, p.gasConstant].every((n) => Number.isFinite(n) && n > 0) ||
      ![p.molarConcentration, p.specificViscosity].every((n) => Number.isFinite(n) && n >= 0) ||
      (p.viscosityCoefficient !== 1 && p.viscosityCoefficient !== 2.5)) {
    return refuse("invalid-input", "Supply positive temperature, solvent viscosity, diffusivity and gas constant, nonnegative concentration and specific viscosity, and coefficient 1 or 2.5.", "input");
  }
  // Work in log space to avoid overflowing intermediate products at finite inputs.
  const logA = Math.log(p.gasConstant) + Math.log(p.temperature) - Math.log(6 * Math.PI) -
    Math.log(p.viscosity) - Math.log(p.diffusion);
  const A = Math.exp(logA);
  if (!Number.isFinite(A) || A <= 0) {
    return refuse("nonrepresentable-output", "The radius-times-number product cannot be represented as a positive finite number at these settings.", "numerical");
  }
  if (p.molarConcentration === 0 && p.specificViscosity === 0) {
    const unknown = {
      status: "underdetermined" as const,
      compatibleFamily: "a N = RT/(6 pi eta D); doubling a and halving N leaves D unchanged.",
      neededInformation: Object.freeze(["A nonzero dilute-solution concentration and its viscosity increment, or an independently measured radius."]),
    };
    return Object.freeze({
      radius: result("radius", unknown), molecularNumber: result("molecularNumber", unknown),
      radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", { status: "value", value: A }),
      volumeFraction: result("volumeFraction", { status: "value", value: 0 }),
    });
  }
  if (p.molarConcentration === 0 || p.specificViscosity === 0) {
    return refuse("inconsistent-solution", "A finite positive molecular radius and number require both a nonzero concentration and a nonzero viscosity increment. Zero concentration cannot explain a positive increment.", "model");
  }
  const phi = p.specificViscosity / p.viscosityCoefficient;
  if (phi > MAX_DILUTE_VOLUME_FRACTION) {
    return refuse("not-dilute", "The inferred solute volume fraction exceeds this model's explicit 5% admission ceiling. A concentrated-solution model is needed; this cutoff is not an error estimate.", "model");
  }
  const logRadius = (Math.log(p.specificViscosity) - Math.log(p.viscosityCoefficient) -
    Math.log(4 * Math.PI / 3) - Math.log(p.molarConcentration) - logA) / 2;
  const radius = Math.exp(logRadius);
  const N = Math.exp(logA - logRadius);
  if (![radius, N, phi].every((n) => Number.isFinite(n) && n > 0)) {
    return refuse("nonrepresentable-output", "The inferred radius, molecular number or volume fraction cannot be represented as a positive finite number. No zero or infinity is substituted.", "numerical");
  }
  return Object.freeze({
    radius: result("radius", { status: "value", value: radius }),
    molecularNumber: result("molecularNumber", { status: "value", value: N }),
    radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", { status: "value", value: A }),
    volumeFraction: result("volumeFraction", { status: "value", value: phi }),
  });
}
