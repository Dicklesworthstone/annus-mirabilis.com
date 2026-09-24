/**
 * Journey I, "why suspect that light comes in energy quanta?" (plan §9.2): the parts of the route
 * that the skeleton components render on /discover/light-quanta/. Typed against the journey
 * schema, as Journeys II and IV are (src/discovery/brownian/journeyII.ts,
 * src/discovery/massEnergy/journeyIV.ts).
 *
 * A route you could take, not a transcript of Einstein's private thinking. The narration keeps the
 * paper's own letters (R, N, β, ν, P) and its word "heuristic"; h appears only in labelled
 * modern-lens text. Every card a part names is on the page's shelf (src/content/lightQuantaShelf.ts).
 */
import type {
  Doors,
  Fork,
  JourneyMove,
  PpeTask,
  SourceJump,
  WorldCheck,
} from "../../content/schemas/journey.ts";
import { LQ05_PRESETS } from "../../experiments/lq05/definition.ts";
import { encodeLq05Settings } from "../../experiments/lq05/permalink.ts";
import { PRINTED_STOPPING_CHECK } from "./worldCheck.ts";

/** The observation that does not fit (am-disc-journey-i-chain-n1lh). */
export const NAGGING_FACT =
  "Turn up the lamp and the electrons come out in greater numbers, but not with greater energy. A stronger wave should shake them harder.";

/** One sentence, second person (plan §9.1 item 3). */
export const FIRST_HONEST_QUESTION =
  "Is there any regime of light where you can do honest thermodynamics without knowing what light is made of?";

/**
 * The one non-obvious step (am-disc-journey-i-chain-n1lh, Stage F): reading the radiation entropy's
 * multiplier of log(V/V₀) as a count of independent things, in the way the gas law's multiplier
 * counts molecules. Its logical role is a heuristic inference, and the summary says so. It points
 * at the paper's §6 argument and the record for the effective count there.
 *
 * The summary is the bead's authored sentence, recorded as a draft: only a named physics reviewer
 * may set it reviewed.
 */
export const MOVE: JourneyMove = {
  label: "Read the multiplier as a count of independent quanta",
  chainId: "arg-lq-entropy-correspondence",
  stepId: "eq-model-lq-effective-count",
  r0Summary: {
    text: "When light of low density and a single frequency is given more room, its entropy, the quantity that measures how many ways its energy can be arranged, changes in the same way as that of a gas of independent particles, which suggests, as a heuristic step rather than a proof, treating the light's energy as if it came in independent parts whose size is set by the frequency.",
    reviewState: "draft",
  },
};

/** Where the marked step opens in the reading face: the paper's §6 argument. */
export const MOVE_HREF = "/papers/light-quanta/s6/#arg-lq-entropy-correspondence";

/**
 * Fork A (the bead's Fork A): which account to give of the volume logarithm both sides accept.
 * Planck's resonator account keeps every thermodynamic result and is weaker, not refuted.
 */
export const FORK_ENTROPY_ACCOUNT: Fork = {
  id: "arg-fork-lq-volume-logarithm",
  afterStageId: "step-04",
  question:
    "Two accounts of one result both sides accept: where have you seen the logarithm of the volume before?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-lq-resonator-elements",
      label: "The elements belong to the resonators",
      proponent: { name: "Max Planck, 1900–1901", cardId: "planck-1901-energy-elements" },
      hypothesis:
        "The logarithm is a coincidence of the mathematics. Radiation stays continuous, and the finite energy elements are a property of the resonators in the walls that exchange energy with it.",
      worksWhen:
        "For every thermodynamic result about radiation in equilibrium: the spectrum, its entropy, and the constants Planck drew from them.",
      steps: [
        {
          text: "Keep the field continuous, as the wave theory's successes in optics require.",
        },
        {
          text: "Put the finite elements where Planck put them, in the resonators' exchange of energy with the field.",
        },
        {
          text: "Ask what this says about one act of absorption at a metal surface. It gives no reason for an electron's energy to be independent of the brightness.",
        },
      ],
      outcome: {
        type: "correct-but-weaker",
        plainLanguage:
          "Every thermodynamic result stands, and nothing on the 1904 shelf refutes this account. In 1904 terms it has nothing to say about Lenard's finding that brighter light does not give faster electrons: it explains less, and what it does explain it gets right.",
      },
    },
    {
      id: "arg-branch-lq-gas-law-again",
      label: "It is the gas law again",
      hypothesis:
        "The radiation's entropy multiplies log(V/V₀) by E/(βν), and the gas law multiplies the same logarithm by the number of independent molecules. Read E/(βν), with R and N restoring the units, as a number of independent things.",
      worksWhen:
        "For radiation of low density at one frequency, where Wien's law holds, and only as far as this one thermodynamic comparison goes.",
      steps: [
        {
          text: "Write the gas law: for n independent molecules the entropy changes by (R/N) n log(V/V₀).",
        },
        {
          text: "Write the radiation's: its entropy changes by (E/(βν)) log(V/V₀).",
        },
        {
          text: "Match the multipliers. In this respect the radiation behaves as if it consisted of n = (N/R) E/(βν) independent quanta, each of energy Rβν/N.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's heuristic step: a resemblance in one thermodynamic property, read as a count. It is not yet a claim about how light is emitted or absorbed, and the paper goes on to test that.",
      },
    },
  ],
};

