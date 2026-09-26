/**
 * Journey III's exercises (dispatch 260): two expressions and one number, each checked against the
 * host kinematics owner, and two explanation parts the reader judges against their criteria.
 *
 * NOTHING HERE IS CHECKED AS TEXT. An expression part is checked by evaluating the reader's
 * expression and the reference at sample points across the declared ranges (equivalence.ts), and
 * the test beside this file shows each reference agrees with the owner (composeCollinear, gamma)
 * wherever it is evaluated. The numeric part converts the reader's value to SI and compares it with
 * a number the owner computed (numeric.ts). A wrong answer that is word for word a string the part
 * stores is refused, and the test plants one to show it.
 *
 * Pages may not import physics owners (noPhysicsInComponents), so the page receives the parts, and
 * every number a prompt or worked explanation prints is formatted from the owner's values here.
 * The paper writes V for the speed of light; the parts write c and say so.
 */
import {
  composeCollinear,
  dilationLossPerSecond,
  gamma,
} from "../../physics/reference/kinematics.ts";
import type { ExpressionExercisePart } from "../exercises/answer.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

const SPEED = ["1", "0", "-1", "0", "0", "0"] as const;
const TIME = ["0", "0", "1", "0", "0", "0"] as const;
const LIGHT = { min: 2.99e8, max: 3e8 } as const;

/** The owner's value, or a refusal that fails the build. */
function ownerValue(
  result: Readonly<{ status: string; value?: unknown }>,
  owner: string,
  exerciseId: string,
): number {
  return referenceFromEvaluation(result, {
    constantSetId: "none: a ratio of speeds",
    owner,
    exerciseId,
  }).value;
}
/** A number as a sentence prints it: three significant figures, no trailing zeros. */
const f = (x: number, figures = 3) => String(Number(x.toPrecision(figures)));

const B = 0.6;
const COMPOSED = ownerValue(composeCollinear(B, B), "kinematics.composeCollinear", "sr-composed");
const G = ownerValue(gamma(B), "kinematics.gamma", "sr-clock-speed");

/** Exercise 1: two speeds along one line, as § 5 combines them. */
export const COMPOSITION_EXERCISE: ExpressionExercisePart = {
  id: "sr-composed-speed",
  prompt:
    "Section 5 of the paper asks how speeds combine. A body moves at speed w relative to a system k, in the direction in which k itself moves at speed v relative to you. How fast does the body move relative to you? Write it using v, w and c, the speed of light, which the paper writes V.",
  declaredNames: ["v", "w", "c"],
  domains: {
    v: { min: 1e6, max: 2.9e8, scale: "log" },
    w: { min: 1e6, max: 2.9e8, scale: "log" },
    c: LIGHT,
  },
  referenceSource: "(v+w)/(1+v*w/c^2)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  dimensions: { v: SPEED, w: SPEED, c: SPEED },
  workedExplanation: `The ordinary rule would give v + w. Section 5 finds instead U = (v + w)/(1 + vw/V²), which you can write (v+w)/(1+v*w/c^2). At v = w = ${f(B)}c the ordinary rule gives ${f(2 * B)}c, and this one gives ${f(2 * B)}c/${f(1 + B * B)}, about ${f(COMPOSED)}c, less than c. If either speed is c the result is c, whatever the other is: § 5 prints U = V for that case, since composing the speed of light with a smaller speed does not change it. At everyday speeds vw/c² is tiny, and the ordinary sum returns.`,
};

/** Exercise 2: the speed of a clock, from what it reads and what the resting clocks read. */
export const CLOCK_SPEED_EXERCISE: ExpressionExercisePart = {
  id: "sr-clock-speed-from-readings",
  prompt:
    "A clock moving past you in a straight line reads τ while your clocks read t. How fast is it moving? Write v using t, tau for τ, and c, the speed of light, which the paper writes V.",
  declaredNames: ["t", "tau", "c"],
  // Every τ in its range is below every t, so the clock always reads less than yours.
  domains: {
    t: { min: 60, max: 100 },
    tau: { min: 1, max: 50 },
    c: LIGHT,
  },
  referenceSource: "c*sqrt(1-tau^2/t^2)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  dimensions: { t: TIME, tau: TIME, c: SPEED },
  workedExplanation: `Section 4 gives the moving clock's reading as τ = t√(1 − v²/V²). Divide by t and square: τ²/t² = 1 − v²/c², so v²/c² = 1 − τ²/t², and v = c√(1 − τ²/t²), which you can write c*sqrt(1-tau^2/t^2). The check against the world at step 08 opens with ${f(10 / G)} s on the moving clock for 10 s of the resting clocks, and this gives v = c√(1 − ${f((1 / G) ** 2)}) = ${f(B)}c. A reading equal to t gives v = 0, and a reading near zero a speed near c, never beyond it.`,
};

/** The light clock's arm, m, and its speed as a fraction of the speed of light. */
export type LightClockInputs = Readonly<{ arm: number; beta: number }>;

export const LIGHT_CLOCK_INPUTS: LightClockInputs = Object.freeze({ arm: 1.5, beta: 0.6 });

/**
 * Exercise 3: the light clock's path in one tick, judged from rest: twice the arm times the owner's
 * γ. Built from inputs, so a test can show that an input the owner refuses fails the build.
 */
