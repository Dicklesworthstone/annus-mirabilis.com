/**
 * Maps a preview argument's already-authored help and experiments onto
 * PassageActions. Obstacle copy is attached only when supplied; missing
 * kinds stay unavailable rather than being filled in here.
 */
import type { Argument } from "../../content/schemas/reading.ts";
import type { ObstacleResponses } from "./passageActions.schema.ts";
import { type PassageActions, validatePassageActions } from "./passageActions.schema.ts";

/** Authored obstacle answers for the Brownian observable argument. Other kinds stay unavailable. */
const ARG_BM_OBSERVABLE_OBSTACLES: ObstacleResponses = {
  algebraicMove: {
    explanation:
      "Squaring before averaging is the move that keeps movement when signs cancel. The signed mean of −3, −1, +1, +3 is zero; the mean of those squares is not.",
    foundationLinks: [
      {
        foundationId: "bridge-squaring-square-roots",
        callingAnchor: "arg-bm-observable",
        returnCaption: "Return to zero average is not no movement.",
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
        returnCaption: "Return to zero average is not no movement.",
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
