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

// regimeRelativeErrors is ONE function that three manifests declare (lq-02, lq-03, lq-04), so its
// words are written once here rather than copied into three entries that would then drift apart.
// transformSI is ONE function that two manifests declare (sr-02 and sr-08), so its words are written
// once rather than copied into two entries that would then drift apart.
const TRANSFORM_SI_WORDS = {
  r0: "The electric and magnetic fields as the moving frame measures them: along the motion each is unchanged, across it each mixes with the other.",
  r1: "This is § 6's transformation in modern SI letters. The components along the boost, E sub x and B sub x, pass through untouched. The transverse components mix: the new E sub y is gamma times (E sub y minus v times B sub z), and the new B sub y is gamma times (B sub y plus v times E sub z over c squared). A frame with no electric field at all therefore measures one, which is the whole content of the magnet-and-conductor observation the paper opens with.",
  r2: "The function computes gamma from v over c and, if that refuses, returns the input fields unchanged with gamma reported as NaN rather than inventing a transformed field. Otherwise each component is built once, in the order x, y, z, and the result is frozen so a caller cannot mutate a field it was handed. Note the asymmetry between the two blocks: the electric mixing carries v while the magnetic mixing carries v over c squared. That is not a typo but the SI unit system, and the same physics written in Gaussian units puts v over c in both, which is what transformGaussianHistorical does for the paper's own form.",
} as const;

