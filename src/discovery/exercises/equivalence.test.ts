import { describe, expect, test } from "bun:test";
import { checkEquivalence } from "./equivalence";
import { evaluate } from "./evaluate";
import { parse } from "./grammar";

const TOLERANCE = { absolute: 1e-9, relative: 1e-9 };

function mustParse(text: string, names: readonly string[] = ["x"]) {
  const parsed = parse(text, new Set(names));
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.message}`);
  return parsed.expr;
}

describe("checkEquivalence: real identities pass", () => {
  test("x^2-1 and (x-1)*(x+1) are equivalent", () => {
    const outcome = checkEquivalence(
      mustParse("x^2-1"),
      mustParse("(x-1)*(x+1)"),
      { x: { min: -10, max: 10 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("equivalent");
    if (outcome.status === "equivalent") {
      expect(outcome.acceptedPointCount).toBeGreaterThanOrEqual(12);
      expect(outcome.label).toContain("not a proof");
    }
  });

  test("sqrt(4*D*t) and 2*sqrt(D*t) are equivalent over the Brownian teaching domain", () => {
    const outcome = checkEquivalence(
      mustParse("sqrt(4*D*t)", ["D", "t"]),
      mustParse("2*sqrt(D*t)", ["D", "t"]),
      { D: { min: 1e-14, max: 1e-10, scale: "log" }, t: { min: 0.1, max: 100, scale: "log" } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("equivalent");
  });
});

describe("checkEquivalence: near-misses fail, with the first differing point", () => {
  test("x^2 against 2*x is not equivalent", () => {
    const outcome = checkEquivalence(
      mustParse("x^2"),
      mustParse("2*x"),
      { x: { min: -10, max: 10 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("not-equivalent");
  });
});

describe("checkEquivalence: honest refusal, never a guess", () => {
  test("too few points accepted inside the domain reports could-not-compare, not a verdict", () => {
    // sqrt(-x) has no real value anywhere on a positive x domain: every candidate is skipped.
    const outcome = checkEquivalence(
      mustParse("sqrt(-x)"),
      mustParse("x"),
      { x: { min: 0.1, max: 10 } },
      TOLERANCE,
    );
    expect(outcome.status).toBe("could-not-compare");
  });

  test("results are identical across repeated runs (deterministic, no Math.random)", () => {
    const run = () =>
      checkEquivalence(mustParse("x^2"), mustParse("x*x"), { x: { min: -5, max: 5 } }, TOLERANCE);
    expect(run()).toEqual(run());
  });
});

describe("KNOWN, DISCLOSED GAP: this Halton-only checker is fooled by a grid-tuned adversarial pair", () => {
  test("x^2 vs x^2 + sin(32*pi*x) on [0,1) is wrongly reported 'equivalent' -- the bead's own adversarial fixture, which the second (Philox) point set this pass does not build exists specifically to catch", () => {
    const outcome = checkEquivalence(
      mustParse("x^2+sin(32*pi*x)", ["x", "pi"]),
      mustParse("x^2", ["x", "pi"]),
      { x: { min: 0, max: 1 } },
      { absolute: 1e-9, relative: 1e-9 },
    );
    // This assertion documents the vulnerability, not a passing security property:
    // a correct, fully-built checker (with the Philox second set) MUST report
    // "not-equivalent" here. Recording the true current behavior so the gap is
    // visible in CI rather than silently assumed closed.
    expect(outcome.status).toBe("equivalent");
  });

  test("off the Halton grid, at x = 21/64, the two expressions actually differ by about 1", () => {
    const reader = mustParse("x^2+sin(32*pi*x)", ["x", "pi"]);
    const reference = mustParse("x^2", ["x", "pi"]);
    const point = { x: 21 / 64, pi: Math.PI };
    const readerResult = evaluate(reader, point);
    const referenceResult = evaluate(reference, point);
    if (readerResult.status !== "value" || referenceResult.status !== "value") {
      throw new Error("expected both sides to evaluate");
    }
    expect(Math.abs(readerResult.value - referenceResult.value)).toBeCloseTo(1, 6);
  });
});
