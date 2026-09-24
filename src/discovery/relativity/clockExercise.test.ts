import { describe, expect, test } from "bun:test";
import { type AnswerVerdict, checkExerciseAnswer } from "../exercises/answer.ts";
import { MOVING_CLOCK_EXERCISE } from "./clockExercise.ts";

/**
 * The moving clock as an expression (am-disc-exercise-checker-i4h2), through the real checker:
 * every correct form is accepted, the two common slips are not, and an answer that subtracts a
 * speed from a pure number is told so by its dimension before any numbers are compared.
 */

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

describe("every correct form of the reading is accepted", () => {
  for (const answer of [
    "t*sqrt(1-v^2/c^2)",
    "t*sqrt(1-(v/c)^2)",
    "t*sqrt((c^2-v^2)/c^2)",
    "t*sqrt(c^2-v^2)/c",
    "sqrt(t^2-t^2*v^2/c^2)",
  ])
    test(answer, async () => {
      expect(status(await checkExerciseAnswer(MOVING_CLOCK_EXERCISE, answer))).toBe("equivalent");
    });
});

describe("the common slips are not", () => {
  test("dividing by the factor: the other side of the same fact, not the moving clock's reading", async () => {
    const verdict = await checkExerciseAnswer(MOVING_CLOCK_EXERCISE, "t/sqrt(1-v^2/c^2)");
    expect(status(verdict)).toBe("not-equivalent");
  });

  test("the speed not squared: t·√(1 − v/c)", async () => {
    expect(status(await checkExerciseAnswer(MOVING_CLOCK_EXERCISE, "t*sqrt(1-v/c)"))).toBe(
      "not-equivalent",
    );
  });

  test("c left out: the dimension says a speed squared was subtracted from a pure number", async () => {
    const verdict = await checkExerciseAnswer(MOVING_CLOCK_EXERCISE, "t*sqrt(1-v^2)");
    expect(verdict.kind).toBe("dimension");
    expect(verdict.kind === "dimension" && verdict.message).toContain(
      "quantities of different dimensions cannot be added or subtracted",
    );
  });
});

describe("its ranges keep the moving clock slower than light", () => {
  test("every v in the declared range is below every c", () => {
    expect(MOVING_CLOCK_EXERCISE.domains.v?.max).toBeLessThan(
      MOVING_CLOCK_EXERCISE.domains.c?.min as number,
    );
  });
});
