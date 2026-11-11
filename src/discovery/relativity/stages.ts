/**
 * Special relativity's seven argument stages, shared by the journey record (am-4k0m).
 *
 * These records expose the discovery page's existing argument to the compiler, shelf audit and
 * local search. The route remains a pedagogical reconstruction, keeps Lorentz's 1904 account
 * explicitly live where the available evidence is equivalent, and makes no later result a premise.
 */
import type { Stage } from "../../content/schemas/journey.ts";

export const MAGNET_COIL_STAGE = Object.freeze({
  id: "step-01",
  title: "Start where the paper starts",
  question: "A magnet, a coil, and a needle that moves",
  computeFromShelf:
    "Maxwell's field equations supply the established electromagnetic description. The route begins from the paper's observation that exchanging which body moves changes the theoretical story while leaving the measured current tied only to their relative motion.",
  premiseRefs: [{ cardId: "maxwell-1873-field-equations" }],
  instrument: { instrumentId: "sr-02" },
  reasoning: [
    { foundationId: "fields-waves", kind: "field-description", label: "Distinguish the field description from the measured current it predicts." },
    { foundationId: "frames-events", kind: "relative-motion", label: "Describe the same apparatus from different inertial viewpoints." },
  ],
  prerequisites: ["fields-waves", "frames-events"],
  support: {
    workedExample: {
      prompt: "Compare two arrangements with the same relative magnet-coil speed: first move the magnet, then move the coil. What does the needle decide?",
      steps: [
        "The relative speed is the same in both arrangements.",
        "The measured current has the same magnitude for the corresponding setup.",
        "The 1904 field story nevertheless assigns different mechanisms depending on which body is called moving.",
      ],
      result: "The measurement does not reveal the preferred assignment of motion that the two stories presuppose.",
    },
    partialComparison: {
      given: "Two descriptions give the same current for every measurement made on the apparatus.",
      toComplete: "What would be needed to make their difference empirical?",
      explanation:
        "Some additional observable would have to distinguish the putative state of absolute motion. Without one, the difference remains in the description rather than in the measured current.",
    },
    explanation:
      "Hold a coil of wire still and push a magnet into it: the needle deflects. Now hold the magnet still and move the coil over it instead, at the same relative speed: the needle deflects by the same amount. Every measurement you can make on the two arrangements agrees.\n\nThe accepted theory of 1904 does not describe them the same way. In the first case the moving magnet is said to produce an electric field; in the second the current is attributed to the wire moving through an unchanged field. Two mechanisms, one needle.",
  },
  meanings: { logicalRole: "observation", historicalStatus: "pedagogical-reconstruction", modelStatus: "idealized-representation", executionStatus: "static-illustration" },
}) satisfies Stage;

