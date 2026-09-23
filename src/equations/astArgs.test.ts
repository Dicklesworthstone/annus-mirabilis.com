import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { type Expression, parseExpression } from "./ast.ts";
import { expressionToSpokenText } from "./derivations/a11yText.ts";
import { checkDimensions } from "./dimensions.ts";
import { expressionLatex } from "./latex.ts";
import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * A quantity's value at several arguments: paper 2's density p(x, t) and p(x - Delta, t). The
 * value has the quantity's own dimension, each argument is still checked, and a value takes one
 * argument (`at`) or several (`args`), never both.
 */
// Position and jump share one semantic kind here: this file tests the argument list, and the
// semantic rule for adding a position to a displacement is a separate question.
const q = (id: string, glyph: string, dimension: string[]): Quantity => ({
  id,
  name: id,
  glyph,
  dimension,
  unit: "1",
  displayUnit: "1",
  displayPower: 0,
  semanticKind: id === "jump" ? "position" : id,
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("density", "p", ["-1", "0", "0", "0", "0", "0"]),
    q("position", "x", ["1", "0", "0", "0", "0", "0"]),
    q("time", "t", ["0", "0", "1", "0", "0", "0"]),
    q("jump", "\\Delta", ["1", "0", "0", "0", "0", "0"]),
  ].map((x) => [x.id, x]),
);
const ID = "eq-model-test-args";
let n = 0;
const sym = (quantityId: string, extra: Record<string, unknown> = {}) =>
  ({ kind: "symbol", termId: `${ID}.t.s${n++}`, quantityId, ...extra }) as Expression;
const op = (x: Record<string, unknown>) => ({ ...x, opId: `${ID}.op.o${n++}` }) as Expression;
const parse = (e: Expression) => parseExpression(e, ID, R);
const equals = (left: Expression, right: Expression) =>
  op({ kind: "relation", operator: "=", left, right });
const shifted = () =>
  op({ kind: "sum", args: [sym("position"), { kind: "negate", argument: sym("jump") }] });

describe("a value at several arguments", () => {
  test("p(x - Delta, t) = p(x, t) parses, balances, renders and is spoken", () => {
    const value = sym("density", { args: [shifted(), sym("time")] });
    const e = equals(value, sym("density", { args: [sym("position"), sym("time")] }));
    expect(checkDimensions(parse(e), R).status).toBe("consistent");
    const tex = expressionLatex(parse(e), R);
    expect(tex).toContain("p\\left(x - \\Delta,\\,t\\right)");
    expect(() => renderToString(tex, { throwOnError: true })).not.toThrow();
    // "<p> of <x minus Delta> and <t>": one "of", then the arguments joined with "and".
    expect(expressionToSpokenText(value)).toMatch(/^\S+ of .+ and \S+$/);
  });

  test("planted: `at` and `args` together are refused", () => {
    const e = equals(
      sym("density", { at: sym("position"), args: [sym("position"), sym("time")] }),
      sym("density"),
    );
    expect(() => parse(e)).toThrow(/not both/);
  });

  test("planted: one argument, or five, is refused", () => {
    for (const args of [[sym("position")], Array.from({ length: 5 }, () => sym("time"))]) {
      expect(() => parse(equals(sym("density", { args }), sym("density")))).toThrow(
        /two to four arguments/,
      );
    }
  });

  test("planted: an inconsistent argument is still caught", () => {
    const badArgument = op({ kind: "sum", args: [sym("position"), sym("time")] });
    const e = equals(sym("density", { args: [badArgument, sym("time")] }), sym("density"));
    expect(checkDimensions(parse(e), R).status).not.toBe("consistent");
  });
});
