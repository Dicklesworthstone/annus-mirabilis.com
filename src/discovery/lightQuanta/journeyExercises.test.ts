import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  checkNumericAnswer,
  ExerciseReferenceError,
  type NumericExercisePart,
  numericPartProblems,
} from "../exercises/numeric.ts";
import {
  H_FROM_STOPPING_LINE,
  hFromLinePart,
  INTENSITY_EXPLANATION,
  LINE_INPUTS,
  LOCKED_POSITIONS_EXPLANATION,
  PPE_EXPLANATION,
  QUANTA_PER_SECOND,
  quantaPerSecondPart,
  SOURCE_INPUTS,
  THRESHOLD_TWO_EV,
  thresholdPart,
} from "./journeyExercises.ts";

/**
 * Journey I's exercises (am-disc-journey-i-chain-n1lh), with the real photoelectric owner and the
 * 2019 SI set. The bead's reference values: threshold 4.83598 × 10¹⁴ Hz for 2 eV; 2.67815 × 10¹⁸
 * quanta per second from 1 W at 532 nm; both to a relative 10⁻⁴.
 */
const SET = getConstantSet("modern-si-2019");
const H = constantValue(SET, "planckConstant").value;
const E = constantValue(SET, "elementaryCharge").value;
const C = constantValue(SET, "speedOfLight").value;
const close = (a: number, b: number, relative: number) => withinTolerance(a, b, { relative }).ok;

describe("the references are the owner's, at the bead's values", () => {
  test("the threshold for 2 eV is 4.83598 × 10¹⁴ Hz", () => {
    expect(close(THRESHOLD_TWO_EV.reference.value, 4.83598e14, 1e-4)).toBe(true);
    expect(THRESHOLD_TWO_EV.reference.owner).toBe("photoelectric.thresholdFrequencyFromEv");
    expect(THRESHOLD_TWO_EV.reference.constantSetId).toBe("modern-si-2019");
  });

  test("1 W at 532 nm is 2.67815 × 10¹⁸ quanta each second", () => {
    expect(close(QUANTA_PER_SECOND.reference.value, 2.67815e18, 1e-4)).toBe(true);
    expect(QUANTA_PER_SECOND.reference.owner).toBe("photoelectric.quantumRate");
    expect(QUANTA_PER_SECOND.family).toBe("countRate");
  });

  test("the made-up line recovers today's h, from the owner's own stopping potentials", () => {
    expect(close(H_FROM_STOPPING_LINE.reference.value, H, 1e-9)).toBe(true);
    expect(H_FROM_STOPPING_LINE.reference.owner).toBe("photoelectric.stoppingPotentialFromEv");
    expect(H_FROM_STOPPING_LINE.family).toBe("action");
  });

  test("every part is usable as authored", () => {
    for (const part of [H_FROM_STOPPING_LINE, THRESHOLD_TWO_EV, QUANTA_PER_SECOND])
      expect(numericPartProblems(part)).toEqual([]);
  });
});

describe("a reader who works from the printed numbers agrees", () => {
  test("the line's two printed voltages give an h the checker accepts", () => {
    // The prompt's own figures, read back out of its text rather than retyped.
    const volts = [...H_FROM_STOPPING_LINE.prompt.matchAll(/(\d+\.\d+) V at (\d+) THz/g)].map(
      (m) => ({ v: Number(m[1]), nu: Number(m[2]) * 1e12 }),
    );
    expect(volts.length).toBe(2);
    const [a, b] = volts as [{ v: number; nu: number }, { v: number; nu: number }];
    const h = ((b.v - a.v) / (b.nu - a.nu)) * E;
    expect(checkNumericAnswer(H_FROM_STOPPING_LINE, h.toPrecision(4), "J*s").kind).toBe("agrees");
    expect(checkNumericAnswer(H_FROM_STOPPING_LINE, (h / E).toPrecision(4), "eV*s").kind).toBe(
      "agrees",
    );
  });

  test("the threshold agrees in THz and in Hz, and the rate per second", () => {
    expect(checkNumericAnswer(THRESHOLD_TWO_EV, "483.6", "THz").kind).toBe("agrees");
    expect(checkNumericAnswer(THRESHOLD_TWO_EV, "4.836e14", "Hz").kind).toBe("agrees");
    expect(checkNumericAnswer(QUANTA_PER_SECOND, "2.678e18", "1/s").kind).toBe("agrees");
  });
});