export const ASYMMETRY_STAGE = Object.freeze({
  id: "step-02",
  title: "Decide whether that bothers you",
  question: "An asymmetry in the telling, not in the measuring",
  computeFromShelf:
    "Michelson and Morley's null result is one available constraint on attempts to identify motion relative to a light medium. It is not treated as the sole cause of the paper, and the shelf leaves Lorentz's ether theory available as a response rather than calling the ether refuted.",
  premiseRefs: [{ cardId: "michelson-morley-1887-no-drift" }],
  reasoning: [
    { foundationId: "error-and-inference", kind: "constraint-scope", label: "Use a null result only for the prediction it actually tests." },
    { foundationId: "frames-events", kind: "equivalence", label: "Ask whether an absolute-motion label has an observable consequence." },
  ],
  prerequisites: ["error-and-inference", "frames-events"],
  support: {
    workedExample: {
      prompt: "An ether-at-rest model predicts a 0.4-fringe shift, while the observed displacement is less than one twentieth of that. What has failed?",
      steps: [
        "The stated model predicts a second-order fringe displacement of the quoted size.",
        "The measured shift is far smaller.",
        "That specific uncorrected model is constrained; the observation alone does not exclude every possible ether theory.",
      ],
      result: "A prediction fails without making the broader ontology disappear by decree.",
    },
    partialComparison: {
      given: "Lorentz adds contraction and local time and recovers the null result.",
      toComplete: "Has Michelson-Morley alone refuted Lorentz's 1904 account?",
      explanation:
        "No. Within the shelf's scope Lorentz's account was constructed to reproduce the null results, so the route keeps it as a serious rival.",
    },
    explanation:
      "Nothing is predicted wrongly by the magnet-coil asymmetry itself. What is odd is that the theory distinguishes two situations no measurement distinguishes. Attempts to reveal motion relative to the light medium had also failed. The route uses those failures as constraints, not as a historical claim about one experiment causing the paper.",
    transferCase: {
      condition: "What if a new experiment directly measured absolute motion through the medium?",
      explanation:
        "Then the descriptive asymmetry could acquire an observable anchor and the equivalence claim would have to be reconsidered.",
      whatChanges: "Absolute-motion labels would no longer be empirically idle.",
      whatStaysValid: "The magnet-coil current still depends on the relative motion actually measured in that apparatus.",
    },
  },
  meanings: { logicalRole: "qualification", historicalStatus: "pedagogical-reconstruction", modelStatus: "idealized-representation", executionStatus: "static-illustration" },
}) satisfies Stage;

export const TWO_PRINCIPLES_STAGE = Object.freeze({
  id: "step-03",
  title: "Make a prediction",
  question: "Can you keep both of these at once?",
  computeFromShelf:
    "Poincaré's 1904 relativity principle supplies the no-detectable-uniform-motion starting point, while Maxwell's field theory supplies a definite light speed. Newton's absolute-time convention is the background assumption that makes ordinary speed addition look unavoidable.",
  premiseRefs: [
    { cardId: "poincare-1904-principle-of-relativity" },
    { cardId: "maxwell-1873-field-equations" },
    { cardId: "newton-1687-absolute-time" },
  ],
  reasoning: [
    { foundationId: "frames-events", kind: "compare-frames", label: "State what two inertial observers assign to the same event pair." },
    { foundationId: "bridge-fractions-ratios", kind: "speed-ratio", label: "Track how distance divided by time produces the apparent conflict." },
  ],
  prerequisites: ["frames-events", "bridge-fractions-ratios"],
  support: {
    workedExample: {
      prompt: "If one observer moves at half the light speed relative to another and both use ordinary speed addition, what speed would the moving observer assign to a forward light ray?",
      steps: [
        "The resting observer assigns the ray speed c.",
        "Ordinary subtraction of velocities gives c minus 0.5c.",
        "That result is 0.5c, which conflicts with the premise that both inertial observers measure the same light speed.",
      ],
      result: "The two principles and ordinary kinematics cannot all survive unchanged.",
    },
    partialComparison: {
      given: "Keep both principles but allow distant observers to disagree about elapsed time between separated events.",
      toComplete: "Is ordinary speed addition still forced?",
      explanation:
        "No. The usual addition rule assumes the observers share the same time interval. Changing that premise opens a third option besides abandoning either principle.",
    },
    prediction: {
      prompt: "Which hidden premise makes the two principles look incompatible under ordinary kinematics?",
      choices: ["A shared absolute time.", "The existence of electric charge.", "The inverse-square law."],
      explanation:
        "Ordinary speed addition follows from combining relative positions with a time coordinate treated as the same for both observers.",
    },
    explanation:
      "First: the laws of physics look the same to anyone moving steadily. Second: light travels through empty space at a definite speed independent of its source. Under ordinary speed addition those statements appear incompatible. The route asks which more basic assumption made that addition rule seem compulsory.",
  },
  meanings: { logicalRole: "prediction", historicalStatus: "pedagogical-reconstruction", modelStatus: "idealized-representation", executionStatus: "static-illustration" },
}) satisfies Stage;

