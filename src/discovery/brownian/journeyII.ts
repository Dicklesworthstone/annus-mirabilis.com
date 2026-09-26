/**
 * Journey II, "how can visible wandering reveal invisible molecules?" (plan §9.3): the parts of
 * the route that the skeleton components render on /discover/brownian-motion/. Typed against the
 * journey schema so the components read them as they read any journey.
 *
 * A route you could take, not a transcript of Einstein's private thinking. Every card a part
 * names is on the page's 1904 shelf (src/content/brownianShelf.ts) or, for later evidence, beside
 * the check against the world.
 */
import type {
  Fork,
  JourneyMove,
  PpeTask,
  SourceJump,
  WorldCheck,
} from "../../content/schemas/journey.ts";

/** The observation that does not fit (plan §9.3). */
export const NAGGING_FACT =
  "If Gouy is right and the jiggling is thermal, then a particle a micron across is only a very large molecule, and what is known about molecules in solution should hold for it too. Does it?";

/** One sentence, second person. */
export const FIRST_HONEST_QUESTION =
  "Would a particle you can see, suspended in water, press on a membrane the way a dissolved molecule does?";

/**
 * The one non-obvious step, marked where the derivation chain marks it: bm-variance's cross-term
 * step, which the missing-step panel already names "The move".
 */
export const MOVE: JourneyMove = {
  label: "Independent kicks: the products of different steps average away",
  chainId: "bm-variance",
  stepId: "bm-variance-cross",
  r0Summary: {
    text: "Square the sum of a particle's displacements over many short intervals. Each product of two different displacements averages to zero, because the displacements are independent and as likely to go one way as the other. What is left is the sum of their squares, and that grows in proportion to the time.",
    reviewState: "draft",
  },
};

/** Where the marked step opens, in the reading face of §4. */
export const MOVE_HREF =
  "/papers/brownian-motion/s4/?open=derivation-step:bm-variance-cross#arg-bm-independent-steps";

/** What Einstein wrote: a jump into the reading face where the paper makes the same move. */
export const SOURCE_JUMPS: readonly SourceJump[] = [
  {
    id: "jump-bm-drag",
    label: "Read the argument: what fixes D for a small sphere",
    paperId: "brownian-motion",
    section: "s5",
    targetAnchor: "arg-bm-diffusivity",
    pointer:
      "The second route, force against drag, is the paper's §3. Its result is the diffusion coefficient that §5 turns into a displacement.",
  },
  {
    id: "jump-bm-move",
    label: "Read the argument: why independent steps add",
    paperId: "brownian-motion",
    section: "s4",
    targetAnchor: "arg-bm-independent-steps",
    pointer:
      "The move is in §4, where a particle's displacements over successive intervals are taken to be independent of each other.",
  },
  {
    id: "jump-bm-inference",
    label: "Read the argument: what would let us count molecules",
    paperId: "brownian-motion",
    section: "s5",
    targetAnchor: "arg-bm-inference",
    pointer:
      "The paper closes §5 by turning the relation around: measure the displacement, and the one unknown left is the number of molecules.",
  },
];

/** Predict, perturb, explain: the reader's own change to the tracer ensemble. */
export const PPE_TASK: PpeTask = {
  promptId: "bm-predict-perturb-explain-radius",
  task: "Predict first. The tracer ensemble shows how far a particle typically gets in one second. If you double the particle's radius, does that distance halve, fall by less than half, or stay the same?",
  perturbPrompt:
    "Open the tracer ensemble, change the radius from 0.5 to 1 micrometre, apply it, and read the one-second displacement again.",
  explainPrompt:
    "Explain the factor you saw. Say what the radius does to the drag, what the drag does to D, and how the distance depends on D.",
};

/**
 * Fork A (plan §9.3): Nägeli's argument from single impacts, worked until it fails on a stated
 * constraint, beside the branch the paper takes. Nobody is mocked: his estimate for one impact is
 * sound, and the branch says so.
 */
