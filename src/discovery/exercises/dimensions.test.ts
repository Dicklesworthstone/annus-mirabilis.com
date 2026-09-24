import { describe, expect, test } from "bun:test";
import { dimension } from "../../content/dimensions/rational.ts";
import { checkExerciseAnswer, type ExpressionExercisePart } from "./answer.ts";
import { dimensionMessage, dimensionOf, readDimensions } from "./dimensions.ts";
import { parse } from "./grammar.ts";

/**
 * Dimension feedback (am-disc-exercise-checker-i4h2): "D*t answering a length prompt yields the
 * area message; exp(t) with dimensional t is rejected; sqrt(2*D*t) passes with length dimension."
 */

const DIMENSIONS = {
  D: dimension(["2", "0", "-1", "0", "0", "0"]),
  t: dimension(["0", "0", "1", "0", "0", "0"]),
};
const tree = (text: string) => {
  const parsed = parse(text, new Set(["D", "t"]));
  expect(parsed.ok).toBe(true);
  return parsed.ok ? parsed.expr : ({ kind: "number", value: 0 } as const);
};
const length = tree("sqrt(4*D*t)");

describe("the three cases the bead names", () => {
  test("D*t answering a length prompt yields the area message", () => {
    expect(dimensionMessage(tree("D*t"), length, DIMENSIONS)).toBe(
      "Your expression has the dimension of an area; the quantity asked for is a length.",
    );
  });

  test("exp(t) with a dimensional t is refused", () => {
    expect(dimensionOf(tree("exp(t)"), DIMENSIONS)).toEqual({
      kind: "refused",
      message: "The quantity inside an exponential must be a pure number, but here it is a time.",
    });
  });

  test("sqrt(2*D*t) passes with the dimension of a length", () => {
    expect(dimensionMessage(tree("sqrt(2*D*t)"), length, DIMENSIONS)).toBeNull();
    const d = dimensionOf(tree("sqrt(2*D*t)"), DIMENSIONS);
    expect(d.kind === "known" && d.dimension.map((r) => String(r.num))).toEqual([
      "1",
      "0",
      "0",
      "0",
      "0",
      "0",
    ]);
  });
});

describe("a dimension with no common name is given in SI units", () => {
  test("kg·m², kg·m²·s⁻¹ and a fractional exponent", async () => {
    const { describeDimension } = await import("./dimensions.ts");
    expect(describeDimension(dimension(["2", "1", "0", "0", "0", "0"]))).toBe(
      "a quantity in kg·m²",
    );
    expect(describeDimension(dimension(["2", "1", "-1", "0", "0", "0"]))).toBe(
      "a quantity in kg·m²·s⁻¹",
    );
    expect(describeDimension(dimension(["1/2", "0", "-1", "0", "0", "0"]))).toBe(
      "a quantity in m^(1/2)·s⁻¹",
    );
  });

  test("h/nu − P reads as an energy taken from a quantity in kg·m²", () => {
    const energy = {
      h: dimension(["2", "1", "-1", "0", "0", "0"]),
      nu: dimension(["0", "0", "-1", "0", "0", "0"]),
      P: dimension(["2", "1", "-2", "0", "0", "0"]),
    };
    const parsed = parse("h/nu-P", new Set(["h", "nu", "P"]));
    if (!parsed.ok) throw new TypeError(parsed.message);
    expect(dimensionOf(parsed.expr, energy)).toEqual({
      kind: "refused",
      message:
        "Your expression subtracts an energy from a quantity in kg·m², and quantities of different dimensions cannot be added or subtracted.",
    });
  });
});

