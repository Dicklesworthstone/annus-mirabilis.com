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
