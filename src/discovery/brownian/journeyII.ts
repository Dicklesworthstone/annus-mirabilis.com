/**
 * Journey II, "how can visible wandering reveal invisible molecules?" (plan §9.3): the parts of
 * the route that the skeleton components render on /discover/brownian-motion/. Typed against the
 * journey schema so the components read them as they read any journey.
 *
 * A route you could take, not a transcript of Einstein's private thinking. Every card a part
 * names is on the page's 1904 shelf (src/content/brownianShelf.ts) or, for later evidence, beside
 * the check against the world.
 */
import type { JourneyMove, PpeTask, SourceJump } from "../../content/schemas/journey.ts";

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
