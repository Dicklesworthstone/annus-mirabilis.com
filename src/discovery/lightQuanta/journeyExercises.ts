/**
 * Journey I's exercises (am-disc-journey-i-chain-n1lh, checked by am-disc-exercise-checker-i4h2):
 * three instrumented parts computed at build time by the photoelectric reference owner with the
 * 2019 SI constants, and two explanation parts the reader judges against their criteria.
 *
 * All three numbers are the photoelectric rule's arithmetic under a modern lens, with today's h.
 * None is a 1905 measurement. The stopping-potential line of the first part is made up and says
 * so: two points computed from the rule for a made-up surface, never sampled with noise to look
 * like data (AGENTS.md "Historical constants, modern constants, synthetic data, real data").
 *
 * Pages may not import physics owners (noPhysicsInComponents), so the page receives the parts.
 * Every number a prompt or a worked explanation prints is formatted from the owner's own values
 * here, so the text and the reference cannot disagree.
 */
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  quantumRate,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
} from "../../physics/reference/photoelectric.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

const SET_ID = "modern-si-2019";
const SET = getConstantSet(SET_ID);
const H = constantValue(SET, "planckConstant").value;
const E = constantValue(SET, "elementaryCharge").value;
const C = constantValue(SET, "speedOfLight").value;

const RAISED: Readonly<Record<string, string>> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** A number as the prompt prints it: four significant figures, a power of ten raised. */
export function printed(value: number, figures = 4): string {
  const [mantissa = "", exponent = "0"] = value.toExponential(figures - 1).split("e");
  const power = Number(exponent);
  if (power >= -3 && power < 6) return String(Number(value.toPrecision(figures)));
  const raised = [...String(power)].map((c) => RAISED[c] ?? c).join("");
  return `${Number(mantissa)} × 10${raised}`;
}

/** The value of an owner result, or a refusal that fails the build. */
function ownerValue(
  result: Readonly<{ status: string; value?: unknown }>,
  owner: string,
  exerciseId: string,
): number {
  return referenceFromEvaluation(result, { constantSetId: SET_ID, owner, exerciseId }).value;
}

/** The made-up surface's escape cost, eV, and the two frequencies of its line, Hz. */
export type LineInputs = Readonly<{ workFunctionEv: number; low: number; high: number }>;

export const LINE_INPUTS: LineInputs = Object.freeze({ workFunctionEv: 2, low: 6e14, high: 9e14 });

/**
 * Exercise 1: h from two points of a made-up stopping-potential line. The points are the owner's
 * stopping potentials, printed to four figures; the reader's slope times e is h. The reference is
 * the same arithmetic on the owner's unrounded values, which is today's h itself.
 */
export function hFromLinePart(inputs: LineInputs): NumericExercisePart {
  const id = "lq-h-from-stopping-line";
  const owner = "photoelectric.stoppingPotentialFromEv";
  const low = ownerValue(
    stoppingPotentialFromEv(inputs.low, inputs.workFunctionEv, SET),
    owner,
    id,
  );
  const high = ownerValue(
    stoppingPotentialFromEv(inputs.high, inputs.workFunctionEv, SET),
    owner,
    id,
  );
  const slope = (high - low) / (inputs.high - inputs.low);
  // The same refusal as every other reference: a slope that is not a finite number fails the build.
  const reference = referenceFromEvaluation(
    { status: "value", value: slope * E, quantityId: "planckConstant" },
    { constantSetId: SET_ID, owner, exerciseId: id },
  );
  const h = reference.value;
  const onePoint = (low * E) / inputs.low;
  return Object.freeze({
    id,
    prompt: `Under the modern lens, a made-up line and not a measurement: for a surface from which an electron needs ${inputs.workFunctionEv} eV to escape, the photoelectric rule with today’s constants gives a stopping potential of ${printed(low)} V at ${printed(inputs.low / 1e12)} THz and ${printed(high)} V at ${printed(inputs.high / 1e12)} THz. The rule says these lie on a straight line whose slope is h/e, with e = 1.602176634 × 10⁻¹⁹ C. What is h? Give it in J·s or eV·s.`,
    workedExplanation: `The slope is the rise over the run: (${printed(high)} − ${printed(low)}) V over (${printed(inputs.high)} − ${printed(inputs.low)}) Hz, about ${printed(slope)} V·s. The rule says the slope is h/e, so h is the slope times e: ${printed(slope)} × 1.602176634 × 10⁻¹⁹, about ${printed(h)} J·s, or ${printed(slope)} eV·s. The escape cost drops out of the slope; it only moves the line up or down. The line was computed from today’s h, so this recovers the h that made it. With measured points the same slope is how h is read from the photoelectric effect, which Millikan did in 1916, later evidence and not on the 1904 shelf.`,
    family: "action",
    units: ["J*s", "eV*s"],
    reference,
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "The two points are printed to four figures, and their difference keeps fewer, so an answer within 1 percent is the same answer.",
    // The slope itself, h/e, typed as J·s needs no slip: numerically it is h in eV·s, and the
    // checker's unit diagnosis ("would agree in eV·s") says so before any slip is tried.
    commonSlips: [
      {
        factor: onePoint / h,
        message:
          "That divides one point’s voltage by its frequency, as though the line went through zero. It does not: the escape cost lowers it. Use the difference between the two points.",
      },
    ],
  });
}