describe("the rest of the arithmetic", () => {
  test("a speed squared is named as one, not spelled out as length and time exponents", () => {
    const speeds = { v: dimension(["1", "0", "-1", "0", "0", "0"]) };
    const parsed = parse("1-v^2", new Set(["v"]));
    if (!parsed.ok) throw new TypeError(parsed.message);
    expect(dimensionOf(parsed.expr, speeds)).toEqual({
      kind: "refused",
      message:
        "Your expression subtracts a speed squared from a pure number, and quantities of different dimensions cannot be added or subtracted.",
    });
  });

  test("adding quantities of different dimensions is refused in words", () => {
    expect(dimensionMessage(tree("D+t"), length, DIMENSIONS)).toBe(
      "Your expression adds a time to an area per unit time, the dimension of a diffusion coefficient, and quantities of different dimensions cannot be added or subtracted.",
    );
  });

  test("powers with a numeric exponent are exact, including halves", () => {
    expect(dimensionMessage(tree("(4*D*t)^(1/2)"), length, DIMENSIONS)).toBeNull();
    expect(dimensionMessage(tree("(D*t)^0.5*2"), length, DIMENSIONS)).toBeNull();
  });

  test("a power whose exponent has a dimension is refused", () => {
    expect(dimensionOf(tree("2^t"), DIMENSIONS).kind).toBe("refused");
  });

  test("a symbolic exponent on a dimensional base is unknown, so the numbers decide", () => {
    expect(dimensionOf(tree("D^(t/t)"), DIMENSIONS).kind).toBe("unknown");
    expect(dimensionMessage(tree("D^(t/t)"), length, DIMENSIONS)).toBeNull();
  });
});

describe("reading an exercise's map", () => {
  test("a complete map reads; a missing variable or a malformed entry turns the check off", () => {
    expect(
      readDimensions({ D: ["2", "0", "-1", "0", "0", "0"], t: ["0", "0", "1", "0", "0", "0"] }, [
        "D",
        "t",
      ]),
    ).not.toBeNull();
    expect(readDimensions({ D: ["2", "0", "-1", "0", "0", "0"] }, ["D", "t"])).toBeNull();
    expect(
      readDimensions({ D: ["2", "0"], t: ["0", "0", "1", "0", "0", "0"] }, ["D", "t"]),
    ).toBeNull();
    expect(
      readDimensions({ D: ["x", "0", "0", "0", "0", "0"], t: ["0", "0", "1", "0", "0", "0"] }, [
        "D",
        "t",
      ]),
    ).toBeNull();
  });
});

describe("the checker speaks before it compares numbers", () => {
  const part: ExpressionExercisePart = {
    id: "dimension-part",
    prompt: "What is the root mean square distance in the plane?",
    declaredNames: ["D", "t"],
    domains: {
      D: { min: 1e-14, max: 1e-10, scale: "log" },
      t: { min: 0.1, max: 100, scale: "log" },
    },
    referenceSource: "2*sqrt(D*t)",
    tolerance: { absolute: 1e-9, relative: 1e-9 },
    workedExplanation: "sqrt(4*D*t) = 2*sqrt(D*t).",
    dimensions: { D: ["2", "0", "-1", "0", "0", "0"], t: ["0", "0", "1", "0", "0", "0"] },
  };

  test("D*t gets the dimension verdict, with how it was read", async () => {
    const verdict = await checkExerciseAnswer(part, "D*t");
    expect(verdict.kind).toBe("dimension");
    if (verdict.kind === "dimension") {
      expect(verdict.message).toContain("dimension of an area");
      expect(verdict.readAs).toBe("D · t");
    }
  });

  test("the right answer still goes on to the numeric comparison and passes", async () => {
    const verdict = await checkExerciseAnswer(part, "sqrt(4*D*t)");
    expect(verdict.kind === "checked" && verdict.outcome.status).toBe("equivalent");
  });

  test("a right-dimension wrong answer is caught by the numbers, not the dimensions", async () => {
    const verdict = await checkExerciseAnswer(part, "3*sqrt(D*t)");
    expect(verdict.kind === "checked" && verdict.outcome.status).toBe("not-equivalent");
  });

  test("without a map there is no dimension verdict: D*t is compared numerically", async () => {
    const { dimensions: _omitted, ...plain } = part;
    const verdict = await checkExerciseAnswer(plain, "D*t");
    expect(verdict.kind).toBe("checked");
  });
});