/**
 * Fork B (the bead's Fork B): what one lump does to one electron. The spreading account fails
 * against Lenard's 1902 card on the shelf; the whole-quantum account is the paper's §8 route,
 * kept heuristic.
 */
export const FORK_ONE_LUMP: Fork = {
  id: "arg-fork-lq-one-lump",
  afterStageId: "step-06",
  question:
    "If the light's energy arrives in lumps, what happens when one lump meets one electron?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-lq-energy-spreads",
      label: "The energy spreads through the metal",
      hypothesis:
        "As in the wave picture, the light's energy spreads over the lit surface, and each electron gathers energy from it until it can leave.",
      worksWhen:
        "For how much energy the surface takes up in total, which does grow with the brightness.",
      steps: [
        {
          text: "An electron that gathers energy from a spread-out supply gets more of it when the supply is richer.",
        },
        { text: "So brighter light should give faster electrons, and not only more of them." },
        {
          text: "Lenard compared the fastest electrons at different brightnesses in 1902, and their energy did not change.",
        },
      ],
      outcome: {
        type: "dead-end-on-constraint",
        constraintRef: "lenard-1902-photoelectric",
        plainLanguage:
          "It predicts what Lenard did not see: the greatest energy of the electrons would grow with the brightness.",
      },
    },
    {
      id: "arg-branch-lq-whole-quantum",
      label: "One electron takes one whole quantum",
      hypothesis:
        "A single quantum gives all its energy to a single electron, which pays the cost P of leaving the metal and keeps the rest.",
      worksWhen:
        "As a heuristic, for the fastest electrons, whose energy does not depend on how bright the light is.",
      steps: [
        { text: "Each quantum carries Rβν/N, fixed by the frequency." },
        {
          text: "An electron that takes one quantum and pays the exit cost P leaves with at most Rβν/N − P.",
        },
        {
          text: "Brighter light brings more quanta, so more electrons, each with the same greatest energy, which is what Lenard saw. The paper adds a prediction he had not tested: the greatest energy rises in a straight line with the frequency.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's route in §8, and the paper keeps it a heuristic. It predicts a stopping potential that rises in a straight line with the frequency and stays the same with the brightness, which Millikan measured in 1916.",
      },
    },
  ],
};

/**
 * Check it against the world (plan §9.1 item 7). The prediction is LQ-08's own stopping potential,
 * read from the accepted snapshot of the laboratory embedded beside it; the static reference is the
 * paper's §8 figure from its own constants (worldCheck.ts). Millikan 1916 is later evidence and is
 * cited, not plotted.
 */
export const WORLD_CHECK: WorldCheck = {
  id: "lq-world-check-stopping-potential",
  claim:
    "Section 8 of the paper puts a number to the prediction. Light of frequency 1.03 × 10¹⁵ per second, with the cost of leaving the metal neglected, should give electrons that a potential of about 4.3 volts can stop, which the paper says agrees in order of magnitude with Lenard's results. Set the frequency and the exit cost in the laboratory below and read the stopping potential it computes.",
  instrumentId: "lq-08",
  quantityId: "stoppingPotentialMagnitude",
  expected: "about 4.3 volts at 1.03 × 10¹⁵ per second, with the exit cost neglected",
  comparisonKind: "printed-prediction",
  staticWorkedExample: {
    label: "What the paper prints in §8",
    value: `about 4.3 volts; from the paper’s own constants, ${Number(PRINTED_STOPPING_CHECK.volts.toPrecision(3))} V`,
    unit: "",
    constantSetId: PRINTED_STOPPING_CHECK.constantSetId,
  },
};

/**
 * What Einstein actually wrote (plan §9.1 item 8): one jump to each part of the paper the route
 * has used. Each target is an argument anchor on its section's page, checked on live on
 * 2026-09-24 (s5's arg-lq-statistical-probability did not resolve, so §§5–6 enters at
 * arg-lq-independent-configurations). Each shows its static pointer: no instrument state is
 * carried into the reading yet, so no weave predicate is named.
 */
