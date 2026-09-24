import { describe, expect, test } from "bun:test";
import { type AnswerVerdict, checkExerciseAnswer } from "../exercises/answer.ts";
import { GREATEST_ENERGY_EXERCISE } from "./electronExercise.ts";

/** The electron rule as an expression (am-disc-exercise-checker-i4h2), through the real checker. */

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("the greatest energy, written by the reader", () => {
  for (const answer of ["h*nu-P", "nu*h-P", "-P+h*nu", "h*(nu-P/h)"])
    test(`${answer} is accepted`, async () => {
      expect(status(await checkExerciseAnswer(GREATEST_ENERGY_EXERCISE, answer))).toBe(
        "equivalent",
      );
    });

  test("the sign turned round, P − hν, is not equivalent", async () => {
    expect(status(await checkExerciseAnswer(GREATEST_ENERGY_EXERCISE, "P-h*nu"))).toBe(
      "not-equivalent",
    );
  });

  test("the whole quantum, hν, is not equivalent: the escape is paid for", async () => {
    expect(status(await checkExerciseAnswer(GREATEST_ENERGY_EXERCISE, "h*nu"))).toBe(
      "not-equivalent",
    );
  });

  test("h/nu − P is refused by its dimension before any numbers", async () => {
    const verdict = await checkExerciseAnswer(GREATEST_ENERGY_EXERCISE, "h/nu-P");
    expect(verdict.kind).toBe("dimension");
  });
});
