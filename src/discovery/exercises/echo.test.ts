import { describe, expect, test } from "bun:test";
import { checkExerciseAnswer, type ExpressionExercisePart } from "./answer.ts";
import { echo, parse } from "./grammar.ts";

/**
 * The parsed echo (am-disc-exercise-checker-i4h2, "the parsed echo shows the interpretation"): the
 * reader's expression written back with every grouping explicit, before the verdict.
 */

const read = (text: string, names = ["x", "y", "a", "b", "c", "D", "t"]) => {
  const parsed = parse(text, new Set(names));
  expect(parsed.ok).toBe(true);
  return parsed.ok ? echo(parsed.expr) : "";
};

describe("the echo makes every grouping explicit", () => {
  test("a division followed by a product: y multiplies, it is not in the denominator", () => {
    expect(read("2*x/3*y")).toBe("((2 · x) / 3) · y");
  });

  test("precedence: a product inside a sum, and a sum inside a product", () => {
    expect(read("a+b*c")).toBe("a + (b · c)");
    expect(read("(a+b)*c")).toBe("(a + b) · c");
  });

  test("a minus sign applies to the whole power, and powers group from the right", () => {
    expect(read("-x^2")).toBe("−(x^2)");
    expect(read("2^3^2")).toBe("2^(3^2)");
  });

  test("functions keep their argument, and plain names and numbers are not bracketed", () => {
    expect(read("sqrt(4*D*t)")).toBe("sqrt((4 · D) · t)");
    expect(read("x")).toBe("x");
    expect(read("0.5")).toBe("0.5");
  });

  test("subtraction and division print as themselves, with a true minus sign", () => {
    expect(read("a-b/c")).toBe("a − (b / c)");
  });
});

describe("the checker returns the echo with its verdict", () => {
  const part: ExpressionExercisePart = {
    id: "echo-part",
    prompt: "Rewrite 2*sqrt(D*t).",
    declaredNames: ["D", "t"],
    domains: {
      D: { min: 1e-14, max: 1e-10, scale: "log" },
      t: { min: 0.1, max: 100, scale: "log" },
    },
    referenceSource: "2*sqrt(D*t)",
    tolerance: { absolute: 1e-9, relative: 1e-9 },
    workedExplanation: "sqrt(4*D*t) = 2*sqrt(D*t).",
  };

  test("an equivalent answer comes back with how it was read", async () => {
    const verdict = await checkExerciseAnswer(part, "sqrt(4*D*t)");
    expect(verdict.kind).toBe("checked");
    if (verdict.kind === "checked") {
      expect(verdict.outcome.status).toBe("equivalent");
      expect(verdict.readAs).toBe("sqrt((4 · D) · t)");
    }
  });

  test("a wrong answer is echoed too, so the reader can see what was compared", async () => {
    const verdict = await checkExerciseAnswer(part, "2*D*t");
    expect(verdict.kind === "checked" && verdict.readAs).toBe("(2 · D) · t");
  });

  test("an unreadable answer gets its parse error and no echo", async () => {
    const verdict = await checkExerciseAnswer(part, "2*(D");
    expect(verdict.kind).toBe("parse-error");
  });
});
