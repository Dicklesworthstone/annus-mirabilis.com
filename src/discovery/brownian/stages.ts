/**
 * Brownian motion's argument stages, shared by the page and its journey record (am-4k0m).
 *
 * The main narrative is the page's existing prose. Premise attribution, worked comparisons
 * and transfer questions are authored guidance under the same model qualifications. The
 * arithmetic examples are constructed examples, never microscope observations. The separate
 * world check and end exercises keep their published anchors and their existing owners.
 */
import type { Stage } from "../../content/schemas/journey.ts";

export const OBSERVABLE_STAGE = Object.freeze({
  id: "step-01",
  title: "Choose a quantity",
  question: "Averages can hide motion.",
  computeFromShelf:
    "Brown and Gouy supply the observation of motion in suspended particles. Choosing a signed displacement and an observation interval makes that observation comparable across particles. The calculation below assumes equally likely directions; an observed trace still needs to be checked for drift.",
  premiseRefs: [
    { cardId: "brown-1828-microscopical-observations" },
    { cardId: "gouy-1888-brownian-motion" },
    { cardId: "exner-1900-particle-speeds" },
  ],
  instrument: { instrumentId: "bm-01" },
  reasoning: [
    {
      foundationId: "bridge-sum-average",
      kind: "choose-an-observable",
      label: "Add signed displacements before taking their average.",
    },
    {
      foundationId: "mean-variance-rms",
      kind: "distinction",
      label: "Distinguish an average displacement from an average of squares.",
    },
  ],
  prerequisites: ["bridge-sum-average", "mean-variance-rms"],
  support: {
    workedExample: {
      prompt:
        "In an arithmetic example, one particle ends two micrometres to the right and another two micrometres to the left of their starting positions. What do their averages say?",
      steps: [
        "The signed displacements are plus two and minus two micrometres. Their sum and their mean are zero.",
        "Each squared displacement is four square micrometres, so their mean square is four square micrometres.",
        "Taking the square root gives an RMS displacement of two micrometres. Both particles moved despite the zero signed mean.",
      ],
      result: "A zero signed mean can coexist with a nonzero spread.",
    },
    partialComparison: {
      given: "In another arithmetic example, both particles end two micrometres to the right.",
      toComplete: "Which average changes, and which stays the same?",
      explanation:
        "The signed mean is now two micrometres. The mean square is still four square micrometres. The square alone does not separate shared drift from random spreading; inspect the signed mean too.",
    },
    prediction: {
      prompt: "Can an ensemble have a zero average displacement while its particles spread?",
      choices: ["Yes, opposite displacements can cancel.", "No, zero would mean no movement."],
      explanation:
        "Opposite signed displacements cancel in their average, while their positive squares remain. A finite random sample need not have exactly zero signed mean even when the model has no drift.",
    },
    explanation:
      "Imagine marking each particle’s starting point and looking again after one second. A movement to the right is positive; a movement to the left is negative. When left and right are equally likely, these signed displacements cancel on average, even though the particles have spread out.\n\nBefore you read on, choose what you would measure: the signed displacement, its size regardless of sign, or its square. The last two both keep the information about the spread.",
    transferCase: {
      condition: "What if the liquid carries every particle to the right?",
      explanation:
        "A common drift contributes to both the signed mean and the mean square. Subtracting the mean before squaring measures the spread around that moving centre, and estimating that mean from a finite sample changes the estimator.",
      whatChanges: "The raw mean square now includes the square of the mean displacement.",
      whatStaysValid:
        "Signed and squared displacements remain different observables. Record the observation interval with either one.",
    },
  },
  meanings: {
    logicalRole: "definition",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "idealized-representation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const OSMOTIC_STAGE = Object.freeze({
  id: "step-02",
  title: "Ask whether it presses",
  question: "Does a particle you can see push like a molecule?",
  computeFromShelf:
    "Van ’t Hoff’s law relates osmotic pressure to the number of dissolved particles in a dilute solution. Applying that counting to suspended particles is the hypothesis this route examines. Maxwell’s kinetic account motivates treating particles of different masses together; it does not remove the need to justify the suspension’s free energy.",
  premiseRefs: [
    { cardId: "vant-hoff-1887-osmotic-gas-law" },
    { cardId: "maxwell-1860-equipartition" },
  ],
  instrument: { instrumentId: "bm-02" },
  reasoning: [
    {
      foundationId: "free-energy-osmotic-pressure",
      kind: "counting-to-pressure",
      label: "Relate the change of free energy with volume to pressure.",
    },
    {
      foundationId: "probability-independence",
      kind: "assumption",
      label: "Identify where independent particles enter the counting.",
    },
  ],
  prerequisites: ["free-energy-osmotic-pressure", "probability-independence"],
  support: {
    workedExample: {
      prompt:
        "Compare two ideal dilute suspensions at the same temperature and volume. The second contains twice as many independent particles.",
      steps: [
        "The number of particles per unit volume doubles.",
        "In the proposed osmotic law, pressure is proportional to that number density at fixed temperature.",
        "The second pressure is twice the first. Changing the radius alone at fixed count and volume leaves this ideal pressure unchanged, provided both suspensions remain dilute.",
      ],
      result:
        "The law counts independently moving particles. Particle size enters the limits of the approximation even though it does not enter this ideal pressure formula.",
    },
    partialComparison: {
      given: "Keep the particle count and temperature fixed, but double the available volume.",
      toComplete: "What happens to number density and to the predicted pressure?",
      explanation:
        "Both halve. Each particle has twice as much space, so the same count produces half as much pressure in this ideal model.",
    },
    prediction: {
      prompt:
        "What should doubling the independent particle count do to the ideal pressure at fixed volume and temperature?",
      choices: ["Double it.", "Leave it unchanged.", "Halve it."],
      explanation:
        "The ideal pressure doubles with number density. That comparison assumes both suspensions remain dilute and their particles remain independent.",
    },
    explanation:
      "In 1887 van ’t Hoff showed that a substance dissolved in a dilute solution presses on a membrane that lets only the water through, and that this osmotic pressure follows the gas law. The law counts molecules. Nothing in it says how big a molecule is.\n\nSo take the nagging fact at its word. If a particle a micron across is only a very large molecule, the same law should hold for it, with the number of particles in place of the number of molecules. The usual view in 1904 said otherwise: a membrane holding back suspended particles should feel no force at all, because their free energy did not seem to depend on where they are. The kinetic theory says it must feel one. Both cannot be right, and the particles’ wandering is where they part.",
    transferCase: {
      condition: "What if the particles lock into permanent pairs?",
      explanation:
        "Each rigid pair has one independently placeable centre. In the same dilute ideal counting, pairing all particles leaves half as many independent objects and half the pressure at the same temperature and volume.",
      whatChanges:
        "The independent count changes. Counting each member of a locked pair separately would count positions that cannot be chosen independently.",
      whatStaysValid:
        "The pressure calculation still starts from the volume dependence of the available configurations, with the independence assumption stated.",
    },
  },
  meanings: {
    logicalRole: "heuristic-inference",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const DRAG_BALANCE_STAGE = Object.freeze({
  id: "step-03",
  title: "Balance a force against drag",
  question: "Pull on the particles, and see what holds them back.",
  computeFromShelf:
    "Use van ’t Hoff’s pressure law for the suspension, Stokes’s slow-sphere mobility and Fick’s diffusion flux. Requiring both force balance and zero particle flux in the same equilibrium fixes the diffusion coefficient. The result retains the dilute-suspension, slow-flow and no-slip assumptions.",
  premiseRefs: [
    { cardId: "vant-hoff-1887-osmotic-gas-law" },
    { cardId: "stokes-1851-sphere-drag" },
    { cardId: "fick-1855-diffusion-equation" },
  ],
  instrument: { instrumentId: "bm-04" },
  reasoning: [
    {
      foundationId: "viscosity-stokes-drag",
      kind: "force-balance",
      label: "Use drag to turn a weak force into a drift speed.",
    },
    {
      foundationId: "flux-continuity",
      kind: "balance",
      label: "Balance the particle flux from drift against the diffusion flux.",
    },
    {
      foundationId: "ratios-scaling",
      kind: "eliminate-an-auxiliary-quantity",
      label: "Cancel the common force after relating the two descriptions.",
    },
  ],
  prerequisites: ["viscosity-stokes-drag", "flux-continuity", "ratios-scaling"],
  support: {
    workedExample: {
      prompt:
        "Hold temperature, viscosity and radius fixed. Compare equilibrium under a weak force and under twice that force, both within the slow-drift model.",
      steps: [
        "Stokes mobility stays fixed, so doubling the force doubles the drift speed.",
        "Osmotic force balance doubles the concentration gradient relative to the local concentration.",
        "Zero total flux balances that doubled drift against the doubled gradient. The same diffusion coefficient satisfies both accounts.",
      ],
      result:
        "The auxiliary force changes the equilibrium profile, while the inferred diffusion coefficient stays the same.",
    },
    partialComparison: {
      given: "The force is now zero, so both drift and the equilibrium gradient vanish.",
      toComplete: "Can you recover the coefficient by dividing these two zeros?",
      explanation:
        "No. That particular balance gives zero equals zero and does not identify the coefficient. The relation obtained by comparing nonzero-force equilibria still has a finite zero-force limit under the same model.",
    },
    prediction: {
      prompt:
        "Would doubling a weak force change the inferred diffusion coefficient when temperature, viscosity and radius stay fixed?",
      choices: [
        "The coefficient doubles.",
        "The coefficient stays the same.",
        "The coefficient halves.",
      ],
      explanation:
        "The drift and relative concentration gradient both double, leaving the same coefficient. A force strong enough to leave the slow-flow regime would require a different model.",
    },
    explanation:
      "Suppose a force pulls every particle the same way, toward the bottom say. In equilibrium the particles crowd together until their osmotic pressure pushes back as hard as the force pulls. That is one account of the crowd.\n\nHere is another. Under the force each particle drifts through the water, held back by Stokes’s drag, while the crowding makes the particles diffuse back from more to fewer, as Fick’s law says. In equilibrium the drift one way and the diffusion the other carry equal numbers across each second.\n\nPut the two accounts side by side and the force cancels: a stronger force makes a steeper crowd in exactly the proportion that it makes a faster drift. What is left fixes the diffusion coefficient by the temperature, the viscosity of the liquid and the radius of the particle alone.",
    transferCase: {
      condition: "What if the liquid is twice as viscous?",
      explanation:
        "At fixed temperature and radius, the drag per unit speed doubles and the mobility halves. The diffusion coefficient therefore halves. The equilibrium concentration profile under a fixed force is unchanged because its osmotic balance depends on temperature and force.",
      whatChanges: "Drift and diffusion both slow by the same factor.",
      whatStaysValid:
        "At equilibrium the opposite fluxes cancel. Changing the rate of approach does not by itself change the equilibrium profile.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const TIME_SCALING_STAGE = Object.freeze({
  id: "step-04",
  title: "Make a prediction",
  question: "Four times as long. Four times as far?",
  computeFromShelf:
    "Fick supplies a continuum law for spreading. Connecting it to individual displacements requires an additional model: independent symmetric increments over equal intervals with a finite mean square. Their variances add, which produces a spread proportional to the square root of time. This is a deduction under those assumptions, rather than another observation on the shelf.",
  premiseRefs: [{ cardId: "fick-1855-diffusion-equation" }],
  instrument: { instrumentId: "bm-05" },
  reasoning: [
    {
      foundationId: "probability-independence",
      kind: "independence",
      label: "See why products of independent zero-mean increments average to zero.",
    },
    {
      foundationId: "random-walks",
      kind: "sum-of-increments",
      label: "Build a displacement from successive independent steps.",
    },
    {
      foundationId: "bridge-squaring-square-roots",
      kind: "scaling",
      label: "Take the square root only after averaging the squares.",
    },
  ],
  prerequisites: ["probability-independence", "random-walks", "bridge-squaring-square-roots"],
  support: {
    workedExample: {
      prompt:
        "In a finite teaching model, each step is one unit left or right, equally likely and independent. List the outcomes of two steps.",
      steps: [
        "The four equally likely direction pairs are left-left, left-right, right-left and right-right.",
        "Their final displacements are minus two, zero, zero and plus two units. The squares are four, zero, zero and four.",
        "The mean square is two square units, twice the one-step mean square. The signed mean remains zero.",
        "For four independent steps the mean square is four square units, and the RMS is two units. Four equal intervals doubled the RMS rather than multiplying it by four.",
      ],
      result:
        "Independent zero-mean increments add their mean squares. This finite step example shows the scaling without pretending to resolve molecular impacts.",
    },
    partialComparison: {
      given: "For the same diffusion coefficient, the waiting time becomes nine times as long.",
      toComplete: "By what factors do the mean square and the RMS displacement change?",
      explanation:
        "The mean square grows by a factor of nine and the RMS by a factor of three, as long as the same independent-increment model remains valid over both intervals.",
    },
    prediction: {
      prompt: "Under the same diffusion model, how does the RMS change after four times as long?",
      choices: ["It stays the same.", "It doubles.", "It becomes four times as large."],
      explanation:
        "The mean square becomes four times as large. Its square root doubles. This is an ensemble statement, not a promise about the distance reached by any particular particle.",
    },
    explanation:
      "Wait four times as long. Does a particle get no farther, twice as far, or four times as far? It depends on how it moves. A particle drifting at a steady speed would go four times as far. A particle kicked about at random, each kick independent of the last, would not. Choose before you open the argument.",
    transferCase: {
      condition: "What if the second step always follows the first?",
      explanation:
        "Only left-left and right-right remain, each equally likely. The signed mean is still zero, but the mean square after two steps is four square units. The correlated cross term no longer averages away.",
      whatChanges:
        "The increments are correlated, so the independent-step variance rule no longer applies.",
      whatStaysValid:
        "Displacements still add and their squares can still be averaged. Keeping the cross terms makes the arithmetic agree with the changed model.",
    },
  },
  meanings: {
    logicalRole: "derivation",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const INTERVAL_STAGE = Object.freeze({
  id: "step-05",
  title: "Ask an interval question",
  question: "A curve’s height is not a probability.",
  computeFromShelf:
    "Fick’s spreading equation can be solved for particles that start together. Reading the normalized solution as a displacement distribution adds an explicit probability interpretation. The probability of an interval is its area under that density, and the point-start state is handled separately.",
  premiseRefs: [{ cardId: "fick-1855-diffusion-equation" }],
  instrument: { instrumentId: "bm-06" },
  reasoning: [
    {
      foundationId: "distributions",
      kind: "density-versus-total",
      label: "Turn a density into a probability by choosing an interval.",
    },
    {
      foundationId: "integration",
      kind: "area",
      label: "Add the probability carried by small pieces of that interval.",
    },
  ],
  prerequisites: ["distributions", "integration"],
  support: {
    workedExample: {
      prompt:
        "At positive time with positive diffusivity, compare the exact starting point with an interval one micrometre to each side of it.",
      steps: [
        "The exact point has zero width, so its probability is zero in the continuous distribution.",
        "The interval has width two micrometres. Integrating its density gives a positive probability smaller than one.",
        "The density has units per micrometre when displacement is measured in micrometres. Multiplying by a small width removes those units; adding the pieces gives a dimensionless probability.",
      ],
      result:
        "A high density near the start does not give a nonzero probability to one exact point at positive time.",
    },
    partialComparison: {
      given: "Widen the interval symmetrically while keeping the same distribution.",
      toComplete: "Can the probability decrease? Does the curve’s height at the centre change?",
      explanation:
        "The interval includes all its old positions and more, so its probability cannot decrease. The distribution has not changed, so its central height stays the same.",
    },
    prediction: {
      prompt:
        "At positive time with positive diffusivity, does a high density at the start give the exact starting point a nonzero probability?",
      choices: [
        "Yes, the density’s height is that probability.",
        "No, an exact point has zero width.",
      ],
      explanation:
        "For the continuous distribution, probability is area over a range of positions. A zero-width interval has zero area. The initial point mass is a separate case.",
    },
    explanation:
      "“How likely is the displacement to lie between −1 and +1 micrometres?” is an interval question. The model answers with an area, a dimensionless probability. The height of the density is measured per micrometre.\n\nAt the very start every particle sits at the starting point, so any stretch that includes it holds all of them. After that, the chance of being at one exact point is zero, however crowded its neighbourhood: only a stretch of some width has a chance, and that chance is the area under the curve across it.",
    transferCase: {
      condition: "What changes at the exact starting time?",
      explanation:
        "Before any spreading, the model puts all probability at the starting point. A closed interval containing that point has probability one, including the zero-width interval there. A finite-height Gaussian cannot represent this point mass.",
      whatChanges:
        "The initial point mass replaces the continuous density used at positive time and positive diffusivity.",
      whatStaysValid:
        "Total probability is one. An interval’s answer still depends on which positions it includes.",
    },
  },
  meanings: {
    logicalRole: "definition",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "exact-within-model",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const INFERENCE_STAGE = Object.freeze({
  id: "step-07",
  title: "Turn the question around",
  question: "What can a finite sample tell you?",
  computeFromShelf:
    "The osmotic and drag argument relates the diffusion coefficient to temperature, viscosity, radius and the molecular number. Inverting that relation requires a gas constant established without the same unknown molecular number and a radius measured independently of the displacements. A finite displacement sample adds uncertainty; the algebra alone supplies no interval.",
  premiseRefs: [
    { cardId: "vant-hoff-1887-osmotic-gas-law" },
    { cardId: "stokes-1851-sphere-drag" },
    { cardId: "fick-1855-diffusion-equation" },
  ],
  instrument: { instrumentId: "bm-07" },
  reasoning: [
    {
      foundationId: "error-and-inference",
      kind: "conditional-inference",
      label: "Separate an estimate from what its finite sample can establish.",
    },
    {
      foundationId: "two-measurements-two-unknowns",
      kind: "identifiability",
      label: "Supply an independent measurement to separate radius from molecular number.",
    },
  ],
  prerequisites: ["error-and-inference", "two-measurements-two-unknowns"],
  support: {
    workedExample: {
      prompt:
        "In an illustrative one-axis summary, the mean squared displacement is four square micrometres over two seconds, with no drift or measurement error.",
      steps: [
        "Divide the mean square by twice the observation interval: four divided by four gives a diffusion estimate of one square micrometre per second.",
        "At fixed temperature and viscosity, that diffusion estimate fixes the product of the particle radius and the molecular number.",
        "A candidate radius twice as large needs a molecular number half as large to predict the same spread. A separate radius measurement is needed to distinguish them.",
      ],
      result:
        "The spread alone cannot determine both radius and molecular number. A point estimate also needs a sample-size and observation-model account before an uncertainty interval can be justified.",
    },
    partialComparison: {
      given: "The radius was estimated by fitting the very same displacement data.",
      toComplete: "Has that supplied the independent information needed to count molecules?",
      explanation:
        "No. The fitted radius and molecular number still lie on the same compatible family. Reusing one measurement does not create a second constraint.",
    },
    prediction: {
      prompt:
        "If two radius-and-number pairs predict exactly the same displacement distribution, can more displacements of the same kind distinguish the pairs?",
      choices: [
        "Yes, a larger sample removes the ambiguity.",
        "No, an independent constraint is still needed.",
      ],
      explanation:
        "A larger independent sample can narrow uncertainty in the diffusion coefficient. It does not separate parameters that enter only through the same product.",
    },
    explanation:
      "In the next laboratory, the molecular number behind a made-up set of paths is hidden. How fast the particles spread fixes the radius and the number only together: a larger radius with a smaller number spreads at the same rate. So give it the radius from a separate measurement, estimate the number, and run it again and again to see how often the range you quote misses the true number.",
    transferCase: {
      condition: "What if these paths came from a camera?",
      explanation:
        "Calibration, blur and localization error enter the displacement estimate. Neighbouring recorded increments can share a position error, so treating them all as independent can make an uncertainty interval too narrow. The camera laboratory separates the recorded observations from the hidden paths.",
      whatChanges:
        "The observation model and the estimator’s admissible uncertainty calculation must account for the camera.",
      whatStaysValid:
        "Independent radius information is still required. With modern defined constants the result is a consistency check; synthetic paths test the inference method rather than establish that real particles obey it.",
    },
  },
  meanings: {
    logicalRole: "heuristic-inference",
    historicalStatus: "pedagogical-reconstruction",
    modelStatus: "approximation",
    executionStatus: "static-illustration",
  },
}) satisfies Stage;

export const BROWNIAN_STAGES: readonly Stage[] = Object.freeze([
  OBSERVABLE_STAGE,
  OSMOTIC_STAGE,
  DRAG_BALANCE_STAGE,
  TIME_SCALING_STAGE,
  INTERVAL_STAGE,
  INFERENCE_STAGE,
]);
