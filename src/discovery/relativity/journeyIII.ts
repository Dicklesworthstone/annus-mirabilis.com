/**
 * Journey III, "one current, two stories" (plan §9.4): the parts of the route that the skeleton
 * components render on /discover/special-relativity/. Typed against the journey schema, as
 * Journeys I, II and IV are (src/discovery/lightQuanta/journeyI.ts, src/discovery/brownian/
 * journeyII.ts, src/discovery/massEnergy/journeyIV.ts).
 *
 * A route you could take, not a transcript of Einstein's private thinking. Every card a fork names
 * is on the page: a proponent's or a constraint's on the 1904 shelf, and the record that later
 * decided an open question among the later evidence (src/content/specialRelativityShelf.ts). What
 * each branch says of a card is what that card's source check records, so nothing is added here to
 * smooth the path: the fringe figures are Michelson and Morley's p. 341, the partial drag is
 * Fizeau's p. 355, the three null results are Lorentz's p. 825, and the second presupposition is
 * the paper's own sentence s0-p2-s2.
 */
import type { Fork, PpeTask, WorldCheck } from "../../content/schemas/journey.ts";
import { SR05_MODEL, SR05_PRESETS } from "../../experiments/sr05/definition.ts";
import { CLOCK_CHECK_READING } from "./worldCheck.ts";

/**
 * Fork A, after the null results of step 02: what to do with an ether nobody has detected. The
 * ether at rest with the ordinary kinematics meets the first-order observations and fails at the
 * second order against Michelson and Morley; Lorentz's ether with contraction and local time is
 * empirically equivalent on everything the shelf holds; the paper raises the failure to a
 * principle. A measurement-free reason for preferring the last is not a refutation of the second,
 * and the fork does not offer one as such.
 */
export const FORK_UNDETECTED_ETHER: Fork = {
  id: "arg-fork-sr-undetected-ether",
  afterStageId: "step-02",
  question:
    "Every attempt to detect the Earth's motion through the light medium has failed. What do you do with the medium?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-sr-ether-at-rest",
      label: "Keep an ether at rest, and speeds that add",
      hypothesis:
        "There is one frame at rest in the ether, and light travels at one speed relative to it. Speeds add in the ordinary way, and a moving transparent body drags light along only partly, by the fraction Fresnel proposed.",
      worksWhen:
        "For every effect of the first order in the ratio of the Earth's speed to light's. That includes light in moving water, where Fizeau in 1851 found a displacement close to the value Fresnel's fraction gives, and the paper itself says that for quantities of the first order the laws are already known to be the same in every such frame.",
      steps: [
        {
          text: "Send light out along an arm that moves through the ether at speed v, and back. Out, it gains on the far mirror at c − v; back, it meets the near one at c + v. The round trip takes longer than at rest, by the factor 1/(1 − v²/c²).",
        },
        {
          text: "Send it across the arm instead. It has to aim ahead of the moving mirror, and the round trip is longer by the smaller factor 1/√(1 − v²/c²). The two times differ in proportion to v²/c²: an effect of the second order.",
        },
        {
          text: "Michelson and Morley built an interferometer to see that difference. For their apparatus they expected a displacement of 0.4 of a fringe, and in 1887 they reported one certainly less than a twentieth of that.",
        },
      ],
      outcome: {
        type: "dead-end-on-constraint",
        constraintRef: "michelson-morley-1887-no-drift",
        plainLanguage:
          "It meets the first-order observations, Fizeau's moving water among them, and fails at the second order, where it predicts a displacement Michelson and Morley did not find. That is one prediction against one measurement, and it does not dispose of the ether itself, which the next branch keeps.",
      },
    },
    {
      id: "arg-branch-sr-lorentz-ether",
      label: "Keep the ether, and let motion through it shorten bodies",
      proponent: { name: "H. A. Lorentz, 1904", cardId: "lorentz-1904-corresponding-states" },
      hypothesis:
        "Keep the ether at rest. Suppose that electrons, and bodies made of them, moving through it contract along their motion, and describe the moving system in a local time, a variable of the equations.",
      worksWhen:
        "For every experiment on this shelf. Lorentz's paper of 1904 says the theory accounts for the negative results of Michelson, and of Rayleigh and Brace, and that it makes Trouton and Noble's clear at once.",
      steps: [
        {
          text: "Shorten the arm that lies along the motion by the factor √(1 − v²/c²). Its round trip then takes exactly as long as the one across, and the second-order difference is gone.",
        },
        {
          text: "Give the electrons the same contraction and write the moving system's equations in local time. Every state of a system at rest then has a counterpart in motion, so no experiment of this kind can reveal the motion.",
        },
        {
          text: "Step 07 follows this account further. It reaches the same formulas as the paper.",
        },
      ],
      outcome: {
        type: "empirically-equivalent-not-refuted",
        scopeNote:
          "Every observation on the 1904 shelf: the aberration of starlight, Fizeau's moving water, and the null results of Michelson and Morley, of Rayleigh and Brace, and of Trouton and Noble.",
        plainLanguage:
          "Nothing on the shelf separates it from the paper's route, and this route does not call it refuted. Lorentz put it forward with all due reserve. What separates the two is what each takes as given and what each adds by hand, not a measurement either one fails.",
      },
    },
    {
      id: "arg-branch-sr-no-rest",
      label: "Raise the failure to a principle",
      hypothesis:
        "The laws of physics are the same for every observer in uniform motion, so no experiment can reveal who is at rest. The ether is given nothing to do.",
      worksWhen:
        "Wherever the principle holds. Poincaré had stated it in 1904 as a general principle of physics, an experimental result strongly generalized.",
      steps: [
        {
          text: "Start where the paper starts: the unsuccessful attempts to detect a motion of the Earth relative to the light medium suggest that absolute rest corresponds to no property of the phenomena.",
        },
        {
          text: "Add the second statement of step 03, that light travels at one speed whatever its source does. Under the ordinary addition of speeds the two conflict.",
        },
        {
          text: "Step 04 finds what has to give: the assumption that observers in relative motion agree about which distant events happen at the same time.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's route. It predicts the same null results as the branch before it, needs no medium at rest, and adds no contraction by hand: in § 4 the contraction comes out of the kinematics.",
      },
    },
  ],
};

