import { describe, expect, test } from "bun:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  type AnswerVerdict,
  checkExerciseAnswer,
  ExerciseDefinitionError,
  type ExpressionExercisePart,
  snapshotExercise,
} from "./answer.ts";
import { type DomainProbeOutcome, probeDomain, undefinedReason } from "./domainProbe.ts";
import { evaluate } from "./evaluate.ts";
import { parse } from "./grammar.ts";

/**
 * The domain probe (am-disc-exercise-checker-i4h2), through the real parser, evaluator, sampler and
 * tolerance module. The three named cases are traps a sampled check inside a positive range reports
 * as identities; each must stay "equivalent" and gain a note naming where the agreement stops.
 *
 * The bead's illustrative probe points were x = −3 and (a, b) = (−2, −3). The probe's rule, the
 * mirror of the declared range at Halton points rounded to one significant figure, lands on
 * x = −5 and (a, b) = (−5, −3); the conditions and reasons are the ones the bead names.
 */

const TOLERANCE = { absolute: 1e-12, relative: 1e-9 } as const;
const UNIT = { min: 0.1, max: 10 } as const;

const tree = (text: string, names: readonly string[]) => {
  const parsed = parse(text, new Set(names));
  if (!parsed.ok) throw new TypeError(`${text}: ${parsed.message}`);
  return parsed.expr;
};

function part(
  referenceSource: string,
  declaredNames: readonly string[],
  domains: ExpressionExercisePart["domains"],
  extra: Partial<ExpressionExercisePart> = {},
): ExpressionExercisePart {
  return {
    id: `probe-${referenceSource}`,
    prompt: "Write an expression equal to the reference in the stated ranges.",
    declaredNames,
    domains,
    referenceSource,
    tolerance: TOLERANCE,
    workedExplanation: "Compare the two expressions term by term.",
    ...extra,
  };
}

function refusalCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof ExerciseDefinitionError ? error.code : "not an exercise refusal";
  }
  return "no refusal";
}

function probeOf(verdict: AnswerVerdict): DomainProbeOutcome | undefined {
  if (verdict.kind !== "checked")
    throw new TypeError(`expected a checked verdict, got ${verdict.kind}`);
  expect(verdict.outcome.status).toBe("equivalent");
  return verdict.probe;
}

const NAMED = [
  {
    name: "sqrt(x^2) against x",
    part: part("x", ["x"], { x: UNIT }, { conditionNote: "These agree wherever x is positive." }),
    reader: "sqrt(x^2)",
    kind: "scope-note",
    point: { x: -5 },
  },
  {
    name: "x/x against 1",
    part: part("1", ["x"], { x: UNIT }, { conditionNote: "These agree wherever x is not zero." }),
    reader: "x/x",
    kind: "domain-note",
    point: { x: 0 },
  },
  {
    name: "ln(a*b) against ln(a)+ln(b)",
    part: part(
      "ln(a)+ln(b)",
      ["a", "b"],
      { a: UNIT, b: UNIT },
      { conditionNote: "These agree wherever a and b are both positive." },
    ),
    reader: "ln(a*b)",
    kind: "domain-note",
    point: { a: -5, b: -3 },
  },
] as const;

