import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import {
  checkNumericAnswer,
  ExerciseReferenceError,
  type NumericExercisePart,
  referenceFromEvaluation,
} from "./numeric.ts";

/**
 * Numeric parts (am-disc-exercise-checker-i4h2): "Numeric answers convert units before comparison
 * (483.6 THz equals 4.836e14 Hz), and a declared common slip produces its hint." Pure: the
 * references here are literals; the Brownian one computed by the evaluators is tested beside it
 * in src/discovery/brownian/numericExercises.test.ts.
 */

const context = { constantSetId: "modern-si-2019", owner: "test.literal", exerciseId: "t" };

const THRESHOLD: NumericExercisePart = {
  id: "threshold-frequency",
  prompt: "What is the threshold frequency for a work function of 2 eV?",
  workedExplanation: "Divide the work function by h.",
  family: "frequency",
  units: ["THz", "Hz"],
  // Φ/h for Φ = 2 eV with the exact 2019 SI h and e: 4.83598 × 10¹⁴ Hz.
  reference: referenceFromEvaluation(
    { status: "value", value: 4.835978484e14, quantityId: "thresholdFrequency" },
    context,
  ),
  tolerance: { absolute: 0, relative: 1e-3 },
  toleranceReason: "Four significant figures.",
};

const LAMBDA: NumericExercisePart = {
  id: "one-second",
  prompt: "How far along one axis in one second?",
  workedExplanation: "√(2Dt).",
  family: "length",
  units: ["um", "nm", "m"],
  reference: referenceFromEvaluation(
    { status: "value", value: 7.947832833416785e-7, quantityId: "rmsDisplacement1d" },
    context,
  ),
  tolerance: { absolute: 0, relative: 0.01 },
  toleranceReason: "Two significant figures.",
  commonSlips: [
    { factor: Math.SQRT1_2, message: "Did you use the diameter where the radius is asked?" },
    { factor: Math.SQRT2, message: "That is the distance in the plane." },
  ],
};

describe("units are converted before comparison", () => {
  test("483.6 THz and 4.836e14 Hz both agree with the reference", () => {
    expect(checkNumericAnswer(THRESHOLD, "483.6", "THz").kind).toBe("agrees");
    expect(checkNumericAnswer(THRESHOLD, "4.836e14", "Hz").kind).toBe("agrees");
  });

  test("the same number in the wrong unit does not agree, and is told which unit it fits", () => {
    const verdict = checkNumericAnswer(THRESHOLD, "483.6", "Hz");
    expect(verdict.kind).toBe("differs");
    expect(verdict.message).toBe(
      "Your number would agree in THz, not Hz: choose THz, or convert the number.",
    );
  });

  test("0.79 μm, Einstein's 0.8 μm, 794.8 nm and 7.9e-7 m all agree", () => {
    for (const [value, unit] of [
      ["0.79", "um"],
      ["0.8", "um"],
      ["794.8", "nm"],
      ["7.9e-7", "m"],
      ["−0.79", "um"],
    ] as const) {
      const verdict = checkNumericAnswer(LAMBDA, value, unit);
      if (value.startsWith("−")) expect(verdict.kind).toBe("differs");
      else expect(verdict.kind, `${value} ${unit}`).toBe("agrees");
    }
  });

  test("the agreement names the reference in the reader's unit and the execution label", () => {
    // The number and its unit are held together by a no-break space.
    expect(checkNumericAnswer(LAMBDA, "794.8", "nm").message).toBe(
      "This agrees with the reference, 794.8\u00a0nm, within 1 percent. Ideal model, host calculation.",
    );
  });
});

describe("a declared common slip produces its hint, and only its hint", () => {
  test("0.562 μm is the diameter slip, 1/√2 of the reference", () => {
    const verdict = checkNumericAnswer(LAMBDA, "0.562", "um");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toBe(
      "Your value is 0.707 times the reference. Did you use the diameter where the radius is asked?",
    );
  });

  test("1.124 μm is the plane distance, √2 of the reference", () => {
    expect(checkNumericAnswer(LAMBDA, "1.124", "um").message).toContain("distance in the plane");
  });

  test("a ratio between the slips gets no hint, only its size", () => {
    const verdict = checkNumericAnswer(LAMBDA, "2", "um");
    expect(verdict).toEqual({
      kind: "differs",
      ratio: 2 / 0.7947832833416785,
      segments: ["Your value is ", { number: 2.5 }, " times the reference."],
      message: "Your value is 2.5 times the reference.",
    });
  });
});

describe("a miss is described by its size, never judged", () => {
  const cases = [
    ["7.9e5", "um", "Your value is about a million times the reference."],
    ["0.00079", "um", "Your value is about a thousandth of the reference."],
    ["-0.79", "um", "Your value has the opposite sign to the reference."],
    ["0", "um", "Your value is zero, and the reference is not."],
  ] as const;
  for (const [value, unit, start] of cases)
    test(`${value} ${unit}`, () => {
      expect(checkNumericAnswer(LAMBDA, value, unit).message).toStartWith(start);
    });
});

