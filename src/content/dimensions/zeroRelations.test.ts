import { describe, expect, test } from "bun:test";
import { checkDimensions, type QuantityRegistryMap } from "./check.ts";

const registry: QuantityRegistryMap = {
  position: { id: "position", dimension: ["1", "0", "0", "0", "0", "0"] },
  duration: { id: "duration", dimension: ["0", "0", "1", "0", "0", "0"] },
  energy: { id: "energy", dimension: ["2", "1", "-2", "0", "0", "0"] },
  missingDimension: { id: "missingDimension", dimension: [], dimensionStatus: "unsupported" },
};
const symbol = (quantityId: string) => ({ kind: "symbol", termId: quantityId, quantityId });
const literal = (value: string | number) => ({ kind: "number", value });
const relation = (left: unknown, right: unknown) => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});

describe("literal zero in a dimensional relation", () => {
  test("the source's z = 0 and 0 = z retain the coordinate's dimension", () => {
    for (const zero of [literal("0"), literal(0)]) {
      for (const tree of [relation(symbol("position"), zero), relation(zero, symbol("position"))]) {
        const result = checkDimensions(tree, registry);
        expect(result.status).toBe("consistent");
        if (result.status !== "consistent") throw new Error(result.reason);
        expect(result.dimension.map((slot) => `${slot.num}/${slot.den}`)).toEqual([
          "1/1",
          "0/1",
          "0/1",
          "0/1",
          "0/1",
          "0/1",
        ]);
      }
    }
  });

  test("the entire nonzero side determines the dimension, including a derivative", () => {
    const rate = {
      kind: "derivative",
      expression: symbol("energy"),
      variable: symbol("duration"),
      order: 1,
      partial: false,
    };
    const result = checkDimensions(relation(rate, literal("0")), registry);
    expect(result.status).toBe("consistent");
    if (result.status !== "consistent") throw new Error(result.reason);
    expect(result.dimension.map((slot) => `${slot.num}/${slot.den}`)).toEqual([
      "2/1",
      "1/1",
      "-3/1",
      "0/1",
      "0/1",
      "0/1",
    ]);
  });

  test("zero never hides an unknown symbol or an unsupported quantity dimension", () => {
    for (const name of ["unknown", "missingDimension"]) {
      expect(checkDimensions(relation(symbol(name), literal("0")), registry).status).toBe(
        "unsupported-check",
      );
      expect(checkDimensions(relation(literal("0"), symbol(name)), registry).status).toBe(
        "unsupported-check",
      );
    }
  });

  test("zero never admits a dimensionally inconsistent expression on the other side", () => {
    const sum = { kind: "sum", args: [symbol("position"), symbol("duration")] };
    expect(checkDimensions(relation(sum, literal("0")), registry).status).toBe("inconsistent");
    expect(checkDimensions(relation(literal("0"), sum), registry).status).toBe("inconsistent");
  });

  test("a nonzero literal and a computed dimensionless zero keep their own dimensions", () => {
    for (const value of ["1", "-1", "1e-100"]) {
      expect(checkDimensions(relation(symbol("position"), literal(value)), registry).status).toBe(
        "inconsistent",
      );
    }
    const difference = { kind: "sum", args: [literal("1"), literal("-1")] };
    expect(checkDimensions(relation(symbol("position"), difference), registry).status).toBe(
      "inconsistent",
    );
    // Non-literal coercions must not acquire a physical unit by evaluating to zero in JavaScript.
    for (const value of ["", " ", "0x0"]) {
      expect(checkDimensions(relation(symbol("position"), literal(value)), registry).status).toBe(
        "inconsistent",
      );
    }
  });
});
