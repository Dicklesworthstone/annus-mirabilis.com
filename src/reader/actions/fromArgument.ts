/**
 * Maps a preview argument's already-authored help and experiments onto
 * PassageActions. Obstacle copy is attached only when supplied; missing
 * kinds stay unavailable rather than being filled in here.
 */
import type { Argument } from "../../content/schemas/reading.ts";
import type { ObstacleResponses } from "./passageActions.schema.ts";
import { type PassageActions, validatePassageActions } from "./passageActions.schema.ts";

/** Authored obstacle answers for the Brownian observable argument, one for each of the six kinds. */
const RETURN = "Return to zero average is not no movement.";
const ARG_BM_OBSERVABLE_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "Two averages carry this passage. ⟨x⟩ is the average of the displacements themselves, each with its sign: plus for a tracer that ended to the right of where it started, minus for one that ended to the left. ⟨x²⟩ is the average of their squares, and a square is never negative.",
    foundationLinks: [
      {
        foundationId: "bridge-negative-numbers-direction",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  physicalReason: {
    explanation:
      "Nothing in the liquid prefers left to right. Molecules strike each tracer from every side, so in the model a step to the right is exactly as likely as the same step to the left, and over the whole ensemble the signed steps balance. The strikes never stop, so every tracer keeps moving; only the average of the signed displacements stays at the start.",
    foundationLinks: [
      { foundationId: "random-walks", callingAnchor: "arg-bm-observable", returnCaption: RETURN },
    ],
  },
  connectionToPicture: {
    explanation:
      "Watch the cloud of tracers rather than any one of them. Its centre stays on the starting line: that centre is ⟨x⟩, and it stays at zero. Its edges move outward: how wide the cloud is, measured as √⟨x²⟩, is the quantity that grows.",
    foundationLinks: [
      { foundationId: "distributions", callingAnchor: "arg-bm-observable", returnCaption: RETURN },
    ],
  },
  tooMuchAtOnce: {
    explanation:
      "One example, four numbers. Four tracers end at −3, −1, +1 and +3. Their signed average is 0. Square them to get 9, 1, 1 and 9; the average of those is 5, and its square root, about 2.24, is how far a typical tracer has gone. That is the whole passage.",
    foundationLinks: [
      {
        foundationId: "bridge-sum-average",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  algebraicMove: {
    explanation:
      "Squaring before averaging is the move that keeps movement when signs cancel. The signed mean of −3, −1, +1, +3 is zero; the mean of those squares is not.",
    foundationLinks: [
      {
        foundationId: "bridge-squaring-square-roots",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
  purposeOfCalculation: {
    explanation:
      "The calculation answers how far members of the ensemble have wandered, not where their centre has moved. That is why a zero signed mean is not a claim that nothing moved.",
    foundationLinks: [
      {
        foundationId: "mean-variance-rms",
        callingAnchor: "arg-bm-observable",
        returnCaption: RETURN,
      },
    ],
  },
};

export function passageActionsFromArgument(argument: Argument): PassageActions {
  const firstExperiment = argument.experiments[0];
  const obstacleResponses =
    argument.id === "arg-bm-observable" ? ARG_BM_OBSERVABLE_OBSTACLES : undefined;
  return validatePassageActions({
    hard: argument.id === "arg-bm-observable",
    why: argument.help.why,
    missingStep: argument.help.missingStep,
    example: argument.help.example,
    original: [argument.id],
    ...(firstExperiment !== undefined ? { tryIt: { instrumentId: firstExperiment } } : {}),
    ...(obstacleResponses !== undefined ? { obstacleResponses } : {}),
  });
}
