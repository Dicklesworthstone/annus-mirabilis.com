/**
 * Journey III's exercises (dispatch 260), through the real checkers. Two properties:
 *   - the references are the kinematics owner's: the expression references agree with
 *     composeCollinear and gamma at points across their ranges, and the number is the owner's γ;
 *   - they are checked by evaluation, never by text. A correct answer written unlike anything the
 *     part stores is accepted, and a wrong answer that is word for word a string the part stores
 *     (in its prompt, its worked explanation, or a planted answer field) is refused.
 */
import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { composeCollinear, gamma } from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  type AnswerVerdict,
  checkExerciseAnswer,
  type ExpressionExercisePart,
} from "../exercises/answer.ts";
import { evaluate } from "../exercises/evaluate.ts";
import { explanationOutcome } from "../exercises/explanation.ts";
import { parse } from "../exercises/grammar.ts";
import {
  checkNumericAnswer,
  ExerciseReferenceError,
  numericPartProblems,
} from "../exercises/numeric.ts";
import {
  CLOCK_SPEED_EXERCISE,
  COMPOSITION_EXERCISE,
  LIGHT_CLOCK_INPUTS,
  LIGHT_CLOCK_PATH,
  lightClockPathPart,
  PPE_EXPLANATION,
  SIMULTANEITY_EXPLANATION,
} from "./journeyExercises.ts";

const status = (verdict: AnswerVerdict) =>
  verdict.kind === "checked" ? verdict.outcome.status : verdict.kind;

/** The reference expression's value at a point, read by the same grammar the checker uses. */
function referenceAt(part: ExpressionExercisePart, env: Record<string, number>): number {
  const parsed = parse(part.referenceSource, new Set(part.declaredNames));
  if (!("expr" in parsed)) throw new Error(`${part.id}: the reference does not parse`);
  const result = evaluate(parsed.expr, env);
  if (result.status !== "value") throw new Error(`${part.id}: the reference did not evaluate`);
  return result.value;
}
const owner = (r: { status: string; value?: unknown }) => {
  if (r.status !== "value" || typeof r.value !== "number") throw new Error("owner refused");
  return r.value;
};
const close = (a: number, b: number) => withinTolerance(a, b, { relative: 1e-12 }).ok;
const C = 299_792_458;