describe("the three named cases stay equivalent and gain one note", () => {
  test("sqrt(x^2) against x: a scope note at x = −5 naming 5, −5 and the sign condition", async () => {
    const [c] = NAMED;
    const probe = probeOf(await checkExerciseAnswer(c.part, c.reader));
    if (probe?.kind !== "scope-note")
      throw new TypeError(`expected a scope note, got ${probe?.kind}`);
    expect(probe.point).toEqual(c.point);
    expect(probe.readerValue).toBe(5);
    expect(probe.referenceValue).toBe(-5);
    expect(probe.text).toBe(
      "These agree wherever x is positive. At x = −5 your expression gives 5 and the reference gives −5, so they are different expressions.",
    );
  });

  test("x/x against 1: a domain note at x = 0 naming division by zero, the reference defined", async () => {
    const [, c] = NAMED;
    const probe = probeOf(await checkExerciseAnswer(c.part, c.reader));
    if (probe?.kind !== "domain-note")
      throw new TypeError(`expected a domain note, got ${probe?.kind}`);
    expect(probe.point).toEqual(c.point);
    expect(probe.definedSide).toBe("reference");
    expect(probe.definedValue).toBe(1);
    expect(probe.reason).toBe("it divides by zero");
    expect(probe.text).toBe(
      "These agree wherever x is not zero. At x = 0 the reference gives 1 and your expression cannot be evaluated, because it divides by zero.",
    );
  });

  test("ln(a*b) against ln(a)+ln(b): a domain note at a = −5, b = −3 naming the positive-factor condition", async () => {
    const [, , c] = NAMED;
    const probe = probeOf(await checkExerciseAnswer(c.part, c.reader));
    if (probe?.kind !== "domain-note")
      throw new TypeError(`expected a domain note, got ${probe?.kind}`);
    expect(probe.point).toEqual(c.point);
    expect(probe.definedSide).toBe("reader");
    expect(withinTolerance(probe.definedValue, Math.log(15), { relative: 1e-15 }).ok).toBe(true);
    expect(probe.reason).toBe("a logarithm needs a positive argument");
    expect(probe.text).toBe(
      "These agree wherever a and b are both positive. At a = −5, b = −3 your expression gives 2.70805 and the reference cannot be evaluated, because a logarithm needs a positive argument.",
    );
  });

  test("inside the range the ln pair agrees to the last bit, which is why only the probe can see it", () => {
    const readerValue = evaluate(tree("ln(a*b)", ["a", "b"]), { a: 2, b: 3 });
    const referenceValue = evaluate(tree("ln(a)+ln(b)", ["a", "b"]), { a: 2, b: 3 });
    if (readerValue.status !== "value" || referenceValue.status !== "value")
      throw new TypeError("both sides have values at a = 2, b = 3");
    expect(readerValue.value).toBe(1.791759469228055);
    expect(withinTolerance(readerValue.value, referenceValue.value, { relative: 1e-15 }).ok).toBe(
      true,
    );
  });

  test("the same case probed twice gives the same point and the same sentence", async () => {
    for (const c of NAMED) {
      const first = probeOf(await checkExerciseAnswer(c.part, c.reader));
      const second = probeOf(await checkExerciseAnswer(c.part, c.reader));
      expect(second).toEqual(first as DomainProbeOutcome);
    }
  });

  test("without an authored condition the note opens with the generic sentence", () => {
    const probe = probeDomain(tree("sqrt(x^2)", ["x"]), tree("x", ["x"]), {
      domains: { x: UNIT },
      tolerance: TOLERANCE,
    });
    expect(probe.kind === "scope-note" && probe.text).toStartWith(
      "These agree in the ranges this exercise uses, but not everywhere. At x = −5",
    );
  });
});

describe("no false note", () => {
  test("sqrt(4*D*t) against 2*sqrt(D*t) holds on both sides' whole domain, so no note", async () => {
    const probe = probeOf(
      await checkExerciseAnswer(
        part("2*sqrt(D*t)", ["D", "t"], {
          D: { min: 1e-14, max: 1e-10, scale: "log" },
          t: { min: 0.1, max: 100 },
        }),
        "sqrt(4*D*t)",
      ),
    );
    expect(probe?.kind).toBe("agrees");
  });

  test("x^2-1 against (x-1)*(x+1) is a polynomial identity on every real x, so no note", async () => {
    const probe = probeOf(
      await checkExerciseAnswer(part("(x-1)*(x+1)", ["x"], { x: UNIT }), "x^2-1"),
    );
    expect(probe?.kind).toBe("agrees");
    expect(probe?.kind === "agrees" && probe.acceptedPointCount).toBeGreaterThanOrEqual(3);
  });
});

