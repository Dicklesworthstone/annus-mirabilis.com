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

  // SR-04, SR-05 and SR-06 (am-f3e4, dispatch 321). Each lab's frame-speed control IS beta: sr-04
  // reads v/c with displayUnit "c" and sr-06 with displayUnit "1", so binding a kernel's `beta` to
  // frameSpeed binds the control the reader is moving, not a quantity of the same name.
  //
  // Where one sentence is the whole truth it is the only sentence (words()); where R2 has more to
  // say it is written out, and every one of those is a cancellation-free form whose reason for
  // existing IS the step R2 shows. Collapsing those into R0 would throw away what the function is.
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics.ts", "galileanVelocity"),
    // One sentence is the whole truth: the function subtracts, and there is nothing under it.
    words: words(
      "Subtract the frame's speed from the speed measured in the resting system. That is the everyday rule this laboratory is testing, and it carries no reference to the speed of light at all.",
    ),
    liveTerms: ["frameSpeed", "velocityInMovingFrame"],
    identifierBindings: [
      bind("galileanVelocity", "u", "velocityComponentXStationary"),
      bind("galileanVelocity", "v", "frameSpeed"),
      bind("galileanVelocity", "galileanVelocity", "velocityInMovingFrame"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics.ts", "rapidity"),
    words: {
      r0: "The rapidity of a boost: a way of writing its speed that adds up when boosts are applied one after another, where the speeds themselves do not.",
      r1: "Rapidity is the inverse hyperbolic tangent of v/c, computed here as half the logarithm of (1 + beta) over (1 - beta). Two collinear boosts have rapidities that simply add, which is what makes it useful: the speeds compose by the addition theorem instead, and never add. The factor and the speed follow from it, since gamma is the hyperbolic cosine of the rapidity and gamma times beta its hyperbolic sine.",
      r2: "The function refuses before it computes. isMode1904 refuses the whole surface, because a rapidity is not a quantity the 1904 shelf holds; then refuseBeta rejects a nonfinite beta and any |beta| at or beyond 1, since there is no inertial observer there and the logarithm would divide by zero exactly at the light speed. What is left is one line: 0.5 * Math.log((1 + beta) / (1 - beta)). At beta = 0.6 the ratio is 1.6 over 0.4, so the rapidity is half of log 4, which is log 2. At beta = 0 it is 0, and it grows without bound as beta approaches 1, which is the same fact as light speed being unreachable, written in a coordinate where the boundary has moved to infinity.",
      r3: "Rapidity is a later aid and the module says so: paper 3 prints no rapidity glyph, and the hyperbolic reading of a boost is Minkowski's 1908 geometry rather than Einstein's 1905 kinematics. It is offered here as a modern lens on the same map, and it imports no later physics into the construction the laboratory performs.",
    },
    liveTerms: ["frameSpeed", "rapidity"],
    identifierBindings: [
      bind("rapidity", "beta", "frameSpeed"),
      bind("rapidity", "rapidity", "rapidity"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics.ts", "galileanRelativisticVelocityDifference"),
    words: {
      r0: "How far the relativistic answer sits from the Galilean one, computed as a single quantity rather than by subtracting two nearly equal numbers.",
      r1: "The relativistic transformed velocity is (u - v) divided by (1 - u v / c squared); the Galilean one is (u - v). Their difference is the first times the small factor relativeSize, which is (u v / c squared) divided by (1 - u v / c squared). At everyday speeds that factor is around ten to the minus seventeen, so the difference is far below anything the two velocities could be measured to.",
      r2: "Subtracting the two answers directly would compute (u - v) / (1 - u v / c squared) minus (u - v), two numbers that agree to sixteen digits at walking speeds, and the result would be mostly rounding error. The algebra removes the cancellation before the arithmetic: factor out (u - v) and what remains is 1 / (1 - u v / c squared) minus 1, which is exactly (u v / c squared) / (1 - u v / c squared). That is relativeSize, and the difference is (u - v) times it. The function returns both, so a reader can see that the ratio, not the difference, is the quantity that stays meaningful at small speeds. Its guards are the same shape as elsewhere: finite inputs, a positive c, |v| strictly below c, and |u| at most c, since a particle may move at the light speed while a frame may not.",
    },
    equationId: "eq-model-sr-velocity-x",
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("galileanRelativisticVelocityDifference", "u", "velocityComponentXStationary", [
        "eq-model-sr-velocity-x.t.ux",
      ]),
      bind("galileanRelativisticVelocityDifference", "v", "frameSpeed", [
        "eq-model-sr-velocity-x.t.speed",
      ]),
      bind("galileanRelativisticVelocityDifference", "c", "speedOfLight", [
        "eq-model-sr-velocity-x.t.light",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/physics/reference/kinematics.ts", "dilationLossPerSecond"),
    words: {
      r0: "How much a moving clock falls behind per second of the resting system, given exactly and again in the paper's small-speed form, so the two can be compared.",
      r1: "The loss per coordinate second is 1 minus 1 over gamma. The function returns it as exact, computed as beta squared over (1 + the square root of 1 minus beta squared), and beside it printedSecondOrder, which is half of beta squared. The second is what the paper prints on page 904 when it says the moving clock falls behind by half of (v/V) squared per second, neglecting magnitudes of the fourth order and higher.",
      r2: "Writing 1 minus the square root of (1 minus beta squared) directly would subtract two numbers that agree to sixteen digits at any everyday speed, and the answer would be rounding error. Multiplying above and below by (1 + the root) turns the numerator into 1 minus (1 minus beta squared), which is beta squared, and leaves the denominator 1 + the root: no subtraction of near-equals survives. At beta = 0.6 the root is 0.8 and the exact loss is 0.36 over 1.8, which is 0.2, while the printed second-order form gives 0.18; the two differ by a tenth of the answer at that speed. At a walking pace they agree to more digits than any clock can resolve, which is what the paper's neglect of fourth-order terms means.",
    },
    equationId: "eq-model-sr-slow-clock",
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("dilationLossPerSecond", "beta", "frameSpeed", ["eq-model-sr-slow-clock.t.speed"]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/experiments/sr05/worldline.ts", "reciprocalRates"),
    words: {
      r0: "Each frame reports the same factor for the other's clock. The function returns that one factor, which is gamma.",
      r1: "There is no asymmetry to find here: the frame at rest reports the moving clock running slow by gamma, and the moving frame reports the resting clock slow by the same gamma. The function returns the single dilationFactor rather than a pair, because a pair would suggest the two numbers could differ.",
      r2: "The implementation is gamma and a refusal: it calls gamma(beta), returns that result unchanged if it is not a value, and otherwise wraps the number as dilationFactor. What it deliberately does NOT do is compare two separated clock readings, and the comment in the source says so. That comparison needs a simultaneity convention to say which readings are being compared, and choosing one is where the apparent paradox of the twins lives; this function makes the symmetric statement about rates and stops, rather than smuggling a convention in.",
    },
    equationId: "eq-model-sr-time-dilation",
    liveTerms: ["frameSpeed", "lorentzFactor"],
    identifierBindings: [
      bind("reciprocalRates", "beta", "frameSpeed"),
      bind("reciprocalRates", "dilationFactor", "lorentzFactor", [
        "eq-model-sr-time-dilation.t.factor",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-06",
    kernel: tsRef("src/physics/reference/kinematics.ts", "composedSpeedShortfall"),
    words: {
      r0: "How far the composed speed falls short of the light speed, computed as its own quantity so that the answer survives when the shortfall is tiny.",
      r1: "Composing two speeds below c gives a speed below c, and this function returns by how much: 1 minus U/c, where U is the collinear composition. It is written as (1 - beta1) times (1 - beta2), over (1 + beta1 beta2). Compose 0.99 with 0.99 and the shortfall is one part in 19801, a number that says what the composed speed is far better than 0.99994949 does.",
      r2: "The reason this function exists is the reason it is not written as 1 minus composeCollinear. The composition is (beta1 + beta2) over (1 + beta1 beta2), so the shortfall is (1 + beta1 beta2 - beta1 - beta2) over (1 + beta1 beta2), and the numerator factors exactly into (1 - beta1)(1 - beta2). Computing it that way multiplies two small numbers; computing it as 1 minus the composition subtracts two numbers that agree to as many digits as the shortfall is small, and at 0.99 with 0.99 that throws away four of the sixteen digits available. Same guards as elsewhere: each input finite, each |beta| strictly below 1.",
    },
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("composedSpeedShortfall", "beta1", "frameSpeed"),
      bind("composedSpeedShortfall", "beta2", "velocityInMovingFrame"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-06",
    kernel: tsRef("src/physics/reference/kinematics.ts", "compositionIncrement"),
    words: {
      r0: "How much adding a second speed actually gains, computed directly rather than by composing and then subtracting.",
      r1: "Add w to a frame already moving at u and the gain is not w. It is w times (1 minus u squared over c squared), divided by (1 + u w over c squared). The first factor is what makes the gain shrink as u approaches the light speed: at u near c, almost nothing is added however large w is.",
      r2: "Composing and then subtracting would compute (u + w) / (1 + u w / c squared) minus u, two numbers that are close whenever w is small, which is exactly when the increment is the quantity of interest. Doing the subtraction first, on paper, gives (u + w - u - u squared w / c squared) over (1 + u w / c squared); the u terms cancel exactly and what is left is w (1 - u squared / c squared) over the same denominator, with no near-equal subtraction left for the arithmetic to lose.",
    },
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("compositionIncrement", "u", "frameSpeed"),
      bind("compositionIncrement", "w", "velocityInMovingFrame"),
      bind("compositionIncrement", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-06",
    kernel: tsRef("src/physics/reference/kinematics.ts", "composePrinted"),
    words: {
      r0: "The paper's own composition formula for two speeds at an angle, in its printed form, with its refusals made explicit.",
      r1: "This is the formula of paper 3, section 5: the resulting speed is the square root of (v squared plus w squared plus twice v w cos alpha, less the square of v w sin alpha over c), all divided by (1 + v w cos alpha over c squared). Under the root the first three terms are the parallelogram law, the answer ordinary mechanics would give; the subtracted term and the denominator are what the theory adds, and both vanish as the speeds fall away from c. The angle alpha is between the two velocities, and the expression is symmetric in v and w, which the paper remarks on.",
      r2: "The function computes cos alpha and sin alpha once, then the denominator 1 + v w cos alpha / c squared, then the radicand inner. It refuses before taking the root, in two ways that are different facts: a nonfinite input or a non-positive c is a malformed request, while |v| or |w| at or beyond c is a request outside the model, and those return different codes. It then refuses again if the radicand came out negative or the denominator vanished, rather than returning a NaN that would flow into a plot. Only then does it return the square root of inner over den. Setting alpha to zero makes sin alpha zero and cos alpha one, and the whole expression collapses to (v + w) over (1 + v w / c squared), the collinear form.",
      r3: "The printed form is Einstein's, from section 5 of the 1905 paper, where V is the letter for the light speed and alpha is the angle between the velocities. The site keeps the structure of the printed line rather than a rearranged modern equivalent, so that a reader comparing the panel with the page sees the same shape.",
    },
    equationId: "eq-model-sr-velocity-x",
    liveTerms: ["frameSpeed", "emissionAngle"],
    identifierBindings: [
      bind("composePrinted", "v", "frameSpeed", ["eq-model-sr-velocity-x.t.speed"]),
      bind("composePrinted", "w", "velocityInMovingFrame"),
      bind("composePrinted", "alpha", "emissionAngle"),
      bind("composePrinted", "c", "speedOfLight", ["eq-model-sr-velocity-x.t.light"]),
    ],
    independentReferences: [],
  },

  // SR-01, SR-02, SR-07 and SR-11 (am-f3e4, dispatch 324).
  //
  // A NOTE ON LIVE TERMS, because this batch is where the trap bites hardest. Of the 37 quantityIds
  // these four manifests use, 11 are registered. sr-01's are ALL unregistered (rodBeta, pairBeta,
  // assignedRemoteTime, criterionOffset and the rest), so its entries declare only what is both
  // canonical and true of the identifier, and two of them declare none at all rather than bind a
  // near miss. The panel still shows the code, the hash and the words; colour is what is missing,
  // not the deliverable.
  {
    instrumentId: "sr-01",
    kernel: tsRef("src/physics/reference/events.ts", "synchronizationRound"),
    words: {
      r0: "One round trip of a light signal, and the time it assigns to the distant clock: the midpoint of sending and receiving.",
      r1: "This is § 1's definition, computed. Given the time a signal left A, the time its echo returned to A, and the separation, it assigns the distant clock the average of the two local readings, and reports the round-trip speed over that separation. It also returns criterionOffset, which is the outward interval minus the return interval as the definition assigns them, and which is therefore zero by construction.",
      r2: "The refusals come first and they are different facts: a nonfinite time is a malformed request, while a reception at or before its emission is a request outside the model, and each returns its own code. Then assignedRemoteTime is (emissionTimeA + receptionTimeA) / 2, and roundTripSpeedLsPerS is twice the separation over the elapsed round trip, which is a speed the definition does not assume but measures. equalsC compares that speed with c to within 1e-9 rather than testing equality of floating-point numbers. criterionOffset is computed and returned even though the construction forces it to zero, because a reader should be able to watch it stay zero rather than be told it does.",
      r3: "The one-way speed is not measured here and cannot be: § 1 makes the equality of the two legs a stipulation, and this function computes what follows from that stipulation. What it measures is the round trip, which is what experience fixes.",
    },
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "sr-01",
    kernel: tsRef("src/physics/reference/events.ts", "movingRodLegs"),
    words: {
      r0: "The two legs of the same signal along a moving rod: the chase out takes longer than the return, and the difference is the whole of § 2's argument.",
      r1: "A light signal runs from one end of a moving rod to the other and back. Measured in the resting system the light travels at c while the far end runs away at beta, so the gap closes at c minus beta on the way out; on the return the near end runs to meet the light and the gap closes at c plus beta. The function returns both legs and, as criterionSatisfiedInStationaryFrame, whether they are equal, which happens only when beta is zero.",
      r2: "Nothing here says light slows down. The rates c - beta and c + beta are closing rates between two speeds both taken in the resting system, not speeds of light, and the two legs are separationLs divided by each. Because the denominators differ whenever the rod moves, the observers travelling with the rod cannot both apply § 1's criterion and agree with the resting system: that is the contradiction § 2 exhibits, and the boolean is the site's way of letting a reader watch it appear and disappear as beta passes through zero.",
    },
    liveTerms: ["frameSpeed"],
    identifierBindings: [bind("movingRodLegs", "beta", "frameSpeed")],
    independentReferences: [],
  },
  {
    instrumentId: "sr-01",
    kernel: tsRef("src/physics/reference/events.ts", "desynchronizationObserved"),
    words: words(
      "Two clocks synchronised in their own system are not synchronised in the system they move through: the trailing one reads ahead, by the separation times the speed over the square of the light speed, and the function returns that magnitude with which clock leads.",
    ),
    liveTerms: ["frameSpeed"],
    identifierBindings: [bind("desynchronizationObserved", "beta", "frameSpeed")],
    independentReferences: [],
  },
  {
    instrumentId: "sr-02",
    kernel: tsRef("src/physics/reference/fields.ts", "transformSI"),
    words: {
      r0: "The electric and magnetic fields as the moving frame measures them: along the motion each is unchanged, across it each mixes with the other.",
      r1: "This is § 6's transformation in modern SI letters. The components along the boost, E sub x and B sub x, pass through untouched. The transverse components mix: the new E sub y is gamma times (E sub y minus v times B sub z), and the new B sub y is gamma times (B sub y plus v times E sub z over c squared). A frame with no electric field at all therefore measures one, which is the whole content of the magnet-and-conductor observation the paper opens with.",
      r2: "The function computes gamma from v over c and, if that refuses, returns the input fields unchanged with gamma reported as NaN rather than inventing a transformed field. Otherwise each component is built once, in the order x, y, z, and the result is frozen so a caller cannot mutate a field it was handed. Note the asymmetry between the two blocks: the electric mixing carries v while the magnetic mixing carries v over c squared. That is not a typo but the SI unit system, and the same physics written in Gaussian units puts v over c in both, which is what transformGaussianHistorical does for the paper's own form.",
    },
    liveTerms: ["electricFieldStationary", "magneticFieldStationary", "frameSpeed"],
    identifierBindings: [
      bind("transformSI", "E", "electricFieldStationary"),
      bind("transformSI", "B", "magneticFieldStationary"),
      bind("transformSI", "v", "frameSpeed"),
      bind("transformSI", "γ", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-02",
    kernel: tsRef("src/physics/reference/fields.ts", "dipoleField"),
    words: words(
      "The magnetic field of a point dipole at a point in space: three times the dipole's component along the line of sight, spread along that line, less the dipole itself, all falling off as the cube of the distance.",
    ),
    liveTerms: ["magneticDipoleMoment"],
    identifierBindings: [bind("dipoleField", "moment", "magneticDipoleMoment")],
    independentReferences: [],
  },
  {
    instrumentId: "sr-02",
    kernel: tsRef("src/physics/reference/fields.ts", "evaluateSr02"),
    words: {
      r0: "The magnet and the conductor, computed in both frames at once, with every quantity carrying its own status rather than a number it has not earned.",
      r1: "The laboratory's evaluator. It takes the relative speed, the field, the path and the charge, transforms the field to the conductor's frame, computes the force in each frame, and returns the electromotive force each description gives. The two descriptions differ in what they say is happening, an electric force in one and a magnetic force in the other, and agree on what is measured, which is the observation the paper opens with.",
      r2: "Almost all of this function is about what it refuses to say. In apparatus mode it returns every row as SYMBOLIC, a typed state carrying the letter rather than a number, because no numbers have been requested. If the speed, field, length or charge is not finite, or the speed reaches c, or the declared path has no length, every row becomes OUTSIDE-DOMAIN with the condition named. Where the path lies along the motion the electromotive force is zero in both frames, and the excess becomes NOT-APPLICABLE with its reason rather than a zero that could be read as a measurement. Where the path is neither along nor across within tolerance the rows become UNDETERMINED, since the classification itself is the thing in doubt. The circuit current is always not-applicable, with the reason that no circuit is modelled. Only after all of that does it compute: emfMagnet is the magnitude of v times B times the length, taken only across the motion, and emfConductor is gamma times it.",
    },
    liveTerms: [
      "frameSpeed",
      "magneticFieldStationary",
      "electromotiveForceMagnetFrame",
      "electromotiveForceConductorFrame",
    ],
    identifierBindings: [
      bind("evaluateSr02", "v", "frameSpeed"),
      bind("evaluateSr02", "Bz", "magneticFieldStationary"),
      bind("evaluateSr02", "emfMagnet", "electromotiveForceMagnetFrame"),
      bind("evaluateSr02", "emfConductor", "electromotiveForceConductorFrame"),
      bind("evaluateSr02", "γ", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-07",
    kernel: tsRef("src/physics/reference/fields.ts", "maxwellResidualsPlaneWave"),
    words: {
      r0: "A numerical test of § 6's claim: transform a plane wave into the moving system and ask whether Maxwell's equations still hold there, by measuring how far from zero they come out.",
      r1: "The function builds a plane wave, transforms its field derivatives into the moving system by the chain rule, and forms the two combinations that Faraday's and Ampere's laws set to zero. What it returns is not a verdict but the residuals themselves, six of them, together with the largest, so that a reader sees the size of the failure rather than a passed or failed stamp. It also returns the amplitude and frequency factors, which for a wave along the motion are the Doppler factor gamma times (1 minus the direction cosine times beta).",
      r2: "The comparison is where the care is. Testing a floating-point residual against zero would fail on rounding alone, so each of the six is compared with a tolerance built from the terms that produced it: a relative part times the largest term, plus a floor times the wave's own scale. A residual smaller than that is not evidence of a violation, and the function says so by leaving allPassed true. The events are seeded, so the same six residuals come back on every run and a reader can compare two runs meaningfully. The convention parameter selects the printed transformation or its flipped sign, which is how a reader can watch the residuals leave zero when the wrong sign is used.",
      r3: "This is a modern verification oracle, not a step of the 1905 argument. The paper asserts the form invariance and demonstrates it algebraically; computing residuals against a tolerance is the site's way of letting a reader test it, and a small residual is evidence about this implementation rather than a proof about nature.",
    },
    liveTerms: ["frameSpeed", "lorentzFactor"],
    identifierBindings: [
      bind("maxwellResidualsPlaneWave", "v", "frameSpeed"),
      bind("maxwellResidualsPlaneWave", "γ", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-07",
    kernel: tsRef("src/physics/reference/fields.ts", "transformGaussianHistorical"),
    words: {
      r0: "The same field transformation in the paper's own units, where the mixing term is the speed over the light speed in both the electric and the magnetic line.",
      r1: "Paper 3 works in Gaussian units, and there the transformation is symmetric between the two fields: each transverse component picks up v over c times the other's. The SI form of the same physics carries v in the electric line and v over c squared in the magnetic one. Nothing physical differs; the unit system moves the factors.",
      r2: "The function computes the factor from v over c and, if that refuses, hands back the input fields with the factor reported as NaN rather than a transformed field it cannot justify. Then each component is written once: the components along the boost pass through, and the four transverse ones mix with vOverC. Compare it line by line with transformSI and the only differences are where the c's sit.",
      r3: "The identifier holding the Lorentz factor in this function is the Greek letter beta, which is the paper's own letter for it. A modern reader expects beta to mean v over c, and in this file that ratio is called vOverC. The site keeps the printed letter in the historical function and the modern letter in the SI one, and the notation concordance records the collision; reading this beta as v over c would invert the whole transformation.",
    },
    liveTerms: [
      "electricFieldStationary",
      "magneticFieldStationary",
      "frameSpeed",
      "lorentzFactor",
    ],
    identifierBindings: [
      bind("transformGaussianHistorical", "E", "electricFieldStationary"),
      bind("transformGaussianHistorical", "B", "magneticFieldStationary"),
      bind("transformGaussianHistorical", "v", "frameSpeed"),
      bind("transformGaussianHistorical", "β", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-11",
    kernel: tsRef("src/physics/reference/waves.ts", "evaluateSr11"),
    words: {
      r0: "Light reflected from a moving mirror: the frequency it comes back with, the angle it leaves at, the pressure it exerts, and the power it carries, each with its own status.",
      r1: "The laboratory's evaluator for § 8's moving mirror. It takes the mirror's speed, the angle of incidence, the incident energy density and the mirror's area, and returns the frequency ratio, the cosine and degrees of the reflected angle, the amplitude ratio, the radiation pressure and force, the incident and reflected powers, the rate at which the light does work on the mirror, and the residual by which the energy account fails to balance. In the mirror's own rest frame it reports no work and equal powers, which is the check that the two descriptions agree.",
      r2: "Three refusals, and they are three different facts. A speed at or beyond the light speed is OUTSIDE-DOMAIN with the boundary named. An angle whose cosine is within tolerance of the mirror's speed is INDETERMINATE, because that is exactly the interception boundary and the classification itself is in doubt. An angle whose cosine is at or below the mirror's speed is NOT-APPLICABLE, with the reason that the light never reaches the receding mirror: the mirror is outrunning it. Only past all three does the function compute, and even then the energy-balance residual is returned rather than asserted to be zero, so a reader can see how well the account closes instead of being told that it does.",
      r3: "The condition that the light must overtake the mirror is the paper's own: § 8's reflection formulas hold where the cosine of the angle of incidence exceeds the mirror's speed over the light speed, and the site refuses rather than extrapolating past it.",
    },
    liveTerms: ["radiationForce", "incidentPower"],
    identifierBindings: [
      bind("evaluateSr11", "beta", "frameSpeed"),
      bind("evaluateSr11", "radiationForce", "radiationForce"),
      bind("evaluateSr11", "incidentPower", "incidentPower"),
    ],
    independentReferences: [],
  },

  // LQ-01, LQ-05, LQ-06 and LQ-09 (am-f3e4, dispatch 329). The light-quanta family had no entries
  // at all, so all four labs mounted the panel for the first time in this commit.
  //
  // ON THE MODULE PATHS. The lq-01 and lq-05 manifests declare the barrel
  // src/physics/reference/radiation.ts; the entries below name the file the function is actually
  // written in. Measured: extraction through the barrel and through the file return the same
  // source, the same hash and the same line numbers, so the only difference is what the panel
  // points a reader at and how wide the closure pin is. The barrel's closure is 20 modules,
  // including constants.ts and philox.ts; waves.ts is 6 and configurations.ts is 9. lq-06 and
  // lq-09 name real files in their manifests already and are unchanged here.
  //
  // ON LIVE TERMS. Eleven of the quantityIds these four manifests use are not registered
  // (phaseAngle, visibility, fringeSpacing, dimensionlessRatio, lnW, sampleFraction, trialCount,
  // meanEnergyRatio, gasEntropy, absorptionEfficiency, duration), so nothing below binds them:
  // a live term that is not an exact canonical quantity id is a compiler rejection, not a near
  // miss. lq-01's phase control and its fringe-spacing readout are the notable absences.
  {
    instrumentId: "lq-01",
    kernel: tsRef("src/physics/reference/radiation/waves.ts", "twoSourceIntensity"),
    words: {
      r0: "Two coherent sources, and the brightness where their waves meet: either the steady reading a detector settles to, or the square of the field at one instant.",
      r1: "Each source contributes an amplitude that falls as one over its distance, a1 = A1/r1 and a2 = A2/r2. The time-averaged reading is a1 squared plus a2 squared plus 2 a1 a2 cos(delta), and that last cross term is the whole of interference: it adds at delta = 0 and cancels the rest at delta = pi. The phase difference comes from the path difference, k(r1 - r2), unless the caller supplies one. Given an absorption coefficient kappa the answer is in watts per square metre; without one it is normalized to what a single source would average.",
      r2: "The instantaneous branch returns twice the square of the field, not the square, and the reason is that the two readouts have to agree. Average psi = a1 cos(phi) + a2 cos(phi + delta) over a period and you get half of (a1 squared + a2 squared + 2 a1 a2 cos delta), which is half what the time-averaged branch reports, so doubling the instantaneous square makes the average of the instant equal the average the other branch gives. The comments in the source record that it was once the plain square, which peaked at 4 for two unit waves in phase, exactly the number the averaged branch returns, and then averaged to half of it. They record the other half of the same repair too: the instantaneous branch used to take delta from the geometry alone, so at r1 = r2 a caller-set delta of pi read dark on average and bright at t = 0.",
    },
    liveTerms: ["radiationElectricField", "wavelength", "incidentPower"],
    identifierBindings: [
      bind("twoSourceIntensity", "A1", "radiationElectricField"),
      bind("twoSourceIntensity", "A2", "radiationElectricField"),
      bind("twoSourceIntensity", "wavelength", "wavelength"),
      bind("twoSourceIntensity", "intensity", "incidentPower"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-01",
    kernel: tsRef("src/physics/reference/radiation/waves.ts", "inverseSquareIntensity"),
    // One sentence is the whole truth: a division, and two refusals before it.
    words: words(
      "Divide the source's power by the area of the sphere the light has reached, 4 pi r squared, and refuse before dividing: a radius at or below zero and a negative power each return a typed outside-domain result quoting the value that was passed.",
    ),
    liveTerms: ["incidentPower", "displacement1d"],
    identifierBindings: [
      bind("inverseSquareIntensity", "P", "incidentPower"),
      bind("inverseSquareIntensity", "r", "displacement1d"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-01",
    kernel: tsRef("src/physics/reference/radiation/waves.ts", "shellPowerIdentity"),
    words: {
      r0: "Add the intensity up over a whole sphere drawn around the source, and check that what comes back is the power that left it.",
      r1: "The surface integral of I(r) = P / (4 pi r squared) over a sphere of radius r. Substituting mu = cos(theta) turns it into 2 pi r squared times the integral of I over mu from -1 to 1; the function sums that on a uniform grid of twice the order and returns the enclosed power. For any radius it returns P, which is the statement that spreading dilutes the intensity without losing any of the energy.",
      r2: "What this establishes, and what it does not. The integrand does not depend on mu at all, so every node contributes the same I_r times dMu and the sum is exactly twice I_r whatever the node placement is. The comment above the loop names Gauss-Legendre quadrature and the loop is a uniform sum; for a constant integrand those agree, and for an anisotropic source they would not. So this function checks the bookkeeping, the 4 pi r squared of the sphere against the one-over-r-squared of the falloff, rather than the accuracy of any quadrature rule. Passing it is evidence that the area and the falloff cancel, and it is not evidence about integrating a source that shines unevenly.",
    },
    liveTerms: ["incidentPower", "displacement1d"],
    identifierBindings: [
      bind("shellPowerIdentity", "P", "incidentPower"),
      bind("shellPowerIdentity", "r", "displacement1d"),
      bind("shellPowerIdentity", "enclosedPower", "incidentPower"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-01",
    kernel: tsRef("src/physics/reference/radiation/waves.ts", "fringeVisibility"),
    words: {
      r0: "How sharp the fringes are, from the two amplitudes alone: 1 when the waves are equally strong, falling toward 0 as either one takes over.",
      r1: "V = 2 A1 A2 / (A1 squared + A2 squared). This is the contrast a detector reports, the largest intensity minus the smallest over their sum, with the largest (A1 + A2) squared where the waves arrive in step and the smallest (A1 - A2) squared where they arrive opposed: the difference is 4 A1 A2, the sum is twice (A1 squared + A2 squared), and the factor of 2 cancels.",
      r2: "Only the ratio of the amplitudes matters. Write rho = A2/A1 and the expression is 2 rho / (1 + rho squared), which equals 1 at rho = 1 and falls away on either side, so doubling both amplitudes changes nothing and the visibility can never pass 1. The guard returns zero when neither amplitude is positive. The case the arithmetic needs it for is the pair (0, 0), where the quotient would be zero divided by zero, and this laboratory's domain declares both amplitudes non-negative, so that pair is the case the guard meets.",
    },
    liveTerms: ["radiationElectricField"],
    identifierBindings: [
      bind("fringeVisibility", "A1", "radiationElectricField"),
      bind("fringeVisibility", "A2", "radiationElectricField"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-01",
    kernel: tsRef("src/physics/reference/radiation/waves.ts", "fringeSpacingSmallAngle"),
    words: {
      r0: "The distance from one bright fringe to the next: the wavelength times the distance to the screen, divided by the separation of the two sources.",
      r1: "Delta y = lambda D / d, in the small-angle form. The path difference at a point a height y up the screen is taken as d y / D rather than the exact d sin(theta), and the two agree while y stays small against D. All three lengths must be in the same unit, and the answer comes back in that unit.",
      r2: "There is no guard inside the function, and that is a division of labour rather than an omission. A separation of zero would divide by zero and return Infinity; the caller refuses it first, in src/workers/operations/lq01.ts, which tests that the separation is strictly positive and otherwise returns a typed outside-domain result saying that zero separation produces infinite fringe spacing. So the listing shows the arithmetic without the refusal, and the refusal a reader meets on the page lives one call above the code shown here.",
    },
    liveTerms: ["wavelength", "displacement1d"],
    identifierBindings: [
      bind("fringeSpacingSmallAngle", "wavelength", "wavelength"),
      bind("fringeSpacingSmallAngle", "separation", "displacement1d"),
      bind("fringeSpacingSmallAngle", "screenDistance", "displacement1d"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-05",
    kernel: tsRef(
      "src/physics/reference/radiation/configurations.ts",
      "independentPointsProbability",
    ),
    words: {
      r0: "The chance that n independent points are all inside a fraction f of the volume at the same moment: f multiplied by itself n times.",
      r1: "W = f to the n, with f the volume ratio V/V0. The function returns it three ways, because past any interesting n only one of them survives in a double: the plain value, the natural logarithm n ln f, and the base-ten logarithm. The last field, deltaSOverKb, is the entropy change in units of the Boltzmann constant, and it is the same number as ln W, which is Boltzmann's relation and the reason the calculation is here at all.",
      r2: "f to the n underflows quickly, and the three representations are the answer to that. Measured with this function at f = 0.5: n = 100 still returns 7.888609052210105e-31, and n = 1100 returns exactly 0, with linearRepresentable false and log10W = -331.13. That is why the entropy is not computed from the value: the logarithm of a zero is minus Infinity, while n ln f is ordinary arithmetic at any n. Pass f as a pair of bigints and the function also returns the exact rational p to the n over q to the n, which no floating-point path can offer.",
    },
    equationId: "eq-model-lq-configuration-probability",
    liveTerms: ["independentPointCount", "volumeRatio", "configurationProbability"],
    identifierBindings: [
      bind("independentPointsProbability", "n", "independentPointCount", [
        "eq-model-lq-configuration-probability.t.count",
      ]),
      bind("independentPointsProbability", "f", "volumeRatio", [
        "eq-model-lq-configuration-probability.t.fraction",
      ]),
      bind("independentPointsProbability", "value", "configurationProbability", [
        "eq-model-lq-configuration-probability.t.probability",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-06",
    kernel: tsRef("src/physics/reference/radiation/quanta.ts", "effectiveIndependentCount"),
    words: {
      r0: "How many independent things the radiation is behaving like: its energy divided by the energy of one element, E over h nu.",
      r1: "The count paragraph 6 reads off the entropy comparison. Given an energy and a frequency it divides by the element energy and returns the count, that element energy in joules, and the same in electronvolts. The element energy arrives three ways: as a number, which is Einstein's printed R beta nu over N; from a declared constant set; or, with nothing passed, from the modern SI Planck constant.",
      r2: "The count is a real number and is not required to be a whole one. At E = 1e-18 joules and nu = 6.0e14 hertz it returns 2.5153169660702535, with an element energy of 2.4814 electronvolts. What makes that division mean a count is not this line: equate the radiation's entropy change, E over beta nu times ln(V/V0), with a gas's, R over N times n times ln(V/V0), and the exponent n in W = (V/V0) to the n has to be E N over R beta nu, which is E over h nu. The function performs the division; the entropy comparison is what licenses reading it as a number of independent somethings. There is no guard on a zero frequency, which would make the element energy zero and the count Infinity, and this laboratory's frequency domain starts at 1e14 hertz.",
    },
    equationId: "eq-model-lq-effective-count",
    liveTerms: ["radiationEnergy", "frequency", "effectiveIndependentCount", "quantumEnergy"],
    identifierBindings: [
      bind("effectiveIndependentCount", "E", "radiationEnergy", [
        "eq-model-lq-effective-count.t.energy",
      ]),
      bind("effectiveIndependentCount", "nu", "frequency", [
        "eq-model-lq-effective-count.t.frequency",
      ]),
      bind("effectiveIndependentCount", "count", "effectiveIndependentCount", [
        "eq-model-lq-effective-count.t.count",
      ]),
      bind("effectiveIndependentCount", "quantumEnergy", "quantumEnergy"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-06",
    kernel: tsRef("src/physics/reference/radiation/quanta.ts", "meanQuantumEnergyWien"),
    words: {
      r0: "The average energy of one quantum across a whole Wien spectrum at temperature T: three times k_B T, which is twice the average kinetic energy of a gas molecule.",
      r1: "It returns 3 k_B T in joules and electronvolts, beside the resonator energy k_B T and a molecule's 1.5 k_B T, and the ratio of the first to the last, which comes out at exactly 2. At 300 K that is 0.0776 electronvolts against 0.0388. It also returns the ratio of a 600 terahertz quantum's energy to this average, about 32, which says how far an optical quantum sits above the thermal average at room temperature.",
      r2: "The 3 is a ratio of two gamma integrals. Write x = h nu / k_B T; a Wien spectrum puts energy proportional to x cubed times e to the minus x in each interval and quanta proportional to x squared times e to the minus x, so the mean energy per quantum is k_B T times the integral of the first over the integral of the second, which is 6 over 2. The gamma3 and gamma4 helpers below are those integrals up to a finite x in closed form, and the function spends them on the honest part of the answer: the boundary x0 = ln(1/epsilon) is where Wien's form departs from Planck's by more than epsilon, and at the default epsilon of 0.01 it sits at x0 = 4.605. Below that boundary lie 0.675 of the Wien energy and 0.838 of the Wien quanta. The 3 k_B T average is therefore dominated by the frequencies where the stipulated spectrum is outside the regime it was admitted for, which is what the returned modelStatus says in one string.",
      r3: "The paragraph 6 conclusion carries its own parenthesis: monochromatic radiation of low density, within the range of validity of Wien's radiation formula, behaves in thermal respects as if it consisted of mutually independent energy quanta. The shares this function returns are the site's accounting of how much of the spectrum lies outside that range, not a figure the paper computes.",
    },
    liveTerms: ["temperature", "meanQuantumEnergyWien", "boltzmannConstant"],
    identifierBindings: [
      bind("meanQuantumEnergyWien", "T", "temperature"),
      bind("meanQuantumEnergyWien", "kB", "boltzmannConstant"),
      bind("meanQuantumEnergyWien", "meanWienJoules", "meanQuantumEnergyWien"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-09",
    kernel: tsRef("src/physics/reference/photoelectric.ts", "ionizationCount"),
    words: {
      r0: "How many molecules a beam of light can ionize: count the quanta it delivers, and under the paper's hypothesis each absorbed quantum ionizes one molecule.",
      r1: "The evaluator behind this laboratory. It checks the frequency against the ionization energy, resolves the incident and absorbed powers through the absorption efficiency, multiplies the absorbed power by the duration to get the absorbed energy, divides that by h nu for the number of absorbed quanta, and then lets the absorption mode decide what may be said about ionization. Every number it returns carries its own status, so the quanta can be a value on a page where the ionization count is a refusal.",
      r2: "Four exits, and the difference between them is the content of the function. A frequency below the threshold is NOT-APPLICABLE for the ionization count and the gram-molecules, while the incident rate, the absorbed rate and the absorbed quanta stay values: light did arrive, it just cannot ionize, and reporting zero ionizations would have merged those two statements. An absorption mode of unknown is UNDERDETERMINED, and the reason names the bound rather than guessing at a fraction: the count cannot pass the number of absorbed quanta. A declared fraction multiplies that bound and says so. The unqualified hypothesis, every absorbed quantum ionizing one molecule, is the remaining exit and the one the paper argues for, and it returns the count and the gram-molecules divided by the Avogadro constant. Bad inputs, a negative power or an efficiency outside zero to one or a negative duration, are OUTSIDE-DOMAIN before any of that.",
    },
    equationId: "eq-model-lq-ion-count-bound",
    liveTerms: [
      "frequency",
      "ionizationEnergyPerMolecule",
      "incidentPower",
      "quantumEfficiency",
      "absorbedLightEnergy",
      "quantumRate",
      "absorbedQuantumRate",
      "ionizationRate",
      "ionCount",
      "ionizedGramMolecules",
    ],
    identifierBindings: [
      bind("ionizationCount", "nu", "frequency", ["eq-model-lq-ion-count-bound.t.frequency"]),
      bind("ionizationCount", "ionizationEnergyEv", "ionizationEnergyPerMolecule"),
      bind("ionizationCount", "incidentPowerWatts", "incidentPower"),
      bind("ionizationCount", "declaredFraction", "quantumEfficiency"),
      bind("ionizationCount", "lAbs", "absorbedLightEnergy", [
        "eq-model-lq-ion-count-bound.t.absorbed",
      ]),
      bind("ionizationCount", "h", "planckConstant", ["eq-model-lq-ion-count-bound.t.planck"]),
      bind("ionizationCount", "na", "avogadroConstant"),
      bind("ionizationCount", "incQRate", "quantumRate"),
      bind("ionizationCount", "absQRate", "absorbedQuantumRate"),
      bind("ionizationCount", "ionRate", "ionizationRate"),
      bind("ionizationCount", "ionCount", "ionCount", ["eq-model-lq-ion-count-bound.t.ions"]),
      bind("ionizationCount", "jMol", "ionizedGramMolecules"),
    ],
    independentReferences: [],
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
