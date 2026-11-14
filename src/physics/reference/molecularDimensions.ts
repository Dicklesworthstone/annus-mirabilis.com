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
  molecularNumber: {
    quantityId: "molecularNumber",
    unit: "mol^-1",
    semanticKind: "molecular-number",
  },
  radiusTimesMolecularNumber: {
    quantityId: "radiusTimesMolecularNumber",
    unit: "m/mol",
    semanticKind: "identifiability-product",
  },
  volumeFraction: {
    quantityId: "soluteVolumeFraction",
    unit: "1",
    semanticKind: "volume-fraction",
  },
  viscosityProduct: {
    quantityId: "radiusCubedTimesMolecularNumber",
    unit: "m3/mol",
    semanticKind: "identifiability-product",
  },
  viscosityResidual: {
    quantityId: "relativeSpecificViscosityResidual",
    unit: "1",
    semanticKind: "relative-model-residual",
  },
} as const);
type Key = keyof typeof IDENTITIES;

function result(key: Key, payload: ResultPayload): ScientificResult {
  return Object.freeze({ ...payload, ...IDENTITIES[key], ownerId: MOLECULAR_DIMENSIONS_OWNER });
}

function logDiffusionProduct(p: MolecularDimensionsInputs): number {
  return (
    Math.log(p.gasConstant) +
    Math.log(p.temperature) -
    Math.log(6 * Math.PI) -
    Math.log(p.viscosity) -
    Math.log(p.diffusion)
  );
}

function refuse(
  condition: string,
  reason: string,
  domainKind: "input" | "model" | "numerical",
): MolecularDimensionsSnapshot {
  const payload = {
    status: "outside-domain" as const,
    condition,
    domainKind,
    reason,
    boundary: Object.freeze({
      alternativeModel: "positive finite inputs in the dilute-sphere regime",
    }),
  };
  return Object.freeze({
    radius: result("radius", payload),
    molecularNumber: result("molecularNumber", payload),
    radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", payload),
    volumeFraction: result("volumeFraction", payload),
  });
}

export function inferMolecularDimensions(
  p: MolecularDimensionsInputs,
): MolecularDimensionsSnapshot {
  if (
    ![p.temperature, p.viscosity, p.diffusion, p.gasConstant].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    ![p.molarConcentration, p.specificViscosity].every((n) => Number.isFinite(n) && n >= 0) ||
    (p.viscosityCoefficient !== 1 && p.viscosityCoefficient !== 2.5)
  ) {
    return refuse(
      "invalid-input",
      "Supply positive temperature, solvent viscosity, diffusivity and gas constant, nonnegative concentration and specific viscosity, and coefficient 1 or 2.5.",
      "input",
    );
  }
  // Work in log space to avoid overflowing intermediate products at finite inputs.
  const logA = logDiffusionProduct(p);
  const A = Math.exp(logA);
  if (!Number.isFinite(A) || A <= 0) {
    return refuse(
      "nonrepresentable-output",
      "The radius-times-number product cannot be represented as a positive finite number at these settings.",
      "numerical",
    );
  }
  if (p.molarConcentration === 0 && p.specificViscosity === 0) {
    const unknown = {
      status: "underdetermined" as const,
      compatibleFamily: "a N = RT/(6 pi eta D); doubling a and halving N leaves D unchanged.",
      neededInformation: Object.freeze([
        "A nonzero dilute-solution concentration and its viscosity increment, or an independently measured radius.",
      ]),
    };
    return Object.freeze({
      radius: result("radius", unknown),
      molecularNumber: result("molecularNumber", unknown),
      radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", {
        status: "value",
        value: A,
      }),
      volumeFraction: result("volumeFraction", { status: "value", value: 0 }),
    });
  }
  if (p.molarConcentration === 0 || p.specificViscosity === 0) {
    return refuse(
      "inconsistent-solution",
      "A finite positive molecular radius and number require both a nonzero concentration and a nonzero viscosity increment. Zero concentration cannot explain a positive increment.",
      "model",
    );
  }
  const phi = p.specificViscosity / p.viscosityCoefficient;
  if (phi > MAX_DILUTE_VOLUME_FRACTION) {
    return refuse(
      "not-dilute",
      "The inferred solute volume fraction exceeds this model's explicit 5% admission ceiling. A concentrated-solution model is needed; this cutoff is not an error estimate.",
      "model",
    );
  }
  const logRadius =
    (Math.log(p.specificViscosity) -
      Math.log(p.viscosityCoefficient) -
      Math.log((4 * Math.PI) / 3) -
      Math.log(p.molarConcentration) -
      logA) /
    2;
  const radius = Math.exp(logRadius);
  const N = Math.exp(logA - logRadius);
  if (![radius, N, phi].every((n) => Number.isFinite(n) && n > 0)) {
    return refuse(
      "nonrepresentable-output",
      "The inferred radius, molecular number or volume fraction cannot be represented as a positive finite number. No zero or infinity is substituted.",
      "numerical",
    );
  }
  return Object.freeze({
    radius: result("radius", { status: "value", value: radius }),
    molecularNumber: result("molecularNumber", { status: "value", value: N }),
    radiusTimesMolecularNumber: result("radiusTimesMolecularNumber", { status: "value", value: A }),
    volumeFraction: result("volumeFraction", { status: "value", value: phi }),
  });
}

