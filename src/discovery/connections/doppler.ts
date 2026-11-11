import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { boostMatrixXT } from "../../physics/reference/kinematics.ts";
import { dopplerFactor } from "../../physics/reference/waves.ts";
import type { ExpressionExercisePart } from "../exercises/answer.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import {
  type NumericExercisePart,
  type NumericReference,
  referenceFromEvaluation,
} from "../exercises/numeric.ts";
import { CONNECTION_EXERCISE_LINKS } from "./links.ts";
import type { ConnectionExercise } from "./types.ts";

const SET_ID = "modern-si-2019";
const id = CONNECTION_EXERCISE_LINKS[1].id;

/**
 * One comparison from two existing owners. The matrix owner supplies every boost entry;
 * applying it to the light-line vectors (c, 1) and (-c, 1) reads their scale factors.
 * No copied Doppler formula supplies the matrix side of the comparison.
 */
export function dopplerReferences(beta: number): Readonly<{
  receding: NumericReference;
  approaching: NumericReference;
  forwardLightLine: NumericReference;
  backwardLightLine: NumericReference;
}> {
  const c = constantValue(getConstantSet(SET_ID), "speedOfLight").value;
  const matrix = boostMatrixXT(beta, c);
  const wave = (angle: number, quantityId: string) =>
    referenceFromEvaluation(
      { status: "value", value: dopplerFactor(beta, angle), quantityId },
      { constantSetId: SET_ID, owner: "waves.dopplerFactor", exerciseId: id },
    );
  const eigenvalue = (direction: 1 | -1, quantityId: string) =>
    referenceFromEvaluation(
      matrix.status === "value"
        ? {
            status: "value",
            value:
              (matrix.value[1]?.[0] ?? Number.NaN) * direction * c +
              (matrix.value[1]?.[1] ?? Number.NaN),
            quantityId,
          }
        : matrix,
      { constantSetId: SET_ID, owner: "kinematics.boostMatrixXT", exerciseId: id },
    );
  return Object.freeze({
    receding: wave(0, "recedingDopplerFactor"),
    approaching: wave(Math.PI, "approachingDopplerFactor"),
    forwardLightLine: eigenvalue(1, "recedingDopplerFactor"),
    backwardLightLine: eigenvalue(-1, "approachingDopplerFactor"),
  });
}

export const DOPPLER_REFERENCES = dopplerReferences(0.6);

function factorPart(
  suffix: string,
  prompt: string,
  workedExplanation: string,
  reference: NumericReference,
): NumericExercisePart {
  return {
    id: `${id}-${suffix}`,
    prompt,
    workedExplanation,
    family: "ratio",
    units: ["1"],
    reference,
    tolerance: { absolute: 0, relative: 0.001 },
    toleranceReason:
      "These are dimensionless factors. Agreement to one part in a thousand allows rounding while separating the two directions.",
  };
}

export const RECEDING_FACTOR = factorPart(
  "receding",
  "A source and observer recede along the line of sight at 0.6c. With β = v/c = 0.6 and γ = 1/√(1 − β²), what fraction ν′/ν of the emitted frequency is received? Use γ(1 − β).",
  "Here γ = 1/√0.64 = 1.25. Multiplying by 1 − 0.6 = 0.4 gives 0.5: the received frequency is halved. The factor is a ratio, so its unit is 1. Reversing recession into approach changes the sign in the second factor; it does not change γ.",
  DOPPLER_REFERENCES.receding,
);

export const APPROACHING_FACTOR = factorPart(
  "approaching",
  "Now let source and observer approach at the same speed, 0.6c. What is ν′/ν? Use γ(1 + β), with β = 0.6 the positive speed magnitude in this comparison.",
  "γ is still 1.25, but the second factor is 1 + 0.6 = 1.6. The product is 2: the received frequency doubles. The receding and approaching factors multiply to 1. Giving 0.5 here would have kept the receding direction.",
  DOPPLER_REFERENCES.approaching,
);

export const FORWARD_EIGENVALUE = factorPart(
  "forward-light-line",
  "Write the same boost on coordinates (x, ct). At β = 0.6 its rows are (1.25, −0.75) and (−0.75, 1.25). It sends the light-line vector (1, 1) to a multiple of itself. What is that multiplier, its eigenvalue?",
  "Both output components are 1.25 − 0.75 = 0.5, so (1, 1) becomes 0.5 times (1, 1). The light line keeps its direction while its coordinates are rescaled. That is the same factor as the receding frequency shift, now read from the coordinate transformation.",
  DOPPLER_REFERENCES.forwardLightLine,
);