export const H_FROM_STOPPING_LINE = hFromLinePart(LINE_INPUTS);

/** Exercise 2: the threshold for a made-up surface with a 2 eV escape cost. */
export function thresholdPart(workFunctionEv: number): NumericExercisePart {
  const id = "lq-threshold-two-ev";
  const owner = "photoelectric.thresholdFrequencyFromEv";
  const reference = referenceFromEvaluation(thresholdFrequencyFromEv(workFunctionEv, SET), {
    constantSetId: SET_ID,
    owner,
    exerciseId: id,
  });
  return Object.freeze({
    id,
    prompt: `Under the modern lens, with today’s h = 6.62607015 × 10⁻³⁴ J·s and 1 eV = 1.602176634 × 10⁻¹⁹ J: a made-up surface needs ${workFunctionEv} eV to free an electron. Below what frequency does light free none, however bright it is? Give it in THz or Hz.`,
    workedExplanation: `One quantum must pay the whole escape cost, so the lowest frequency that frees an electron is the one whose quantum carries exactly ${workFunctionEv} eV: ν₀ = W/h. In joules W is ${workFunctionEv} × 1.602176634 × 10⁻¹⁹ = ${printed(workFunctionEv * E)} J, and dividing by h gives ${printed(reference.value)} Hz, about ${printed(reference.value / 1e12)} THz. Below it, brighter light brings more quanta of the same too-small size, and in this model no electron leaves.`,
    family: "frequency",
    units: ["THz", "Hz"],
    reference,
    tolerance: { absolute: 0, relative: 0.005 },
    toleranceReason:
      "The inputs are exact and the answer is quoted to four figures, so an answer within half a percent is the same answer.",
    commonSlips: [
      {
        factor: 1 / E,
        message: `That divides ${workFunctionEv} by h without turning ${workFunctionEv} eV into joules first.`,
      },
    ],
  });
}

export const THRESHOLD_TWO_EV = thresholdPart(2);

/** Radiated power W, and the wavelength of the light, m. */
export type SourceInputs = Readonly<{ power: number; wavelength: number }>;

export const SOURCE_INPUTS: SourceInputs = Object.freeze({ power: 1, wavelength: 532e-9 });

/** Exercise 3: how many quanta a one-watt green source gives off each second. */
export function quantaPerSecondPart(inputs: SourceInputs): NumericExercisePart {
  const id = "lq-quanta-per-second-green";
  const owner = "photoelectric.quantumRate";
  const frequency = C / inputs.wavelength;
  const reference = referenceFromEvaluation(quantumRate(inputs.power, frequency, SET), {
    constantSetId: SET_ID,
    owner,
    exerciseId: id,
  });
  return Object.freeze({
    id,
    prompt: `Under the modern lens, with today’s h = 6.62607015 × 10⁻³⁴ J·s and c = 299 792 458 m/s: a source gives off ${inputs.power} W of green light of wavelength ${printed(inputs.wavelength * 1e9)} nm. If its energy comes in quanta of hν each, how many does it give off each second? Give the number per second.`,
    workedExplanation: `The frequency is c/λ = 299 792 458 / ${printed(inputs.wavelength)}, about ${printed(frequency)} Hz, so each quantum carries hν, about ${printed(H * frequency)} J. ${inputs.power} W is ${inputs.power} J each second, and dividing by the size of one quantum gives about ${printed(reference.value)} each second. The number is so large that the light’s arrival in quanta cannot be seen in its brightness, only in what a single quantum can do.`,
    family: "countRate",
    units: ["1/s"],
    reference,
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "The wavelength is given to three figures, so an answer within 1 percent is the same answer.",
    commonSlips: [
      {
        // P/(hλ) over the reference Pλ/(hc) is c/λ².
        factor: C / inputs.wavelength ** 2,
        message:
          "That divides by h times the wavelength. A quantum carries h times the frequency, c/λ.",
      },
      {
        factor: 1e9,
        message: `That uses ${printed(inputs.wavelength * 1e9)} for the wavelength. In metres it is ${printed(inputs.wavelength)}.`,
      },
    ],
  });
}

