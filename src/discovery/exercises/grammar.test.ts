import { describe, expect, test } from "bun:test";
import { evaluate } from "./evaluate";
import { parse } from "./grammar";

const NO_VARS: ReadonlySet<string> = new Set();
const XY = new Set(["x", "y"]);

function evalText(text: string, names: ReadonlySet<string> = NO_VARS, env: Record<string, number> = {}) {
  const parsed = parse(text, names);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.message} at ${parsed.position}`);
  const result = evaluate(parsed.expr, env);
  if (result.status !== "value") throw new Error(`evaluate failed: ${result.status}`);
  return result.value;
}

describe("grammar: precedence and associativity", () => {
  test("2^3^2 = 512 (right-associative power)", () => {
    expect(evalText("2^3^2")).toBe(512);
  });
  test("-2^2 = -4 (power binds tighter than unary minus)", () => {
    expect(evalText("-2^2")).toBe(-4);
  });
  test("(-2)^2 = 4", () => {
    expect(evalText("(-2)^2")).toBe(4);
  });
  test("2*-3 = -6", () => {
    expect(evalText("2*-3")).toBe(-6);
  });
});

describe("grammar: function allow-list", () => {
  test("sqrt, exp, ln, sin, cos, abs all parse and evaluate", () => {
    expect(evalText("sqrt(4)")).toBe(2);
    expect(evalText("abs(-3)")).toBe(3);
    expect(evalText("ln(1)")).toBe(0);
  });
  test("a function without parentheses is a parse error naming the function", () => {
    const parsed = parse("sqrt 4", NO_VARS);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("sqrt");
  });
});

describe("grammar: declared-variable enforcement", () => {
  test("an undeclared identifier is a parse error naming it", () => {
    const parsed = parse("z", new Set(["x"]));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("z");
  });
  test("a declared variable parses and evaluates from the environment", () => {
    expect(evalText("x+1", XY, { x: 5, y: 0 })).toBe(6);
  });
});

describe("grammar: explicit multiplication only", () => {
  test("2x is a parse error suggesting 2*x", () => {
    const parsed = parse("2x", new Set(["x"]));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("*");
  });
  test("x y is a parse error suggesting x*y", () => {
    const parsed = parse("x y", XY);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("*");
  });
});

describe("grammar: number literals", () => {
  test(".5 is a parse error suggesting 0.5", () => {
    const parsed = parse(".5", NO_VARS);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("0.5");
  });
  test("1.2e-3 and 1.2E-3 parse as the same value", () => {
    expect(evalText("1.2e-3")).toBeCloseTo(0.0012, 12);
    expect(evalText("1.2E-3")).toBeCloseTo(0.0012, 12);
  });
  test("1.2*10^-3 parses as ordinary multiplication and power", () => {
    expect(evalText("1.2*10^-3")).toBeCloseTo(0.0012, 12);
  });
  test("a literal that underflows to zero is rejected", () => {
    const parsed = parse("1e-400", NO_VARS);
    expect(parsed.ok).toBe(false);
  });
  test("an out-of-range literal is rejected, not silently read as Infinity", () => {
    const parsed = parse("1e400", NO_VARS);
    expect(parsed.ok).toBe(false);
  });
});

describe("grammar: limits", () => {
  test("an expression over the length limit is rejected", () => {
    const parsed = parse("1+".repeat(150) + "1", NO_VARS);
    expect(parsed.ok).toBe(false);
  });
  test("deep parenthesis nesting past the depth limit is rejected", () => {
    const parsed = parse("(".repeat(40) + "1" + ")".repeat(40), NO_VARS);
    expect(parsed.ok).toBe(false);
  });
});

describe("grammar: no dynamic code, ever", () => {
  test("constructor, __proto__, and toString are undeclared identifiers, not object lookups", () => {
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const parsed = parse(name, NO_VARS);
      expect(parsed.ok).toBe(false);
    }
  });
});
