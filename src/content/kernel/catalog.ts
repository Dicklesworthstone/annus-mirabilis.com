import type { IdentifierBinding } from "../schemas/experiment.ts";
import type { KernelCatalogEntry } from "./types.ts";

const words = (r1: string) => ({ r0: r1, r1, r2: r1 });

const bind = (
  kernelFunction: string,
  identifier: string,
  quantityId: string,
  termIds?: readonly string[],
): IdentifierBinding => ({
  kernelFunction,
  identifier,
  quantityId,
  ...(termIds ? { termIds } : {}),
});

const tsRef = (module: string, exportName: string) => ({
  displayRole: "reference-implementation" as const,
  language: "ts" as const,
  module,
  exportName,
});

export const SLICE_KERNEL_CATALOG: readonly KernelCatalogEntry[] = [
  {
    instrumentId: "bm-01",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "stokesEinsteinD"),
    words: words(
      "Take the temperature and the gas constant, divide by the number of molecules in a mole to get the energy scale of one molecule, then divide by the drag on a sphere of this radius in a liquid of this viscosity.",
    ),
    equationId: "eq-model-bm-diffusivity",
    liveTerms: [
      "diffusionCoefficient",
      "viscosity",
      "particleRadius",
      "temperature",
      "boltzmannConstant",
    ],
    identifierBindings: [
      bind("stokesEinsteinD", "eta", "viscosity", ["eq-model-bm-diffusivity.t.viscosity"]),
      bind("stokesEinsteinD", "a", "particleRadius", ["eq-model-bm-diffusivity.t.radius"]),
      bind("stokesEinsteinD", "T", "temperature", ["eq-model-bm-diffusivity.t.temperature"]),
      bind("stokesEinsteinD", "k", "boltzmannConstant", ["eq-model-bm-diffusivity.t.boltzmann"]),
    ],
    independentReferences: [],
    traceScenarioId: "diffusion-einstein-1905-printed",
  },
  {
    instrumentId: "bm-01",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "rmsDisplacement"),
    words: words(
      "The typical one-dimensional displacement is the square root of twice the diffusion coefficient times the observation interval.",
    ),
    equationId: "eq-model-bm-rms",
    liveTerms: ["diffusionCoefficient", "observationInterval", "rmsDisplacement1d"],
    identifierBindings: [
      bind("rmsDisplacement", "D", "diffusionCoefficient", ["eq-model-bm-rms.t.diffusion"]),
      bind("rmsDisplacement", "t", "observationInterval", ["eq-model-bm-rms.t.time"]),
      bind("rmsDisplacement", "rmsDisplacement", "rmsDisplacement1d", ["eq-model-bm-rms.t.rms"]),
    ],
    independentReferences: [],
    traceScenarioId: "diffusion-einstein-1905-printed",
  },
  {
    instrumentId: "bm-01",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "apparentSpeed"),
    words: words(
      "Divide the model RMS displacement by the observation interval. The quotient depends on how long you watch.",
    ),
    equationId: "eq-model-bm-apparent-speed",
    liveTerms: ["diffusionCoefficient", "observationInterval"],
    identifierBindings: [
      bind("apparentSpeed", "D", "diffusionCoefficient"),
      bind("apparentSpeed", "tau", "observationInterval"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-01",
    kernel: tsRef("src/physics/reference/diffusion/tracers.ts", "ensembleMoments"),
    words: words("Average the recorded displacements of every tracer, not a viewport subset."),
    liveTerms: ["rmsDisplacement1d"],
    identifierBindings: [bind("ensembleMoments", "rms", "rmsDisplacement1d")],
    independentReferences: [],
  },
  {
    instrumentId: "bm-01",
    kernel: tsRef("src/physics/reference/diffusion/tracers.ts", "displacementHistogram"),
    words: words("Count how many recorded displacements fall in each interval of the histogram."),
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "kernelDiffusivity"),
    words: words(
      "A symmetric step with finite variance has diffusivity equal to that variance divided by twice the step interval.",
    ),
    liveTerms: ["diffusionCoefficient", "stepInterval"],
    identifierBindings: [
      bind("kernelDiffusivity", "tau", "stepInterval"),
      bind("kernelDiffusivity", "kernelDiffusivity", "diffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "randomWalkMoments"),
    words: words(
      "After n independent steps the mean-square displacement is n times the step variance.",
    ),
    liveTerms: ["diffusionCoefficient", "rmsDisplacement1d", "observationInterval"],
    identifierBindings: [
      bind("randomWalkMoments", "tau", "stepInterval"),
      bind("randomWalkMoments", "elapsedTime", "observationInterval"),
      bind("randomWalkMoments", "diffusion", "diffusionCoefficient"),
      bind("randomWalkMoments", "rms", "rmsDisplacement1d"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "coinWalkDistribution"),
    words: words(
      "A fair coin walk has an exact binomial distribution on the reachable lattice points.",
    ),
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walks.ts", "recordWalks"),
    words: words(
      "Draw independent walker steps from the chosen kernel and record a bounded set of traces.",
    ),
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "gaussianPropagator"),
    words: words(
      "On an unbounded line the probability density is a Gaussian whose width grows as the square root of elapsed time.",
    ),
    liveTerms: ["diffusionCoefficient", "observationInterval"],
    identifierBindings: [
      bind("gaussianPropagator", "D", "diffusionCoefficient"),
      bind("gaussianPropagator", "t", "observationInterval"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "intervalProbability"),
    words: words("The probability of landing between two points is the integral of that Gaussian."),
    liveTerms: ["diffusionCoefficient", "observationInterval"],
    identifierBindings: [
      bind("intervalProbability", "D", "diffusionCoefficient"),
      bind("intervalProbability", "t", "observationInterval"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/special/erf.ts", "erf"),
    words: words(
      "The error function is the integral that turns a Gaussian density into an interval probability.",
    ),
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/special/erf.ts", "erfc"),
    words: words(
      "The complementary error function evaluates the Gaussian tail without subtracting from one.",
    ),
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "radialPropagator2d"),
    words: words("In two dimensions the radial density is not itself a Gaussian."),
    liveTerms: ["diffusionCoefficient", "observationInterval"],
    identifierBindings: [
      bind("radialPropagator2d", "D", "diffusionCoefficient"),
      bind("radialPropagator2d", "t", "observationInterval"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "radialPropagator3d"),
    words: words("In three dimensions the radial density is not itself a Gaussian."),
    liveTerms: ["diffusionCoefficient", "observationInterval"],
    identifierBindings: [
      bind("radialPropagator3d", "D", "diffusionCoefficient"),
      bind("radialPropagator3d", "t", "observationInterval"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/ftcs.ts", "ftcs1d"),
    words: words(
      "Advance a one-dimensional density with an explicit three-point Laplacian. Refuse when the stability ratio exceeds one half.",
    ),
    liveTerms: ["diffusionCoefficient"],
    identifierBindings: [bind("ftcs1d", "D", "diffusionCoefficient")],
    independentReferences: [],
  },
  /*
    MASS-ENERGY (dispatch 173). Each entry is one of the kernelFunctions its instrument's manifest
    declares (content/experiments/me-0N.yaml, owner), with that manifest's identifierBindings for
    the function; meCatalog.test.ts holds the two equal. Three things the manifests also say are
    left out, each for a measured reason:
    - independentReferences: every one names content/verification/<id>/<quantity>.yaml, and that
      directory does not exist, so each would be a link to nothing.
    - live terms beyond the bindings: check.ts derives ME-01's and ME-03's live terms from the
      two-ledgers equations, which include the body energies H0, H1, E0 and E1. No kernel
      computes those; the paper and the model leave them symbolic, so no identifier can honestly
      stand for them. Each entry's live terms are the quantities its bindings name.
    - the traces: only bm-01's is computed, so traceScenarioId is registered and nothing more.
  */
  {
    instrumentId: "me-01",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluatePulseEnergies"),
    words: words(
      "Seen from the moving frame, each of the two pulses carries half the emitted energy, times the Lorentz factor, times one minus or one plus the frame speed times the cosine of the emission angle. The angle cancels in the sum, which is the Lorentz factor times the emitted energy.",
    ),
    liveTerms: [
      "emittedEnergyRestFrame",
      "frameSpeed",
      "emissionAngle",
      "lorentzFactor",
      "lightComplexEnergyMoving",
    ],
    identifierBindings: [
      bind("evaluatePulseEnergies", "emittedEnergyRestFrame", "emittedEnergyRestFrame"),
      bind("evaluatePulseEnergies", "frameSpeed", "frameSpeed"),
      bind("evaluatePulseEnergies", "emissionAngleRad", "emissionAngle"),
      bind("evaluatePulseEnergies", "lorentzFactor", "lorentzFactor"),
      bind("evaluatePulseEnergies", "pulseSumMoving", "lightComplexEnergyMoving"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "me-01",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluateLedgers"),
    words: words(
      "In the frame where the body rests, it loses exactly the energy it emits. In the moving frame it loses the Lorentz factor times that energy. The function returns both balances, and if it is given an initial body energy it first seeds the ledger with it.",
    ),
    liveTerms: ["emittedEnergyRestFrame", "frameSpeed", "lorentzFactor"],
    identifierBindings: [
      bind("evaluateLedgers", "emittedEnergyRestFrame", "emittedEnergyRestFrame"),
      bind("evaluateLedgers", "frameSpeed", "frameSpeed"),
      bind("evaluateLedgers", "lorentzFactor", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "me-01",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluateSubtraction"),
    words: words(
      "Subtract the rest-frame balance from the moving-frame balance: the emitted energy times the Lorentz factor minus one. If the premise holds that the additive constant does not change during the emission, that difference is the drop in the body's kinetic energy; with the premise set aside, no kinetic difference is returned. The Lorentz factor minus one is computed so that it does not round to zero at walking speeds, and an observer speed that is not finite and below the speed of light is refused.",
    ),
    liveTerms: ["kineticEnergyDifference"],
    identifierBindings: [
      bind("evaluateSubtraction", "kineticDifference", "kineticEnergyDifference"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "me-02",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluateMe02"),
    words: words(
      "Refuse unless the emitted energy and the speed of light are positive and the observer moves slower than light. Then compute the exact drop in kinetic energy, the emitted energy times the Lorentz factor minus one; its low-speed approximation, half the emitted energy times the square of the frame speed; and the limiting mass coefficient, the emitted energy divided by the square of the speed of light. At a finite speed, also divide the exact drop by half the square of the speed: that ratio is larger than the limit and approaches it as the speed goes to zero.",
    ),
    liveTerms: [
      "frameSpeed",
      "emittedEnergyRestFrame",
      "speedOfLight",
      "kineticEnergyDifference",
      "finiteSpeedMassProxy",
      "inertialMassDecrease",
    ],
    identifierBindings: [
      bind("evaluateMe02", "beta", "frameSpeed"),
      bind("evaluateMe02", "L", "emittedEnergyRestFrame"),
      bind("evaluateMe02", "c", "speedOfLight"),
      bind("evaluateMe02", "exact", "kineticEnergyDifference"),
      bind("evaluateMe02", "proxy", "finiteSpeedMassProxy"),
      bind("evaluateMe02", "limitValue", "inertialMassDecrease"),
    ],
    independentReferences: [],
    traceScenarioId: "mass-energy-printed-factor",
  },
  {
    instrumentId: "me-03",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluateMe03"),
    words: words(
      "Read the chosen boundary, what happens to the radiation, and the energies, then pass them to the boundary ledger, the modern four-momentum calculation and the energy-source cards, and gather their results in one snapshot. A missing or invalid energy falls back to the default: one unit emitted, none put in.",
    ),
    liveTerms: ["emittedEnergyRestFrame", "speedOfLight"],
    identifierBindings: [
      bind("evaluateMe03", "emittedEnergy", "emittedEnergyRestFrame"),
      bind("evaluateMe03", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "me-03",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "evaluatePhotonBox"),
    words: words(
      "Refuse unless the box mass, box length and pulse energy are positive and finite, and unless the pulse energy is small compared with the box mass times the square of the speed of light. Then the pulse carries momentum equal to its energy divided by the speed of light, the box recoils at that momentum divided by its mass, and while the pulse crosses, the box moves back by the energy times the length divided by the mass times the square of the speed of light. If the light is given the mass of its energy divided by the square of the speed of light, the centre of mass does not move.",
    ),
    liveTerms: [
      "boxMass",
      "boxLength",
      "emittedEnergyRestFrame",
      "pulseMomentum",
      "recoilSpeed",
      "centerOfMassShift",
    ],
    identifierBindings: [
      bind("evaluatePhotonBox", "M", "boxMass"),
      bind("evaluatePhotonBox", "ell", "boxLength"),
      bind("evaluatePhotonBox", "E", "emittedEnergyRestFrame"),
      bind("evaluatePhotonBox", "pulseMomentum", "pulseMomentum"),
      bind("evaluatePhotonBox", "recoilSpeed", "recoilSpeed"),
      bind("evaluatePhotonBox", "comShift", "centerOfMassShift"),
    ],
    independentReferences: [],
    traceScenarioId: "me-03-box-canonical",
  },
];

export const SLICE_REGISTERED_SCENARIOS: Readonly<Record<string, readonly string[]>> = {
  "bm-01": ["diffusion-einstein-1905-printed", "bm-01-golden"],
  "bm-05": ["bm-05-golden"],
  "bm-06": ["bm-06-golden", "ftcs-stability-limit"],
  "me-02": ["mass-energy-printed-factor"],
  "me-03": ["me-03-box-canonical"],
};

export function pinKey(modulePath: string, exportName: string): string {
  return `${exportName}@${modulePath}`;
}
