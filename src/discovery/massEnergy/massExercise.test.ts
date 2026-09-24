import { describe, expect, test } from "bun:test";
import { type AnswerVerdict, checkExerciseAnswer } from "../exercises/answer.ts";
import { explanationOutcome } from "../exercises/explanation.ts";
import {
  EQUAL_AND_OPPOSITE_EXPLANATION,
  MASS_GIVEN_UP_EXERCISE,
  PULSE_SUM_EXERCISE,
} from "./massExercise.ts";

/** The paper's result as an expression (am-disc-exercise-checker-i4h2), through the real checker. */

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("the mass given up, written by the reader", () => {
  for (const answer of ["L/V^2", "L/(V*V)", "L*V^-2", "(L/V)/V"])
    test(`${answer} is accepted`, async () => {
      expect(status(await checkExerciseAnswer(MASS_GIVEN_UP_EXERCISE, answer))).toBe("equivalent");
    });

  test("L/V is told by its dimension that it is a momentum, not a mass", async () => {
    const verdict = await checkExerciseAnswer(MASS_GIVEN_UP_EXERCISE, "L/V");
    expect(verdict.kind === "dimension" && verdict.message).toBe(
      "Your expression has the dimension of a momentum; the quantity asked for is a mass.",
    );
  });

  test("L·V² is refused by its dimension too", async () => {
    expect((await checkExerciseAnswer(MASS_GIVEN_UP_EXERCISE, "L*V^2")).kind).toBe("dimension");
  });

  test("half of it, the shape of the kinetic energy, is the right dimension and the wrong number", async () => {
    expect(status(await checkExerciseAnswer(MASS_GIVEN_UP_EXERCISE, "L/(2*V^2)"))).toBe(
      "not-equivalent",
    );
  });
});

/** Journey IV's exercise 2 (am-disc-journey-iv-chain-wwrz): the angle drops out of the sum. */
describe("the two pulses' total, written by the reader", () => {
  for (const answer of ["L/sqrt(1-(v/V)^2)", "L*(1-(v/V)^2)^(-1/2)", "L/sqrt(1-v^2/V^2)"])
    test(`${answer} is accepted`, async () => {
      expect(status(await checkExerciseAnswer(PULSE_SUM_EXERCISE, answer))).toBe("equivalent");
    });

  test("the unsimplified sum is refused by the angle it still contains", async () => {
    const verdict = await checkExerciseAnswer(
      PULSE_SUM_EXERCISE,
      "(L/2)*(1-(v/V)*cos(phi))/sqrt(1-(v/V)^2)+(L/2)*(1+(v/V)*cos(phi))/sqrt(1-(v/V)^2)",
    );
    expect(verdict.kind).toBe("parse-error");
    expect(verdict.kind === "parse-error" && verdict.message).toContain("'phi'");
  });

  test("L alone, the rest-frame energy, is the right dimension and the wrong total", async () => {
    expect(status(await checkExerciseAnswer(PULSE_SUM_EXERCISE, "L"))).toBe("not-equivalent");
    expect(status(await checkExerciseAnswer(PULSE_SUM_EXERCISE, "L*sqrt(1-(v/V)^2)"))).toBe(
      "not-equivalent",
    );
  });

  test("a mass is told by its dimension that it is not an energy", async () => {
    expect((await checkExerciseAnswer(PULSE_SUM_EXERCISE, "L/V^2")).kind).toBe("dimension");
  });
});

describe("why two equal, opposite pulses", () => {
  test("is a valid explanation part, read by the reader against its criteria", () => {
    expect(explanationOutcome(EQUAL_AND_OPPOSITE_EXPLANATION).kind).toBe("needs-human-reading");
  });
});
