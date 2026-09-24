/**
 * Journey IV, "can emitting light change inertia?" (plan §9.5): the parts of the route that the
 * skeleton components render on /discover/mass-energy/. Typed against the journey schema, as
 * Journey II's are (src/discovery/brownian/journeyII.ts).
 *
 * A route you could take, not a transcript of Einstein's private thinking. Every card a part
 * names is on the page's shelf (src/content/massEnergyShelf.ts), where the one 1905 import is
 * marked as one.
 */
import type {
  Doors,
  Fork,
  JourneyMove,
  PpeTask,
  SourceJump,
  WorldCheck,
} from "../../content/schemas/journey.ts";
import { ME03_DEFAULTS } from "../../experiments/me03/definition.ts";
import { encodeMe03Settings } from "../../experiments/me03/permalink.ts";

/** The observation that does not fit (plan §9.5). */
export const NAGGING_FACT =
  "A body that gives off light in one direction recoils. If it gives off equal pulses in opposite directions it does not recoil, and yet the two pulses carry different energies as a moving observer measures them.";

/** One sentence, second person. */
export const FIRST_HONEST_QUESTION =
  "If you already know how the energy of a light pulse changes between frames, what does the conservation of energy force you to say about the body that gave it off?";

/**
 * The one non-obvious step (plan §9.5; am-disc-journey-iv-chain-wwrz, chain step 6): reading the
 * limiting coefficient of v²/2 as a loss of mass, L/V², within the paper's premises. The two
 * accounts and the subtraction before it are bookkeeping any careful reader can check; this is the
 * identification the paper asks the reader to accept, and it is made only in the slow limit.
 *
 * The ids are the paper page's checked chain: the low-speed certificate (massEnergyLowSpeed.ts)
 * and its "identify" step, which LowSpeedExplorer names "The move" and anchors #me-the-move.
 *
 * The summary is the bead's authored sentence, recorded as a draft: only a named physics reviewer
 * may set it reviewed.
 */
export const MOVE: JourneyMove = {
  label: "Read the coefficient as a lost mass",
  chainId: "me-low-speed-coefficient",
  stepId: "identify",
  r0Summary: {
    text: "Seen by an observer moving past, the body carries less energy of motion after giving off light than before, at the same speed, just as a slightly lighter body would when the motion is slow, so, within the paper's stated premises, giving off energy lowers the body's mass by an amount set by that energy.",
    reviewState: "draft",
  },
};

/** Where the marked step opens, in the reading face. */
export const MOVE_HREF = "/papers/mass-energy/#me-the-move";

/**
 * The fork (plan §9.5): Poincaré's fictitious fluid, worked honestly as bookkeeping that is
 * empirically equivalent within its scope, beside the paper's route. Neither is mocked, and the
 * fluid is not declared refuted.
 */
