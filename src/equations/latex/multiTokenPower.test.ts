import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionLatex } from "../latex.ts";
import type { Quantity, QuantityRegistry } from "../quantities.ts";

/**
 * A power sits on its base without brackets only when the base's glyph is ONE TeX token, with at
 * most a subscript and primes. \Delta t squared printed as \Delta t^{2} reads as Delta times t
 * squared; the lesson on derivatives prints (\Delta t)^2.
 */
const q = (id: string, glyph: string): Quantity => ({
  id,
  name: id,
  glyph,
  dimension: ["0", "0", "1", "0", "0", "0"],
  unit: "s",
  displayUnit: "s",
  displayPower: 0,
  semanticKind: "time",
  role: "input",
  definition: id,
});
const R: QuantityRegistry = Object.fromEntries(
  [
    q("increment", "\\Delta t"),
    q("apparent", "v_{\\mathrm{app}}"),
    q("plain", "t"),
    q("sub", "k_B"),
  ].map((x) => [x.id, x]),
);
const squared = (quantityId: string) =>
  expressionLatex(
    {
      kind: "power",
      base: { kind: "symbol", termId: "eq-model-test.t.x", quantityId },
      exponent: { num: 2, den: 1 },
    } as Expression,
    R,
  );

describe("a power on a multi-token glyph", () => {
  test("two tokens take brackets, and KaTeX accepts the result", () => {
    expect(squared("increment")).toBe("\\left(\\Delta t\\right)^{2}");
    expect(() => renderToString(squared("increment"), { throwOnError: true })).not.toThrow();
  });

  test("one token, with or without a subscript, takes none", () => {
    expect(squared("plain")).toBe("t^{2}");
    expect(squared("sub")).toBe("k_B^{2}");
    expect(squared("apparent")).toBe("v_{\\mathrm{app}}^{2}");
  });
});