export const BACKWARD_EIGENVALUE = factorPart(
  "backward-light-line",
  "Apply that matrix to the other light-line vector (−1, 1). What multiplier sends the whole vector to its transformed value?",
  "The output is (−1.25 − 0.75, 0.75 + 1.25) = (−2, 2), which is 2 times (−1, 1). The eigenvalue is positive 2, not −2: it multiplies the whole vector. It matches the approaching frequency factor.",
  DOPPLER_REFERENCES.backwardLightLine,
);

export const DOPPLER_EXPRESSION: ExpressionExercisePart = {
  id: `${id}-expression`,
  prompt:
    "Write the receding factor γ(1 − β) as a single square root using beta for β. Here γ = 1/√(1 − β²). The checker also accepts an equivalent expression with the square root in the denominator.",
  declaredNames: ["beta"],
  domains: { beta: { min: -0.95, max: 0.95 } },
  dimensions: { beta: ["0", "0", "0", "0", "0", "0"] },
  referenceSource: "(1-beta)/sqrt(1-beta^2)",
  tolerance: { absolute: 1e-12, relative: 1e-10 },
  conditionNote: "The comparison admits inertial relative speeds with |beta| < 1.",
  workedExplanation:
    "Factor 1 − β² as (1 − β)(1 + β). In the admitted range both factors are positive, so (1 − β)/√((1 − β)(1 + β)) = √((1 − β)/(1 + β)). You can enter sqrt((1-beta)/(1+beta)). The reciprocal describes the opposite light line, not another form of this same factor. Negative beta reverses the relative motion.",
};

export const DOPPLER_EXPLANATION: ExplanationExercisePart = {
  id: `${id}-explanation`,
  prompt:
    "Why do the colour-shift factor and the light-line eigenvalue agree? Explain more than the numerical coincidence at 0.6c.",
  criteria: [
    "The phase of the same plane light wave is unchanged when its events are described in the other inertial frame.",
    "The boost preserves the two light lines; its eigenvectors lie on those lines.",
    "A wave four-vector along either light line is rescaled by that line’s eigenvalue, and its frequency receives the same factor.",
    "The matched pair depends on the propagation direction; the receding and approaching factors are reciprocal.",
  ],
  workedExplanation:
    "A boost changes the coordinates assigned to the same events, while a wave crest remains the same crest. Keeping the phase fixed relates the transformed frequency to the transformed wave vector. For propagation along a light line, the wave four-vector is rescaled without changing its lightlike direction. The scaling is therefore both a boost eigenvalue and the frequency ratio. The equality holds throughout |β| < 1; it is not a fit to the single example at 0.6c. Eigenvector language is a modern way to compare the paper’s coordinate and wave transformations.",
};

export const DOPPLER_EXERCISE: ConnectionExercise = {
  id,
  title: CONNECTION_EXERCISE_LINKS[1].title,
  historicalStatus: "later-development",
  introduction: [
    "The relativity paper changes both the coordinates of an event and the frequency of a light wave. This modern matrix view asks whether those two changes contain the same scale factor.",
    "Our sign convention is β = v/c positive for recession along the line of sight. For the matrix, the source is at rest in the original frame and the observer moves at +v along the outgoing ray. Reversing the light direction gives the approaching comparison. The paper writes V for the speed of light; c here is modern notation.",
  ],
  sections: [
    {
      id: `${id}-numbers`,
      title: "First compare the two directions",
      paragraphs: [
        "The frequency ratios and matrix scale factors are computed independently by their registered host reference owners.",
      ],
      parts: [
        { kind: "numeric", part: RECEDING_FACTOR },
        { kind: "numeric", part: APPROACHING_FACTOR },
        { kind: "numeric", part: FORWARD_EIGENVALUE },
        { kind: "numeric", part: BACKWARD_EIGENVALUE },
      ],
    },
    {
      id: `${id}-meaning`,
      title: "Then ask why the agreement persists",
      paragraphs: [],
      parts: [
        { kind: "expression", part: DOPPLER_EXPRESSION },
        { kind: "explanation", part: DOPPLER_EXPLANATION },
      ],
    },
  ],
  links: [
    {
      href: "/discover/special-relativity/#step-05",
      label: "Journey III: construct the coordinate map",
    },
    {
      href: "/discover/special-relativity/#step-06",
      label: "Journey III: apply the map to clocks, waves and light",
    },
    { href: "/papers/special-relativity/#s7", label: "Relativity §7: the wave transformation" },
    { href: "/lab/sr-04/", label: "Explore the boost matrix" },
    { href: "/lab/sr-09/", label: "Explore Doppler shift and aberration" },
  ],
};