export const FORK_NAEGELI: Fork = {
  id: "arg-fork-naegeli",
  afterStageId: "step-02",
  question: "Can molecular impacts move a particle large enough to see?",
  varies: "theoretical-postulate",
  branches: [
    {
      id: "arg-branch-single-impact",
      label: "No single impact is big enough",
      proponent: { name: "Carl Nägeli, 1879", cardId: "naegeli-1879-single-impacts" },
      hypothesis:
        "A water molecule is so much lighter than a particle a micron across that one impact changes the particle's speed by far too little to see. Impacts arrive from every side, so they cancel, and the molecules cannot be what moves the particle.",
      worksWhen:
        "For one impact on its own the estimate is right: the particle's speed barely changes.",
      steps: [
        {
          text: "Estimate what one impact does. The molecule's momentum, shared with a particle many billions of times heavier, changes the particle's speed by an amount no microscope could follow.",
        },
        {
          text: "Conclude that the impacts, arriving from every side, cancel, so that in still water a particle stays where it is.",
        },
        {
          text: "Follow the consequence. Particles that nothing moves cannot spread, so a step in their concentration stays a step for ever. The laboratory linked below runs that world with the kicks turned off.",
        },
      ],
      outcome: {
        type: "dead-end-on-constraint",
        plainLanguage:
          "The estimate for one impact is sound, and the conclusion does not follow from it. With the kicks off nothing spreads, which contradicts Fick's law for dissolved matter and Gouy's observation that the motion never dies away.",
      },
    },
    {
      id: "arg-branch-imbalance",
      label: "The imbalance of many impacts moves it",
      hypothesis:
        "In any short interval a particle is struck an enormous number of times. The impacts do not cancel exactly, and the imbalance left over, different in each interval, moves it by an amount you can see over a time you can wait.",
      worksWhen:
        "When the particle is watched over intervals long compared with the time between impacts, and the imbalances in successive intervals are independent of one another.",
      steps: [
        { text: "Ask how far the particle gets over an interval, not what one impact does." },
        {
          text: "Treat its displacements in successive intervals as independent, each as likely to go one way as the other. Their squares add, so the mean square grows in proportion to the time.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the paper's route in §4, and it is the move marked below: the products of different displacements average away, so the mean squares of independent displacements add.",
      },
    },
  ],
};

/**
 * Fork B (plan §9.3, and §3.4's editorial boundary: the observable is a displacement, not a
 * velocity). Exner's measurements are taken as careful; what fails is the comparison, because an
 * apparent speed is set by the interval as much as by the particle.
 */
export const FORK_EXNER: Fork = {
  id: "arg-fork-exner",
  afterStageId: "step-04",
  question: "What should you measure: how fast a particle moves, or how far it gets?",
  varies: "measurement-choice",
  branches: [
    {
      id: "arg-branch-apparent-speed",
      label: "Measure its speed",
      proponent: { name: "Felix Exner, 1900", cardId: "exner-1900-particle-speeds" },
      hypothesis:
        "Trace the particle's path under the microscope for half a minute to a minute and divide the distance by the time. If molecules shove the particles, their energy of motion should match the molecules' at the same temperature, and the speed tells you whether it does.",
      worksWhen:
        "For a particle drifting at a steady speed, where every interval gives the same answer. And as a stated quantity: a speed over a named interval is something you can measure and report.",
      steps: [
        {
          text: "Measure the displacement over an interval τ and divide by τ. Exner did this with care, each value a mean of about ten tracings of half a minute to a minute. Given the kinetic energy of the liquid's molecules, his particles implied molecules moving about 30 cm a second at 20 °C, where G. Jäger had calculated 270 metres a second.",
        },
        {
          text: "Now change τ. For a particle kicked at random the displacement grows only as the square root of τ, so the displacement divided by τ grows as the interval shrinks: a quarter of the interval, twice the speed.",
        },
        {
          text: "So the number depends on how often you look, and it has no limit as you look more often. It is not a property of the particle, and comparing it with the speeds of molecules compares nothing.",
        },
      ],
      outcome: {
        type: "dead-end-on-constraint",
        plainLanguage:
          "The measurements can be right and the comparison still fails: for a randomly kicked particle, an apparent speed is set by the interval as much as by the particle.",
      },
    },
    {
      id: "arg-branch-displacement",
      label: "Measure how far it gets in a given time",
      hypothesis:
        "Mark where the particle starts, look again after a fixed interval, and record the displacement. Repeat, and take the mean square.",
      worksWhen:
        "Whenever the displacements in successive intervals are independent. Then the mean square grows in proportion to the interval, and its ratio to the interval belongs to the particle and the liquid, not to the observer.",
      steps: [
        {
          text: "Fix the interval and record displacements, to the left as negative and to the right as positive.",
        },
        {
          text: "Divide the mean square by twice the interval. The answer does not change with the interval: it is D.",
        },
      ],
      outcome: {
        type: "papers-route",
        plainLanguage:
          "This is the observable the paper chooses. In §5 it predicts how far a particle gets in one second and in one minute, not how fast it moves.",
      },
    },
  ],
};

/**
 * Check it against the world (plan §9.1 item 7, §9.3). The prediction is BM-01's own
 * lambdaX1s and lambdaX60s, read from the accepted snapshot of the tracer ensemble embedded beside
 * it; the static reference is what Einstein printed in §5 (plate p. 559: "0,8 Mikron" in one
 * second, "ca. 6 Mikron" in one minute, for particles 0,001 mm across in water at 17 °C). The later
 * measurement is the Perrin card in src/content/brownianShelf.ts, flagged as later evidence.
 */
export const WORLD_CHECK: WorldCheck = {
  id: "bm-world-check-displacement",
  claim:
    "Einstein predicted a displacement a microscope could follow: for particles 0.001 mm across in water at 17 °C, about 0.8 micron in one second and about 6 microns in one minute. Set the tracer ensemble to his inputs, or to your own, and compare.",
  instrumentId: "bm-01",
  quantityId: "lambdaX1s",
  expected: "about 0.8 µm in one second, about 6 µm in one minute",
  comparisonKind: "printed-prediction",
  staticWorkedExample: {
    label: "What Einstein printed in §5, taking N = 6 × 10²³ from gas theory",
    value: "about 0.8 µm in one second, about 6 µm in one minute",
    unit: "",
    constantSetId: "einstein-1905-brownian-printed",
  },
};

/** Einstein's §5 inputs, as the laboratory takes them: 17 °C, k = 1.35 × 10^-2 poise, 0.001 mm across. */
export const EINSTEIN_TRACER_INPUTS = { T: 290.15, eta: 0.00135, a: 0.5e-6 } as const;