export const QUANTA_PER_SECOND = quantaPerSecondPart(SOURCE_INPUTS);

/** Exercise 4: why the brightness does not change the greatest energy. */
export const INTENSITY_EXPLANATION: ExplanationExercisePart = {
  id: "lq-intensity-and-greatest-energy",
  prompt:
    "In two sentences: in the paper’s picture, why does brighter light of the same frequency free more electrons, but none with more energy than before?",
  criteria: [
    "Each electron takes its energy from a single quantum, and the size of a quantum is set by the frequency alone.",
    "Brighter light of the same frequency brings more quanta each second, not larger ones.",
    "So more electrons leave each second, while the greatest energy any one can leave with stays the same.",
    "This is the paper’s heuristic viewpoint; that the energy does not grow with the brightness is Lenard’s observation of 1902, which the viewpoint was built to meet, not something the model shows about nature.",
  ],
  workedExplanation:
    "An electron gets its energy from one quantum at a time, and a quantum’s size depends only on the frequency, so the most any electron can carry away is one quantum’s energy less what it pays to escape. Making the light brighter adds quanta, not size, so more electrons leave each second and the greatest energy stays where it was. That is how the viewpoint meets Lenard’s 1902 observation; it does not prove the viewpoint, which the paper calls heuristic.",
};

/** Exercise 5: the locked positions of LQ-05's counterexample. */
export const LOCKED_POSITIONS_EXPLANATION: ExplanationExercisePart = {
  id: "lq-locked-positions",
  prompt:
    "In LQ-05’s locked counterexample the n points move together, as one rigid pattern placed at random. Why is the chance that all of them lie in a fraction f of the box then f, and not f to the power n?",
  criteria: [
    "When the points are locked together, where one point lies decides where all of them lie.",
    "So the chance that all lie in the fraction f is the chance for one point: f.",
    "Independent points each need their own chance f, and independent chances multiply, which gives f to the power n.",
    "So the power n in a volume law is a sign that the things counted are independent, not merely that there are n of them.",
  ],
  workedExplanation:
    "Locked together, the points have one position between them: once one lands in the fraction f, the rest land there too, so the chance is just f. Free and independent, each point has to land there on its own, with chance f each time, and the chances multiply to f to the power n. That is why the gas law’s power counts independent molecules, and why reading the radiation’s multiplier as a count needs the quanta to behave as if they were independent.",
};

/** The explain step of the predict-perturb-explain task, judged against its criteria. */
export const PPE_EXPLANATION: ExplanationExercisePart = {
  id: "lq-ppe-below-and-above-threshold",
  prompt:
    "Explain what you saw: why doubling the power frees no electrons below the threshold, and why above it the rate rises while the greatest energy does not.",
  criteria: [
    "Below the threshold no single quantum carries enough energy to pay the cost of escape, so more quanta still free none.",
    "Above it, each freed electron has taken up one quantum, so doubling the power doubles the rate and leaves the greatest energy unchanged.",
    "The power falling on the metal does double: it is the energy per quantum that stays the same.",
    "The moving marks in the laboratory are a teaching picture of the model’s bookkeeping, not a picture of anything seen, and the model computes what its premises imply rather than testing them.",
  ],
  workedExplanation:
    "In this picture an electron is freed only by taking up one whole quantum, and a quantum’s energy is set by the frequency. Below the threshold every quantum is too small to pay the cost of escape, so doubling the power doubles the number of too-small quanta and still frees nothing. Above it, the number of electrons follows the number of quanta, so the rate doubles, while the most any one electron can carry away is one quantum less the escape cost, which the power does not change. The marks the laboratory draws are its way of showing that bookkeeping; they are not photographs of light, and a model built this way shows its premises’ consequences, not whether nature agrees.",
};