export const SYNCHRONIZATION_STAGE = Object.freeze({
  id: "step-04",
  title: "Find the assumption",
  question: "What does it take to say two distant things happened at once?",
  computeFromShelf:
    "Newton's absolute time supplies the inherited convention this stage makes explicit. The paper replaces an unexamined global simultaneity with an operational rule: compare separated clocks using light signals and define agreement through equal out-and-back travel times.",
  premiseRefs: [{ cardId: "newton-1687-absolute-time" }],
  instrument: { instrumentId: "sr-01" },
  reasoning: [
    { foundationId: "frames-events", kind: "operational-definition", label: "Define a distant time comparison by events and signal exchanges." },
    { foundationId: "bridge-equals-sign-relationship", kind: "definition", label: "Treat equal travel times as the stated synchronization rule, not an observed absolute fact." },
  ],
  prerequisites: ["frames-events", "bridge-equals-sign-relationship"],
  support: {
    workedExample: {
      prompt: "Clock A sends a light pulse at 0 s, clock B reflects it when B reads 5 s, and A receives it at 10 s. Under the equal-legs convention, is B synchronized with A for that exchange?",
      steps: [
        "The midpoint of A's send and receive readings is 5 s.",
        "B reads 5 s at reflection.",
        "The convention therefore declares the clocks synchronized for this exchange.",
      ],
      result: "The agreement follows from the stated procedure, not from access to an observer-independent distant present.",
    },
    partialComparison: {
      given: "Another inertial observer applies the same rule with clocks at rest in that observer's frame.",
      toComplete: "Must that observer select the same distant event as simultaneous?",
      explanation:
        "No. The synchronization procedure is applied in a different inertial frame, and the resulting simultaneity relation need not match the first observer's.",
    },
    prediction: {
      prompt: "Is distant simultaneity in this route measured before the rule is chosen?",
      choices: ["No; the rule defines the comparison.", "Yes; the clocks reveal an absolute fact automatically."],
      explanation:
        "The stage's non-obvious move is to make the comparison rule explicit and then follow its consequences.",
    },
    explanation:
      "Two events at one place can be compared with one clock. Two events far apart require two clocks, and those clocks must first be synchronized by some procedure. The paper lays down such a procedure with light signals. Once that definition is explicit, observers in relative motion need not agree about which distant events are simultaneous.",
    transferCase: {
      condition: "What if the synchronization signal propagated anisotropically under the chosen convention?",
      explanation:
        "Then the equal-leg rule would no longer describe that signal model, and the coordinate construction would have to state a different convention rather than silently reuse the old one.",
      whatChanges: "The assigned distant time coordinate changes with the synchronization convention.",
      whatStaysValid: "A distant comparison still requires an explicit operational rule.",
    },
  },
  meanings: { logicalRole: "definition", historicalStatus: "pedagogical-reconstruction", modelStatus: "exact-within-model", executionStatus: "static-illustration" },
}) satisfies Stage;