export const FORK_POINCARE: Fork = {
  id: "arg-fork-poincare-fluid",
  afterStageId: "step-05",
  question:
    "Two accounts of the same bookkeeping: does a fictitious fluid carried by the light save the centre of mass, or did the body's own inertia change?",
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
        scopeNote:
          "The centre-of-mass bookkeeping of emission and absorption treated in Poincaré's 1900 paper.",
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

/**
 * The second fork (am-disc-journey-iv-chain-wwrz, fork 2): how far the claim reaches. Electromagnetic
 * mass was a serious quantitative programme, and what 1904 lacked was not a better account of it but
 * a body whose non-field energy could be weighed. So its branch is undecided on the evidence of the
 * day, and names the later measurement that bears on it, which is on the page as later evidence.
 */
export const FORK_FIELD_MASS: Fork = {
  id: "arg-fork-field-or-energy",
  afterStageId: "step-05",
  question:
    "How far does the claim reach: to the energy of a charged body's field, or to energy of every kind?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-field-mass",
      label: "Only the field's energy has inertia",
      proponent: { name: "J. J. Thomson, 1881", cardId: "thomson-1881-electromagnetic-mass" },
      hypothesis:
        "A charged body's field adds to its inertia, so inertia belongs to the energy of the electromagnetic field. The light in this argument is field energy, so its leaving lowers the inertia, and nothing follows about energy of other kinds.",
      worksWhen:
        "For charged bodies and their fields, where the added inertia can be calculated. How much it adds depends on the model of the charge.",
      steps: [
        {
          text: "Start from Thomson's result: a moving charged sphere carries a magnetic field whose energy makes it harder to accelerate.",
        },
        {
          text: "Read the paper's argument the same way. The energy that leaves is light, which is field energy, so the lost inertia can be booked to the field.",
        },
        {
          text: "Ask what would tell this apart from the paper's claim: a body whose energy of another kind changes by enough to weigh.",
        },
      ],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency:
          "The 1904 shelf carries no measurement of a body whose non-electromagnetic energy changes by enough to weigh, so it cannot separate a claim about field energy from a claim about energy as such.",
        whatWouldDecide: {
          name: "Cockcroft and Walton's lithium disintegration",
          recordId: "cockcroft-walton-1932-lithium",
          year: 1932,
          status: "later",
        },
        plainLanguage:
          "On the evidence of 1904 this branch is neither refuted nor confirmed. It is a narrower claim than the paper's, and the measurement that bears on it came twenty-seven years later.",
      },
    },
    {
      id: "arg-branch-energy-as-such",
      label: "Energy of every kind has inertia",
      hypothesis:
        "The inertia of a body depends on its energy content, whatever form that energy takes.",
      worksWhen:
        "Wherever the paper's premises hold. Its last step, from light to energy of any form, is the one sentence in the paper that goes beyond the calculation.",
      steps: [
        {
          text: "Find where the argument used the fact that the energy left as light: only in the rule for how the light's energy changes between frames. What it concluded is about the body's energy of motion.",
        },
        {
          text: "Conclude, as the paper does, that the mass of a body is a measure of its energy content.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's statement, and it is a stated inference: the paper calls it evident that nothing depends on the energy leaving as radiation.",
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
      "The two accounts: the paper writes the body's energy before and after the emission in two frames, and uses the June paper's rule for the energy of the light in each.",
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

/**
 * Check it against the world (plan §9.1 item 7, §9.5). The prediction is ME-03's own massChange
 * for the energy the reader lets leave, read from the accepted snapshot of the boundary ledger
 * embedded beside it. The static reference is the paper's last page (plate p. 641): "ändert sich
 * die Energie um L, so ändert sich die Masse in demselben Sinne um L/9.10^20, wenn die Energie in
 * Erg und die Masse in Grammen gemessen wird", and its suggestion that radium salts might test it.
 */
export const WORLD_CHECK: WorldCheck = {
  id: "me-world-check-mass",
  claim:
    "The paper ends with a number and a suggestion. A change of energy L changes the mass by L/9·10²⁰, with the energy in erg and the mass in grams, and bodies whose energy content changes a great deal, radium salts for instance, might test it. The ledger below lets one joule of light leave a body. Move its boundary and read the mass that goes with it.",
  instrumentId: "me-03",
  quantityId: "massChange",
  expected: "L/9·10²⁰ grams for an energy L in erg",
  comparisonKind: "printed-prediction",
  staticWorkedExample: {
    label: "What Einstein printed on the paper's last page",
    value: "the mass changes by L/9·10²⁰, with the energy in erg and the mass in grams",
    unit: "",
    constantSetId: "einstein-1905-mass-energy-printed",
  },
};

/** ME-03 opened in its 1906 box mode: the side door for programmers. */
export const BOX_1906_HREF = `/lab/me-03/${encodeMe03Settings({ ...ME03_DEFAULTS, mode: "box-1906" })}`;

/**
 * The doors (plan §9.5): the paper's argument, the 1906 box for programmers (labelled 1906, with
 * the credit to Poincaré), and the no-algebra door of two accounting sheets. All arrive at the
 * same result, and the page says so.
 */
export const DOORS: Doors = {
  frontDoor: {
    id: "door-me-front",
    title: "The paper's argument: two accounts of one emission",
    arrivesAtEquationId: "eq-model-me-mass-decrease",
    arrivesAtLabel: "the mass falls by L/V²",
    href: "/papers/mass-energy/#arg-me-two-ledgers",
    summary:
      "Write the body's energy in two frames, take one account from the other, and read the slow-speed limit.",
  },
  sideDoors: [
    {
      id: "door-me-box-1906",
      title: "The 1906 box, for programmers",
      arrivesAtEquationId: "eq-model-me-mass-decrease",
      arrivesAtLabel: "the mass falls by L/V²",
      href: BOX_1906_HREF,
      summary:
        "Einstein's argument of 1906, crediting Poincaré's fluid of 1900: a pulse crosses a floating box, and the centre of mass stays put only if the light carries the mass E/c². It comes after the paper, and says so.",
    },
    {
      id: "door-me-two-sheets",
      title: "Two accounting sheets and one subtraction",
      arrivesAtEquationId: "eq-model-me-mass-decrease",
      arrivesAtLabel: "the mass falls by L/V²",
      href: "/papers/mass-energy/#entry-mass-energy",
      summary:
        "No algebra: keep one sheet for an observer at rest and one for an observer gliding past, and take one from the other.",
    },
  ],
};
