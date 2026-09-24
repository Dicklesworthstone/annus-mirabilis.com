import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkExerciseAnswer, type ExpressionExercisePart, NEXT_ACTION } from "./answer.ts";
import { evaluate } from "./evaluate.ts";
import { ALLOWED_FUNCTIONS, parse, UNSUPPORTED_FUNCTIONS } from "./grammar.ts";
import { normalize } from "./normalize.ts";

/**
 * The outcome vocabulary (am-disc-exercise-checker-i4h2): "unsupported-expression" means the
 * checker cannot read the answer, "could-not-compare" that it could not find enough places to
 * compare it. Each has its own sentence and next action. The rewrites offered for an unsupported
 * function are advice a reader will act on, so each is checked against the function it replaces.
 */

const MATH: Readonly<Record<string, (x: number) => number>> = {
  tan: Math.tan,
  log10: Math.log10,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
};

function readBack(text: string, names: readonly string[]) {
  const normalized = normalize(text);
  if (!normalized.ok) throw new TypeError(`${text}: ${normalized.message}`);
  const parsed = parse(normalized.text, new Set(names));
  if (!parsed.ok) throw new TypeError(`${text}: ${parsed.message}`);
  return parsed.expr;
}

const PART: ExpressionExercisePart = {
  id: "unsupported-demo",
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

describe("a rewrite the checker offers is the same function", () => {
  const rewritten = Object.entries(UNSUPPORTED_FUNCTIONS).filter(([, r]) => r !== null);

  test("every function with a rewrite has a reference implementation here", () => {
    expect(rewritten.map(([name]) => name).sort()).toEqual(Object.keys(MATH).sort());
  });

  for (const [name, rewrite] of rewritten)
    test(`${name}: the rewrite agrees with Math.${name}, for x and for (2 · x) + 1`, () => {
      const fn = MATH[name] as (x: number) => number;
      const plain = readBack(rewrite?.("x") ?? "", ["x"]);
      // The argument as the parser echoes it, so the test covers a pasted-back echo too.
      const compound = readBack(rewrite?.("(2 · x) + 1") ?? "", ["x"]);
      for (const x of [0.05, 0.1, 0.9, 1.3]) {
        for (const [expr, arg] of [
          [plain, x],
          [compound, 2 * x + 1],
        ] as const) {
          const got = evaluate(expr, { x });
          if (got.status !== "value") throw new TypeError(`${name} rewrite has no value at ${x}`);
          expect(
            withinTolerance(got.value, fn(arg), { absolute: 1e-15, relative: 1e-12 }).ok,
            `${name} at ${arg}`,
          ).toBe(true);
        }
      }
    });

  test("no unsupported name is also an allowed function", () => {
    for (const name of Object.keys(UNSUPPORTED_FUNCTIONS))
      expect((ALLOWED_FUNCTIONS as readonly string[]).includes(name)).toBe(false);
  });
});

describe("an answer the checker cannot read is told so, with a next action", () => {
  test("tan(D) is unsupported-expression, named, with a rewrite in the reader's own argument", async () => {
    const verdict = await checkExerciseAnswer(PART, "tan(D)");
    expect(verdict).toEqual({
      kind: "unsupported-expression",
      name: "tan",
      position: 0,
      message:
        "This checker does not read tan. It reads sqrt, exp, ln, sin, cos and abs. tan(D) can be written sin(D)/cos(D).",
      nextAction: NEXT_ACTION["unsupported-expression"],
    });
  });

  test("log offers both bases, because a reader's log may mean either", async () => {
    const verdict = await checkExerciseAnswer(PART, "log(D*t)");
    expect(verdict.kind).toBe("unsupported-expression");
    expect(verdict.kind === "unsupported-expression" && verdict.message).toContain(
      "write ln(D · t) for the natural logarithm, or ln(D · t)/ln(10) for base 10.",
    );
  });

  test("a function with no rewrite says so and points to the worked explanation", async () => {
    const verdict = await checkExerciseAnswer(PART, "arcsin(t)");
    expect(verdict.kind === "unsupported-expression" && verdict.message).toContain(
      "Write the answer without arcsin, or compare it with the worked explanation below.",
    );
  });

  test("an unreadable argument still names the function, with a generic u", () => {
    const parsed = parse("tan(", new Set(["x"]));
    expect(parsed.ok === false && parsed.unsupported).toBe("tan");
    expect(parsed.ok === false && parsed.message).toContain("tan(u) can be written sin(u)/cos(u).");
  });

  test("a declared variable named like a function is the reader's variable, not a refusal", () => {
    expect(parse("tan*x", new Set(["tan", "x"])).ok).toBe(true);
    const called = parse("tan(x)", new Set(["tan", "x"]));
    expect(called.ok === false && called.unsupported).toBeUndefined();
  });

  test("e is never Euler's number: e^x is pointed to exp(x), as a typing error", async () => {
    const verdict = await checkExerciseAnswer(
      {
        ...PART,
        id: "e-demo",
        declaredNames: ["x"],
        domains: { x: { min: 0.1, max: 2 } },
        referenceSource: "exp(x)",
      },
      "e^x",
    );
    expect(verdict.kind).toBe("parse-error");
    expect(verdict.kind === "parse-error" && verdict.message).toContain(
      "write exp(…), so e^x is exp(x).",
    );
    expect(parse("e^x", new Set(["e", "x"])).ok).toBe(true);
  });
});

describe("could-not-compare is a different outcome with a different next step", () => {
  test("x/x on a range through zero: could-not-compare, the point named in plain words", async () => {
    const verdict = await checkExerciseAnswer(
      {
        ...PART,
        id: "hole-demo",
        declaredNames: ["x"],
        domains: { x: { min: -1, max: 1 } },
        referenceSource: "1",
      },
      "x/x",
    );
    if (verdict.kind !== "checked" || verdict.outcome.status !== "could-not-compare")
      throw new TypeError("expected could-not-compare");
    expect(verdict.outcome.reason).toBe(
      "Your expression cannot be evaluated at x = 0, where the reference has a value, so this point cannot be set aside.",
    );
  });

  test("the two next actions differ, and neither judges the answer", () => {
    expect(NEXT_ACTION["unsupported-expression"]).not.toBe(NEXT_ACTION["could-not-compare"]);
    for (const text of Object.values(NEXT_ACTION))
      expect(text).toStartWith("This says nothing about whether your answer is right.");
  });

  test("no sampling-family name or authoring advice reaches a reader", async () => {
    const verdict = await checkExerciseAnswer(
      {
        ...PART,
        id: "sparse-demo",
        declaredNames: ["x"],
        domains: { x: { min: 0.1, max: 2 } },
        referenceSource: "sqrt(x - 1.99)",
      },
      "sqrt(x - 1.99)",
    );
    if (verdict.kind !== "checked" || verdict.outcome.status !== "could-not-compare")
      throw new TypeError(
        "expected could-not-compare: the reference has a value on 0.5% of the range",
      );
    const reason = verdict.outcome.reason;
    expect(reason).toMatch(
      /^Only \d+ of the sample points gave the reference a value, and 12 are needed/,
    );
    expect(reason).not.toMatch(/Halton|Philox|boundary|numeric resolution|Check the domain/);
  });
});

describe("every new sentence passes the voice lint", () => {
  test("messages and next actions, in task-feedback context", async () => {
    const texts: string[] = [...Object.values(NEXT_ACTION)];
    for (const answer of ["tan(D)", "log(D)", "arcsin(D)", "sinh(D)", "cosh(D)", "tanh(D)"]) {
      const verdict = await checkExerciseAnswer(PART, answer);
      if (verdict.kind === "unsupported-expression") texts.push(verdict.message);
    }
    expect(texts.length).toBe(8);
    for (const text of texts) {
      const errors = checkVoice(text, { context: "task-feedback" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
      expect(text).not.toMatch(/\b(wrong|incorrect|score|attempts?)\b/i);
    }
  });
});