/** Arithmetic comparison only. This is neither measurement uncertainty nor a goodness-of-fit test. */
export const MOLECULAR_IDENTIFICATION_TOLERANCE = 1e-10;

/** Chosen before any viscosity observation is admitted; these cannot reveal a withheld answer. */
const IDENTIFICATION_RADII = Object.freeze([1.25e-10, 2.5e-10, 5e-10, 1e-9, 2e-9]);

export type MolecularIdentificationCandidate = Readonly<{
  radius: number;
  diffusionNumber: ScientificResult;
  viscosityNumber: ScientificResult;
  viscosityResidual: ScientificResult;
  satisfiesBoth: boolean;
  intersection: boolean;
}>;

export type MolecularIdentification = Readonly<{
  viscosityAdmitted: boolean;
  diffusionProduct: ScientificResult;
  viscosityProduct: ScientificResult;
  radius: ScientificResult;
  molecularNumber: ScientificResult;
  candidates: readonly MolecularIdentificationCandidate[];
}>;

function finiteIdentificationValue(key: Key, value: number, positive: boolean): ScientificResult {
  if (Number.isFinite(value) && (!positive || value > 0))
    return result(key, { status: "value", value });
  return result(key, {
    status: "outside-domain",
    condition: "nonrepresentable-identification-output",
    domainKind: "numerical",
    reason: "This candidate cannot be represented by a finite number at these settings.",
    boundary: { alternativeModel: "a numerically representable candidate radius" },
  });
}

/**
 * Two independently admitted combinations, Na and Na³. The diffusion-only path never reads the
 * concentration, viscosity increment or coefficient. Withholding an observation is not the same
 * experiment as replacing its measured value with zero.
 *
 * Each candidate is on the diffusion family. Once viscosity is admitted, its separate family and
 * forward residual test that candidate. Only the existing joint inverse supplies the intersection.
 */