const REGIME_ERROR_WORDS = {
  r0: "How far Wien's law and the classical law each sit from Planck's at this frequency and temperature, and which of the two is admitted here.",
  r1: "Everything turns on one dimensionless number, x = h nu / (k_B T). Wien's relative error is e to the minus x, so Wien is good where x is large, which is high frequency or low temperature. The classical error is (e^x - 1)/x - 1, which vanishes where x is small. The function returns both errors, the regime they put you in, and the value of x at which each error reaches its tolerance, one per cent by default. Measured at 600 THz and 5800 K: x = 4.96, Wien runs 0.70 per cent below Planck, and the classical law is 27.7 times too large.",
  r2: "The classical error is measured against Planck, the same denominator Wien's error uses, and the comment above it records that it was not always. It was computed as 1 - x/(e^x - 1), which divides the difference by the classical value instead of by Planck's. The two agree to first order at small x, which is exactly where the classical law is used, so the error was invisible wherever anyone looked; at x = 5.76 it read 0.98 while the classical law is about 55 times Planck's value, and it put the one per cent boundary at x = 0.020067 where the owning bead specifies 0.0198678. That boundary is now found by Newton's method on e^x - 1 = (1 + epsilon) x and comes out at 0.019867768. Past x = 700 the exponential leaves binary64 and the classical error is returned as Infinity, which a caller has to put into words rather than print.",
} as const;
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
  // BM-05'S REMAINING FOUR (am-f3e4, 2026-10-06). Its manifest declares eight kernels and four had an
  // entry here. Three of these four are where the walk becomes diffusion and where that passage can
  // fail, and the fourth is the replay that makes an observation at step n repeatable.
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "kernelMoments"),
    words: {
      r0: "The mean, the mean square, the variance and the fourth moment of one step, with a refusal for the step law that has none.",
      r1: "A random walk becomes diffusion because the steps have a finite variance, and this function is where that is checked rather than assumed. For the supported symmetric kernels it returns all four moments with their units, metres and metres squared and metres to the fourth. Ask it for the Cauchy step law and it refuses: that law's variance is not large, it does not exist, and the function returns an outside-domain result under the condition finite-moments rather than a number.",
      r2: "The four are built from one table of names so that each carries its own canonical quantity and unit, and the refusal path builds the same four keys from the same table, so a caller that handles the accepted case field by field cannot be handed an object missing a field. The Cauchy branch is the reason the function exists at all: a sampler can draw Cauchy steps perfectly well, and the sum of those steps does not approach a Gaussian however many are taken, so the quantity a diffusion coefficient would be computed FROM is undefined. Refusing here, at the moments, keeps that fact at the place a reader can see it instead of surfacing later as a diffusivity that will not settle.",
      r3: "Einstein assumes a step distribution with a finite mean square in section 4 and says so in those words, which is the hypothesis this function tests rather than a technicality. The heavy-tailed alternative is Levy's, from the 1920s and 1930s, and it is offered in this instrument as a modern lens: the walk still happens and the central limit theorem does not apply to it.",
    },
    // The four moments are bound through the keys the result object uses for them, which are the only
    // names they have; all four quantities became records on 2026-10-06, which is why this entry had
    // no bindings when it was written. The one parameter is a kernel CHOICE and still has no canonical
    // quantity, which is a kind of thing rather than a gap.
    liveTerms: ["stepMean", "stepSecondMoment", "stepVariance", "stepFourthMoment"],
    identifierBindings: [
      bind("kernelMoments", "mean", "stepMean"),
      bind("kernelMoments", "secondMoment", "stepSecondMoment"),
      bind("kernelMoments", "variance", "stepVariance"),
      bind("kernelMoments", "fourthMoment", "stepFourthMoment"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "continuumLimit"),
    words: {
      r0: "The diffusion coefficient a shrinking step reaches, and a refusal for the way of shrinking it that reaches nothing.",
      r1: "Take the steps smaller and more frequent and the walk approaches diffusion, but only if the two are shrunk together. Holding the step size fixed while the interval shrinks makes the coefficient grow without bound, and the function refuses that request by name, with the condition hold-variance-over-time-fixed and a sentence saying what to do instead. Under the ratio that does work the answer is the step scale squared over twice the interval: a step of one micrometre every millisecond gives 500 square micrometres per second.",
      r2: "The refusal is the whole content of this function and it is deliberately not a clamp or a very large number. Both scalings are arithmetically computable, and one of them has no limit, so returning a figure for it would be a wrong answer dressed as a right one. The guards run in one block before either branch, so a malformed scale and an unsupported scaling name are refused at the same place, and the accepted branch is a single expression. Note that the quantity returned is named continuumDiffusionCoefficient rather than diffusionCoefficient: it is the coefficient of a declared limiting procedure, not a measured property of a liquid, and a plot that mixed the two would be comparing a model choice with an observation.",
      r3: "Section 4 passes from a step picture to the diffusion equation in one move, taking the limit without naming which quantities are held fixed, because in that context only one choice makes sense. Making the choice explicit here is a modern reading, and the reason to do it is that a reader with sliders can make the other choice in two seconds.",
    },
    liveTerms: ["stepRms", "stepInterval", "continuumDiffusionCoefficient"],
    identifierBindings: [
      bind("continuumLimit", "stepScale", "stepRms"),
      bind("continuumLimit", "tau", "stepInterval"),
      // `scaling` selects the limiting procedure and is not a physical quantity, so it has no
      // canonical id to bind to. The coefficient's quantity became a record on 2026-10-06, and it is
      // bound through the function's own name, which is the only identifier that stands for it: the
      // value itself is returned inline.
      bind("continuumLimit", "continuumLimit", "continuumDiffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walkLaws.ts", "kolmogorovShapeTerm"),
    words: {
      r0: "How far the walk's own distribution still is from a Gaussian after this many steps, as the largest gap between the two curves.",
      r1: "The central limit theorem says the gap closes, and this says by how much at a given number of steps. It is the largest vertical distance between the walk's cumulative distribution and the normal one. For the coin kernel it falls off like one over the square root of the number of steps: 0.341 at one step, 0.1875 at four, 0.0398 at a hundred and 0.00399 at ten thousand. Multiply each by the square root of its step count and all of them land near 0.3989, which is one over the square root of two pi, so the approach to a Gaussian is not merely happening, it is happening at a rate that can be quoted. For the Gaussian kernel the distance is exactly zero, and the function says why in one line: a sum of Gaussians is a Gaussian.",
      r2: "The coin branch sums the exact binomial probabilities rather than sampling, so the distance is a property of the distribution and not of a trial. The subtlety is that the walk's distribution has atoms, so its cumulative function jumps, and the largest gap may be on either side of a jump. The loop therefore takes the larger of the gap before adding the atom's probability and the gap after, which is what makes the answer the true supremum rather than one of its one-sided neighbours. The docblock states the matching honesty: the distribution is exact, the evaluated distance is a number computed in floating point, and it is not an interval-arithmetic enclosure of itself.",
      r3: "The theorem is Lindeberg's and Levy's, from the 1920s, and the distance is Kolmogorov's measure from 1933; none of this vocabulary is in the 1905 paper, which asserts the Gaussian form from the independence of the steps and the finiteness of their mean square. The value of the number is that a reader can ask the paper's assumption how fast it becomes true.",
    },
    liveTerms: ["walkStepCount"],
    identifierBindings: [
      bind("kolmogorovShapeTerm", "n", "walkStepCount"),
      bind("kolmogorovShapeTerm", "distance", "kolmogorovDistance"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-05",
    kernel: tsRef("src/physics/reference/diffusion/walks.ts", "observeWalks"),
    words: {
      r0: "The walkers' positions at a chosen step, obtained by replaying the recorded walk rather than by drawing a new one.",
      r1: "Looking at step 400 and then at step 300 must not change what happened. This function answers either question from the same recording: if a checkpoint exists at that step it returns it and reports that nothing was replayed, and otherwise it starts from the nearest earlier checkpoint and replays forward through the recording's own draw engine. It reports how many draws the replay consumed, so the cost of moving the observation point is visible rather than hidden.",
      r2: "Three guards are worth reading. The replay checks that the draws it receives name the same producer as the recording did, and fails rather than continuing if they do not, because a sequence from a different engine would be a different walk presented as the same one. A coordinate that stops being representable fails rather than propagating as an infinity into a plot. And a checkpoint is published only after the whole replay completes, so a cancelled observation leaves no partial milestone behind for the next call to start from. The loop yields to the host every chunk and checks for cancellation on both sides of that yield, which is what lets a reader drag an observation slider without the page stopping, and the chunk size is required to be bounded so that a malformed option cannot make the yield never happen.",
      r3: "Nothing here is in the paper; it is the machinery that makes a reader's observation of a stochastic model repeatable, which the paper does not need because it works with distributions rather than realisations. The rule it implements is this edition's: changing where you look is a measurement change and never a new experiment.",
    },
    liveTerms: [],
    identifierBindings: [bind("observeWalks", "n", "walkStepCount")],
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
  // BM-06'S LAST TWO UNPINNED KERNELS (am-f3e4, 2026-10-06). The manifest declares seven and five had
  // an entry here. These two are the distribution's summary numbers, which is where a reader is most
  // likely to assume one number stands for the spread when three different ones do.
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "mostLikelyRadius2d"),
    words: {
      r0: "The distance from the start a tracer is most often found at, in two dimensions, which is not the average distance and not zero.",
      r1: "In one dimension the most likely position is the starting point. In two it is not: the radial density is r over 2Dt times the falling exponential, so near the start the circumference of available positions is growing from nothing and the product peaks away from zero. Setting the derivative to zero puts the peak at the square root of 2Dt, which is exactly the one-dimensional root-mean-square displacement. The growth of available room and the fall of density cancel there.",
      r2: "The function is a guard and one square root, and the square root is the interesting part: it is computed as the scale helper does it, by the square root of 2 times the square root of D times the square root of t, rather than the square root of their product. That is not style. At D and t both 1e-300 the product underflows to zero and the direct form returns a radius of 0, while the factored form returns 1.4142135623730952e-300; at 1e300 each the product overflows to infinity and the factored form returns 1.4142135623730952e+300. Diffusivities in this edition run around 4e-13 with times a reader may set freely, so the margin matters. There is no three-dimensional counterpart here because the owning bead's specification gives no closed form for it, and inventing one would be a different claim.",
      r3: "Einstein works in one dimension throughout section 4 and asks for the root mean square, not the mode, so this quantity is not in the paper. It is included because the two-dimensional picture is what a reader sees under a microscope, and because the coincidence of the 2D mode with the 1D root mean square is the kind of thing that looks like a mistake until the circumference argument is made.",
    },
    liveTerms: ["diffusionCoefficient", "mostLikelyRadius2d"],
    identifierBindings: [
      bind("mostLikelyRadius2d", "D", "diffusionCoefficient"),
      bind("mostLikelyRadius2d", "t", "observationInterval"),
      // The function's own name standing for its output, the convention gaussianPropagator uses.
      // Withheld on 2026-10-06 while the quantity was undefined; the record exists now.
      bind("mostLikelyRadius2d", "mostLikelyRadius2d", "mostLikelyRadius2d"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-06",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "moments"),
    words: {
      r0: "The four summary numbers of the spread at this time, in one, two or three dimensions, returned together so that none of them can be mistaken for another.",
      r1: "Write sigma for the square root of 2Dt. Then the mean square of a single coordinate is sigma squared whatever the dimension, the mean square distance from the start is d times that, and the root mean square distance is the square root of d times sigma. The mean distance is the one that changes shape with dimension: sigma times the square root of 2 over pi in one dimension, sigma times the square root of pi over 2 in two, and sigma times twice the square root of 2 over pi in three, which are 0.798, 1.253 and 1.596 times sigma. In two dimensions that puts the mode at sigma, the mean at 1.253 sigma and the root mean square at 1.414 sigma: three different distances, all describing the same cloud.",
      r2: "The four are returned in one frozen object on purpose, because the failure this prevents is using one of them where another belongs. Each carries its own canonical quantity, so a plot asking for the mean radial distance cannot be handed the root mean square. The validity guard covers d as well as D and t, and an invalid request returns all four as outside-domain rather than returning some numbers and some refusals, since a caller that got a partial object would have to check each field. The last argument to each make call is D > 0 and t > 0, which marks the degenerate start: at t = 0 every one of the four is legitimately zero and that zero is a limit rather than a measurement, which is a distinction the display needs and the arithmetic cannot carry on its own.",
      r3: "The paper gives one of these four, the root mean square in one dimension, and gives it as the quantity to compare with observation because it is what a series of position readings yields. The mean distance is easier to picture and harder to estimate from data, which is roughly why Einstein does not use it, and the two differ by about a fifth in one dimension.",
    },
    equationId: "eq-model-bm-gaussian-second-moment",
    liveTerms: [
      "meanSquareDisplacement1d",
      "rmsDisplacement1d",
      "meanRadialDistance",
      "meanSquareDisplacement",
      "rmsRadialDistance",
    ],
    identifierBindings: [
      bind("moments", "D", "diffusionCoefficient", [
        "eq-model-bm-gaussian-second-moment.t.diffusivity",
      ]),
      bind("moments", "t", "observationInterval"),
      // s and mean are named locals; marginal, total and rmsRadius are the keys under which each
      // result is both looked up and returned, and are the only names those three have. Declaring a
      // liveTerm the kernel holds in no identifier at all would make this entry fail its own check,
      // which is what the first draft of it did.
      bind("moments", "s", "rmsDisplacement1d"),
      bind("moments", "marginal", "meanSquareDisplacement1d"),
      // These three were withdrawn on 2026-10-06 because content/quantities defined none of their
      // quantities, and they return now that it does. mean and s are named locals; marginal, total
      // and rmsRadius are the keys under which each result is both looked up and returned, and are
      // the only names those three have.
      bind("moments", "mean", "meanRadialDistance"),
      bind("moments", "total", "meanSquareDisplacement"),
      bind("moments", "rmsRadius", "rmsRadialDistance"),
    ],
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
    instrumentId: "me-01",
    kernel: tsRef("src/physics/reference/massEnergy.ts", "initializeMassEnergyLedger"),
    words: {
      r0: "The four body energies, kept as symbols: this is the function that refuses to give them a number.",
      r1: "Before and after the emission, in each of the two frames, the body has an energy nobody has measured. This function names all four of them, E0 and E1 in the rest frame and H0 and H1 in the moving frame, and returns each as a symbol rather than a value. Naming them is what lets the subtraction remove them.",
      r2: "It also refuses, and the refusal is the point. Handed an absolute rest energy it throws absolute-energy-not-admitted, whether that energy arrives as a number in the historical model or as an expression that already contains the mass times the square of the speed of light. A ledger seeded that way would assume the very thing the paper derives, so the function will not build one.",
    },
    liveTerms: [
      "bodyEnergyRestBefore",
      "bodyEnergyRestAfter",
      "bodyEnergyMovingBefore",
      "bodyEnergyMovingAfter",
    ],
    identifierBindings: [
      bind("initializeMassEnergyLedger", "restBodyBefore", "bodyEnergyRestBefore"),
      bind("initializeMassEnergyLedger", "restBodyAfter", "bodyEnergyRestAfter"),
      bind("initializeMassEnergyLedger", "movingBodyBefore", "bodyEnergyMovingBefore"),
      bind("initializeMassEnergyLedger", "movingBodyAfter", "bodyEnergyMovingAfter"),
    ],
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
      bind("evaluateMe02", "gamma", "lorentzFactor"),
      bind("evaluateMe02", "massChangeSigned", "massChangeSigned"),
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
      bind("evaluateMe03", "massChange", "massChangeSigned"),
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
  // THE LAST FOUR DECLARED KERNELS IN THE REPOSITORY WITH NO CATALOGUE ENTRY (am-f3e4, 2026-10-06).
  // Three belong to SR-04's constraint engine, which is where the transformation is DERIVED rather
  // than used, and one is SR-03's simultaneity verdict. With these, every kernel any manifest declares
  // can show a reader its source.
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics.ts", "boostMatrixXT"),
    words: {
      r0: "The transformation written as a two-by-two table of coefficients, which is the form that makes its one defining property visible.",
      r1: "Put the transformation of x and t side by side and it is a matrix: gamma on the diagonal, minus gamma v in one corner and minus gamma v over c squared in the other. Its determinant is 1, exactly, at every speed, which is the statement that the transformation preserves areas in the x-t plane. Its two eigenvalues are the square roots of (1 minus beta) over (1 plus beta) and its reciprocal, and at 0.6 c those come out as exactly one half and exactly two: the directions along the two light rays are stretched and squeezed by reciprocal factors, and their product being 1 is the determinant again.",
      r2: "The function refuses before it computes, and the first refusal is the interesting one: in the 1904 mode it declines outright, because a matrix is a modern surface rather than something available on the shelf this edition's discovery route is built from. Only then are gamma and c checked, gamma returning its own refusal for a speed at or past light. The matrix itself is built by a private helper so that the SAME layout is used wherever a boost is composed, which is what lets composeBoosts multiply two of them and read a composite gamma out of the product's first entry; if this function returned a differently arranged table, that extraction would be reading the wrong slot.",
      r3: "Einstein writes section 3's result as four equations, not as a matrix, and the matrix form is Minkowski's way of seeing it from 1908. Keeping it behind a 1904-mode refusal is the edition's rule that modern notation and modern knowledge are separate choices: a reader may have the matrix, and a reader reconstructing the 1904 desk may not be handed it as though it were available.",
    },
    liveTerms: ["frameSpeed", "lorentzFactor", "speedOfLight"],
    identifierBindings: [
      bind("boostMatrixXT", "beta", "frameSpeed"),
      bind("boostMatrixXT", "c", "speedOfLight"),
      bind("boostMatrixXT", "g", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics/constraints.ts", "checkCandidateMap"),
    words: {
      r0: "A proposed set of transformation coefficients measured against each requirement in turn, so a reader can see which one a guess breaks.",
      r1: "Offer four numbers for the transformation and this says how far each requirement is from being met. Light moving right must still move at c, light moving left must too, and the transformation must be reciprocal, which for the longitudinal coefficient means its square times (1 minus beta squared) equals 1. Each requirement comes back as a residual, zero when it holds, so a guess is not simply wrong but wrong by an amount and in a named way. Put gamma in for that coefficient and the reciprocity residual is exactly zero.",
      r2: "Returning residuals rather than booleans is the whole design. A reader moving a coefficient by hand needs to know whether they are approaching a constraint or leaving it, which a true-or-false answer cannot say, and the sign tells them which side they are on. allHold is derived from the residuals rather than computed separately, so it cannot disagree with them. identifiesLongitudinalScale is reported apart from the rest because the light-speed conditions alone do not fix that coefficient: they leave a one-parameter family, and saying so is the point of the instrument rather than a limitation of it.",
      r3: "This is section 3's argument taken apart. Einstein imposes the requirements in prose and arrives at the coefficients; here the requirements are separate dials and the coefficients are the reader's to propose, which is a reconstruction and is labelled as one. The family that the light conditions leave open is what Einstein closes with his reciprocity and isotropy arguments, and a reader who has watched the residual for that one requirement refuse to vanish has met the step the paper spends a paragraph on.",
    },
    liveTerms: ["frameSpeed", "transformationCoefficientA"],
    identifierBindings: [
      bind("checkCandidateMap", "v", "frameSpeed"),
      bind("checkCandidateMap", "a", "transformationCoefficientA"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-04",
    kernel: tsRef("src/physics/reference/kinematics/constraints.ts", "solveCandidateFamily"),
    words: {
      r0: "With the requirements a reader has switched on, what the transformation is forced to be, and what is left free.",
      r1: "Switch on a subset of the requirements and this reports which transformations still satisfy them. With all of them on, one answer survives and it is Einstein's. With the reciprocity requirement off, a whole family survives, and the instrument says so rather than quietly picking a member of it. Hand it a candidate instead and it reports that candidate's residuals, which is the other way of asking the same question.",
      r2: "The two modes come back under different statuses, residual-report for a candidate and the solved family otherwise, so a caller cannot mistake one for the other. Both are preceded by the same two refusals, and the second is a model statement rather than an arithmetic one: a non-finite v is a malformed request, while a speed at or past light has no inertial observer at all and refuses under its own code. The enabled requirements arrive as a list and are turned into a set once, so switching the same one on twice cannot count twice toward whatever is forced.",
      r3: "A reader can switch off a requirement Einstein never states as separable and watch a family appear, which is the fair-hearing rule in working form: the alternatives are not foolish, they are underdetermined, and the paper's result is what the full set of requirements forces rather than the only coherent thing anyone could have written.",
    },
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("solveCandidateFamily", "v", "frameSpeed"),
      bind("solveCandidateFamily", "transverseScale", "transformationCoefficientA"),
    ],
    independentReferences: [],
  },
  // SR-03'S classifySimultaneity, pinnable since the two extractors were made to agree. It had been
  // withheld because verify.ts pinned with extractTypeScriptExport and compared against HEAD with
  // extractTypeScriptFromText's default, which drops overload signatures, so a pin on an overloaded
  // export could never match: 337-428 against 352-428 here, and 608-668 against 613-668 for
  // redescribe beside it. The comparison now opts into the same node selection as the pin.
  {
    instrumentId: "sr-03",
    kernel: tsRef("src/physics/reference/events.ts", "classifySimultaneity"),
    words: {
      r0: "Whether two events happen at the same time, answered with the tolerance named rather than assumed, and answered again for an observer in motion.",
      r1: "Two readings are simultaneous when their difference is zero, and no measurement gives exactly zero, so the question cannot be answered without a tolerance. This function takes one and reports the verdict against it, and in its fullest form it takes two events and a boost and reports what the moving observer finds. That is section 2's content: the same pair of events may be simultaneous for one observer and ordered for another, and which of them comes first can depend on who is asking.",
      r2: "The three signatures are one function because they are one question asked with more or less information: a single time difference, two readings with a tolerance, or two events under a boost. Keeping them together means the tolerance is handled in one place rather than in three, and the overloads make a caller say which question they are asking instead of passing a sentinel. A verdict near the tolerance is reported as near it rather than resolved to one side, because a function that rounded there would be making the reader's judgement for them about whether their clocks can tell. The signatures are part of what this panel shows, which is not incidental: they are how the function says that the three questions are different, and for a while they were also the reason it could not be pinned.",
      r3: "Section 2 defines simultaneity by a light-signal convention and then shows that observers in relative motion disagree about it. Nothing in the paper mentions a tolerance, because it reasons about exact coordinates; a reader with sliders has numbers instead, and the tolerance is where that difference lives rather than something the physics supplies.",
    },
    liveTerms: ["coordinateTimeStationary", "coordinateTimeMoving"],
    identifierBindings: [
      bind("classifySimultaneity", "timeA", "coordinateTimeStationary"),
      bind("classifySimultaneity", "timeB", "coordinateTimeMoving"),
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
      bind("dilationLossPerSecond", "beta", "frameSpeed"),
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
  // SR-05'S REMAINING FOUR KERNELS (am-f3e4, 2026-10-06). The manifest declares six and only two had
  // an entry here, so four of the six were pinned by nothing and shown to nobody. Together they are
  // the whole of section 4: a clock's own tick, a worldline's accumulated proper time, the lag at
  // reunion against the paper's printed estimate of it, and that estimate read backwards.
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/experiments/sr05/worldline.ts", "lightClockTicks"),
    words: {
      r0: "One tick of a clock made from a light pulse bouncing across the motion, timed by the clock itself and then by the system it moves through.",
      r1: "Give the arm a length in light-seconds and the light's own round trip takes twice that, because in those units c is one light-second per second exactly. That is the proper tick, and it does not depend on the speed: the clock is not aware of its motion. Timed by the stationary system the same tick takes gamma times longer, since the pulse must travel a longer slanted path to return to a mirror that has moved on. At an arm of one light-second and a speed of 0.6 c the proper tick is 2 seconds and the coordinate tick is 2.5, because gamma is 1.25.",
      r2: "Choosing light-seconds for the arm is what removes c from the arithmetic, and it is the reason this function has two lines of algebra rather than four. The guard on the arm is separate from the guard on the speed and comes first: an arm that is not a finite positive number is a malformed request, while a speed at or past c is a request outside the model, and gamma returns that refusal itself rather than having it restated here. The transverse arrangement is not incidental. A clock whose arm lies along the motion would need the length contraction as well, and the two effects would have to be disentangled before the tick could be read; across the motion the arm's length is the same in both systems and the slanted path is the whole of the effect.",
      r3: "Einstein does not build a light clock. The device is a later teaching instrument, usually credited to the 1960s textbooks, and it is offered here as a picture of the result rather than as the paper's argument: section 4 gets the same gamma from the transformation of section 3 directly, without a mechanism. What the picture adds is that nothing about the clock's construction matters, which is the step a reader often wants and the paper leaves implicit.",
    },
    equationId: "eq-model-sr-time-dilation",
    liveTerms: ["properTimeElapsed", "eventSeparationTemporalStationary", "lorentzFactor"],
    identifierBindings: [
      bind("lightClockTicks", "armLengthLs", "lengthProper"),
      bind("lightClockTicks", "properTick", "properTimeElapsed"),
      bind("lightClockTicks", "coordinateTick", "eventSeparationTemporalStationary", [
        "eq-model-sr-time-dilation.t.factor",
      ]),
      bind("lightClockTicks", "beta", "frameSpeed"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/experiments/sr05/worldline.ts", "properTimeAlongLegs"),
    words: {
      r0: "A clock carried along a path of straight segments, and how much less time it records than the system it travelled through.",
      r1: "Each leg contributes its full duration to the coordinate time and its duration divided by gamma to the proper time. The sum is the whole content: proper time is not a property of the two endpoints but of the path between them, and a path that spends longer at speed records less. Two legs of one second each at 0.6 c give a coordinate time of 2 seconds and a proper time of 1.6.",
      r2: "The durations are coordinate durations, which is what makes the sum a simple one. Each leg's gamma is computed from that leg's own beta, so a path may change speed as often as it likes, and a refusal from any leg's gamma is returned at once rather than after the remaining legs are added, so a partial sum is never reported as a total. An empty list refuses rather than returning zero: a worldline with no legs has no proper time to report, and a zero would be read as a clock that recorded nothing. Nothing here requires the path to return to where it started, which is why the reunion case is a separate function rather than an option on this one.",
      r3: "Section 4 treats one clock moved along a closed polygonal path and states the result for a slowly travelled curve as the limit of such paths. This function is that polygon, with the limit left to the caller. Einstein's own closing remark, that a clock at the equator runs slow compared with one at the pole, is the one place the paper applies it to the world, and it is wrong for a reason outside the 1905 theory: the two clocks also sit at different gravitational potentials, which the general theory supplies and this function does not model.",
    },
    equationId: "eq-model-sr-transported-clock",
    liveTerms: ["properTimeElapsed", "coordinateTimeStationary", "lorentzFactor"],
    identifierBindings: [
      bind("properTimeAlongLegs", "properTime", "properTimeElapsed"),
      bind("properTimeAlongLegs", "coordinateTime", "coordinateTimeStationary"),
      bind("properTimeAlongLegs", "g", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/experiments/sr05/worldline.ts", "reunionComparison"),
    words: {
      r0: "The two clocks compared when the travelling one gets back, with the paper's own small-speed estimate of the lag printed beside the exact one.",
      r1: "The travelling clock's reading is the proper time along its path and the stationary clock's is the coordinate time, so the lag is the difference. The function also accumulates what section 4 prints: half of beta squared per second, summed leg by leg. The two are not the same number and the panel shows both. For two legs of one second at 0.6 c the exact lag is 0.4 seconds and the printed estimate is 0.36, so the paper's form understates the lag by exactly a tenth of it at that speed. At any speed a clock has ever actually been carried the two agree far beyond measurement.",
      r2: "The exact lag is taken as coordinate time minus proper time, both already summed by properTimeAlongLegs, rather than accumulated as a third running total: one subtraction of two quantities that differ by a visible amount is safe, where summing many small per-leg differences would not be. The printed estimate is accumulated separately and per leg, because half of beta squared is a rate and each leg has its own beta. travelingProperTime and stationaryProperTime are both returned even though the second equals coordinateTime, which is deliberate: the reader is comparing two CLOCKS, and naming one of them the coordinate time would hide that a clock at rest in the system reads it.",
      r3: "The paper states the lag for a closed path and calls the travelling clock's loss half of (v over V) squared per second, neglecting fourth-order and higher magnitudes. Keeping that form beside the exact one is the point of this function: the approximation is Einstein's, not an artefact, and seeing where it departs is how a reader learns what neglecting fourth order buys and costs. The experiment that settled it is Hafele and Keating's in 1971, flying caesium clocks around the world, which is later evidence and labelled as such wherever this instrument cites it.",
    },
    equationId: "eq-model-sr-transported-clock",
    liveTerms: ["properTimeElapsed", "coordinateTimeStationary"],
    identifierBindings: [
      bind("reunionComparison", "travelingProperTime", "properTimeElapsed"),
      bind("reunionComparison", "coordinateTime", "coordinateTimeStationary"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-05",
    kernel: tsRef("src/physics/reference/kinematics.ts", "speedForDailyLoss"),
    words: {
      r0: "The question asked backwards: how fast would a clock have to travel to lose this much in a day.",
      r1: "Fix the loss as a fraction of a day and the speed follows. If a clock loses a fraction L of each second then one over gamma is 1 minus L, so beta squared is 2 L minus L squared. Losing one second per day is a fraction of about 1.157 parts in a hundred thousand, and the speed that does it is 0.00481 c, which is about 1442 kilometres per second. That is the arithmetic that makes the effect feel remote: a clock in low orbit moves at a fortieth of that.",
      r2: "The inversion is exact, not the paper's second-order form read backwards, and the way it is written is the reason. Solving 1 over gamma equals 1 minus L gives beta squared equals 1 minus (1 minus L) squared, and for a small L those two squares agree to most of their digits, so that subtraction throws them away. Expanding it by hand to 2 L minus L squared leaves no near-equal subtraction at all. Measured at one second per day the naive form returns 2.3148014188900667e-5 and this one returns 2.3148014188957476e-5, so about four digits were being lost. The guards bracket the question rather than the answer: a loss must be positive and less than a whole day, and the resulting beta squared must land strictly inside zero and one, which catches the case where a loss inside a day still asks for a speed at or past light.",
    },
    equationId: "eq-model-sr-slow-clock",
    liveTerms: [],
    identifierBindings: [],
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
      bind("composePrinted", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  // TWO MORE OF SR-06'S KERNELS, BOTH OF WHICH IT CALLS AND NEITHER OF WHICH HAD AN ENTRY HERE, so
  // neither could be pinned and neither appeared in show-the-code (am-f3e4, am-1nnj, 2026-10-06).
  // transformVelocity was not even declared in the manifest until 70687812, which is why four
  // velocity-component live terms resolved to nothing while the function computing them was invisible.
  {
    instrumentId: "sr-06",
    kernel: tsRef("src/physics/reference/kinematics.ts", "transformVelocity"),
    words: {
      r0: "A particle's velocity as the moving frame measures it: the component along the motion changes by one rule, the two across it by another.",
      r1: "This is section 5 read as a transformation rather than as a formula for one speed. Given a velocity in the stationary system K and a frame moving at v along x, the new component along x is (u sub x minus v) divided by (1 minus u sub x v over c squared). The two transverse components are divided by that SAME denominator and then by gamma as well. The asymmetry is the whole content: the longitudinal direction carries no gamma and the transverse directions each carry one, so a velocity that was purely across the motion acquires a component along it and shrinks in the direction it had. Take a light ray travelling along y in K and boost at 0.6 c: in the moving frame its components are minus 0.6 c and 0.8 c, because gamma is 1.25 and one over gamma is exactly 0.8, and the speed is the square root of 0.36 plus 0.64, which is c again.",
      r2: "The order of the guards is the argument. Gamma is computed first and its refusal returned unchanged, so a frame speed at or past c never reaches the arithmetic. Then every component and c are checked finite with c positive, which is a malformed request rather than an unphysical one. Then the particle's own speed is measured with Math.hypot and refused if it EXCEEDS c, which deliberately admits a speed of exactly c: light has to be transformable, and the ray above is the case that would break if the test were not strict. Only then is v formed as beta times c, and the denominator 1 minus u sub x v over c squared; a vanishing denominator is refused rather than returned as an infinity. The transverse components divide by gamma times the denominator in one step rather than twice in sequence, so there is one rounding instead of two. Note that the returned object's keys are ux, uy and uz, the components in the MOVING system, while the same three names read off the argument u are the components in the stationary one; the colours in this panel follow the returned values.",
      r3: "Einstein writes the stationary system K and the moving one k, with the moving coordinates named xi, eta and zeta, and he presents section 5 as the composition of two velocities rather than as a coordinate transformation of one. The two statements are the same arithmetic. The transverse rule is where the later textbook treatment and the printed one diverge in appearance: a modern presentation usually writes the factor as one over gamma times the denominator, which is what this function computes, while the paper arrives at the composed speed directly.",
    },
    equationId: "eq-model-sr-velocity-x",
    liveTerms: [
      "velocityComponentXMoving",
      "velocityComponentYMoving",
      "frameSpeed",
      "speedOfLight",
    ],
    identifierBindings: [
      bind("transformVelocity", "ux", "velocityComponentXMoving", [
        "eq-model-sr-velocity-x.t.uxMoving",
      ]),
      bind("transformVelocity", "uy", "velocityComponentYMoving"),
      bind("transformVelocity", "beta", "frameSpeed", ["eq-model-sr-velocity-x.t.speed"]),
      bind("transformVelocity", "c", "speedOfLight", ["eq-model-sr-velocity-x.t.light"]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-06",
    kernel: tsRef("src/physics/reference/kinematics.ts", "composeBoosts"),
    words: {
      r0: "Two frame changes applied one after the other, and what is left over when the result is written as a single frame change.",
      r1: "Multiply the two boost matrices and the product is not, in general, a boost. It is a boost followed by a rotation of the spatial axes, and this function separates them. The composite gamma is the product's first entry, the composite velocity is read from its first column divided by that gamma, and dividing the product by the boost those numbers describe leaves the rotation. For two boosts along the same line the rotation is the identity and the composite speed is the collinear composition: 0.6 c with 0.6 c gives 15 over 17, which is the 0.8823529411764706 this instrument's own trace row shows. For boosts at an angle the rotation is real, and its angle is what the panel reports as the Wigner angle.",
      r2: "The extraction is deliberately indirect. Nothing reads a velocity out of the product matrix by name; the first column is used because for a pure boost that column is gamma times (1, minus beta), so dividing by the 00 entry recovers minus beta and the three components are negated back. The sign is the part worth reading twice. Before any of that the 00 entry is checked to be finite and at least 1, since a product that is not a Lorentz boost block has no composite gamma to report, and the two boosts are required to share one value of c, which is a malformed request rather than a physical limit. generalBoost is then asked to build a boost from those components, and its refusal is returned unchanged rather than repaired, so a composition that lands at or past c refuses where the single boost would. The rotation is obtained from the product and the INVERSE of the extracted boost, which is why inverseBoost is called at all.",
      r3: "The rotation has no counterpart in the 1905 paper, which composes collinear velocities and does not treat the general case. It is Wigner's, from 1939, and it is included here as a modern lens rather than as part of the paper's argument: the point a reader can take back to section 5 is that the collinear case Einstein treats is exactly the case where the rotation vanishes.",
    },
    liveTerms: ["frameSpeed", "lorentzFactor"],
    identifierBindings: [
      bind("composeBoosts", "g", "lorentzFactor"),
      bind("composeBoosts", "speed", "frameSpeed"),
      bind("composeBoosts", "c", "speedOfLight"),
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
      r2: "The refusals come first and they are different facts: a nonfinite time is a malformed request, while a reception at or before its emission is a request outside the model, and each returns its own code. Then assignedRemoteTime is (emissionTimeA + receptionTimeA) / 2, and roundTripSpeedLsPerS is twice the separation over the elapsed round trip, which is a speed the definition does not assume but measures. equalsC compares that speed with c to within 10^-9 rather than testing equality of floating-point numbers. criterionOffset is computed and returned even though the construction forces it to zero, because a reader should be able to watch it stay zero rather than be told it does.",
      r3: "The one-way speed is not measured here and cannot be: § 1 makes the equality of the two legs a stipulation, and this function computes what follows from that stipulation. What it measures is the round trip, which is what experience fixes.",
    },
    liveTerms: [],
    identifierBindings: [
      bind("synchronizationRound", "emissionTimeA", "signalDepartureTimeA"),
      bind("synchronizationRound", "receptionTimeA", "signalReturnTimeA"),
      bind("synchronizationRound", "assignedRemoteTime", "signalReflectionTimeB"),
    ],
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
    words: TRANSFORM_SI_WORDS,
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
      bind("evaluateSr11", "c", "speedOfLight"),
      bind("evaluateSr11", "incidentAngleRad", "propagationAngleStationary"),
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
      r2: "f to the n underflows quickly, and the three representations are the answer to that. Measured with this function at f = 0.5: n = 100 still returns 7.888609052210105 times 10^-31, and n = 1100 returns exactly 0, with linearRepresentable false and log10W = -331.13. That is why the entropy is not computed from the value: the logarithm of a zero is minus Infinity, while n ln f is ordinary arithmetic at any n. Pass f as a pair of bigints and the function also returns the exact rational p to the n over q to the n, which no floating-point path can offer.",
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
      r2: "The count is a real number and is not required to be a whole one. At E = 10^-18 joules and nu = 6.0 times 10^14 hertz it returns 2.5153169660702535, with an element energy of 2.4814 electronvolts. What makes that division mean a count is not this line: equate the radiation's entropy change, E over beta nu times ln(V/V0), with a gas's, R over N times n times ln(V/V0), and the exponent n in W = (V/V0) to the n has to be E N over R beta nu, which is E over h nu. The function performs the division; the entropy comparison is what licenses reading it as a number of independent somethings. There is no guard on a zero frequency, which would make the element energy zero and the count Infinity, and this laboratory's frequency domain starts at 10^14 hertz.",
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

  // LQ-02, LQ-03, LQ-04 and LQ-07 (am-f3e4, dispatch 333). This closes the light-quanta family:
  // all nine instruments now have entries, and none of these four labs mounted the panel before.
  //
  // TWO BINDINGS DELIBERATELY NOT MADE, both for the same reason. radiationEntropyVolumeChange
  // returns a field NAMED effectiveIndependentCount whose value is E/(B nu) in J/K, which
  // content/quantities/radiation.yaml defines as entropyVolumeCoefficient while saying of the
  // count that it "stays dimensionless and never carries the J/K value". The identifier is bound
  // to the quantity it holds, not the quantity it is named after; src/experiments/lq04/session.ts
  // already relabels the field and computes the true count itself. And fluorescenceBudget's e1J
  // and e2J are both quanta energies, but binding both to quantumEnergy would merge the absorbed
  // and emitted quantum into one colour, which is the collapse the incidentFrequency record warns
  // against, so neither is bound and the two frequencies carry the distinction.
  //
  // independentReferences is [] on all sixteen, as on every entry above. The lq-03 and lq-04
  // manifests declare references into content/verification/, a directory that does not exist.
  {
    instrumentId: "lq-02",
    kernel: tsRef("src/physics/reference/radiation/classical.ts", "meanResonatorEnergy"),
    words: {
      r0: "The average energy of one resonator at temperature T: k_B times T, and nothing else in it.",
      r1: "The classical equipartition result, returned in joules and in electronvolts, with the ratio to a free molecule's average kinetic energy beside it. At 300 K it is 4.141947 times 10^-21 J, which is 0.025852 eV. The function takes the Boltzmann constant from the declared set rather than a literal, so a historical set gives Einstein's printed R over N instead.",
      r2: "The ratio it returns is 2/3, and the 2 and the 3 come from different places. A free molecule has three directions to move in and gets half of k_B T for each, so 1.5 k_B T. A resonator has one direction, but it stores energy twice over, half in motion and half in the spring, so the two halves make one whole k_B T rather than a half. The quotient of those is 2/3, written as a literal in the return with the arithmetic in a comment beside it. The number is not measured here and is not fitted; it is what equipartition asserts, which is the assertion the rest of this laboratory tests against a spectrum.",
    },
    liveTerms: ["temperature", "meanResonatorEnergy", "boltzmannConstant"],
    identifierBindings: [
      bind("meanResonatorEnergy", "T", "temperature"),
      bind("meanResonatorEnergy", "kB", "boltzmannConstant"),
      bind("meanResonatorEnergy", "energyJoules", "meanResonatorEnergy"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-02",
    kernel: tsRef("src/physics/reference/radiation/classical.ts", "classicalCutoffEnergyDensity"),
    words: {
      r0: "How much energy the classical rule puts below a chosen frequency: it grows as the cube of that frequency, so the answer is as large as the cutoff you allow.",
      r1: "U = (8 pi k_B T / 3 c^3) times the cube of the cutoff frequency, which is the Rayleigh-Jeans density integrated from zero up to that cutoff. At a cutoff of 10^15 Hz and 5800 K it returns 24.898 J/m^3. Doubling the cutoff multiplies it by eight, and that is the whole of the difficulty: there is no frequency at which the classical allocation stops adding energy.",
      r2: "Three refusals, and the third one is a different KIND of refusal from the other two. A cutoff at infinity and a cutoff at or below zero are physical refusals, as is a nonpositive temperature. The third fires after the arithmetic: the cube carries the product past the largest number a double can hold, so the result is checked for finiteness and refused with domainKind numerical rather than physical, saying that the value is larger than this calculation can represent and naming the cube as the reason. Measured: a cutoff of 5.6 times 10^102 Hz still returns 4.37 times 10^264, and 10^103 Hz refuses. Returning the infinity instead printed 'Infinity J/m3' on this page with a NaN share beside it, which is a statement about binary64 dressed as a statement about radiation.",
    },
    equationId: "eq-model-lq-cutoff-total",
    liveTerms: [
      "frequency",
      "temperature",
      "energyDensityBelowCutoff",
      "boltzmannConstant",
      "speedOfLight",
    ],
    identifierBindings: [
      bind("classicalCutoffEnergyDensity", "nuCutoff", "frequency", [
        "eq-model-lq-cutoff-total.t.cutoff",
      ]),
      bind("classicalCutoffEnergyDensity", "T", "temperature", [
        "eq-model-lq-cutoff-total.t.temperature",
      ]),
      bind("classicalCutoffEnergyDensity", "kB", "boltzmannConstant", [
        "eq-model-lq-cutoff-total.t.boltzmann",
      ]),
      bind("classicalCutoffEnergyDensity", "c", "speedOfLight", [
        "eq-model-lq-cutoff-total.t.light",
      ]),
      bind("classicalCutoffEnergyDensity", "uCutoff", "energyDensityBelowCutoff", [
        "eq-model-lq-cutoff-total.t.total",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-02",
    kernel: tsRef("src/physics/reference/radiation/classical.ts", "classicalTotalEnergy"),
    words: {
      r0: "The classical total over all frequencies, which is not a number: the function refuses, and says why.",
      r1: "Integrating the classical density from zero to infinity gives no finite answer, because the density rises as the square of the frequency and never turns over. So this function computes nothing. It returns an outside-domain result whose reason is that the classical allocation assigns unbounded total energy, and it does that for every temperature.",
      r2: "It takes a temperature and a constant set and uses neither, which is why both parameters are written with a leading underscore. That is the honest shape for this one: the answer does not depend on the temperature, so accepting the temperature and ignoring it is the statement. Compare the refusal beside it. Its sibling refuses a large cutoff with domainKind numerical, because a bigger floating-point type would push that boundary out; this one refuses with domainKind physical, because no arithmetic would help. A reader who sees one word of difference between the two is seeing the whole distinction between a limit of the machine and a limit of the model.",
    },
    liveTerms: ["temperature"],
    identifierBindings: [bind("classicalTotalEnergy", "_T", "temperature")],
    independentReferences: [],
  },
  {
    instrumentId: "lq-02",
    kernel: tsRef("src/physics/reference/radiation/avogadro.ts", "avogadroFromPlanckConstants"),
    words: {
      r0: "Einstein's paragraph 2 arithmetic: two constants fitted to a radiation spectrum give the number of molecules in a mole.",
      r1: "N = (beta / alpha) times 8 pi R / L^3, with alpha and beta the two constants of Wien's law as Planck had fitted them, R the gas constant and L the speed of light. Run on the 1905 CGS inputs it returns 6.170486250063268 times 10^23, against the 6.17 times 10^23 Einstein printed and 6.02214076 times 10^23 in the modern definition: high by 2.5 per cent. It returns both the unrounded value and the printed one, and it derives the hydrogen atom mass and R over N from the PRINTED N, so that the page's numbers and the paper's numbers agree digit for digit.",
      r2: "Three of the inputs carry markers because they are not all the same kind of input. alpha's marker records a corrected witness exponent, 10^-57 where the witness has 10^-56. R and the speed of light are marked editorial-input: Einstein does not print R in paragraph 2, and the 3 times 10^10 cm/s is the rounded figure of the period, so the function says which numbers are his and which are the edition's. It also records the sensitivity of each, linear in R and inverse cubic in L, which is the reason the rounding of the speed of light matters three times as much as the rounding of R. Two silent conversions are worth knowing before reading a result: a gas constant below 100 is taken as SI and multiplied by 10^7, and a speed of light below 10^9 is taken as m/s and multiplied by 100, so mixing a modern set into these CGS formulas is handled rather than refused.",
    },
    equationId: "eq-model-lq-avogadro-from-spectrum",
    liveTerms: [
      "wienConstantAlpha",
      "wienConstantBeta",
      "molarGasConstant",
      "speedOfLight",
      "avogadroNumberEstimate",
    ],
    identifierBindings: [
      bind("avogadroFromPlanckConstants", "alpha", "wienConstantAlpha", [
        "eq-model-lq-avogadro-from-spectrum.t.alpha",
      ]),
      bind("avogadroFromPlanckConstants", "beta", "wienConstantBeta", [
        "eq-model-lq-avogadro-from-spectrum.t.beta",
      ]),
      bind("avogadroFromPlanckConstants", "R_cgs", "molarGasConstant", [
        "eq-model-lq-avogadro-from-spectrum.t.gas",
      ]),
      bind("avogadroFromPlanckConstants", "L_cgs", "speedOfLight", [
        "eq-model-lq-avogadro-from-spectrum.t.light",
      ]),
      bind("avogadroFromPlanckConstants", "N_unrounded", "avogadroNumberEstimate"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-02",
    kernel: tsRef("src/physics/reference/radiation/spectra.ts", "regimeRelativeErrors"),
    words: REGIME_ERROR_WORDS,
    liveTerms: ["frequency", "temperature"],
    identifierBindings: [
      bind("regimeRelativeErrors", "nu", "frequency"),
      bind("regimeRelativeErrors", "T", "temperature"),
      bind("regimeRelativeErrors", "h", "planckConstant"),
      bind("regimeRelativeErrors", "kB", "boltzmannConstant"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-03",
    kernel: tsRef("src/physics/reference/radiation/spectra.ts", "planckFrequencyEnergyDensity"),
    words: {
      r0: "Planck's spectrum at one frequency and temperature: the classical mode count multiplied by an average energy that falls away at high frequency.",
      r1: "u_nu = (8 pi h nu^3 / c^3) divided by (e^x - 1), with x = h nu / (k_B T). The first factor is the same mode count the classical law uses; everything that distinguishes Planck from Rayleigh and Jeans is in the second. Measured at 600 THz and 5800 K it returns 9.383671111056491 times 10^-16 J per cubic metre per hertz, where the classical law gives 2.689 times 10^-14 and Wien's gives 9.318 times 10^-16.",
      r2: "Nothing here is computed as a product. The prefactor and the factor are both taken to logarithms, added, and handed to packLogRepresentation, which returns the plain value when a double can hold it and otherwise reports the logarithm and marks the value not linearly representable. That matters because this quantity ranges over hundreds of orders of magnitude across the axes this laboratory offers, and a product of 8 pi h with nu cubed underflows long before the physics stops being interesting. The x > 50 branch is there for the same reason in the other direction: -x - log1p(-e^-x) is algebraically the same as -log(e^x - 1) and stays finite past x = 709, where e^x does not. The two branches below it are the same expression written twice, so the x below 10^-4 case is a distinction the code does not currently make.",
    },
    equationId: "eq-model-lq-planck-low-frequency",
    liveTerms: ["frequency", "temperature", "frequencyEnergyDensity"],
    identifierBindings: [
      bind("planckFrequencyEnergyDensity", "nu", "frequency", [
        "eq-model-lq-planck-low-frequency.t.frequency",
      ]),
      bind("planckFrequencyEnergyDensity", "T", "temperature", [
        "eq-model-lq-planck-low-frequency.t.temperature",
      ]),
      bind("planckFrequencyEnergyDensity", "h", "planckConstant"),
      bind("planckFrequencyEnergyDensity", "c", "speedOfLight"),
      bind("planckFrequencyEnergyDensity", "kB", "boltzmannConstant"),
      bind("planckFrequencyEnergyDensity", "value", "frequencyEnergyDensity"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-03",
    kernel: tsRef("src/physics/reference/radiation/spectra.ts", "wienFrequencyEnergyDensity"),
    // One sentence is the whole truth: it is the Planck expression with the minus one removed, and
    // what that costs is measured by regimeRelativeErrors rather than stated here.
    words: words(
      "Wien's spectrum, (8 pi h nu^3 / c^3) times e to the minus x, with x = h nu / (k_B T). It is Planck's expression with the minus one dropped from the denominator, which is why the two agree wherever the exponential is large, and it is computed in logarithms for the same reason Planck's is.",
    ),
    equationId: "eq-model-lq-wien-spectrum",
    liveTerms: ["frequency", "temperature", "frequencyEnergyDensity"],
    identifierBindings: [
      bind("wienFrequencyEnergyDensity", "nu", "frequency", [
        "eq-model-lq-wien-spectrum.t.frequency",
      ]),
      bind("wienFrequencyEnergyDensity", "T", "temperature", [
        "eq-model-lq-wien-spectrum.t.temperature",
      ]),
      bind("wienFrequencyEnergyDensity", "h", "planckConstant"),
      bind("wienFrequencyEnergyDensity", "c", "speedOfLight"),
      bind("wienFrequencyEnergyDensity", "kB", "boltzmannConstant"),
      bind("wienFrequencyEnergyDensity", "value", "frequencyEnergyDensity", [
        "eq-model-lq-wien-spectrum.t.density",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-03",
    kernel: tsRef(
      "src/physics/reference/radiation/spectra.ts",
      "rayleighJeansFrequencyEnergyDensity",
    ),
    // One sentence is the whole truth: mode count times k_B T, and no Planck constant anywhere in it.
    words: words(
      "The classical spectrum, (8 pi nu^2 / c^3) times k_B T: the number of modes at this frequency multiplied by the equipartition energy of each. The Planck constant does not appear, which is the point of showing it beside the other two.",
    ),
    equationId: "eq-model-lq-classical-density",
    liveTerms: ["frequency", "temperature", "frequencyEnergyDensity"],
    identifierBindings: [
      bind("rayleighJeansFrequencyEnergyDensity", "nu", "frequency", [
        "eq-model-lq-classical-density.t.frequency",
      ]),
      bind("rayleighJeansFrequencyEnergyDensity", "T", "temperature", [
        "eq-model-lq-classical-density.t.temperature",
      ]),
      bind("rayleighJeansFrequencyEnergyDensity", "c", "speedOfLight", [
        "eq-model-lq-classical-density.t.light",
      ]),
      bind("rayleighJeansFrequencyEnergyDensity", "kB", "boltzmannConstant", [
        "eq-model-lq-classical-density.t.boltzmann",
      ]),
      bind("rayleighJeansFrequencyEnergyDensity", "value", "frequencyEnergyDensity", [
        "eq-model-lq-classical-density.t.density",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-03",
    kernel: tsRef("src/physics/reference/radiation/bandIntegration.ts", "planckBandEnergyDensity"),
    words: {
      r0: "The energy the Planck spectrum puts between two frequencies, integrated numerically rather than looked up.",
      r1: "It integrates the Planck density from one frequency bound to the other with adaptive Gauss-Kronrod quadrature: fifteen points per interval, and each interval split in two whenever the fifteen-point and seven-point estimates disagree by more than a relative 10^-12. At 5800 K the band from 400 to 790 THz comes back as 0.376 J/m^3, which is 43.9 per cent of everything the spectrum holds. Three refusals come first: a bound at or below zero, a range whose upper bound is not above its lower, and a nonpositive temperature.",
      r2: "The check worth knowing is that the quadrature was not compared against itself. Taking the band from 10^9 to 10^17 Hz at 5800 K, this function returns 0.8561759005957852 J/m^3 where the closed form a T^4 in the same file returns 0.8561759006386072, an agreement to eleven significant figures by two routes that share no arithmetic. The one place to be careful is the integrand: where the density is not linearly representable it contributes zero rather than refusing, which is right for a tail that has underflowed and would be silently wrong for a band that lies entirely out of range, since the answer would then be a confident zero.",
    },
    liveTerms: ["frequency", "temperature", "bandEnergy"],
    identifierBindings: [
      bind("planckBandEnergyDensity", "nuMin", "frequency"),
      bind("planckBandEnergyDensity", "nuMax", "frequency"),
      bind("planckBandEnergyDensity", "T", "temperature"),
      bind("planckBandEnergyDensity", "total", "bandEnergy"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-03",
    kernel: tsRef("src/physics/reference/radiation/spectra.ts", "regimeRelativeErrors"),
    words: REGIME_ERROR_WORDS,
    liveTerms: ["frequency", "temperature"],
    identifierBindings: [
      bind("regimeRelativeErrors", "nu", "frequency"),
      bind("regimeRelativeErrors", "T", "temperature"),
      bind("regimeRelativeErrors", "h", "planckConstant"),
      bind("regimeRelativeErrors", "kB", "boltzmannConstant"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-04",
    kernel: tsRef("src/physics/reference/radiation/entropy.ts", "wienTemperatureFromDensity"),
    words: {
      r0: "Read Wien's law backwards: given how much energy sits at one frequency, what temperature would put it there?",
      r1: "Wien's law gives the density from the temperature; this inverts it. T = B nu / ln(A nu^3 / rho), with A = 8 pi h / c^3 and B = h / k_B, which are Einstein's printed alpha and beta written in modern constants. Fed back the density Wien's own law gives at 600 THz and 5800 K, it returns 5800 K. This inversion is what makes the entropy workbench possible: the entropy of radiation is defined through its temperature, and the temperature is not an input here but a reading.",
      r2: "The refusal at high density is a property of the Wien form rather than of the arithmetic. A nu^3 is the largest density the law can express at this frequency, because the logarithm's argument A nu^3 / rho falls to 1 there and the implied temperature runs to infinity; past it the logarithm turns negative and the formula returns a negative temperature, which is why the function stops at the boundary and names it. Measured at 600 THz, A nu^3 is 1.335 times 10^-13 J per cubic metre per hertz, so a density of 10^-10 is refused with the boundary quoted. Nothing about this refusal says the radiation is impossible; it says that Wien's law is the wrong description of it, which is the same thing the regime report says in continuous numbers.",
    },
    equationId: "eq-model-lq-wien-inverse-temperature",
    liveTerms: ["temperature", "frequency", "frequencyEnergyDensity"],
    identifierBindings: [
      bind("wienTemperatureFromDensity", "rho", "frequencyEnergyDensity", [
        "eq-model-lq-wien-inverse-temperature.t.density",
      ]),
      bind("wienTemperatureFromDensity", "nu", "frequency", [
        "eq-model-lq-wien-inverse-temperature.t.frequency",
      ]),
      bind("wienTemperatureFromDensity", "T", "temperature", [
        "eq-model-lq-wien-inverse-temperature.t.temperature",
      ]),
      bind("wienTemperatureFromDensity", "A", "wienConstantAlpha", [
        "eq-model-lq-wien-inverse-temperature.t.alpha",
      ]),
      bind("wienTemperatureFromDensity", "B", "wienConstantBeta", [
        "eq-model-lq-wien-inverse-temperature.t.beta",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-04",
    kernel: tsRef("src/physics/reference/radiation/entropy.ts", "wienSpectralEntropyDensity"),
    words: {
      r0: "The entropy of monochromatic radiation at one frequency, from its energy density alone.",
      r1: "s_nu = -(rho / (B nu)) times (ln(rho / (A nu^3)) - 1), which is what you get by integrating the inverse temperature of the line above with respect to the energy. It is the expression paragraph 4 arrives at, and the whole of paragraph 6 is what happens when its volume dependence is read as a probability. At 600 THz with the Wien density for 5800 K it returns 1.930 times 10^-19 J per cubic metre per hertz per kelvin.",
      r2: "Zero density is not a refusal here, and that is a decision rather than an oversight. The expression contains ln(rho), which has no value at zero, but it is multiplied by rho, and rho ln(rho) goes to zero as rho does. So the function returns a typed analytic-limit at rho = 0, carrying the value 0 and the sentence that the entropy density vanishes continuously there, instead of a NaN or an unexplained zero. A negative density is a different case and is refused outright, and a density above A nu^3 is refused as outside the Wien domain, the same boundary the temperature inversion stops at. Three inputs, three different kinds of answer.",
    },
    equationId: "eq-model-lq-wien-entropy-density",
    liveTerms: ["frequencyEnergyDensity", "frequency", "spectralEntropyDensity"],
    identifierBindings: [
      bind("wienSpectralEntropyDensity", "rho", "frequencyEnergyDensity", [
        "eq-model-lq-wien-entropy-density.t.density",
      ]),
      bind("wienSpectralEntropyDensity", "nu", "frequency", [
        "eq-model-lq-wien-entropy-density.t.frequency",
      ]),
      bind("wienSpectralEntropyDensity", "A", "wienConstantAlpha", [
        "eq-model-lq-wien-entropy-density.t.alpha",
      ]),
      bind("wienSpectralEntropyDensity", "B", "wienConstantBeta", [
        "eq-model-lq-wien-entropy-density.t.beta",
      ]),
      bind("wienSpectralEntropyDensity", "sNu", "spectralEntropyDensity", [
        "eq-model-lq-wien-entropy-density.t.entropyDensity",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-04",
    kernel: tsRef("src/physics/reference/radiation/entropy.ts", "radiationEntropyVolumeChange"),
    words: {
      r0: "How the entropy of a narrow band of radiation changes when its volume changes at fixed energy: a coefficient times the logarithm of the volume ratio.",
      r1: "Delta S = (E / (B nu)) times ln(V / V0). The shape is the whole argument: an entropy that depends on volume only through a logarithm, with a coefficient that does not depend on the volume at all. Alongside the change it returns the temperatures and the dimensionless x at both volumes, so a reader can see that expanding the box at fixed energy cools it. Measured for 1 nJ in a 1 THz band at 600 THz, doubling a cubic centimetre: Delta S = 2.407 times 10^-14 J/K, with the temperature falling from 5884 K to 5154 K.",
      r2: "Two gates stand in front of the formula and they refuse for different reasons. The band must be narrow, a bandwidth no more than one per cent of the frequency, because the law is stated at one frequency and integrating it over a wide band is a different calculation; that check runs FIRST, before the positivity checks, so a wide band is reported as a wide band rather than as whatever else is wrong. Then the Wien regime is checked at BOTH volumes, not just the starting one, because compressing the box raises the density and can carry the final state out of the range where the entropy expression holds even when the initial state is inside it. One warning about the returned fields: effectiveIndependentCount holds E/(B nu), which carries joules per kelvin and is what content/quantities/radiation.yaml calls entropyVolumeCoefficient; the dimensionless count E/(h nu) is a different number, smaller by the Boltzmann constant, and src/experiments/lq04/session.ts computes it separately rather than trusting the name.",
    },
    equationId: "eq-model-lq-volume-entropy",
    liveTerms: [
      "radiationEnergy",
      "frequency",
      "volume",
      "bandwidth",
      "radiationEntropy",
      "volumeRatio",
      "entropyVolumeCoefficient",
    ],
    identifierBindings: [
      bind("radiationEntropyVolumeChange", "E", "radiationEnergy", [
        "eq-model-lq-volume-entropy.t.energy",
      ]),
      bind("radiationEntropyVolumeChange", "nu", "frequency", [
        "eq-model-lq-volume-entropy.t.frequency",
      ]),
      bind("radiationEntropyVolumeChange", "V", "volume", ["eq-model-lq-volume-entropy.t.volume"]),
      bind("radiationEntropyVolumeChange", "V0", "volume", [
        "eq-model-lq-volume-entropy.t.volume0",
      ]),
      bind("radiationEntropyVolumeChange", "dNu", "bandwidth"),
      bind("radiationEntropyVolumeChange", "B", "wienConstantBeta", [
        "eq-model-lq-volume-entropy.t.beta",
      ]),
      bind("radiationEntropyVolumeChange", "A", "wienConstantAlpha"),
      bind("radiationEntropyVolumeChange", "deltaS", "radiationEntropy", [
        "eq-model-lq-volume-entropy.t.entropy",
      ]),
      bind("radiationEntropyVolumeChange", "effectiveCount", "entropyVolumeCoefficient"),
      bind("radiationEntropyVolumeChange", "volumeRatio", "volumeRatio"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-04",
    kernel: tsRef("src/physics/reference/radiation/entropy.ts", "entropyWithUnfixedConstant"),
    words: {
      r0: "The same entropy change with one integration constant left unfixed, which is the version that does not work, kept so a reader can see how badly.",
      r1: "Integrating the inverse temperature to get an entropy leaves a constant of integration that may depend on the frequency but not on the energy. Paragraph 4 fixes it; this function does not, and adds the term it leaves behind, dNu times C times (V - V0), to the correct Delta S. It returns both numbers and labels itself an adversarial derivation variant, not a model of radiation.",
      r2: "The point is the size. With the same band and volumes as the honest calculation and a C of only 10^-3, the extra term is 1000 J/K beside a real Delta S of 2.407 times 10^-14 J/K: seventeen orders of magnitude, so the unfixed constant does not perturb the answer, it replaces it. The other half of the point is the shape. The extra term is linear in the volume rather than logarithmic, so an entropy carrying it could not be read as the logarithm of a probability at all, and paragraph 6's argument would have nothing to work with. Note also what this function does NOT have: no narrow-band gate, no Wien check, no positivity check. It is not a model, so it does not carry a model's guards, and it will return a number for inputs the real calculation refuses.",
    },
    equationId: "eq-model-lq-unfixed-constant",
    liveTerms: [
      "radiationEnergy",
      "frequency",
      "volume",
      "bandwidth",
      "radiationEntropy",
      "entropyDensityConstant",
      "entropyFromUnfixedConstant",
    ],
    identifierBindings: [
      bind("entropyWithUnfixedConstant", "E", "radiationEnergy"),
      bind("entropyWithUnfixedConstant", "nu", "frequency", [
        "eq-model-lq-unfixed-constant.t.frequency",
      ]),
      bind("entropyWithUnfixedConstant", "V", "volume", ["eq-model-lq-unfixed-constant.t.volume"]),
      bind("entropyWithUnfixedConstant", "V0", "volume", [
        "eq-model-lq-unfixed-constant.t.volume0",
      ]),
      bind("entropyWithUnfixedConstant", "dNu", "bandwidth", [
        "eq-model-lq-unfixed-constant.t.band",
      ]),
      bind("entropyWithUnfixedConstant", "C", "entropyDensityConstant", [
        "eq-model-lq-unfixed-constant.t.constant",
      ]),
      bind("entropyWithUnfixedConstant", "B", "wienConstantBeta"),
      bind("entropyWithUnfixedConstant", "deltaS", "radiationEntropy"),
      bind("entropyWithUnfixedConstant", "extraTerm", "entropyFromUnfixedConstant", [
        "eq-model-lq-unfixed-constant.t.extra",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-04",
    kernel: tsRef("src/physics/reference/radiation/spectra.ts", "regimeRelativeErrors"),
    words: REGIME_ERROR_WORDS,
    liveTerms: ["frequency", "temperature"],
    identifierBindings: [
      bind("regimeRelativeErrors", "nu", "frequency"),
      bind("regimeRelativeErrors", "T", "temperature"),
      bind("regimeRelativeErrors", "h", "planckConstant"),
      bind("regimeRelativeErrors", "kB", "boltzmannConstant"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "lq-07",
    kernel: tsRef("src/physics/reference/photoelectric.ts", "fluorescenceBudget"),
    words: {
      r0: "Whether a fluorescent body may emit light of a given frequency after absorbing light of another, under the paper's assumption that one quantum in makes at most one quantum out.",
      r1: "The bound is h times the emitted frequency no greater than h times the absorbed frequency, which is Stokes's rule with a reason attached rather than a rule of thumb. The function returns the verdict, both quantum energies in electronvolts, the largest emitted frequency the assumption allows, the energy left over for other channels when the emission is allowed, and the deficit when it is not. Measured at 600 THz in and 500 THz out: 2.4814 eV absorbed, 2.0678 eV emitted, 0.4136 eV left for heat.",
      r2: "Four regimes, and they are four different claims rather than four settings. The paper's own case allows anything at or below the absorbed frequency, and under the light-only channel choice the SAME pair, 600 THz in and 500 THz out, is disallowed: the leftover 0.4136 eV has nowhere to go, so only exact resonance is permitted. Deviation case 1 lets k absorbed quanta combine, and at k = 3 the ceiling rises to three times the absorbed frequency, 1500 THz. Deviation case 2 is the one that refuses rather than answers: where the exciting light is outside the range in which Wien's law holds, paragraph 7 allows that the light may behave differently, so the function returns outside-domain with no bound derived, and at 100 THz against a 5800 K source that is what happens, with e to the minus x at 0.437 against a tolerance of 0.01. The modern thermal allowance is marked as not being in the 1905 paper at all: ten thermal degrees of freedom at 300 K add 0.2585 eV, which lifts the ceiling from 600 to 662.51 THz. A verdict from this function without its label is not a verdict.",
    },
    equationId: "eq-model-lq-fluorescence-bound",
    liveTerms: ["incidentFrequency", "emittedFrequency", "planckConstant"],
    identifierBindings: [
      bind("fluorescenceBudget", "nu1", "incidentFrequency", [
        "eq-model-lq-fluorescence-bound.t.in",
      ]),
      bind("fluorescenceBudget", "nu2", "emittedFrequency", [
        "eq-model-lq-fluorescence-bound.t.out",
      ]),
      bind("fluorescenceBudget", "h", "planckConstant", [
        "eq-model-lq-fluorescence-bound.t.planck",
      ]),
      bind("fluorescenceBudget", "kB", "boltzmannConstant"),
      bind("fluorescenceBudget", "e", "elementaryCharge"),
    ],
    independentReferences: [],
  },

  // LQ-08 (am-f3e4, dispatch 338). d3596620's subject said the light-quanta family was complete
  // and it was not: getKernelListingsForInstrument("lq-08") returned 0 while the other eight
  // returned 5, 5, 5, 5, 1, 2, 1 and 1. This is the ninth.
  //
  // Its headline output has no identifier to bind. The function returns kResult.value / e, an
  // expression no name holds, so stoppingPotentialMagnitude is NOT in liveTerms although it is
  // registered and is what the laboratory shows: what is bound is what a reader can see coloured.
  {
    instrumentId: "lq-08",
    kernel: tsRef("src/physics/reference/photoelectric.ts", "stoppingPotentialMagnitude"),
    words: {
      r0: "The voltage that just stops the fastest electron: its maximum kinetic energy divided by the charge it carries.",
      r1: "V_s = K_max / e = (h nu - Phi) / e. The physics is in kMax, which this calls; what this function does is ask for the maximum kinetic energy in joules and divide by the elementary charge to put it in volts. Measured at 10^15 Hz against a 2.0 eV work function: 2.135667696923859 V.",
      r2: "Four outcomes under one formula, and the differences between them are the whole of the typed-result discipline. Below the threshold the answer is NOT zero: it is not-applicable, with the reason that there is no emitted electron in this model, where a zero would have claimed an electron came out with nothing left over. EXACTLY at the threshold there is a value, zero volts, carrying its own note that a zero maximum kinetic energy does not guarantee a measurable current; one part in 10^15 below that frequency the status flips to not-applicable, which is the boundary drawn as sharply as a double allows. Under partial transfer the answer is underdetermined: the printed relation is cited as an upper bound, and the missing information is named as the single-quantum transfer fraction rather than guessed at. A nonpositive frequency or a negative work function is outside-domain before any of that. The part of this easiest to get wrong is the part this function does itself: in the underdetermined case it divides the upper bound AND both ends of the interval by the charge, so a bound labelled volts is in volts and not in joules.",
    },
    equationId: "eq-model-lq-stopping-energy",
    liveTerms: ["frequency", "workFunction", "maxKineticEnergy", "elementaryCharge"],
    identifierBindings: [
      bind("stoppingPotentialMagnitude", "nu", "frequency", [
        "eq-model-lq-stopping-energy.t.frequency",
      ]),
      bind("stoppingPotentialMagnitude", "workFunctionJoules", "workFunction", [
        "eq-model-lq-stopping-energy.t.escapeWork",
      ]),
      bind("stoppingPotentialMagnitude", "kResult", "maxKineticEnergy", [
        "eq-model-lq-stopping-energy.t.maxKineticEnergy",
      ]),
      bind("stoppingPotentialMagnitude", "e", "elementaryCharge", [
        "eq-model-lq-stopping-energy.t.charge",
      ]),
    ],
    independentReferences: [],
  },

  // BM-02, BM-03 and BM-04 (am-f3e4, dispatch 338). Route A, the osmotic half of paper 2: the
  // partition, the configuration count, and the balance that makes a diffusivity out of the two.
  //
  // MODULE PATHS. bm-03's manifest names the barrel src/physics/reference/diffusion.ts; the three
  // entries below name routeA.ts, where those functions are written. Same source, same hash, same
  // line numbers either way, measured; what differs is the pointer a reader gets and the closure
  // pin, which is 4 modules for routeA.ts against 22 for the barrel.
  //
  // Several of these return their headline number from an inline expression that no name holds:
  // osmoticPressure's n k_B T, volumeFraction's sphere volume over the vessel, partitionForce's
  // product, hydrostaticHead's quotient, lockedClusterPressure's kT / V, osmoticEquilibriumProfile's
  // exp(logN). Those quantities are absent from liveTerms although each is registered and is what
  // the laboratory shows, and a function's own declaration name is not a substitute for a value
  // identifier: bound is what a reader can see coloured.
  {
    instrumentId: "bm-02",
    kernel: tsRef("src/physics/reference/diffusion/distributions.ts", "osmoticPressure"),
    // One sentence is the whole truth: a product of three numbers, behind one guard.
    words: words(
      "The ideal osmotic pressure of a suspension: the number of particles in a cubic metre, times the Boltzmann constant, times the temperature. A negative density or a nonpositive temperature is refused before the multiplication, and the constant comes from the declared set rather than a literal.",
    ),
    liveTerms: ["numberDensity", "temperature"],
    identifierBindings: [
      bind("osmoticPressure", "n", "numberDensity"),
      bind("osmoticPressure", "T", "temperature"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-02",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "volumeFraction"),
    // One sentence is the whole truth: the particles' own volume over the volume they are in.
    words: words(
      "What fraction of the liquid the particles themselves occupy: the count times the volume of one sphere of this radius, divided by the volume of the vessel. The count must be a whole number, which is why it is checked with isSafeInteger rather than for being finite.",
    ),
    liveTerms: ["particleCount", "particleRadius", "volume"],
    identifierBindings: [
      bind("volumeFraction", "Np", "particleCount"),
      bind("volumeFraction", "a", "particleRadius"),
      bind("volumeFraction", "V", "volume"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-02",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "diluteDomainCheck"),
    words: {
      r0: "Whether this suspension is dilute enough for the ideal law to be used, against a bound the caller has to declare.",
      r1: "It compares the volume fraction with a bound and returns whether it is admitted, together with the two boundaries in the reader's own units: the largest particle count this vessel admits and the smallest vessel this count admits. At a million spheres of half a micron in a cubic millimetre the fraction is 0.000524, and against a bound of 0.01 the ceiling is 19,098,593 particles.",
      r2: "Two things here are refusals of a kind a numerical guard does not make. There is NO DEFAULT BOUND: a missing or nonpositive phiMax, or a blank justification, returns outside-domain with the reason that the bound and the reason for it must both be declared, so nobody inherits a dilution criterion nobody chose. And the check reports virialCorrectionAtBound, the hard-sphere correction evaluated AT the bound, which is 0.041 at a bound of 0.01: that number is the size of what the ideal law is neglecting where it is least valid, so a reader can see the cost of the admission rather than only its verdict.",
    },
    liveTerms: ["volumeFraction", "particleCount", "particleRadius", "volume"],
    identifierBindings: [
      bind("diluteDomainCheck", "phi", "volumeFraction"),
      bind("diluteDomainCheck", "phiMax", "volumeFraction"),
      bind("diluteDomainCheck", "Np", "particleCount"),
      bind("diluteDomainCheck", "a", "particleRadius"),
      bind("diluteDomainCheck", "V", "volume"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-02",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "partitionForce"),
    // One sentence is the whole truth: pressure times area, and the guard that a zero pressure is
    // admissible while a zero area is not.
    words: words(
      "The force the osmotic pressure puts on a partition: the pressure times the area. A zero pressure is allowed and gives a zero force, while a zero area is refused, because a partition with no area is not a partition.",
    ),
    liveTerms: ["osmoticPressure", "partitionArea"],
    identifierBindings: [
      bind("partitionForce", "Pi", "osmoticPressure"),
      bind("partitionForce", "A", "partitionArea"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-02",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "hydrostaticHead"),
    words: {
      r0: "The same osmotic pressure written as a height of liquid, which is a way of saying how small it is.",
      r1: "Pressure divided by density times gravity. At 4 Pa in water it is 0.408 millimetres. The gravity is not an input a reader has to supply: it defaults to the declared standard 9.80665 m/s^2, and a caller may pass another.",
      r2: "It carries a model note, and the note is the reason the function is worth having: an equivalent solvent column height, NOT a manometer in the apparatus. Nothing in this laboratory claims a tube of water stands anywhere. The number is a unit conversion whose purpose is to put a pressure most readers cannot picture into one they can, and the note is what keeps that from being read as a prediction about an experiment. The guards are of a piece with it: a nonpositive density or gravity is refused rather than divided by.",
    },
    liveTerms: ["osmoticPressure"],
    identifierBindings: [bind("hydrostaticHead", "Pi", "osmoticPressure")],
    independentReferences: [],
  },
  {
    instrumentId: "bm-03",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "configurationVolumeTerm"),
    words: {
      r0: "The part of a suspension's free energy that depends on the volume, and the pressure that follows from it.",
      r1: "For Np independent particles the volume-dependent free energy is minus k_B T times Np times the logarithm of the volume, and the change between two volumes is minus k_B T Np ln(V/V0). Differentiating gives the pressure Np k_B T / V, which is the ideal osmotic law arrived at by counting configurations rather than by assuming it. All four are returned separately: Np ln V, the free-energy term, the difference between two volumes, and the pressure.",
      r2: "Three of the seven returned fields are SYMBOLIC, and that is the honest part. The volume-independent factor J, the momentum integrals, and the free-energy offset F0 are all present in the free energy and none is evaluated, because each cancels in a difference between two volumes at one temperature. A calculation that dropped them silently would look identical and would have lost the reason the answer is allowed to ignore them. Instead each comes back with status symbolic and its unspecified symbol named, so the cancellation is a statement in the result rather than an omission in the code.",
    },
    liveTerms: ["particleCount", "volume", "temperature", "freeEnergy", "osmoticPressure"],
    identifierBindings: [
      bind("configurationVolumeTerm", "Np", "particleCount"),
      bind("configurationVolumeTerm", "V", "volume"),
      bind("configurationVolumeTerm", "V0", "volume"),
      bind("configurationVolumeTerm", "T", "temperature"),
      bind("configurationVolumeTerm", "freeEnergyTerm", "freeEnergy"),
      bind("configurationVolumeTerm", "pressure", "osmoticPressure"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-03",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "configurationFactorRatio"),
    words: {
      r0: "How many times more room a given number of particles have after the volume changes: the ratio raised to the power of the count.",
      r1: "The configuration factor is the volume ratio to the power of the particle count, which is the probability in Boltzmann's relation once it is compared with a reference state. The function returns it three ways, because at any interesting count only some of them exist: an exact decimal for a count up to 12, the natural and base-ten logarithms always, and the plain double when one can hold it. The ratio arrives as a decimal STRING and is refused if it is not an exact decimal, so the exact answer is exact.",
      r2: "Three separate pieces of arithmetic care, each with its reason in the source. The exact decimal is built by repeated BigInt multiplication of the decimal digits, so 2 to the twelfth comes back as the characters 4096 rather than as a float. The double is computed as ratio ** Np and not as exp(Np ln ratio), because the first is correctly rounded while the second drifts: the comment names 2 to the five hundredth, which is exact as a double and which the exponential form gets wrong in the fourteenth digit. And overflow, underflow to zero, and a subnormal result all report null rather than a number, since a subnormal has already lost digits; at a count of 1024 and a ratio of 2 the double is null while the logarithm still says 709.78. The logarithms are the answer that survives every size.",
    },
    liveTerms: ["particleCount", "volumeRatio"],
    identifierBindings: [
      bind("configurationFactorRatio", "Np", "particleCount"),
      bind("configurationFactorRatio", "ratio", "volumeRatio"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-03",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "lockedClusterPressure"),
    words: {
      r0: "What the same suspension would do if its particles were locked together into one body, which is the alternative the osmotic argument has to rule out.",
      r1: "Lock every particle into a single unit and the configuration factor is the volume ratio itself rather than the ratio to the power of the count, so the pressure is k_B T / V instead of Np k_B T / V. For a cubic millimetre at 290.15 K that is 4.006 times 10^-12 Pa, smaller by exactly the particle count. The two readings are returned side by side, which is what lets a reader see that the pressure is a statement about independence rather than about the particles being there.",
      r2: "The second field is not a number and must not be. Asked for the independent-particle pressure of a locked cluster, the function returns outside-domain with domainKind model and the reason that Np k_B T / V is not defined once the particles move as one unit, because pressure counts independently placed units. A zero would have been wrong in an interesting way: it would say the independent model predicts nothing here, when what is true is that the independent model does not apply here. This is the adversarial case of paper 2's argument, kept executable and kept labelled, rather than described in prose and never run.",
    },
    liveTerms: ["volume", "temperature"],
    identifierBindings: [
      bind("lockedClusterPressure", "V", "volume"),
      bind("lockedClusterPressure", "T", "temperature"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-04",
    kernel: tsRef("src/physics/reference/diffusion/driftDiffusion.ts", "driftDiffusionFrames1d"),
    words: {
      r0: "The density in a box under a steady force and random kicks together, stepped forward in time and returned frame by frame.",
      r1: "An explicit finite-volume solve of the drift-diffusion equation on a one-dimensional grid with zero-flux walls. It returns every frame's density, the cell width, the drift velocity, the Peclet number that says which of the two transports dominates, and the stability ratio the step was accepted under. At the defaults of this laboratory the Peclet number is 3.90, so drift is a few times stronger than diffusion, and the stability ratio is 0.0052, far inside its limit of 1.",
      r2: "The faces are not a plain average, and the refusals are not one refusal. The two transport speeds come from an exponentially fitted scheme: at a small ratio of drift to diffusion the against-drift speed is a series in that ratio, past a ratio of 50 it is written with e to the minus z so nothing overflows, and between them it is the speed over expm1. A plain centred average would give negative densities exactly where this is hardest. The refusals then separate what a reader can act on: too large a step with kicks present is drift-diffusion-unstable, the same step with no kicks at all is drift-cfl-exceeded, and each carries ranked repairs with the actual values to use, a step of 1.909 seconds at this laboratory's settings and a halved grid. A request too large to run is a budget outcome rather than either, since running out of room is not a statement about the physics.",
    },
    equationId: "eq-model-bm-diffusion-equation",
    liveTerms: [
      "kickDiffusivity",
      "mobility",
      "externalForcePerParticle",
      "temperature",
      "timeStep",
      "driftVelocity",
      "probabilityDensity",
    ],
    identifierBindings: [
      bind("driftDiffusionFrames1d", "kickDiffusivity", "kickDiffusivity"),
      bind("driftDiffusionFrames1d", "mobility", "mobility"),
      bind("driftDiffusionFrames1d", "force", "externalForcePerParticle"),
      bind("driftDiffusionFrames1d", "temperature", "temperature"),
      bind("driftDiffusionFrames1d", "dt", "timeStep"),
      bind("driftDiffusionFrames1d", "u", "driftVelocity"),
      bind("driftDiffusionFrames1d", "values", "probabilityDensity", [
        "eq-model-bm-diffusion-equation.t.density",
      ]),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-04",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "equilibriumBalance"),
    words: {
      r0: "The two descriptions of the same still suspension, the osmotic one and the kicked one, set against each other to see whether they agree.",
      r1: "Paper 2's move is to demand that a force-driven drift and a diffusive spread cancel in equilibrium, and to read a diffusivity out of the demand. This computes both sides: the mobility route gives D = mu k_B T from Stokes's mobility and the temperature, and the balance route gives the diffusivity the cancellation requires. With the kicks set to mu k_B T both come to 3.1485 times 10^-13 m^2/s and the function reports agreement.",
      r2: "Three things it returns instead of asserting. The relation D = mu k_B T comes back as a SYMBOLIC result with its four symbols named, so the page can show the relation without a number pretending to establish it. The two factors that cancel are returned as strings, mu times the force and k_B T over the force, which is where the force leaves the answer and why the diffusivity does not depend on how hard you pull. And agreement is a tolerance test, not an equality: the ratio of the two diffusivities must be within 10^-9 of one. At zero force there is no balance to read and the function says so: the balance diffusivity is not-applicable, with the reason that 0 over 0 is not an evaluation and that the construction relates two descriptions of one state. A zero would have claimed a still suspension does not diffuse.",
    },
    liveTerms: [
      "externalForcePerParticle",
      "temperature",
      "viscosity",
      "particleRadius",
      "kickDiffusivity",
      "mobility",
      "diffusionCoefficient",
    ],
    identifierBindings: [
      bind("equilibriumBalance", "force", "externalForcePerParticle"),
      bind("equilibriumBalance", "temperature", "temperature"),
      bind("equilibriumBalance", "eta", "viscosity"),
      bind("equilibriumBalance", "a", "particleRadius"),
      bind("equilibriumBalance", "kickDiffusivity", "kickDiffusivity"),
      bind("equilibriumBalance", "mu", "mobility"),
      bind("equilibriumBalance", "mobilityD", "diffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-04",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "decayLengths"),
    words: {
      r0: "How far up the box the density falls by a factor of e, computed twice: once from the osmotic account and once from the kicks.",
      r1: "The osmotic length is k_B T over the force; the kinetic length is the kick diffusivity over the mobility times the force. They are the two accounts of the same equilibrium profile, and they are equal exactly when the kicks carry the diffusivity the temperature demands. With the kicks set to mu k_B T both come to 4.006 times 10^-7 m and the returned kick strength is 1.",
      r2: "At zero force both lengths are NOT-APPLICABLE and neither is infinite. The reason returned says why in the reader's terms: no force, no gradient, so the equilibrium profile is uniform and there is no decay length to speak of. An infinity would have been defensible as arithmetic and wrong as a description, because the quantity does not lose its value there, it loses its meaning. Bad inputs are a different refusal again, outside-domain rather than not-applicable, and the kick strength then comes back null rather than as a number nobody should read.",
    },
    liveTerms: [
      "externalForcePerParticle",
      "temperature",
      "kickDiffusivity",
      "mobility",
      "osmoticDecayLength",
      "kineticDecayLength",
    ],
    identifierBindings: [
      bind("decayLengths", "force", "externalForcePerParticle"),
      bind("decayLengths", "temperature", "temperature"),
      bind("decayLengths", "kickDiffusivity", "kickDiffusivity"),
      bind("decayLengths", "mobility", "mobility"),
      bind("decayLengths", "osmotic", "osmoticDecayLength"),
      bind("decayLengths", "kinetic", "kineticDecayLength"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-04",
    kernel: tsRef("src/physics/reference/diffusion/routeA.ts", "osmoticEquilibriumProfile"),
    words: {
      r0: "The settled density at one height in a box, when the force and the kicks have come to balance.",
      r1: "An exponential profile with a decay length of k_B T over the force, normalised so that the whole box holds the particles it was given. The function is evaluated at one position rather than over a grid, and it mirrors for a force pointing the other way rather than carrying a sign through the exponent. At zero force it returns the uniform density directly, which is the same expression in the limit and avoids dividing by a decay length that has gone to infinity.",
      r2: "The exponential is enormous and the code is written around that. Across a box only a tenth of a millimetre wide at this laboratory's force, the settled density runs from about 9.7 times 10^-97 at one wall to about 2.5 times 10^12 at the other, so the obvious form, e to the x over lambda over e to the W over lambda minus 1, overflows its numerator and its denominator long before the ratio stops being representable. It is rewritten as e to the (z minus w) over 1 minus e to the minus w, where no intermediate exceeds 1, and the whole of it is then assembled in logarithms with two guards: a denominator that is not positive and finite is a numerical refusal, and a logarithm above 700 is another, because that is where the exponential would leave binary64. Both say outside-domain with domainKind numerical, which is not the same statement as the model refusing.",
    },
    liveTerms: [
      "positionCoordinate1d",
      "externalForcePerParticle",
      "temperature",
      "osmoticDecayLength",
    ],
    identifierBindings: [
      bind("osmoticEquilibriumProfile", "x", "positionCoordinate1d"),
      bind("osmoticEquilibriumProfile", "force", "externalForcePerParticle"),
      bind("osmoticEquilibriumProfile", "temperature", "temperature"),
      bind("osmoticEquilibriumProfile", "absL", "osmoticDecayLength"),
    ],
    independentReferences: [],
  },

  // BM-07 and BM-08 (am-f3e4, dispatch 343). The two inference laboratories: recovering a molecular
  // number from displacements, and what a real camera does to the displacements first.
  //
  // ONE BINDING DELIBERATELY NOT MADE, and it is a live defect rather than a choice of style.
  // identifiabilityFamily returns `product`, which is R T / (6 pi eta D) and carries a radius times
  // a molecular number. The bm-07 manifest binds its radiusNumberProduct output to
  // quantityId: avogadroNumberEstimate, which is per-mole and a different dimension; am-ff2s holds
  // that, and it needs a new canonical quantity rather than a repair in passing. So `product` is
  // bound to nothing here, and radiusNumberProduct does not become a live term by way of this
  // catalogue. `numbers`, whose elements ARE per-mole molecular numbers, is bound.
  //
  // NO traceScenarioId on any of these, although the bm-07 manifest declares one and the scenario
  // file exists. verify.ts computes a trace for exactly one pair, traceScenarioId
  // "diffusion-einstein-1905-printed" with exportName "stokesEinsteinD"; every other entry gets
  // undefined. Carrying the id would also fail checkTraceScenario, since SLICE_REGISTERED_SCENARIOS
  // has no bm-07 key. A declared trace that reaches no reader is a claim, not a feature.
  //
  // Two entries bind nothing at all. stationaryClickNoiseEstimate returns sigma2, a VARIANCE of a
  // localization error, and the registered quantity localizationErrorStd is a standard deviation;
  // binding one to the other would be the same kind of mistake as the one above. bartlettBandsMA1's
  // gamma0 and gamma1 are covariances of increments, for which there is no registered id. Both
  // still show their source, their hash and their words.
  {
    instrumentId: "bm-07",
    kernel: tsRef("src/physics/reference/inference.ts", "estimateIncrements"),
    words: {
      r0: "A diffusivity read off a run of measured displacements, by one of three named estimators.",
      r1: "It sums the squared displacements and divides by twice the interval and by a count, which is the whole of the estimate. What differs between the three estimators is the count and whether the mean is subtracted first: the known-zero-drift estimator subtracts nothing and divides by the full number of coordinates; the drift-centered one subtracts the sample mean and loses one degree of freedom for it; the maximum-likelihood one centres as well but divides by the uncentred count. On the same eight displacements at half-second spacing those give 2.8125, 3.0536 and 2.6719 times 10^-12 m^2/s.",
      r2: "The third estimator returns TWO numbers and the difference between them is the point. dHat is the maximum-likelihood value, which is biased low, and unbiasedDHat beside it is the same data divided by the degrees of freedom, with biasFactor saying how far apart they are: 0.875, which is seven over eight, on that run. A caller that builds an interval must use the unbiased one, and the comment on chiSquareInterval says so, because a chi-square interval around a biased point estimate is an interval around the wrong centre. Two more pieces of care are visible in the arithmetic: every displacement is divided by the largest of them before squaring, so a run in micrometres and a run in metres take the same path, and the sum is accumulated with a compensation term rather than added straight, because a long run of small squares loses its tail otherwise. A single centred increment is not a small sample but an UNDERDETERMINED one, and the returned reason says why: drift and spread cannot be separated from one observation.",
    },
    liveTerms: ["observationInterval", "diffusionCoefficient"],
    identifierBindings: [
      bind("estimateIncrements", "observationInterval", "observationInterval"),
      bind("estimateIncrements", "dHat", "diffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-07",
    kernel: tsRef("src/physics/reference/inference.ts", "inverseBias"),
    words: {
      r0: "How much the reciprocal of a diffusivity estimate runs high, and whether its spread even exists.",
      r1: "A molecular number is recovered by DIVIDING by the diffusivity, and the reciprocal of a noisy estimate is not the reciprocal of the truth. For a chi-square estimate on q degrees of freedom the mean of the reciprocal is larger by normalization over (q - 2), and its variance is twice the normalization squared over (q - 2) squared times (q - 4). At q = 5 those are 1.667 and 5.556; at q = 10 with a normalization of 12, 1.5 and 0.75.",
      r2: "The two thresholds in those denominators are the whole function. At two degrees of freedom or fewer the reciprocal has NO FINITE EXPECTATION, so the answer is not a large number but a typed not-applicable whose reason says exactly that; a mean factor computed from q - 2 at q = 2 would have been an infinity dressed as a correction. At four or fewer the mean exists but the variance does not, so varianceFactor comes back null while the mean factor is still returned. Three outcomes from one formula, and the middle one is the one a naive implementation loses: it is possible to know how far high an estimate runs and to have no finite answer for how much it scatters.",
    },
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-07",
    kernel: tsRef("src/physics/reference/inference.ts", "invertToMolecularNumber"),
    words: {
      r0: "The inversion paper 2 exists for: a diffusivity, a temperature, a viscosity and a radius give the number of molecules in a mole.",
      r1: "N = R T / (6 pi eta a D), which is the Stokes-Einstein relation read backwards, with the interval carried through by dividing the ENDS in the opposite order, so the upper diffusivity gives the lower number. On a modern set at 290.15 K, 1.35 mPa s, half a micron and a diffusivity of 3.1 times 10^-13 m^2/s it returns 6.116 times 10^23, which is 1.0156 times the defined Avogadro constant, and the Boltzmann constant implied by the same inputs, 1.3594 times 10^-23 J/K.",
      r2: "Two guards stand in front of the arithmetic and neither is numerical. The first refuses a radius that came from THESE SAME DISPLACEMENTS with an assumed molecular number, code circular-radius-from-displacement, because a number recovered that way was put in by hand; that is AGENTS.md's no-circular-explanations rule as executable code rather than as editorial advice. The second asks what the constant set MEANS. A gas constant defined in the modern SI makes the answer a consistency-check, a gas constant measured without counting molecules makes it an independent-estimate, and a set that establishes neither is refused as outside-domain with the reason that it does not support a noncircular observational estimate. Synthetic data is a fourth case and is labelled synthetic-recovery, which is a check of the machinery and not evidence about molecules. The same number means four different things and the function will not hand it over without saying which.",
    },
    liveTerms: [
      "temperature",
      "viscosity",
      "particleRadius",
      "molarGasConstant",
      "diffusionCoefficient",
      "avogadroNumberEstimate",
    ],
    identifierBindings: [
      bind("invertToMolecularNumber", "temperature", "temperature"),
      bind("invertToMolecularNumber", "viscosity", "viscosity"),
      bind("invertToMolecularNumber", "particleRadius", "particleRadius"),
      bind("invertToMolecularNumber", "molarGasConstant", "molarGasConstant"),
      bind("invertToMolecularNumber", "diffusionCoefficient", "diffusionCoefficient"),
      bind("invertToMolecularNumber", "avogadroNumberEstimate", "avogadroNumberEstimate"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-07",
    kernel: tsRef("src/physics/reference/inference.ts", "combinedMolecularNumberInterval"),
    words: {
      r0: "One interval for the molecular number that carries the uncertainty in the temperature, the viscosity and the radius as well as in the diffusivity.",
      r1: "It takes a declared interval for any of the three conditions, pairs the endpoints in the direction that widens the answer, and returns the result with its coverage reduced by the sum of the input error rates. The pairing is where the care is: the lower molecular number uses the lowest temperature against the highest viscosity, radius and diffusivity, and the upper one the reverse, because N rises with T and falls with each of the other three.",
      r2: "The coverage arithmetic is a Bonferroni union bound and the function says so in the returned record, with coverageKind conservative and an estimatorId that names the procedure. That word is doing work. The inputs are NOT assumed independent, which is why the error rates add rather than compounding, and the result is therefore at least the stated coverage rather than equal to it. Two refusals come from the same accounting: an input interval with no valid declared coverage is not-applicable rather than ignored, and error rates that leave no positive coverage return not-applicable too, because an interval with no guarantee left is not a wider interval, it is no interval. An input interval that does not contain its own point value is refused outright.",
    },
    liveTerms: ["temperature", "viscosity", "particleRadius", "molarGasConstant"],
    identifierBindings: [
      bind("combinedMolecularNumberInterval", "T", "temperature"),
      bind("combinedMolecularNumberInterval", "eta", "viscosity"),
      bind("combinedMolecularNumberInterval", "a", "particleRadius"),
      bind("combinedMolecularNumberInterval", "R", "molarGasConstant"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-07",
    kernel: tsRef("src/physics/reference/inference.ts", "identifiabilityFamily"),
    words: {
      r0: "Every radius and molecular number the same measurement admits, drawn as one curve, because the displacements fix their product and not either one.",
      r1: "A diffusivity fixes R T / (6 pi eta D), and that is a product of a radius and a molecular number. Give the radius and the number follows; give the number and the radius follows; measure the displacements alone and neither is determined. The function returns 41 radii spaced evenly in the logarithm across the range asked for, with the molecular number that goes with each. Over two decades of radius the numbers run over two decades too, from 3.058 times 10^24 down to 3.058 times 10^22.",
      r2: "This is what an UNDERDETERMINED result looks like when it is drawn rather than refused. Elsewhere the laboratory returns a typed underdetermined status and stops; here the same fact is made visible, because a reader who sees one curve and is told to pick a point on it has understood the shape of the inference in a way no refusal message conveys. It is also the honest answer to the question the paper is usually said to have settled: paper 2 does not weigh a molecule from displacements alone, it fixes a product, and Perrin's independent radius is what turns the product into a count. The function carries the constant set's semantic kind through unchanged, so a family drawn from synthetic data is still labelled synthetic.",
    },
    liveTerms: [
      "diffusionCoefficient",
      "temperature",
      "viscosity",
      "particleRadius",
      "avogadroNumberEstimate",
    ],
    identifierBindings: [
      bind("identifiabilityFamily", "D", "diffusionCoefficient"),
      bind("identifiabilityFamily", "T", "temperature"),
      bind("identifiabilityFamily", "eta", "viscosity"),
      bind("identifiabilityFamily", "radii", "particleRadius"),
      bind("identifiabilityFamily", "numbers", "avogadroNumberEstimate"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-08",
    kernel: tsRef("src/physics/reference/inference/observation.ts", "cameraMoments"),
    words: {
      r0: "What a real camera does to the displacements before anyone estimates anything: a shutter that is open for a while, and a position that is never read exactly.",
      r1: "For a shutter open for a time Te out of each frame interval dt, and a localization error of standard deviation sigma, the measured increment variance is 2 D (dt - Te/3) + 2 sigma squared, and neighbouring increments acquire a covariance of D Te/3 - sigma squared. The function returns both, the apparent speed a reader would compute from each, and their ratio. At a diffusivity of 3.1 times 10^-13 m^2/s and half-second frames: an ideal camera gives a variance of 3.1 times 10^-13 and a ratio of 1; a shutter open the whole interval gives 2.067 times 10^-13 and a ratio of 0.816; a localization error of 0.2 micrometres with no blur gives 3.9 times 10^-13 and a ratio of 1.122.",
      r2: "Blur and localization error pull in OPPOSITE directions and the covariance is what tells them apart. Blur averages the position over the time the shutter is open, which removes variance from each increment and puts a POSITIVE correlation between neighbours, since they share the same averaging window. Localization error is independent from frame to frame, which adds variance and puts a NEGATIVE correlation between neighbours, because an error high in one frame ends one increment high and starts the next one low. Measured above: the covariance is 5.167 times 10^-14 under full blur and minus 4 times 10^-14 under localization error alone. This is why the adversarial fixture in AGENTS.md says camera noise does NOT leave neighbouring increments independent, and it is why the covariance estimator two functions down can recover the diffusivity and the noise separately from the same run. The crossover, returned only where the error acts alone, is the frame spacing at which the two contributions are equal.",
    },
    liveTerms: [
      "diffusionCoefficient",
      "observationInterval",
      "exposureTime",
      "localizationErrorStd",
      "driftVelocity",
      "apparentSpeed",
      "apparentSpeedRatio",
    ],
    identifierBindings: [
      bind("cameraMoments", "D", "diffusionCoefficient"),
      bind("cameraMoments", "dt", "observationInterval"),
      bind("cameraMoments", "exposure", "exposureTime"),
      bind("cameraMoments", "sigma", "localizationErrorStd"),
      bind("cameraMoments", "drift", "driftVelocity"),
      bind("cameraMoments", "idealApparentSpeed", "apparentSpeed"),
      bind("cameraMoments", "measuredApparentSpeed", "apparentSpeed"),
      bind("cameraMoments", "apparentSpeedRatio", "apparentSpeedRatio"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-08",
    kernel: tsRef("src/physics/reference/inference/observation.ts", "covarianceEstimator"),
    words: {
      r0: "The diffusivity and the localization error recovered together, from the variance of the increments and the covariance of neighbouring ones.",
      r1: "Two measured moments, two unknowns. The diffusivity is the variance over two plus the covariance, all over the frame interval; the localization variance is a weighted combination of the two with the exposure entering through the ratio Te / 6 dt. Both come out of one pass over the increments, and neither needs the other declared in advance, which is what the previous function's opposite signs make possible.",
      r2: "Two refusals of a kind that is easy to write the other way. The drift must be KNOWN and is subtracted as given: the comment says not to substitute a fitted mean, because centring on the sample mean changes the finite-sample expectation of the covariance and this estimator's algebra assumes it was not. And a negative estimate is RETURNED, not clipped: with few increments, or with noise larger than the motion, either moment can come out on the wrong side of zero, and the comment records that these are diagnostics rather than values to be made positive. A clip to zero would turn a visible failure of the model into a plausible small number, which is the direction this whole laboratory is built against.",
    },
    liveTerms: ["observationInterval", "exposureTime", "driftVelocity", "diffusionCoefficient"],
    identifierBindings: [
      bind("covarianceEstimator", "dt", "observationInterval"),
      bind("covarianceEstimator", "exposure", "exposureTime"),
      bind("covarianceEstimator", "knownDrift", "driftVelocity"),
      bind("covarianceEstimator", "D", "diffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-08",
    kernel: tsRef(
      "src/physics/reference/inference/observation.ts",
      "disjointPairsKnownNoiseInterval",
    ),
    words: {
      r0: "A confidence interval for the diffusivity from frame pairs that share nothing, with the localization noise subtracted off.",
      r1: "Take frames in pairs, (0,1), (2,3) and so on, so that no frame and no localization error appears in two increments. Estimate the increment variance from those pairs, subtract twice the noise variance, and divide by twice the interval less a third of the exposure. The interval comes from the chi-square band on the variance, with the noise endpoints subtracted in the widening direction. Drift is fitted from the pairs rather than taken from the truth, which costs a degree of freedom and is the honest choice when a reader has only the frames.",
      r2: "A negative upper endpoint returns an EMPTY set and says so, and that is the hardest thing in this function to leave alone. When the localization noise is larger than the motion, the noise-corrected interval can lie entirely below zero; the function then returns interval null with empty true, keeps the negative point estimate, and flags lowerClipped where only the lower end went under. Measured on a run with a noise variance a thousand times the spread: an estimate of minus 2.14 times 10^-12, twenty pairs, nineteen degrees of freedom, and no interval. The comment says why it must not be retried or made positive: an empty set is a MISS, and a coverage study that quietly discards its misses reports a coverage it has not got. Two further distinctions live in the same record. Coverage is exact when the noise variance is declared exactly and CONSERVATIVE when it is estimated from stationary clicks, because the error rate is then split between two bands; and the procedure refuses outright rather than approximating if a caller says the spacing is not equal or the errors are not independent.",
    },
    liveTerms: ["observationInterval", "exposureTime", "diffusionCoefficient"],
    identifierBindings: [
      bind("disjointPairsKnownNoiseInterval", "dt", "observationInterval"),
      bind("disjointPairsKnownNoiseInterval", "exposure", "exposureTime"),
      bind("disjointPairsKnownNoiseInterval", "estimate", "diffusionCoefficient"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "bm-08",
    kernel: tsRef("src/physics/reference/inference/observation.ts", "stationaryClickNoiseEstimate"),
    words: {
      r0: "The localization error measured from something that is not moving: click the same fixed feature a few times and see how much the clicks scatter.",
      r1: "It takes at least five clicks per coordinate on a stationary feature and returns the variance of their scatter, with the degrees of freedom that variance carries. That number is then the noise the pair interval subtracts, so the laboratory never has to assume a localization error: a reader supplies one by doing the same thing an experimenter would.",
      r2: "It does not implement a variance at all. It calls the displacement estimator, the same one bm-07 uses, with an interval of exactly 0.5, and takes its unbiased diffusivity as the answer. That is not a fudge, it is the reason 0.5 is there: the estimator divides the sum of squares by two times the interval, so an interval of a half makes that factor one and the returned diffusivity IS the unbiased mean square per degree of freedom. One estimator, two meanings, and no second copy of the same arithmetic to drift out of step with the first. The consequence a reader should know is that the drift-centered estimator is the one used, so a slowly wandering stage is removed from the clicks along with the mean, and five clicks give four degrees of freedom per coordinate rather than five.",
    },
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },
  {
    instrumentId: "bm-08",
    kernel: tsRef("src/physics/reference/inference/observation.ts", "bartlettBandsMA1"),
    words: {
      r0: "How much the two measured moments would scatter by themselves, if the model were exactly right.",
      r1: "Bartlett's asymptotic formulas for a moving-average process of order one, which is what camera increments are: correlated with their immediate neighbours and with nothing further away. Given the variance and the neighbour covariance and the number of increments, it returns the standard deviation each of those two moments would show across repeated runs.",
      r2: "The docblock's own capital letters are the point: these are sampling bands for the MOMENTS, and NOT confidence intervals for the diffusivity. The distinction matters because the diffusivity is a combination of both moments, so its uncertainty is not either of these and is not their sum; a reader who took the variance band as an error bar on D would be quoting a number about the wrong quantity. The admissibility check is the other half. A covariance larger in size than half the variance cannot come from a moving-average process of order one at all, so the function refuses rather than returning a band for a model the data has already contradicted, and the refusal is an input refusal rather than a numerical one.",
    },
    liveTerms: [],
    identifierBindings: [],
    independentReferences: [],
  },

  // SR-03, SR-08, SR-09, SR-10, SR-12 and SR-13 (am-f3e4, dispatch 343). The last six, and with
  // them every one of the 33 instruments shows the code that produced its numbers.
  //
  // FOUR OF THESE FILL A SNAPSHOT WITH NaN on a superluminal boost rather than returning a typed
  // refusal, and the listings show it: evaluateSr09, evaluateSr10 and transformChargeCurrent do
  // that, and evaluateSr12 and evaluateSr08 refuse properly instead. In every case the guard is one
  // layer up, in the parameter validator or in the caller, so a reader never reaches the NaN branch;
  // each R2 below says which layer holds the guard rather than pretending the branch is not there.
  {
    instrumentId: "sr-03",
    kernel: tsRef("src/physics/reference/events.ts", "measureRodLength"),
    words: {
      r0: "The length of a moving rod, and the refusal that comes first: two endpoint events that are not simultaneous are not a measurement of anything.",
      r1: "A length is the distance between two endpoint events taken AT THE SAME TIME in the frame doing the measuring, so the function checks the time gap before it measures anything. Simultaneous endpoints give the distance between them: a rod of unit proper length, measured from the frame it moves through at six tenths of the light speed, gives 0.8. Endpoints that are not simultaneous give a not-applicable result whose reason says why.",
      r2: "The refusal carries a REPAIR rather than only a complaint. When the endpoints are not simultaneous the function calls selectSimultaneousEndpoints for the rod and the measuring frame, and hands back the pair of events that WOULD have been a measurement, in repairSuggestedPair. That is the difference between telling a reader they have made a mistake and showing them the measurement they were reaching for. The tolerance is one part in a million million of a second, so a pair generated by a transformation and carrying rounding error still counts as simultaneous, while a genuinely staggered pair does not.",
    },
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("measureRodLength", "v", "frameSpeed"),
      bind("measureRodLength", "L0", "lengthProper"),
      bind("measureRodLength", "measuredLength", "lengthMeasuredStationary"),
      bind("measureRodLength", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  // NO ENTRY for classifySimultaneity, and it is not an omission of judgement. The pin writer
  // refuses it as "uncommitted-pinned-source" although src/physics/reference/events.ts is clean and
  // identical to HEAD: extractFromRepoFile starts an OVERLOADED export at its first overload
  // signature (lines 337-428) while extractFunctionSource, which the committed-source check uses,
  // starts at the implementation (352-428), so the two hash different text and the guard reads the
  // disagreement as a dirty tree. Measured on this file: the two agree on causalOrder,
  // measureRodLength and ellipsoidAxes, and differ on classifySimultaneity and redescribe, which
  // are the two overloaded exports. Forcing it with --allow-dirty-pins would leave the
  // committed-source check red for every pane, so sr-03 shows three of its four kernels until the
  // extractor agrees with itself.
  {
    instrumentId: "sr-03",
    kernel: tsRef("src/physics/reference/events.ts", "causalOrder"),
    words: {
      r0: "Whether one event could have caused another, which unlike their time order is the same in every frame.",
      r1: "It computes the interval s squared, the spatial separation less the light-travel separation, and classifies. Times are in seconds and distances in light-seconds here, so c is 1 and the arithmetic is readable: one light-second apart at the same time gives s squared of 1 and spacelike; one second apart and one light-second apart gives 0 and lightlike; two seconds and one light-second gives minus 3 and timelike. Each classification comes back with a sentence a reader can use, and the spacelike one says in words that the time order can be reversed by choosing a frame.",
      r2: "The lightlike case needs a tolerance and the tolerance is absolute, one part in a million million of a squared light-second. That is a real decision rather than a detail. An exactly lightlike pair is a measure-zero set in floating point, so a test for equality with zero would classify almost every light ray as spacelike or timelike depending on the last bit; measured here, a pair a hundredth of a femtosecond past lightlike still classifies as lightlike. The cost is the other direction: two events genuinely separated by less than that tolerance are called lightlike when they are not, and the tolerance is absolute rather than relative, so it means different things at different scales. It is stated here because a reader who moves the events a long way apart should know which way the classification errs.",
    },
    liveTerms: [],
    identifierBindings: [bind("causalOrder", "dx", "eventSeparationSpatial")],
    independentReferences: [],
  },
  {
    instrumentId: "sr-03",
    kernel: tsRef("src/physics/reference/kinematics.ts", "ellipsoidAxes"),
    // One sentence is the whole truth: one axis is shortened, two are not.
    words: words(
      "The three axes of a sphere as the frame it moves through measures it: the one along the motion is shortened by the square root of one minus beta squared, and the two across it are unchanged. At six tenths of the light speed a unit sphere measures 0.8 by 1 by 1. The paper's § 4 calls that an ellipsoid of revolution, and this function is the whole of that sentence.",
    ),
    liveTerms: ["frameSpeed"],
    identifierBindings: [
      bind("ellipsoidAxes", "beta", "frameSpeed"),
      bind("ellipsoidAxes", "gamma", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-08",
    kernel: tsRef("src/physics/reference/fields.ts", "evaluateSr08"),
    words: {
      r0: "One test charge in one electromagnetic field, described twice: from the laboratory and from a frame moving past it.",
      r1: "It transforms the fields, transforms the charge's velocity, and computes the Lorentz force in both descriptions, alongside the two field invariants that must come out the same in each. Everything a reader sees on this page comes from one call: the stationary and moving fields, the stationary and moving velocities, the transverse force in the laboratory and in the comoving frame, and the Lorentz factor that relates them.",
      r2: "The two transverse forces are NOT equal and that is the instrument's subject. The comoving transverse force is the laboratory one times the Lorentz factor, because a force is a rate of change of momentum and the two frames do not agree about time; a reader who expects the components to match is meeting paper 3's § 10 head on, and this is the adversarial fixture AGENTS.md names as forces having equal numerical components in different frames. Three refusals guard the arithmetic and they are separate facts rather than one validity check: any nonfinite input, a boost at or past the light speed, and a TEST CHARGE at or past the light speed, which is a different condition from the boost and has its own message. Each refusal fills every row of the snapshot with an outside-domain result, so no half-populated snapshot with some real numbers and some missing ever reaches a view.",
    },
    liveTerms: [
      "frameSpeed",
      "electricFieldMoving",
      "magneticFieldMoving",
      "electricFieldStationary",
      "magneticFieldStationary",
    ],
    identifierBindings: [
      bind("evaluateSr08", "boost", "frameSpeed"),
      bind("evaluateSr08", "Eprime", "electricFieldMoving"),
      bind("evaluateSr08", "Bprime", "magneticFieldMoving"),
      bind("evaluateSr08", "E0", "electricFieldStationary"),
      bind("evaluateSr08", "B0", "magneticFieldStationary"),
      bind("evaluateSr08", "lorentzFactor", "lorentzFactor"),
      bind("evaluateSr08", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-08",
    kernel: tsRef("src/physics/reference/fields.ts", "transformSI"),
    words: TRANSFORM_SI_WORDS,
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
    instrumentId: "sr-09",
    kernel: tsRef("src/physics/reference/waves.ts", "evaluateSr09"),
    words: {
      r0: "The frequency and the direction of a light wave as a moving observer finds them: the Doppler shift and the aberration, from one boost and one angle.",
      r1: "Paper 3's § 7 in one evaluation. It takes the boost, the angle the wave travels at in the resting system and its frequency, and returns the transformed angle, the transformed frequency, the Doppler factor, the amplitude factor, the line-of-sight factors for a source receding and approaching, and the aberration in arcseconds for the Earth's orbital speed. It also returns the second-order shift at a stated small speed, which is the part that distinguishes this prediction from the classical one.",
      r2: "It checks the phase rather than asserting it. The function builds named events, transforms the wave four-vector, evaluates the phase at each event in both frames with phaseAtEvent, and reports whether the two agree; it also carries an ADVERSARIAL phase, built to disagree, so that the check has something to fail against and a passing agreement is not a property of the checker. Two refusals of different kinds sit at the front: a classical observer factor and a classical source factor are returned alongside the relativistic one, because the classical predictions differ only at second order and a reader has to see all three to see the difference at all. A boost at or past the light speed fills the snapshot with NaN rather than a typed refusal; the guard is in src/experiments/sr09/parameters.ts, which refuses such a beta before the evaluator is called, so the branch is unreachable from the page and is visible only in the listing.",
    },
    liveTerms: ["frameSpeed", "propagationAngleStationary", "dopplerFactor"],
    identifierBindings: [
      bind("evaluateSr09", "beta", "frameSpeed"),
      bind("evaluateSr09", "propagationAngleStationaryRad", "propagationAngleStationary"),
      bind("evaluateSr09", "doppler", "dopplerFactor"),
      bind("evaluateSr09", "gamma", "lorentzFactor"),
      bind("evaluateSr09", "C_SI", "speedOfLight"),
      bind("evaluateSr09", "propagationAngleMovingRad", "propagationAngleMoving"),
      bind("evaluateSr09", "waveFrequencyMovingHz", "waveFrequencyMoving"),
      bind("evaluateSr09", "waveFrequencyStationaryHz", "waveFrequencyStationary"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-09",
    kernel: tsRef("src/physics/reference/waves.ts", "phaseAtEvent"),
    // One sentence is the whole truth: a dot product less a product, and a refusal before it.
    words: words(
      "The phase of a wave at one event: the wave vector dotted into the position, less the angular frequency times the time. It is the quantity that must come out the same in every frame, which is why it is computed here rather than assumed, and a nonfinite coordinate or component is refused by name before the arithmetic.",
    ),
    liveTerms: ["wavePhase"],
    identifierBindings: [bind("phaseAtEvent", "phase", "wavePhase")],
    independentReferences: [],
  },
  {
    instrumentId: "sr-10",
    kernel: tsRef("src/physics/reference/waves.ts", "evaluateSr10"),
    words: {
      r0: "What happens to the energy of a bundle of light when the observer moves, which is the result the mass-energy paper of September then uses.",
      r1: "A light complex carries an energy, occupies a volume and has an amplitude, and all three change together under a boost. The function returns the transformed energy, volume and amplitude, and the three factors relating them, for a bundle travelling at a stated angle. The energy factor is the same Doppler factor the previous instrument returns, which is § 8's result: the energy of a light complex transforms exactly as its frequency does.",
      r2: "It carries its own COUNTERMODEL. Beside the real volume factor it computes lightComplexMaterialContractionCountermodel, the factor a bundle would have if it contracted like a material body, and returns both so the page can show that they differ. AGENTS.md names this as an adversarial fixture and names the trap in it too: a ray transverse in the MOVING frame gives exactly the material factor, so a countermodel tested only there would agree with the truth and prove nothing, which is why the angle is an input and the comparison is made across angles. A boost at or past the light speed fills the snapshot with NaN rather than refusing in the typed way; as with its sibling the guard sits in the parameter validator one layer up.",
    },
    liveTerms: [
      "frameSpeed",
      "propagationAngleStationary",
      "lightComplexEnergyMoving",
      "lightComplexVolumeMoving",
    ],
    identifierBindings: [
      bind("evaluateSr10", "beta", "frameSpeed"),
      bind("evaluateSr10", "propagationAngleStationaryRad", "propagationAngleStationary"),
      bind("evaluateSr10", "transformedEnergyJ", "lightComplexEnergyMoving"),
      bind("evaluateSr10", "transformedVolumeM3", "lightComplexVolumeMoving"),
      bind("evaluateSr10", "q", "dopplerFactor"),
      bind("evaluateSr10", "initialEnergyJ", "lightComplexEnergyStationary"),
      bind("evaluateSr10", "initialVolumeM3", "lightComplexVolumeStationary"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-12",
    kernel: tsRef("src/physics/reference/fields.ts", "evaluateSr12"),
    words: {
      r0: "A charge density and a current, described from two frames, with the total charge coming out the same in both.",
      r1: "It transforms the four-current, computes its invariant, evaluates the continuity residual in each frame, and totals the charge on a sphere and around a current loop. The heart of it is that charge is invariant while charge DENSITY is not: a sphere carries the same total charge in both descriptions, and the function returns the two totals separately so a reader can see them agree rather than being told they do.",
      r2: "Four refusals, and one of them is not about the observer at all. Nonfinite inputs, a boost past 0.95 of the light speed, and a Lorentz factor that will not evaluate are the first three. The fourth belongs to the model: in convection mode the CARRIER velocity must be below the light speed, which is a statement about the charges in the wire rather than about the frame watching them, and it is refused separately with its own message. The 0.95 bound is tighter than the physics requires and is this laboratory's declared teaching range, not a claim that nothing moves faster. Each refusal fills every row with an outside-domain result, so a snapshot never mixes real numbers with missing ones.",
    },
    liveTerms: ["frameSpeed", "chargeDensityMoving", "currentDensityMoving"],
    identifierBindings: [
      bind("evaluateSr12", "boost", "frameSpeed"),
      bind("evaluateSr12", "chargeDensityMoving", "chargeDensityMoving"),
      bind("evaluateSr12", "currentDensityMoving", "currentDensityMoving"),
      bind("evaluateSr12", "lorentzFactor", "lorentzFactor"),
      bind("evaluateSr12", "c", "speedOfLight"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-12",
    kernel: tsRef("src/physics/reference/fields.ts", "transformChargeCurrent"),
    words: {
      r0: "The charge density and the current as the moving frame measures them, which mix exactly as the time and the position do.",
      r1: "The transformed density is gamma times the density less the current along the boost over c squared; the transformed current along the boost is gamma times the current less the density times the velocity. The components across the boost pass through. Written side by side with the coordinate transformation the pattern is the same, which is the point of showing this function next to that one: a density and a current form a four-vector in the same way a time and a position do.",
      r2: "Its refusal path returns NaN in every field rather than a typed result, and that is worth knowing rather than hiding. The function is not the laboratory's entry point: evaluateSr12 refuses a nonfinite input, a boost past 0.95 of the light speed and a failing Lorentz factor BEFORE calling this, so the NaN branch cannot be reached from the page. It is in the listing because it is in the code, and a reader who follows the call from the evaluator will see a guard that the evaluator has already made unnecessary.",
    },
    liveTerms: ["chargeDensityStationary", "currentDensityStationary", "frameSpeed"],
    identifierBindings: [
      bind("transformChargeCurrent", "rho", "chargeDensityStationary"),
      bind("transformChargeCurrent", "J", "currentDensityStationary"),
      bind("transformChargeCurrent", "beta", "frameSpeed"),
      bind("transformChargeCurrent", "γ", "lorentzFactor"),
    ],
    independentReferences: [],
  },
  {
    instrumentId: "sr-13",
    kernel: tsRef("src/physics/reference/electron.ts", "evaluateSr13"),
    words: {
      r0: "A slowly accelerated electron, and the three different numbers that all have a claim to be called its mass.",
      r1: "It returns the longitudinal mass, the transverse mass in the comoving convention and the transverse mass in the laboratory convention, along with the kinetic energy, the accelerating potential, the radius of curvature in a magnetic and in an electric field, and the trajectory. At six tenths of the light speed an electron's three masses are 1.7792, 1.4233 and 1.1387 times 10^-30 kg: the longitudinal is the rest mass times gamma cubed, the comoving transverse times gamma squared, and the laboratory transverse times gamma.",
      r2: "The two transverse masses differ by a factor of gamma and NEITHER is wrong. Einstein's § 10 defines the transverse mass as the comoving transverse force divided by the laboratory acceleration, which gives gamma squared; Planck's 1906 convention defines force as the rate of change of momentum, which gives gamma. The paper's own footnote says the definition of force is a matter of convention, and this function returns both rather than choosing, with the convention named in each identifier. AGENTS.md's notation concordance calls this out as a substantive modernization rather than a rename, which is why both are here and why neither is called simply the mass. A speed at or past the light speed refuses every mass and energy row with the code superluminal-speed, before any gamma is taken.",
    },
    liveTerms: [
      "speedRatio",
      "longitudinalMass",
      "transverseMassComoving",
      "transverseMassLaboratory",
      "lorentzFactor",
    ],
    identifierBindings: [
      bind("evaluateSr13", "beta", "speedRatio"),
      bind("evaluateSr13", "longM", "longitudinalMass"),
      bind("evaluateSr13", "transMComov", "transverseMassComoving"),
      bind("evaluateSr13", "transMLab", "transverseMassLaboratory"),
      bind("evaluateSr13", "g", "lorentzFactor"),
      bind("evaluateSr13", "acceleratingPotential", "acceleratingPotential"),
      bind("evaluateSr13", "mass", "electronMass"),
      bind("evaluateSr13", "initialSpeed", "electronSpeedStationary"),
      bind("evaluateSr13", "beta", "frameSpeed"),
      bind("evaluateSr13", "kineticEnergy", "kineticEnergy"),
      bind("evaluateSr13", "lorentzFactor", "lorentzFactor"),
      bind("evaluateSr13", "bMag", "magneticFieldStationary"),
      bind("evaluateSr13", "charge", "particleChargeMagnitude"),
      bind("evaluateSr13", "radiusCurvatureMagnetic", "radiusCurvatureMagnetic"),
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
