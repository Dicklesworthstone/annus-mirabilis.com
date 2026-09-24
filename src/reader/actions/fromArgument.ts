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

/**
 * Light quanta's counting passage: why the probability is f to the power n. Every number and claim
 * here is the passage's own (arg-lq-independent-configurations): four independent points in half
 * the volume give 1/16, four locked together give 1/2, and section 6 reads the result "as if" for
 * dilute radiation, which its entrance also says is not a general proof about light.
 */
const RETURN_LQ = "Return to independence supplies the exponent.";
const ARG_LQ_INDEPENDENT_CONFIGURATIONS_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "f is a fraction of the volume: the chosen part divided by the whole, one half when the part is half of it. n is the number of points. W is a probability, the chance that at one moment all n points are inside the chosen part, and ln is the natural logarithm.",
    foundationLinks: [
      // One lesson per answer: ObstacleMenu names each link by its obstacle, so two links in
      // one answer would share a name and lead to different lessons.
      {
        foundationId: "bridge-probability-notation",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  physicalReason: {
    explanation:
      "In the model each point moves over the whole volume without regard to the others, as the molecules of a dilute gas do. So the chance that any one point is in the chosen part is f, whatever the other points are doing. That independence is a premise of the model; the counting does not prove it.",
    foundationLinks: [
      {
        foundationId: "probability-independence",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  connectionToPicture: {
    explanation:
      "Split the volume into the chosen part and the rest, and take one snapshot. One point is in the part a fraction f of the time. For two, the part must catch the first and also the second: f of the time, and then f of those times, which is f × f. Each further point multiplies by f again.",
    foundationLinks: [
      {
        foundationId: "probability-independence",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  tooMuchAtOnce: {
    explanation:
      "One example: four points, half the volume. One point is in the left half with chance 1/2. Two are, with chance 1/2 × 1/2 = 1/4. All four are, with chance 1/16. If the four were locked together and moved as one, the chance would stay 1/2. That difference is the whole passage.",
    foundationLinks: [
      {
        foundationId: "bridge-fractions-ratios",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  algebraicMove: {
    explanation:
      "Multiplying n equal factors f is written fⁿ, and the logarithm turns that power into a product: ln fⁿ = n ln f. So k_B ln W becomes n k_B ln f, the number of points times the change for one. Because f is less than 1, ln f is negative, and so is the entropy change for crowding the points into the smaller part.",
    foundationLinks: [
      {
        foundationId: "logarithms",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
  purposeOfCalculation: {
    explanation:
      "Section 6 uses the result in reverse. The entropy of dilute monochromatic radiation changes with volume the way n k_B ln f does for n independent points, so in that respect such radiation behaves as if it consisted of n independent energy quanta. The exponent is what carries the comparison, which is why the passage says it comes from independence.",
    foundationLinks: [
      {
        foundationId: "entropy-multiplicity",
        callingAnchor: "arg-lq-independent-configurations",
        returnCaption: RETURN_LQ,
      },
    ],
  },
};

/**
 * Relativity's velocity composition: why two ordinary-looking speeds do not simply add. The numbers
 * are the passage's own (arg-sr-velocity-composition): 0.6c and 0.6c give 15c/17, about 0.882c,
 * where plain addition says 1.2c, and light comes out at c in every frame.
 */
const RETURN_SR = "Return to the denominator changes as well.";
const srLink = (foundationId: string) => [
  { foundationId, callingAnchor: "arg-sr-velocity-composition", returnCaption: RETURN_SR },
];
const ARG_SR_VELOCITY_COMPOSITION_OBSTACLES: ObstacleResponses = {
  unfamiliarWordOrSymbol: {
    explanation:
      "v is the speed of the moving frame, measured in the original one. w is the object's speed measured in the moving frame, and U is the same object's speed measured in the original frame. c is the speed of light. uₓ and u′ₓ are the object's velocities along x in the two frames.",
    foundationLinks: srLink("bridge-letter-for-quantity"),
  },
  physicalReason: {
    explanation:
      "A speed is a distance divided by the time taken, and the two frames disagree about both. They disagree about the time because each sets its distant clocks by its own light signals. So a speed cannot pass from one frame to the other by adding v; the time between the same two events changes too.",
    foundationLinks: srLink("frames-events"),
  },
  connectionToPicture: {
    explanation:
      "Picture two neighbouring events on the object's path: here at one moment, and a little further along a little later. Each frame measures the distance and the time between those same two events. Both numbers change from frame to frame, and the speed is their ratio.",
    foundationLinks: srLink("frames-events"),
  },
  tooMuchAtOnce: {
    explanation:
      "One example: v = w = 0.6c. Plain addition gives 1.2c. The formula divides that by 1 + 0.6 × 0.6 = 1.36, which gives 15c/17, about 0.882c. The faster the two speeds, the further the divisor rises above 1.",
    foundationLinks: srLink("bridge-fractions-ratios"),
  },
  algebraicMove: {
    explanation:
      "Transform the two small changes first, then divide. With dx′ = γ(dx − v dt) and dt′ = γ(dt − v dx/c²), the ratio dx′/dt′ is (uₓ − v)/(1 − v uₓ/c²). The factors γ cancel, and the second term of dt′ is what puts 1 − v uₓ/c² in the denominator.",
    foundationLinks: srLink("derivatives"),
  },
  purposeOfCalculation: {
    explanation:
      "It finds what the two postulates require of speeds. Put in light, uₓ = c, and the formula returns c in every frame, as the second postulate demands, and two speeds below c combine to a speed below c. At everyday speeds v w/c² is tiny and the formula is ordinary addition.",
    foundationLinks: srLink("orders-of-magnitude"),
  },
};

/** The passages marked hard, each with an authored answer for all six obstacles. */
const OBSTACLES: Readonly<Record<string, ObstacleResponses>> = {
  "arg-bm-observable": ARG_BM_OBSERVABLE_OBSTACLES,
  "arg-lq-independent-configurations": ARG_LQ_INDEPENDENT_CONFIGURATIONS_OBSTACLES,
  "arg-sr-velocity-composition": ARG_SR_VELOCITY_COMPOSITION_OBSTACLES,
};

export function passageActionsFromArgument(argument: Argument): PassageActions {
  const firstExperiment = argument.experiments[0];
  const obstacleResponses = Object.hasOwn(OBSTACLES, argument.id)
    ? OBSTACLES[argument.id]
    : undefined;
  return validatePassageActions({
    hard: obstacleResponses !== undefined,
    why: argument.help.why,
    missingStep: argument.help.missingStep,
    example: argument.help.example,
    original: [argument.id],
    ...(firstExperiment !== undefined ? { tryIt: { instrumentId: firstExperiment } } : {}),
    ...(obstacleResponses !== undefined ? { obstacleResponses } : {}),
  });
}