export function identifyMolecularDimensions(
  p: MolecularDimensionsInputs,
  viscosityAdmitted: boolean,
): MolecularIdentification {
  const unknown: ResultPayload = Object.freeze({
    status: "underdetermined",
    compatibleFamily: "N a = RT/(6 pi eta D); doubling the radius halves the compatible number.",
    neededInformation: Object.freeze([
      "Independently admit the solution's concentration and viscosity increment, or a measured radius.",
    ]),
  });
  const withheld: ResultPayload = Object.freeze({
    status: "not-applicable",
    reason: "The viscosity observation has not been admitted to this inference.",
  });
  if (
    ![p.temperature, p.viscosity, p.diffusion, p.gasConstant].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    const invalid = refuse(
      "invalid-diffusion-input",
      "Supply positive finite temperature, solvent viscosity, diffusivity and gas constant.",
      "input",
    );
    return Object.freeze({
      viscosityAdmitted,
      diffusionProduct: invalid.radiusTimesMolecularNumber,
      viscosityProduct: result("viscosityProduct", withheld),
      radius: invalid.radius,
      molecularNumber: invalid.molecularNumber,
      candidates: Object.freeze([]),
    });
  }
  const logA = logDiffusionProduct(p);
  const diffusionProduct = finiteIdentificationValue(
    "radiusTimesMolecularNumber",
    Math.exp(logA),
    true,
  );
  const joint = viscosityAdmitted ? inferMolecularDimensions(p) : null;
  const radius = joint?.radius ?? result("radius", unknown);
  const molecularNumber = joint?.molecularNumber ?? result("molecularNumber", unknown);
  // The admitted owner must support the whole second relation before a curve or residual is drawn.
  const admitsSecondRelation =
    joint?.radius.status === "value" && joint.molecularNumber.status === "value";
  const logY = admitsSecondRelation
    ? Math.log(p.specificViscosity) -
      Math.log(p.viscosityCoefficient) -
      Math.log((4 * Math.PI) / 3) -
      Math.log(p.molarConcentration)
    : null;
  const viscosityProduct =
    logY === null
      ? result("viscosityProduct", joint?.radius ?? withheld)
      : finiteIdentificationValue("viscosityProduct", Math.exp(logY), true);
  if (diffusionProduct.status !== "value")
    return Object.freeze({
      viscosityAdmitted,
      diffusionProduct,
      viscosityProduct,
      radius: result("radius", diffusionProduct),
      molecularNumber: result("molecularNumber", diffusionProduct),
      candidates: Object.freeze([]),
    });

  const intersection =
    admitsSecondRelation && radius.status === "value" && typeof radius.value === "number"
      ? radius.value
      : null;
  const radii = [...IDENTIFICATION_RADII];
  if (intersection !== null) {
    const match = radii.findIndex(
      (candidate) => Math.abs(candidate / intersection - 1) <= MOLECULAR_IDENTIFICATION_TOLERANCE,
    );
    if (match < 0) radii.push(intersection);
    else radii[match] = intersection;
    radii.sort((a, b) => a - b);
  }
  const candidates = radii.map((candidateRadius): MolecularIdentificationCandidate => {
    const logRadius = Math.log(candidateRadius);
    const diffusionNumber = finiteIdentificationValue(
      "molecularNumber",
      Math.exp(logA - logRadius),
      true,
    );
    const viscosityNumber =
      logY === null
        ? result("molecularNumber", joint?.radius ?? withheld)
        : finiteIdentificationValue("molecularNumber", Math.exp(logY - 3 * logRadius), true);
    // Admitting the observation does not admit every hypothetical diffusion pair. A candidate
    // may itself require a concentrated solution, where the dilute viscosity law cannot test it.
    // The intersection already passed the inverse owner's domain check, including the boundary.
    const outsideDiluteModel =
      logY !== null &&
      candidateRadius !== intersection &&
      logA + 2 * logRadius + Math.log((4 * Math.PI) / 3) + Math.log(p.molarConcentration) >
        Math.log(MAX_DILUTE_VOLUME_FRACTION);
    // Forward check: (b 4π/3 c_m N a³ - x) / x. expm1 retains small residuals.
    const residual =
      logY === null || diffusionNumber.status !== "value"
        ? result("viscosityResidual", logY === null ? (joint?.radius ?? withheld) : diffusionNumber)
        : outsideDiluteModel
          ? result("viscosityResidual", {
              status: "outside-domain",
              condition: "candidate-not-dilute",
              domainKind: "model",
              reason:
                "This diffusion-compatible candidate exceeds the model's 5% volume-fraction ceiling. The dilute viscosity law cannot test this pair.",
              boundary: Object.freeze({
                alternativeModel: "a concentrated-solution model for this candidate",
              }),
            })
          : finiteIdentificationValue(
              "viscosityResidual",
              Math.expm1(logA + 2 * logRadius - logY),
              false,
            );
    return Object.freeze({
      radius: candidateRadius,
      diffusionNumber,
      viscosityNumber,
      viscosityResidual: residual,
      satisfiesBoth:
        residual.status === "value" &&
        typeof residual.value === "number" &&
        Math.abs(residual.value) <= MOLECULAR_IDENTIFICATION_TOLERANCE,
      intersection: candidateRadius === intersection,
    });
  });
  return Object.freeze({
    viscosityAdmitted,
    diffusionProduct,
    viscosityProduct,
    radius,
    molecularNumber,
    candidates: Object.freeze(candidates),
  });
}
