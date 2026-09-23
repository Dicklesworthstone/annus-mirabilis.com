/**
 * Affine sums (orchestrator ruling, dispatch 100). A point plus or minus a vector is a point, and a
 * point minus a point is a vector, across different authored kinds. Exactly these two-term forms
 * are allowed; every other sum of different meanings is still refused, and dimensions always
 * count. Each allowed form has a positive case and each refused form a planted negative.
 */
import { describe, expect, test } from "bun:test";
import type { Expression } from "../../equations/ast.ts";
import { checkDimensions } from "../../equations/dimensions.ts";
import type { Quantity, QuantityRegistry } from "../../equations/quantities.ts";

const LENGTH = ["1", "0", "0", "0", "0", "0"];
const TIME = ["0", "0", "1", "0", "0", "0"];
const q = (id: string, dimension: string[], semanticKind: string): Quantity => ({
  id,
  name: id,
  glyph: id,
  dimension,
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("x", LENGTH, "coordinate-position"),
    q("xPrime", LENGTH, "coordinate"),
    q("jump", LENGTH, "displacement-increment"),
    q("walked", LENGTH, "cumulative-displacement"),
    q("tA", TIME, "clock-reading"),
    q("t", TIME, "coordinate"),
    q("tau", TIME, "walk-step-interval"),
    q("interval", TIME, "observation-interval"),
    q("proper", TIME, "proper-time"),
  ].map((x) => [x.id, x]),
);
const s = (quantityId: string) =>
  ({ kind: "symbol", termId: `t.${quantityId}`, quantityId }) as Expression;
const minus = (e: Expression) => ({ kind: "negate", argument: e }) as Expression;
const sum = (...args: Expression[]) => ({ kind: "sum", args }) as Expression;
const status = (e: Expression) => checkDimensions(e, R).status;

describe("affine sums: allowed", () => {
  test("position plus or minus a displacement is a position, in either written order", () => {
    expect(status(sum(s("x"), minus(s("jump"))))).toBe("consistent");
    expect(status(sum(s("x"), s("jump")))).toBe("consistent");
    expect(status(sum(s("jump"), s("x")))).toBe("consistent");
  });
  test("a time plus or minus an interval is a time", () => {
    expect(status(sum(s("tA"), s("tau")))).toBe("consistent");
    expect(status(sum(s("t"), minus(s("interval"))))).toBe("consistent");
  });
  test("a position minus a position, or a time minus a time, is a displacement or an interval", () => {
    expect(status(sum(s("x"), minus(s("xPrime"))))).toBe("consistent");
    expect(status(sum(minus(s("tA")), s("t")))).toBe("consistent");
  });
});

describe("affine sums: planted negatives, still refused", () => {
  test("position plus position", () => {
    expect(status(sum(s("x"), s("xPrime")))).toBe("semantic-mismatch");
  });
  test("time plus time", () => {
    expect(status(sum(s("tA"), s("t")))).toBe("semantic-mismatch");
  });
  test("a displacement minus a position", () => {
    expect(status(sum(s("jump"), minus(s("x"))))).toBe("semantic-mismatch");
  });
  test("a mix across dimensions", () => {
    expect(status(sum(s("x"), s("tau")))).toBe("inconsistent");
  });
  test("two intervals of different kinds (not one of the four forms)", () => {
    expect(status(sum(s("tau"), s("interval")))).toBe("semantic-mismatch");
  });
  test("proper time with coordinate time (proper time is not classified)", () => {
    expect(status(sum(s("t"), minus(s("proper"))))).toBe("semantic-mismatch");
  });
  test("a three-term sum (only two-term forms are admitted)", () => {
    expect(status(sum(s("x"), s("jump"), s("walked")))).toBe("semantic-mismatch");
  });
});
