import { describe, expect, test } from "bun:test";
import { type AnswerVerdict, checkExerciseAnswer } from "../exercises/answer.ts";
import { MASS_GIVEN_UP_EXERCISE } from "./massExercise.ts";

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