/**
 * Fork B, after step 03 states the two presuppositions: must light's speed be independent of its
 * source? The emission view gets Michelson and Morley's null result for nothing and gives up
 * Maxwell's equations as they stand; no card on the shelf compares light from sources moving at
 * different speeds, so the shelf cannot decide it, and the route does not call it refuted. What
 * decided it is de Sitter's argument of 1913, later evidence and marked so.
 */
export const FORK_SOURCE_SPEED: Fork = {
  id: "arg-fork-sr-source-speed",
  afterStageId: "step-03",
  question: "Does the speed of light depend on how fast its source is moving?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-sr-emission",
      label: "Light keeps its source's speed",
      hypothesis:
        "Light leaves its source at one speed relative to the source, as a ball thrown from a moving hand does, and speeds add in the ordinary way. No medium and no frame at rest are needed, and the principle of relativity holds for light as it does in mechanics.",
      worksWhen:
        "For Michelson and Morley's null result, at every order. Their lamp moved with the apparatus, so on this view the light went out and back at the same speed relative to both arms, whichever way the Earth was moving.",
      steps: [
        {
          text: "In the interferometer the lamp rides with the mirrors. Relative to the arms the light travels at the same speed in every direction, so the view predicts no displacement of the fringes, which is what was found.",
        },
        {
          text: "Maxwell's equations fix one speed for a disturbance in the field and say nothing of its source. To keep this view you give up those equations as they stand, and nothing on the shelf supplies the ones that would replace them.",
        },
        {
          text: "To decide it you would compare light from sources moving at different speeds. No measurement on the shelf does that.",
        },
      ],
      outcome: {
        type: "undecided-on-available-evidence",
        insufficiency:
          "No measurement on the shelf compares light from sources moving at different speeds, so none of them tells this view from the next. What the shelf can weigh is the cost: this view gets the null result for nothing and gives up Maxwell's equations as they stand, while the paper's keeps the equations and gives up the ordinary addition of speeds.",
        whatWouldDecide: {
          name: "de Sitter's argument from double stars",
          recordId: "de-sitter-1913-double-stars",
          year: 1913,
          status: "later",
        },
        plainLanguage:
          "On the 1904 shelf this stays open, and the route does not call it refuted. In 1913 de Sitter argued from the observed motions of double stars that the velocity of light is independent of the motion of its source; that is later evidence, not on the shelf.",
      },
    },
    {
      id: "arg-branch-sr-fixed-speed",
      label: "One speed, whatever the source does",
      hypothesis:
        "Light travels in empty space at one definite speed, whatever the motion of the body that emits it, as a disturbance does in Maxwell's equations.",
      worksWhen:
        "Wherever Maxwell's equations describe light in empty space. The paper keeps them for bodies at rest and builds on them.",
      steps: [
        {
          text: "Keep Maxwell's equations as they stand: a disturbance in the field travels at the speed they fix, from whatever source.",
        },
        {
          text: "Set that beside the principle of relativity. Under the ordinary addition of speeds two observers in relative motion would have to measure different speeds for the same flash, which is the puzzle of step 03.",
        },
        {
          text: "The paper calls the two presuppositions only apparently incompatible, and step 04 shows why: they fit together once the time of a distant event is set by a stated procedure.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's second presupposition, in its introduction: “that light is always propagated in empty space with a definite velocity V which is independent of the state of motion of the emitting body.”",
      },
    },
  ],
};

