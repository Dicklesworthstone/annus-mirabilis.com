import type { ExecutionOutcome } from "./outcomes.ts";
import type { RequestRefusal } from "./refusals.ts";
import type { ScientificResult } from "./types.ts";

/**
 * Plan examples and fixtures for typed results, refusals, and execution outcomes.
 * Bead: am-rt-typed-results-mqb.
 */

export const valueExample: ScientificResult = Object.freeze({
  quantityId: "displacement",
  unit: "m",
  semanticKind: "latent-coordinate",
  ownerId: "diffusion.rmsDisplacement",
  status: "value",
  value: 0.000005,
  uncertainty: Object.freeze({
    kind: "statistical-interval",
    lower: 0.0000045,
    upper: 0.0000055,
    coverage: 0.95,
    sampleSize: 400,
    method: "bootstrap-bca",
  }),
});

export const symbolicExample: ScientificResult = Object.freeze({
  quantityId: "internal-energy-difference",
  unit: "J",
  semanticKind: "difference",
  ownerId: "massEnergy.ledger",
  status: "symbolic",
  expressionRef: "energy-difference-relation",
  unspecifiedSymbols: Object.freeze(["E_0", "E_1", "H_0", "H_1"]),
});

export const analyticLimitExample: ScientificResult = Object.freeze({
  quantityId: "particle-density-t0",
  unit: "1/m",
  semanticKind: "distribution",
  ownerId: "diffusion.pointDistribution",
  status: "analytic-limit",
  description: "At t = 0 all probability is concentrated at the initial position.",
  representation: Object.freeze({
    kind: "point-mass",
    location: 0,
    mass: 1,
  }),
});

/** ME-02: the rest-frame mass coefficient at v = 0 is L/c^2, not a new experiment. */
export const me02AnalyticLimitExample: ScientificResult = Object.freeze({
  quantityId: "massCoefficient",
  unit: "kg/J",
  semanticKind: "coefficient",
  ownerId: "massEnergy.limitingCoefficient",
  status: "analytic-limit",
  description: "At v = 0 the mass coefficient is the rest-frame factor L/c^2.",
  representation: Object.freeze({
    kind: "coefficient",
    value: 1 / 299792458 ** 2,
  }),
});

export const underdeterminedExample: ScientificResult = Object.freeze({
  quantityId: "particle-radius",
  unit: "m",
  semanticKind: "radius",
  ownerId: "inference.stokesEinstein",
  status: "underdetermined",
  compatibleFamily: "a * N_A = RT / (6 * pi * eta * D) is fixed at constant T, eta, D",
  neededInformation: Object.freeze([
    "Independently measure the particle radius, or inspect the compatible radius–number family.",
  ]),
});

export const notApplicableExample: ScientificResult = Object.freeze({
  quantityId: "stopping-potential",
  unit: "V",
  semanticKind: "potential",
  ownerId: "photoelectric.singleQuantum",
  status: "not-applicable",
  reason: "Below threshold frequency, no electrons are emitted; stopping potential is not defined.",
});

export const outsideDomainExample: ScientificResult = Object.freeze({
  quantityId: "entropy-density",
  unit: "J/(K*m^3)",
  semanticKind: "density",
  ownerId: "radiation.wienEntropy",
  status: "outside-domain",
  condition: "dilute radiation regime (h*nu >> k_B*T)",
  domainKind: "model",
  reason: "The Wien approximation does not describe this dense radiation regime.",
  boundary: Object.freeze({
    alternativeModel: "planck-radiation",
  }),
});

/**
 * LQ-02: Classical mode-energy allocation integrated over unbounded frequency range.
 * Rayleigh-Jeans classical spectral energy density has no finite total without a cutoff.
 */
export const lq02DivergentExample: ScientificResult = Object.freeze({
  quantityId: "spectral-energy-density-total",
  unit: "J/m^3",
  semanticKind: "density",
  ownerId: "radiation.rayleighJeansModeEnergy",
  status: "divergent",
  expressionRef: "classical-mode-energy-integral",
  divergenceKind: "integral",
  variable: "frequency",
  range: Object.freeze({ lower: 0, upper: "unbounded" }),
  rate: Object.freeze({
    statement:
      "The classical spectral energy density integrated over an unbounded frequency range grows as the cube of the upper frequency cutoff.",
    expressionRef: "classical-cubic-growth",
  }),
  modelId: "classical-equipartition",
  finiteUnder: Object.freeze({
    parameterId: "frequencyCutoff",
    value: 1e15,
  }),
});

/**
 * LQ-02 finite cutoff counterpart:
 * At T = 5000 K with nu_max = 10^15 Hz: (8 * pi * k_B * T * nu_max^3) / (3 * c^3) = 2.146396e1 J/m^3
 */
