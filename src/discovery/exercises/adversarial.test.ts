import { describe, expect, test } from "bun:test";
import { checkEquivalence } from "./equivalence.ts";
import { globalExerciseCheckerLogger } from "./exerciseCheckerLogger.ts";
import { parse } from "./grammar.ts";

const TOLERANCE = { absolute: 1e-9, relative: 1e-9 };

function mustParse(text: string, names: readonly string[] = ["x"]) {
  const parsed = parse(text, new Set(names));
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.message}`);
  return parsed.expr;
}

describe("am-disc-exercise-checker-i4h2: adversarial corpus and boundary tests", () => {
  test("adversarial aliasing: x^2 versus x^2 + sin(32*pi*x) rejected via Philox sampling", () => {
    const start = Date.now();
    const outcome = checkEquivalence(
      mustParse("x^2 + sin(32*pi*x)", ["x", "pi"]),
      mustParse("x^2", ["x", "pi"]),
      { x: { min: 0, max: 1 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("not-equivalent");

    globalExerciseCheckerLogger.log({
      testId: "adversarial-sin32pi-aliasing-caught",
      adversarialId: "sin-32-pi-x-grid-aliasing",
      status: "not-equivalent",
      sampleFamily: "philox",
      outcome: "pass",
      durationMs: Date.now() - start,
      message:
        "Adversarial high-frequency grid-aliasing function rejected by Philox random point set.",
    });
  });

  test("algebraic difference: (x+1)^2 - x^2 - 2*x versus 1 confirmed equivalent", () => {
    const start = Date.now();
    const outcome = checkEquivalence(
      mustParse("(x+1)^2 - x^2 - 2*x", ["x"]),
      mustParse("1", ["x"]),
      { x: { min: -100, max: 100 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("equivalent");

    globalExerciseCheckerLogger.log({
      testId: "adversarial-algebraic-expansion-identity",
      status: "equivalent",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Algebraic expansion identity confirmed equivalent across wide linear domain.",
    });
  });

  test("missing factor of 2: 4*D*t versus 2*D*t rejected as not-equivalent", () => {
    const start = Date.now();
    const outcome = checkEquivalence(
      mustParse("4*D*t", ["D", "t"]),
      mustParse("2*D*t", ["D", "t"]),
      { D: { min: 1e-10, max: 1e-8, scale: "log" }, t: { min: 1, max: 10 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("not-equivalent");
    if (outcome.status === "not-equivalent") {
      expect(outcome.readerValue).toBeGreaterThan(outcome.referenceValue);
    }

    globalExerciseCheckerLogger.log({
      testId: "adversarial-missing-factor-of-two",
      status: "not-equivalent",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Missing factor of 2 cleanly rejected with distinct reader and reference values.",
    });
  });

  test("sign flip: -sqrt(2*D*t) versus sqrt(2*D*t) rejected as not-equivalent", () => {
    const start = Date.now();
    const outcome = checkEquivalence(
      mustParse("-sqrt(2*D*t)", ["D", "t"]),
      mustParse("sqrt(2*D*t)", ["D", "t"]),
      { D: { min: 1e-10, max: 1e-8, scale: "log" }, t: { min: 1, max: 10 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("not-equivalent");

    globalExerciseCheckerLogger.log({
      testId: "adversarial-sign-flip",
      status: "not-equivalent",
      outcome: "pass",
      durationMs: Date.now() - start,
      message: "Sign flip rejected across domain.",
    });
  });
});
