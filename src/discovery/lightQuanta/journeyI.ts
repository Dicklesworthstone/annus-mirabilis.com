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
import type { Fork, JourneyMove } from "../../content/schemas/journey.ts";

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
