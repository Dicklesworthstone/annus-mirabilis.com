/**
 * Journey IV, "can emitting light change inertia?" (plan §9.5): the parts of the route that the
 * skeleton components render on /discover/mass-energy/. Typed against the journey schema, as
 * Journey II's are (src/discovery/brownian/journeyII.ts).
 *
 * A route you could take, not a transcript of Einstein's private thinking. Every card a part
 * names is on the page's shelf (src/content/massEnergyShelf.ts), where the one 1905 import is
 * marked as one.
 */
import type { Fork, JourneyMove, PpeTask, SourceJump } from "../../content/schemas/journey.ts";

/** The observation that does not fit (plan §9.5). */
export const NAGGING_FACT =
  "A body that gives off light in one direction recoils. If it gives off equal pulses in opposite directions it does not recoil, and yet the two pulses carry different energies as a moving observer measures them.";

/** One sentence, second person. */
export const FIRST_HONEST_QUESTION =
  "If you already know how the energy of a light pulse changes between frames, what does the conservation of energy force you to say about the body that gave it off?";

/**
 * The one non-obvious step: writing the same emission down a second time, from a moving frame, so
 * that the body's unknown energy appears in both accounts and a subtraction removes it. It is the
 * paper's two-ledger argument, arg-me-two-ledgers, whose second account is the moving ledger.
 */
export const MOVE: JourneyMove = {
  label: "Describe the same emission twice",
  chainId: "arg-me-two-ledgers",
  stepId: "eq-model-me-moving-ledger",
  r0Summary: {
    text: "Write the body's energy before and after the emission as a resting observer does, and again as a moving observer does. Each account holds the body's unknown total energy, the same unknown in both, so taking one account from the other removes it and leaves only what can be computed.",
    reviewState: "draft",
  },
};

/** Where the marked step opens, in the reading face. */
export const MOVE_HREF = "/papers/mass-energy/#arg-me-two-ledgers";

/**
 * The fork (plan §9.5): Poincaré's fictitious fluid, worked honestly as bookkeeping that is
 * empirically equivalent within its scope, beside the paper's route. Neither is mocked, and the
 * fluid is not declared refuted.
 */
export const FORK_POINCARE: Fork = {
  id: "arg-fork-poincare-fluid",
  afterStageId: "step-05",
  question: "Where does the mass go: to a fluid you assign to the light, or out of the body?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-fictitious-fluid",
      label: "Give the radiation a fictitious fluid",
      proponent: { name: "Henri Poincaré, 1900", cardId: "poincare-1900-fictitious-fluid" },
      hypothesis:
        "Keep the centre of mass moving uniformly by treating the radiation's energy as a fluid that carries mass: its energy divided by the square of the speed of light. The question is the field's bookkeeping, not the emitting body's inertia.",
      worksWhen:
        "Wherever the question is how the centre of mass of a body and its radiation moves. Within that scope it gives the same numbers as the paper's route.",
      steps: [
        {
          text: "Let a body give off a pulse of radiation. It recoils, and unless the travelling radiation is counted as carrying mass, the centre of mass of the body and the radiation together moves.",
        },
        {
          text: "Give the radiation a mass equal to its energy divided by the square of the speed of light, and the centre of mass moves uniformly again.",
        },
        {
          text: "Now ask what the body lost. The fluid accounts for the radiation. It does not say what happened to the body, and that is the question this route answers.",
        },
      ],
      outcome: {
        type: "empirically-equivalent-not-refuted",
        scopeNote: "The centre of mass of a body and its radiation.",
        plainLanguage:
          "Within its scope the fluid gives the same numbers, and nothing on the 1904 shelf refutes it. It says something different: it gives mass to the light and leaves the body's inertia alone, where the paper's route says the body's inertia changed.",
      },
    },
    {
      id: "arg-branch-energy-has-inertia",
      label: "Energy has inertia",
      hypothesis:
        "The energy the body gave off was part of its inertia, so its mass fell by that energy divided by the square of the speed of light.",
      worksWhen:
        "Under the two-ledger argument's premises: the light-energy transformation, energy conservation in both frames, and an offset between the ledgers that the emission does not change.",
      steps: [
        {
          text: "Read the slow-speed result as a statement about the body: its energy of motion changed as though its mass had fallen by L/V².",
        },
        {
          text: "Generalise, as the paper does in one sentence, from light to any energy leaving the body: the mass of a body is a measure of its energy content.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's conclusion. Its last step, from light to any form of energy, is a stated inference and not a further derivation.",
      },
    },
  ],
};

/** What Einstein wrote: jumps into the reading face where the paper makes each move. */
export const SOURCE_JUMPS: readonly SourceJump[] = [
  {
    id: "jump-me-two-ledgers",
    label: "Read the argument: two accounts of the same loss",
    paperId: "mass-energy",
    section: "",
    targetAnchor: "arg-me-two-ledgers",
    pointer:
      "The move: the paper writes the body's energy before and after the emission in two frames, and uses the June paper's rule for the energy of the light in each.",
  },
  {
    id: "jump-me-subtraction",
    label: "Read the argument: which difference survives the subtraction",
    paperId: "mass-energy",
    section: "",
    targetAnchor: "arg-me-subtraction",
    pointer:
      "Taking the accounts from each other removes the body's unknown energy and leaves its energy of motion, with the premise about the offset stated.",
  },
  {
    id: "jump-me-small-speed",
    label: "Read the argument: why the slow-speed coefficient is the one to read",
    paperId: "mass-energy",
    section: "",
    targetAnchor: "arg-me-small-speed",
    pointer:
      "The paper's last page takes the slow-speed limit, sets it beside one half m v squared, and states the conclusion in a sentence.",
  },
];

/** Predict, perturb, explain, on the boundary ledger (ME-03). */
export const PPE_TASK: PpeTask = {
  promptId: "me-predict-perturb-explain-joule",
  task: "Predict first. A body gives off one joule of light. Does its mass fall by about a gram, about a microgram, or by far less than either?",
  perturbPrompt:
    "Open the boundary ledger with one joule emitted and the boundary around the body alone, and read the change in mass. Then move the boundary around the body and its light together, and read it again.",
  explainPrompt:
    "Explain both readings. Say what you divide the energy by and why the first answer is so small, and why the second is zero.",
};