export const SOURCE_JUMPS: readonly SourceJump[] = [
  {
    id: "jump-lq-s4-dilute-entropy",
    label: "Read §4: the limiting law for the entropy of dilute radiation",
    paperId: "light-quanta",
    section: "s4",
    targetAnchor: "arg-lq-fixed-band-volume",
    pointer:
      "Where Wien's law holds, at low density and high frequency, the paper finds how the entropy of one narrow band of radiation depends on the volume it fills: through the logarithm of the volume ratio, multiplied by E/βν.",
  },
  {
    id: "jump-lq-s5-s6-volume-dependence",
    label: "Read §§5–6: the same volume dependence for a gas, and what it suggests",
    paperId: "light-quanta",
    section: "s5",
    targetAnchor: "arg-lq-independent-configurations",
    pointer:
      "Section 5 works out, by Boltzmann's principle, how the entropy of n independent moving points depends on the volume. Section 6 sets the two results side by side and reads the radiation's multiplier as a number of independent energy quanta, as a heuristic.",
  },
  {
    id: "jump-lq-s7-stokes",
    label: "Read §7: Stokes's rule for fluorescent light",
    paperId: "light-quanta",
    section: "s7",
    targetAnchor: "arg-lq-fluorescence-budget",
    pointer:
      "If each quantum of the exciting light is taken up whole and gives rise to light of its own, the light given off can have no higher a frequency than the light that excites it. The paper states the conditions under which the rule may fail.",
  },
  {
    id: "jump-lq-s8-photoelectric",
    label: "Read §8: electrons produced by light",
    paperId: "light-quanta",
    section: "s8",
    targetAnchor: "arg-lq-photoelectric-energy",
    pointer:
      "An electron takes up one quantum's energy and spends part of it leaving the metal. The greatest energy it leaves with rises in a straight line with the frequency and does not depend on the intensity; the number of electrons does.",
  },
  {
    id: "jump-lq-s9-ionization",
    label: "Read §9: ionization of gases by ultraviolet light",
    paperId: "light-quanta",
    section: "s9",
    targetAnchor: "arg-lq-ionization-and-counts",
    pointer:
      "If one quantum ionizes one molecule, the energy of a quantum of the ionizing light cannot be less than the energy needed to ionize it. The paper compares the bound with Stark's measurement and names what it does not settle.",
  },
];

const N60_LOG = LQ05_PRESETS["lq-05-n60-log"];

/**
 * LQ-05 opened at the preset the programmer door names: 60 points, logarithmic view. Were the
 * preset renamed, the door would open the laboratory's own worked example instead, and the route
 * test that asserts n = 60 on the logarithmic view fails.
 */
export const LQ05_N60_LOG_HREF = N60_LOG
  ? `/lab/lq-05/?${encodeLq05Settings(N60_LOG.parameters)}`
  : "/lab/lq-05/";

const LOCKED = LQ05_PRESETS["lq-05-locked-positions"];

/** LQ-05 at its locked counterexample, for step 09's explanation item; as above if renamed. */
export const LQ05_LOCKED_HREF = LOCKED
  ? `/lab/lq-05/?${encodeLq05Settings(LOCKED.parameters)}`
  : "/lab/lq-05/";

/**
 * The doors (plan §9.5): the paper's argument, and a side door for programmers through the
 * microstate counter of LQ-05. Both arrive at the effective count of §6, n = (N/R)(E/βν), which is
 * the exponent of the paper's probability W = (V/V₀)^n; it is the compiled record the move marks.
 */
export const DOORS: Doors = {
  frontDoor: {
    id: "door-lq-front",
    title: "The paper's argument from Wien's law, §§1–6",
    arrivesAtEquationId: "eq-model-lq-effective-count",
    arrivesAtLabel:
      "the effective count n = (N/R)(E/βν), the power to which the probability W raises V/V₀",
    href: "/papers/light-quanta/s4/#arg-lq-fixed-band-volume",
    summary:
      "Take Wien's law where it holds, work out how the entropy of dilute radiation depends on its volume, and compare that with a gas of independent molecules.",
  },
  sideDoors: [
    {
      id: "door-lq-programmer",
      title: "The microstate counter, for programmers",
      arrivesAtEquationId: "eq-model-lq-effective-count",
      arrivesAtLabel:
        "the effective count n = (N/R)(E/βν), the power to which the probability W raises V/V₀",
      href: LQ05_N60_LOG_HREF,
      summary:
        "Write the loop: the chance that n labelled points all sit in a fraction f of the box is f to the power n. Given that the entropy of dilute radiation changes with volume like (E/βν) ln f, invert it to a count. The same loop shows what happens when the points are not independent. In the modern lens the count is E/hν, with h = Rβ/N.",
    },
  ],
};

/**
 * Predict, perturb, explain (am-disc-journey-i-chain-n1lh; its id follows am-disc-ppe-teachback-
 * wnp7's ppe-<paper slug>-<sections>). The perturbation is made in the laboratory already on this
 * page at step 08, through its own controls and its preset button, so nothing is re-embedded.
 */
export const PPE_TASK: PpeTask = {
  promptId: "ppe-light-quanta-s7-s9",
  task: "Predict first. A lamp gets brighter, but its frequency stays below the threshold. Of the number of electrons freed each second, the greatest energy any of them leaves with, and the power falling on the metal, which should not rise merely because the laboratory draws more marks arriving?",
  perturbPrompt:
    "In the laboratory at step 08, keep the 2 eV surface, set the frequency below 483.6 THz, and double the incident power: the count of electrons stays at zero, and the laboratory says that in this model no electron is emitted. Then press its preset “The intensity probe (rate vs energy)”, which is above the threshold, and double the power again: the rate rises, and the greatest energy stays where it was.",
  explainPrompt:
    "Explain both results in terms of what one quantum can do, and say what the moving marks in the laboratory are and are not.",
};