const { properTime, coordinateTime, speed } = CLOCK_CHECK_READING;
const reading = (x: number) => String(Number(x.toPrecision(3)));
/** The owner's reading at the check's preset (worldCheck.ts), in words. */
const CHECK_READING =
  properTime === undefined || coordinateTime === undefined
    ? "not computed at the check's setting"
    : `${reading(properTime)} s on the moving clock for ${reading(coordinateTime)} s of the resting clocks, at ${reading(speed)} of the speed of light`;

/**
 * Check it against the world (plan §9.1 item 7). The prediction is SR-05's own properTime, read from
 * the accepted snapshot of the laboratory embedded beside it; the static reference is the same
 * owner's reading at the check's preset, computed at build time (worldCheck.ts). The later
 * measurement, Ives and Stilwell's of 1938, is a card beside the check and is stated in words: the
 * edition holds no dataset of theirs, so no number of theirs is set against this one.
 */
export const WORLD_CHECK: WorldCheck = {
  id: "sr-world-check-moving-clock",
  claim:
    "Section 4 of the paper draws a consequence that could be measured. A clock moving at speed v, judged from the resting system, reads t√(1 − v²/V²) when the resting clocks read t, V being the paper's letter for the speed of light, so it falls behind by 1 − √(1 − v²/V²) of a second in every second; the paper writes that to second order as ½(v/V)². Choose a worldline in the laboratory below and read what the relation gives.",
  instrumentId: "sr-05",
  quantityId: "properTime",
  expected: CHECK_READING,
  comparisonKind: "printed-prediction",
  staticWorkedExample: {
    label: "What § 4's relation gives at the laboratory's first setting",
    value: CHECK_READING,
    unit: "",
    constantSetId: SR05_MODEL.constantSetId,
  },
};

/** A preset's label as the laboratory's button prints it, so the task names only real buttons. */
const button = (id: string) => `“${SR05_PRESETS[id]?.label ?? id}”`;

/**
 * Predict, perturb, explain (am-disc-ppe-teachback-wnp7's ppe-<paper slug>-<sections>). The
 * perturbation is made in the laboratory already on this page at step 08, through its own preset
 * buttons, so nothing is re-embedded. Its explanation part is PPE_EXPLANATION
 * (journeyExercises.ts).
 */
export const PPE_TASK: PpeTask = {
  promptId: "ppe-special-relativity-s4",
  task: "Predict first. One clock goes out and back at 0.6 of the speed of light while the resting clocks advance 10 s; another circles at the same speed for the same 10 s. When each returns to the clock that stayed, which reads less, or do they read the same?",
  perturbPrompt: `In the laboratory at step 08, press ${button("sr-05-out-and-back-0.6c")} and read the moving clock; then press ${button("sr-05-circle-0.6c")} and read it again. Last, press ${button("sr-05-low-speed-1e-4")} and set the exact loss per second beside the printed second-order form.`,
  explainPrompt:
    "Explain why the two paths give the same reading, and say what the laboratory computes rather than measures.",
};