export const MAP_STAGE = Object.freeze({
  id: "step-05",
  title: "Build the map",
  question: "What the definition forces",
  computeFromShelf:
    "With the relativity principle and fixed light speed retained, and with synchronization made explicit, the map between inertial coordinates must preserve the light-cone relation and reduce to the ordinary map at low speed. Homogeneity and isotropy exclude arbitrary position- or direction-dependent terms.",
  premiseRefs: [
    { cardId: "poincare-1904-principle-of-relativity" },
    { cardId: "maxwell-1873-field-equations" },
  ],
  instrument: { instrumentId: "sr-04" },
  reasoning: [
    { foundationId: "matrices-linear-maps", kind: "coordinate-map", label: "Represent the inertial-frame relation as a linear map." },
    { foundationId: "conservation-symmetry", kind: "symmetry", label: "Use homogeneity, isotropy and reciprocity to restrict the map." },
  ],
  prerequisites: ["matrices-linear-maps", "conservation-symmetry"],
  support: {
    workedExample: {
      prompt: "For a candidate linear map, why must a light ray x = ct also satisfy x' = ct'?",
      steps: [
        "The second principle says an inertial observer measures the same light speed.",
        "A ray through the shared origin therefore lies on x = ct in one frame and x' = ct' in the other.",
        "Requiring the map to carry one relation into the other constrains its coefficients.",
      ],
      result: "Preserving the light-speed relation is a structural constraint on the coordinate map.",
    },
    partialComparison: {
      given: "A candidate map preserves forward-moving light but not backward-moving light.",
      toComplete: "Which assumption has it violated?",
      explanation:
        "It violates isotropy and the requirement that light propagate at the same speed in both directions in the inertial frame.",
    },
    prediction: {
      prompt: "At very small relative speed, what must the new map approach?",
      choices: ["The ordinary Galilean map.", "A map that doubles all lengths.", "A frame-dependent constant offset with no low-speed limit."],
      explanation:
        "The relativistic relation must recover the familiar low-speed description where its corrections are negligible.",
    },
    explanation:
      "Take the two principles and the clock-setting procedure as given, then ask what relation can connect one inertial observer's coordinates to another's. Add homogeneity and isotropy. The coefficients are no longer arbitrary: preserving the light-speed relation in both directions and reducing to ordinary kinematics at small speed fixes the familiar Lorentz map.",
    transferCase: {
      condition: "What if space had a preferred direction?",
      explanation:
        "Then isotropy could not be used to eliminate direction-dependent coefficients, so this derivation would no longer force the same symmetric map.",
      whatChanges: "Additional direction-dependent terms could be admissible.",
      whatStaysValid: "The map must still be tested against the postulates actually retained.",
    },
  },
  meanings: { logicalRole: "derivation", historicalStatus: "pedagogical-reconstruction", modelStatus: "exact-within-model", executionStatus: "static-illustration" },
}) satisfies Stage;

export const CONSEQUENCES_STAGE = Object.freeze({
  id: "step-06",
  title: "Read off the consequences",
  question: "Moving clocks, moving rods, and added speeds",
  computeFromShelf:
    "Once the coordinate map is fixed, time dilation, length contraction and the velocity-composition rule are deductions rather than extra postulates. Fizeau's moving-water result supplies a pre-1905 check on the composition law's first-order consequence.",
  premiseRefs: [{ cardId: "fizeau-1851-light-in-moving-water" }],
  instrument: { instrumentId: "sr-05" },
  reasoning: [
    { foundationId: "matrices-linear-maps", kind: "read-map", label: "Hold the appropriate events fixed and read transformed intervals from the coordinate map." },
    { foundationId: "derivatives", kind: "velocity-transform", label: "Differentiate transformed positions with respect to transformed time to obtain velocity composition." },
  ],
  prerequisites: ["matrices-linear-maps", "derivatives"],
  support: {
    workedExample: {
      prompt: "A moving clock advances 8 s while the resting-frame coordinate time advances 10 s. What fraction of the resting time does the moving clock record?",
      steps: [
        "Divide the moving clock reading by the resting-frame interval.",
        "Eight divided by ten is 0.8.",
        "The moving clock therefore records 80 percent of that coordinate-time interval.",
      ],
      result: "The clock reading is an operational comparison between the same reunion events, not a camera-delay effect.",
    },
    partialComparison: {
      given: "A camera sees a moving clock through light that takes time to arrive.",
      toComplete: "Is the photographic delay itself the time-dilation prediction?",
      explanation:
        "No. Propagation delay is a separate optical effect. Time dilation compares clock readings assigned to the relevant events after the coordinate procedure is specified.",
    },
    prediction: {
      prompt: "If two sub-light speeds are composed with the relativistic rule, can the result exceed the light speed?",
      choices: ["No.", "Yes, whenever their ordinary sum exceeds c."],
      explanation:
        "The denominator in the composition rule keeps the result below c for sub-light inputs.",
    },
    explanation:
      "The moving-clock, moving-rod and velocity-composition results are read from the same map. They are not three new assumptions. The changed addition rule resolves the apparent conflict of step 03, while the clock and rod results state what the same operational measurements return in relatively moving frames.",
    transferCase: {
      condition: "What if the relative speed is tiny compared with the speed of light?",
      explanation:
        "The correction factors approach one and the composition denominator approaches one, so the ordinary low-speed rules reappear to the expected accuracy.",
      whatChanges: "Relativistic corrections become numerically negligible.",
      whatStaysValid: "The same transformation remains the model; the approximation changes.",
    },
  },
  meanings: { logicalRole: "derivation", historicalStatus: "pedagogical-reconstruction", modelStatus: "exact-within-model", executionStatus: "static-illustration" },
}) satisfies Stage;