describe("each declared slip is what the slip actually computes", () => {
  const nu = C / SOURCE_INPUTS.wavelength;
  const cases: readonly (readonly [string, NumericExercisePart, number, string, string])[] = [
    [
      "one point through zero",
      H_FROM_STOPPING_LINE,
      // The owner's voltage at the low frequency, divided by that frequency, times e.
      ((H * LINE_INPUTS.low) / E - LINE_INPUTS.workFunctionEv) * (E / LINE_INPUTS.low),
      "J*s",
      "as though the line went through zero",
    ],
    ["eV not turned into J", THRESHOLD_TWO_EV, 2 / H, "Hz", "without turning 2 eV into joules"],
    [
      "h times the wavelength",
      QUANTA_PER_SECOND,
      SOURCE_INPUTS.power / (H * SOURCE_INPUTS.wavelength),
      "1/s",
      "h times the wavelength",
    ],
    [
      "nanometres for metres",
      QUANTA_PER_SECOND,
      (SOURCE_INPUTS.power * 532) / (H * C),
      "1/s",
      "In metres",
    ],
  ];
  for (const [name, part, answer, unit, hint] of cases)
    test(name, () => {
      const verdict = checkNumericAnswer(part, answer.toPrecision(4), unit);
      expect(verdict.kind).toBe("slip");
      expect(verdict.message).toContain(hint);
    });

  test("the slope typed as J·s is told it is h in eV·s, which it numerically is", () => {
    const verdict = checkNumericAnswer(H_FROM_STOPPING_LINE, (H / E).toPrecision(4), "J*s");
    expect(verdict.kind).toBe("differs");
    expect(verdict.message).toContain("would agree in eV·s");
  });

  test("the rate is refused in hertz, which the SI keeps for periodic phenomena", () => {
    expect(QUANTA_PER_SECOND.units).toEqual(["1/s"]);
    expect(nu).toBeGreaterThan(5e14);
  });
});

describe("a reference that cannot be computed fails the build instead of shipping", () => {
  const code = (build: () => unknown) => {
    try {
      build();
      return "no refusal";
    } catch (error) {
      return error instanceof ExerciseReferenceError ? error.code : "another error";
    }
  };
  test("a line whose two points share one frequency has no slope", () => {
    expect(code(() => hFromLinePart({ ...LINE_INPUTS, high: LINE_INPUTS.low }))).toBe(
      "exercise-reference-not-a-value",
    );
  });
  test("a negative power: the owner refuses", () => {
    expect(code(() => quantaPerSecondPart({ ...SOURCE_INPUTS, power: -1 }))).toBe(
      "exercise-reference-not-a-value",
    );
  });
  test("a threshold for an escape cost that is not a number", () => {
    expect(code(() => thresholdPart(Number.NaN))).toBe("exercise-reference-not-a-value");
  });
});

describe("the words", () => {
  const explanations = [INTENSITY_EXPLANATION, LOCKED_POSITIONS_EXPLANATION, PPE_EXPLANATION];
  const numeric = [H_FROM_STOPPING_LINE, THRESHOLD_TWO_EV, QUANTA_PER_SECOND];

  test("each explanation part has two to five criteria", () => {
    for (const part of explanations) {
      expect(part.criteria.length).toBeGreaterThanOrEqual(2);
      expect(part.criteria.length).toBeLessThanOrEqual(5);
    }
  });

  test("every prompt that names h says it is the modern lens", () => {
    for (const part of numeric) expect(part.prompt).toContain("Under the modern lens");
  });

  test("no photon, no catastrophe, no proof, and the voice lint passes", () => {
    const words = [
      ...numeric.flatMap((p) => [p.prompt, p.workedExplanation, p.toleranceReason]),
      ...explanations.flatMap((p) => [p.prompt, p.workedExplanation, ...p.criteria]),
    ].join(" ");
    for (const banned of ["photon", "ultraviolet catastrophe", "proved", "proves", "not a wave"])
      expect(words.toLowerCase()).not.toContain(banned);
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