describe("the references are the kinematics owner's", () => {
  test("the composed speed agrees with composeCollinear across the range", () => {
    for (const [v, w] of [
      [0.6, 0.6],
      [0.1, 0.9],
      [0.99, 0.99],
      [1e-3, 0.5],
    ] as const)
      expect(
        close(
          referenceAt(COMPOSITION_EXERCISE, { v: v * C, w: w * C, c: C }),
          owner(composeCollinear(v, w)) * C,
        ),
      ).toBe(true);
  });

  test("the clock's speed inverts gamma: from its reading, the owner's γ comes back", () => {
    for (const beta of [0.1, 0.6, 0.9]) {
      const t = 80;
      const tau = t / owner(gamma(beta));
      expect(close(referenceAt(CLOCK_SPEED_EXERCISE, { t, tau, c: C }), beta * C)).toBe(true);
    }
  });

  test("the light clock's path is twice the arm times the owner's γ", () => {
    const { arm, beta } = LIGHT_CLOCK_INPUTS;
    expect(close(LIGHT_CLOCK_PATH.reference.value, 2 * arm * owner(gamma(beta)))).toBe(true);
    expect(LIGHT_CLOCK_PATH.reference.owner).toBe("kinematics.gamma");
    expect(numericPartProblems(LIGHT_CLOCK_PATH)).toEqual([]);
  });

  test("an input the owner refuses fails the build rather than shipping a checker", () => {
    let refused: unknown;
    try {
      lightClockPathPart({ arm: 1.5, beta: 1 });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(ExerciseReferenceError);
    expect((refused as ExerciseReferenceError).code).toBe("exercise-reference-not-a-value");
  });
});

describe("checked by evaluation: correct forms nobody stored are accepted", () => {
  for (const [part, answer] of [
    [COMPOSITION_EXERCISE, "(w+v)/(1+w*v/c^2)"],
    [COMPOSITION_EXERCISE, "c^2*(v+w)/(c^2+v*w)"],
    [CLOCK_SPEED_EXERCISE, "sqrt(c^2-c^2*tau^2/t^2)"],
    [CLOCK_SPEED_EXERCISE, "c*sqrt(t^2-tau^2)/t"],
  ] as const)
    test(`${part.id}: ${answer}`, async () => {
      expect(part.referenceSource).not.toBe(answer);
      expect(status(await checkExerciseAnswer(part, answer))).toBe("equivalent");
    });

  test("the light clock's path agrees in metres and in centimetres", () => {
    expect(checkNumericAnswer(LIGHT_CLOCK_PATH, "3.75", "m").kind).toBe("agrees");
    expect(checkNumericAnswer(LIGHT_CLOCK_PATH, "375", "cm").kind).toBe("agrees");
  });
});

describe("the plant: a wrong answer that is a string the part stores is refused", () => {
  test("the ordinary sum, written in the worked explanation, is not the composed speed", async () => {
    expect(COMPOSITION_EXERCISE.workedExplanation).toContain("v + w");
    expect(status(await checkExerciseAnswer(COMPOSITION_EXERCISE, "v + w"))).toBe("not-equivalent");
  });

  test("a planted answer field does not make its wrong answer pass", async () => {
    // Were the checker to compare text with anything the part carries, this would pass.
    const planted = { ...COMPOSITION_EXERCISE, answer: "v + w", acceptedAnswers: ["v + w"] };
    expect(status(await checkExerciseAnswer(planted, "v + w"))).toBe("not-equivalent");
    const numeric = { ...LIGHT_CLOCK_PATH, answer: "3", acceptedAnswers: ["3"] };
    expect(checkNumericAnswer(numeric, "3", "m").kind).not.toBe("agrees");
  });

  test("the arm's length, printed in the prompt, is not the path", () => {
    expect(LIGHT_CLOCK_PATH.prompt).toContain(`${LIGHT_CLOCK_INPUTS.arm} m`);
    expect(checkNumericAnswer(LIGHT_CLOCK_PATH, String(LIGHT_CLOCK_INPUTS.arm), "m").kind).not.toBe(
      "agrees",
    );
  });

  test("the clock's own-frame path is a declared slip, named as one", () => {
    const verdict = checkNumericAnswer(LIGHT_CLOCK_PATH, String(2 * LIGHT_CLOCK_INPUTS.arm), "m");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("in the clock’s own frame");
  });

  test("the speed without c is told by its dimension", async () => {
    const verdict = await checkExerciseAnswer(COMPOSITION_EXERCISE, "(v+w)/(1+v*w)");
    expect(verdict.kind).toBe("dimension");
  });

  test("the clock's speed upside down, t over tau, is refused", async () => {
    expect(status(await checkExerciseAnswer(CLOCK_SPEED_EXERCISE, "c*sqrt(1-t^2/tau^2)"))).not.toBe(
      "equivalent",
    );
  });
});

describe("the explanations and their words", () => {
  test("each explanation part is well formed, with two to five criteria", () => {
    for (const part of [SIMULTANEITY_EXPLANATION, PPE_EXPLANATION]) {
      expect(explanationOutcome(part).kind).toBe("needs-human-reading");
      expect(part.criteria.length).toBeGreaterThanOrEqual(2);
      expect(part.criteria.length).toBeLessThanOrEqual(5);
    }
  });

  test("the prose passes the voice lint and keeps the paper's V named", () => {
    const parts = [COMPOSITION_EXERCISE, CLOCK_SPEED_EXERCISE, LIGHT_CLOCK_PATH];
    for (const part of parts) expect(part.prompt).toContain("V");
    const words = [
      ...parts.flatMap((p) => [p.prompt, p.workedExplanation]),
      ...[SIMULTANEITY_EXPLANATION, PPE_EXPLANATION].flatMap((p) => [
        p.prompt,
        p.workedExplanation,
        ...p.criteria,
      ]),
    ].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