export const lq02FiniteCutoffExample: ScientificResult = Object.freeze({
  quantityId: "spectral-energy-density-total",
  unit: "J/m^3",
  semanticKind: "density",
  ownerId: "radiation.rayleighJeansModeEnergy",
  status: "value",
  value: 2.146396e1,
  uncertainty: Object.freeze({
    kind: "numerical-error-estimate",
    magnitude: 1e-6,
    method: "quadrature-tolerance",
    guarantee: "bound",
  }),
});

/** Same classical integral at ν_max = 10^16 Hz: ten times the cutoff cubes the total. */
export const lq02FiniteCutoff1e16Example: ScientificResult = Object.freeze({
  quantityId: "spectral-energy-density-total",
  unit: "J/m^3",
  semanticKind: "density",
  ownerId: "radiation.rayleighJeansModeEnergy",
  status: "value",
  value: 2.146396e4,
  uncertainty: Object.freeze({
    kind: "numerical-error-estimate",
    magnitude: 1e-3,
    method: "quadrature-tolerance",
    guarantee: "bound",
  }),
});

export const planStatusExamples: readonly ScientificResult[] = Object.freeze([
  valueExample,
  symbolicExample,
  analyticLimitExample,
  me02AnalyticLimitExample,
  underdeterminedExample,
  notApplicableExample,
  outsideDomainExample,
  lq02DivergentExample,
]);

export const ftcsUnstableRefusalExample: RequestRefusal = Object.freeze({
  code: "ftcs-unstable",
  domainKind: "numerical",
  affected: Object.freeze({ parameterIds: Object.freeze(["dt", "dx"]) }),
  message: "This time step is too large for the explicit diffusion scheme.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Reduce the time step to 0.0116 s or smaller.",
      action: Object.freeze({ parameterId: "dt", value: 0.0116 }),
    }),
  ]),
  details: Object.freeze({
    ratio: 0.5000001,
    limit: 0.5,
    dtMax: 0.0116,
  }),
});

export const superluminalObserverRefusalExample: RequestRefusal = Object.freeze({
  code: "superluminal-observer",
  domainKind: "physical",
  affected: Object.freeze({ parameterIds: Object.freeze(["v"]) }),
  message: "An inertial observer must move more slowly than light in this model.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Choose a speed with magnitude below the speed of light.",
      action: Object.freeze({ parameterId: "v", value: 0.8 }),
    }),
  ]),
  details: Object.freeze({
    beta: 1,
  }),
});

export const outsideWienDomainRefusalExample: RequestRefusal = Object.freeze({
  code: "outside-wien-domain",
  domainKind: "model",
  affected: Object.freeze({ parameterIds: Object.freeze(["temperature", "density"]) }),
  message: "The Wien approximation does not describe this radiation regime.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Choose a lower density or compare with a different radiation model.",
    }),
  ]),
});

export const invalidSeedRefusalExample: RequestRefusal = Object.freeze({
  code: "invalid-seed",
  domainKind: "input",
  affected: Object.freeze({ parameterIds: Object.freeze(["seed"]) }),
  message: "The seed must be an unsigned 64-bit whole number written in canonical decimal form.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Enter digits without a sign, spaces, or leading zeros.",
      action: Object.freeze({ parameterId: "seed", value: "1337" }),
    }),
  ]),
  details: Object.freeze({
    input: "01",
  }),
});

export const streamIndexOverflowRefusalExample: RequestRefusal = Object.freeze({
  code: "stream-index-overflow",
  domainKind: "input",
  affected: Object.freeze({ parameterIds: Object.freeze(["startIndex"]) }),
  message: "This request would exceed the random stream's 64-bit draw counter.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Request fewer draws, or start a new identified stream.",
    }),
  ]),
  details: Object.freeze({
    startIndex: "18446744073709551614",
    draws: 1,
    maxIndex: "18446744073709551615",
  }),
});

export const invalidParameterZeroParticlesRefusalExample: RequestRefusal = Object.freeze({
  code: "invalid-parameter",
  domainKind: "input",
  affected: Object.freeze({ parameterIds: Object.freeze(["particleCount"]) }),
  message: "These inputs do not meet the calculation's stated requirements.",
  rankedRepairs: Object.freeze([
    Object.freeze({
      label: "Use the stated range and input combination.",
      action: Object.freeze({ parameterId: "particleCount", value: 1 }),
    }),
  ]),
  details: Object.freeze({
    parameterId: "particleCount",
    value: 0,
  }),
});

export const budgetExhaustedOutcomeExample: ExecutionOutcome = Object.freeze({
  outcome: "budget-exhausted",
  message: "This calculation exceeds the declared work or memory budget.",
  retry: "new-run",
  requested: Object.freeze({ workUnits: 1000, allocationBytes: 67108864 }),
  allowed: Object.freeze({ workUnits: 500, allocationBytes: 33554432 }),
});

export const missingArtifactOutcomeExample: ExecutionOutcome = Object.freeze({
  outcome: "missing-artifact",
  message: "The required calculation module is not available.",
  retry: "reload",
});