export const LORENTZ_RIVAL_STAGE = Object.freeze({
  id: "step-07",
  title: "Meet the serious rival",
  question: "Lorentz gets the same formulas, and is not refuted",
  computeFromShelf:
    "Lorentz's 1904 theory retains an ether, contraction and local time while reproducing the available null results. The route therefore treats it as empirically equivalent within the stated shelf rather than as a failed straw man.",
  premiseRefs: [
    { cardId: "lorentz-1904-corresponding-states" },
    { cardId: "michelson-morley-1887-no-drift" },
  ],
  reasoning: [
    { foundationId: "error-and-inference", kind: "underdetermination", label: "Do not claim an experiment distinguishes theories that make the same tested prediction." },
    { foundationId: "frames-events", kind: "interpretation", label: "Separate a coordinate formalism from the physical interpretation attached to it." },
  ],
  prerequisites: ["error-and-inference", "frames-events"],
  support: {
    workedExample: {
      prompt: "If Lorentz's 1904 account and the paper's kinematics both predict the same Michelson-Morley null result, can that experiment choose between them?",
      steps: [
        "List the prediction of each account for the measured fringe shift.",
        "Within the stated model scope both predict the observed null.",
        "An observation on which the predictions agree supplies no discriminator between the two accounts.",
      ],
      result: "Empirical agreement at the measured quantity leaves the interpretive difference open.",
    },
    partialComparison: {
      given: "The paper's route uses no detectable ether while Lorentz retains one.",
      toComplete: "Is economy an experimental refutation?",
      explanation:
        "No. Economy can motivate a preference, but it is not a measurement that Lorentz's account fails.",
    },
    prediction: {
      prompt: "What status should the route give Lorentz's account on the 1904 shelf?",
      choices: ["Empirically equivalent within the stated scope.", "Refuted by Michelson-Morley alone."],
      explanation:
        "The shelf record explicitly says Lorentz's theory accounts for the relevant negative results, so the route must not manufacture a discriminatory experiment.",
    },
    explanation:
      "Lorentz keeps the light medium, contraction and local time and reaches the same formulas for the tested phenomena. Within this shelf the two accounts are not separated by measurement. The route may compare what each assumes and how broadly its kinematics applies, but it does not relabel equivalence as refutation.",
    transferCase: {
      condition: "What if a future measurement produced different predictions for the two accounts?",
      explanation:
        "Then the equivalence would have a smaller scope, and that measurement could enter as a real discriminator rather than a philosophical preference.",
      whatChanges: "The empirical status of the rival would depend on the new prediction and result.",
      whatStaysValid: "Agreement on the older null results remains agreement on those results.",
    },
  },
  meanings: { logicalRole: "qualification", historicalStatus: "pedagogical-reconstruction", modelStatus: "idealized-representation", executionStatus: "static-illustration" },
}) satisfies Stage;

export const SPECIAL_RELATIVITY_STAGES = Object.freeze([
  MAGNET_COIL_STAGE,
  ASYMMETRY_STAGE,
  TWO_PRINCIPLES_STAGE,
  SYNCHRONIZATION_STAGE,
  MAP_STAGE,
  CONSEQUENCES_STAGE,
  LORENTZ_RIVAL_STAGE,
]) satisfies readonly Stage[];