export function lightClockPathPart(inputs: LightClockInputs): NumericExercisePart {
  const id = "sr-light-clock-path";
  const owner = "kinematics.gamma";
  const { arm, beta } = inputs;
  const g = ownerValue(gamma(beta), owner, id);
  const reference = referenceFromEvaluation(
    { status: "value", value: 2 * arm * g, quantityId: "lightClockPathPerTick" },
    { constantSetId: "none: a ratio of speeds", owner, exerciseId: id },
  );
  const path = reference.value;
  return Object.freeze({
    id,
    prompt: `A light clock is two mirrors ${arm} m apart, and one tick is a trip of light from one mirror to the other and back. The clock moves at ${beta} of the speed of light, across the line between its mirrors. Judged from the resting system, how far does the light travel in one tick? Give it in metres or centimetres. The light clock is not in the paper, which writes V for the speed of light; it is a later way of seeing the factor of § 4.`,
    workedExplanation: `Seen from rest, the mirrors move while the light crosses, so each crossing is the long side of a right triangle: if it takes a time T, (cT)² = ${arm}² + (${beta}cT)², so cT = ${arm}/√(1 − ${f(beta * beta)}) = ${f(path / 2, 4)} m, and there and back is ${f(path, 4)} m. In the clock's own frame the light travels ${f(2 * arm)} m. Both are covered at the speed c, so a tick judged from rest is longer by ${f(path, 4)}/${f(2 * arm)} = ${f(g, 4)}, the factor by which § 4's moving clock reads less than the resting ones.`,
    family: "length",
    units: ["m", "cm"],
    reference,
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason: "An answer within 1 percent is the same answer, so 3.75 m and 375 cm agree.",
    commonSlips: [
      {
        factor: (2 * arm) / path,
        message:
          "That is the path in the clock’s own frame, where the mirrors stand still. Judged from rest they move while the light crosses, and the light has farther to go.",
      },
      {
        factor: 0.5,
        message: "That is one crossing. A tick is there and back.",
      },
      {
        factor: (2 * arm) / g / path,
        message:
          "That shortens the path by the factor instead of lengthening it. The light has farther to go, not less.",
      },
    ],
  });
}

export const LIGHT_CLOCK_PATH = lightClockPathPart(LIGHT_CLOCK_INPUTS);

/** Exercise 4: why neither observer is wrong about simultaneity. */
export const SIMULTANEITY_EXPLANATION: ExplanationExercisePart = {
  id: "sr-neither-observer-wrong",
  prompt:
    "Two observers in uniform motion relative to each other set their clocks by the same rule, and disagree about which distant events happen at the same time. In two or three sentences: why is neither of them wrong?",
  criteria: [
    "For events far apart, “at the same time” is fixed by a procedure: clocks are set by light signals, taking the light’s travel time to be the same both ways.",
    "Each observer applies that procedure correctly in their own system, and light has the same speed in both.",
    "Applied in two systems in relative motion, the one procedure picks out two different sets of simultaneous events, so the disagreement follows from the rule and not from an error.",
    "No experiment can say which set is the real one; that is what the principle of relativity requires.",
  ],
  workedExplanation:
    "Neither observer saw two distant events happen at once; each established it, by setting clocks with light signals and taking the light’s time out to equal its time back. Both did so correctly, and light has the same speed for both. Because they move relative to each other, the same rule gives each a different answer about which distant events share a time. The principle of relativity allows no experiment to choose between them, so the disagreement is a fact about simultaneity, not a mistake by either.",
};

const LOSS = dilationLossPerSecond(B);
/** Each form of the loss, through the same coded refusal: a refused loss fails the build. */
const lossForm = (form: "exact" | "printedSecondOrder") =>
  ownerValue(
    LOSS.status === "value" ? { status: "value", value: LOSS.value[form] } : LOSS,
    "kinematics.dilationLossPerSecond",
    "sr-ppe-two-paths-one-reading",
  );
const LOSS_EXACT = lossForm("exact");
const LOSS_PRINTED = lossForm("printedSecondOrder");

/** The explain step of the predict-perturb-explain task, judged against its criteria. */
export const PPE_EXPLANATION: ExplanationExercisePart = {
  id: "sr-ppe-two-paths-one-reading",
  prompt:
    "Explain what you saw: why the clock that went out and back and the clock that circled read the same when they returned, and what the printed second-order form is.",
  criteria: [
    `In § 4 a moving clock's rate depends only on its speed, so any path at ${f(B)} of the speed of light for 10 s of the resting clocks gives the same reading, ${f(10 / G)} s.`,
    "The paper proves this for a path made of straight pieces and assumes it for a curved one: that a clock’s rate depends only on its speed is an assumption about the clock.",
    `The printed ½(v/V)² is the loss to second order: close to the exact loss at low speed, and at ${f(B)}c it gives ${f(LOSS_PRINTED)} s a second against the exact ${f(LOSS_EXACT)}.`,
    "The laboratory computes what the relation implies for an ideal clock; it is not a measurement of any clock.",
  ],
  workedExplanation: `Section 4's clock loses 1 − √(1 − v²/V²) of a second in every second, which depends on its speed and not its direction, so a turn does not change its rate. Out and back or round a circle, at ${f(B)} of the speed of light for 10 s of the resting clocks, the traveller reads ${f(10 / G)} s. The paper proves the result for a path made of straight pieces and assumes it for a curve. At one ten-thousandth of the speed of light the exact loss and the printed ½(v/V)² agree to many figures; at ${f(B)}c the printed form gives ${f(LOSS_PRINTED)} s a second against the exact ${f(LOSS_EXACT)}. The laboratory computes all of this from the relation; the measurement that tested a moving clock's rate is Ives and Stilwell's of 1938, later evidence.`,
};