describe("what the reader typed is read carefully, and never guessed at", () => {
  const cases = [
    ["", "Enter a number"],
    ["0,79", "Use a point for decimals"],
    [".79", "Put a digit before the point"],
    ["abc", "Enter a plain number"],
    ["0.79 um", "Enter a plain number"],
    ["1e400", "too large"],
  ] as const;
  for (const [value, start] of cases)
    test(JSON.stringify(value), () => {
      const verdict = checkNumericAnswer(LAMBDA, value, "um");
      expect(verdict.kind).toBe("input-error");
      expect(verdict.message).toContain(start);
    });

  test("a unit outside the part's list is refused", () => {
    expect(checkNumericAnswer(LAMBDA, "0.79", "cm")).toEqual({
      kind: "input-error",
      message: "Choose a unit from the list.",
    });
  });
});

describe("a reference that is not a value fails, with a code, where it is computed", () => {
  for (const result of [
    { status: "outside-domain" },
    { status: "underdetermined" },
    // A status other than value refuses even when a number rides along with it.
    { status: "analytic-limit", value: 0 },
    { status: "value", value: Number.NaN },
    { status: "value", value: new Float64Array([1, 2]) },
  ])
    test(`${result.status}, value ${Object.prototype.toString.call(result.value)}`, () => {
      let code = "no refusal";
      try {
        referenceFromEvaluation(result, context);
      } catch (error) {
        code = error instanceof ExerciseReferenceError ? error.code : "another error";
      }
      expect(code).toBe("exercise-reference-not-a-value");
    });
});

describe("a right number in the wrong unit is told which unit it belongs to", () => {
  test("0.79 with m chosen would agree in μm; 790 with μm chosen would agree in nm", () => {
    expect(checkNumericAnswer(LAMBDA, "0.79", "m").message).toBe(
      "Your number would agree in μm, not m: choose μm, or convert the number.",
    );
    expect(checkNumericAnswer(LAMBDA, "794.8", "um").message).toBe(
      "Your number would agree in nm, not μm: choose nm, or convert the number.",
    );
  });

  test("a unit outside the part's list is never suggested", () => {
    // 7.948e-5 is right in cm, which this part does not accept; typed with m chosen, the ratio is
    // the m-to-cm step of 100, and the verdict gives the size without naming a unit.
    const verdict = checkNumericAnswer(LAMBDA, "7.948e-5", "m");
    expect(verdict.message).not.toContain("would agree in");
    expect(verdict.message).toStartWith("Your value is about a hundred times the reference.");
  });
});

describe("a verdict's segments say the same sentence as its message", () => {
  test("each number is rounded once, and drawn as the message writes it", () => {
    for (const [value, unit] of [
      ["0.79", "um"],
      ["0.562", "um"],
      ["2", "um"],
      ["0.79", "m"],
      ["3e-9", "m"],
    ] as const) {
      const verdict = checkNumericAnswer(LAMBDA, value, unit);
      if (!("segments" in verdict)) throw new TypeError(`${value} ${unit} has no segments`);
      const numbers = verdict.segments.filter((s) => typeof s !== "string");
      expect(numbers.every((s) => typeof s !== "string" && Number.isFinite(s.number))).toBe(true);
      const words = verdict.segments.filter((s): s is string => typeof s === "string");
      for (const piece of words) expect(verdict.message).toContain(piece);
    }
  });
});

describe("a coefficient identified in a limit is a reference only when the part says so", () => {
  const limit = {
    status: "analytic-limit",
    quantityId: "inertialMassDecrease",
    representation: { kind: "coefficient", value: 3.51152357690522e-8 },
  };

  test("accepted with limitCoefficient, and recorded as coming from a limit", () => {
    const reference = referenceFromEvaluation(limit, context, { limitCoefficient: true });
    expect(reference.value).toBe(3.51152357690522e-8);
    expect(reference.resultStatus).toBe("analytic-limit");
  });

  test("refused without it, and refused when the limit is not a coefficient", () => {
    for (const [result, options] of [
      [limit, {}],
      [{ ...limit, representation: { kind: "point-mass", value: 1 } }, { limitCoefficient: true }],
      [
        { status: "outside-domain", representation: { kind: "coefficient", value: 1 } },
        { limitCoefficient: true },
      ],
    ] as const) {
      let code = "no refusal";
      try {
        referenceFromEvaluation(result, context, options);
      } catch (error) {
        code = error instanceof ExerciseReferenceError ? error.code : "another error";
      }
      expect(code).toBe("exercise-reference-not-a-value");
    }
  });
});

describe("every reader-facing sentence passes the voice lint", () => {
  test("as task feedback", () => {
    const messages = [
      checkNumericAnswer(LAMBDA, "0.79", "um"),
      checkNumericAnswer(LAMBDA, "0.562", "um"),
      checkNumericAnswer(LAMBDA, "2", "um"),
      checkNumericAnswer(LAMBDA, "0.79", "m"),
      checkNumericAnswer(LAMBDA, "0.00079", "um"),
      checkNumericAnswer(LAMBDA, "-0.79", "um"),
      checkNumericAnswer(LAMBDA, "0", "um"),
      checkNumericAnswer(LAMBDA, "0,79", "um"),
      checkNumericAnswer(LAMBDA, ".79", "um"),
      checkNumericAnswer(LAMBDA, "abc", "um"),
    ].map((v) => v.message);
    for (const message of messages) {
      const errors = checkVoice(message, { context: "task-feedback" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
      expect(message).not.toMatch(/\b(wrong|incorrect|score|attempts?)\b/i);
    }
  });
});