describe("the probe says when it could not look", () => {
  test("a positive-only pair with an all-negative contrast range collects nothing: probe-not-available", async () => {
    const probe = probeOf(
      await checkExerciseAnswer(
        part("sqrt(x)", ["x"], { x: UNIT }, { contrastDomain: { x: { min: -10, max: -1 } } }),
        "sqrt(x)",
      ),
    );
    expect(probe?.kind).toBe("probe-not-available");
    expect(probe?.kind === "probe-not-available" && probe.reason).toContain(
      "cannot say whether they part company",
    );
  });

  test("one evaluable point outside the range is too few, and the reason says how many", () => {
    // sqrt(x - |x|) is 0 for x >= 0 and undefined for x < 0: of the probe's points only x = 0 counts.
    const onlyZero = tree("sqrt(x-abs(x))", ["x"]);
    const probe = probeDomain(onlyZero, onlyZero, { domains: { x: UNIT }, tolerance: TOLERANCE });
    expect(probe).toEqual({
      kind: "probe-not-available",
      reason:
        "Outside the stated ranges only 1 sample point could be evaluated, too few to say whether these expressions part company there.",
    });
  });

  test("a narrow contrast range still yields distinct points rather than one rounded value", () => {
    const shifted = tree("sqrt(x+1.5)", ["x"]);
    const probe = probeDomain(shifted, shifted, {
      domains: { x: UNIT },
      tolerance: TOLERANCE,
      contrastDomain: { x: { min: -1.52, max: -1.48 } },
    });
    expect(probe.kind === "agrees" && probe.acceptedPointCount).toBeGreaterThanOrEqual(3);
  });

  test("a contrast range overlapping the declared range is refused, naming the part and both intervals", () => {
    const overlapping = part(
      "x",
      ["x"],
      { x: UNIT },
      { contrastDomain: { x: { min: 5, max: 20 } } },
    );
    expect(() => snapshotExercise(overlapping)).toThrow(
      "Exercise probe-x: The contrast range for x, [5, 20], overlaps its declared range [0.1, 10]",
    );
    expect(refusalCode(() => snapshotExercise(overlapping))).toBe("exercise-contrast-overlap");
  });

  test("a condition note on two lines is refused with its own code", () => {
    const twoLines = part("x", ["x"], { x: UNIT }, { conditionNote: "These agree\nfor x > 0." });
    expect(refusalCode(() => snapshotExercise(twoLines))).toBe("exercise-condition-note-shape");
  });

  test("a verdict other than equivalent carries no probe", async () => {
    const notEquivalent = await checkExerciseAnswer(part("x^2", ["x"], { x: UNIT }), "2*x");
    expect(notEquivalent.kind === "checked" && notEquivalent.outcome.status).toBe("not-equivalent");
    expect(notEquivalent.kind === "checked" && "probe" in notEquivalent).toBe(false);
    const couldNot = await checkExerciseAnswer(part("x", ["x"], { x: UNIT }), "sqrt(-x)");
    expect(couldNot.kind === "checked" && couldNot.outcome.status).toBe("could-not-compare");
    expect(couldNot.kind === "checked" && "probe" in couldNot).toBe(false);
  });
});

describe("the reason names the operation that fails", () => {
  const cases = [
    ["1/x", { x: 0 }, "it divides by zero"],
    ["x^-1", { x: 0 }, "it divides by zero"],
    ["ln(x)", { x: -1 }, "a logarithm needs a positive argument"],
    ["sqrt(x)", { x: -4 }, "a square root needs an argument that is not negative"],
    ["x^0.5", { x: -4 }, "a negative number has no real fractional power"],
    ["exp(x)", { x: 1000 }, "a value in it grows too large to represent"],
    ["2*ln(1+sqrt(x))", { x: -1 }, "a square root needs an argument that is not negative"],
  ] as const;
  for (const [text, point, reason] of cases)
    test(`${text} at ${JSON.stringify(point)}: ${reason}`, () => {
      expect(undefinedReason(tree(text, ["x"]), point)).toBe(reason);
    });
});

describe("every probe sentence passes the voice lint", () => {
  test("no score, cross, attempt count or the word wrong, and no theater or mockery finding", async () => {
    const texts: string[] = [];
    for (const c of NAMED) {
      const probe = probeOf(await checkExerciseAnswer(c.part, c.reader));
      if (probe && "text" in probe) texts.push(probe.text);
    }
    texts.push(
      ...[
        probeDomain(tree("sqrt(x)", ["x"]), tree("sqrt(x)", ["x"]), {
          domains: { x: UNIT },
          tolerance: TOLERANCE,
          contrastDomain: { x: { min: -10, max: -1 } },
        }),
        probeDomain(tree("x", ["x"]), tree("x", ["x"]), { domains: {}, tolerance: TOLERANCE }),
        probeDomain(tree("sqrt(x-abs(x))", ["x"]), tree("sqrt(x-abs(x))", ["x"]), {
          domains: { x: UNIT },
          tolerance: TOLERANCE,
        }),
        probeDomain(tree("sqrt(x^2)", ["x"]), tree("x", ["x"]), {
          domains: { x: UNIT },
          tolerance: TOLERANCE,
        }),
      ].map((p) => ("text" in p ? p.text : p.kind === "probe-not-available" ? p.reason : "")),
    );
    expect(texts.filter(Boolean).length).toBe(7);
    for (const text of texts) {
      expect(text).not.toMatch(/\b(wrong|score|attempts?|incorrect)\b/i);
      expect(text).not.toMatch(/[✗✘×]\s*$|❌/u);
      const findings = checkVoice(text, { context: "task-feedback" }).filter(
        (f) => f.severity === "error",
      );
      expect(findings.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
    }
  });
});
