import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";

/*
  The derivation renderer wrapped every power's base in brackets, so the Brownian missing-step
  panels printed <(A)^2> + (<2AB>) + <(B)^2> while the equation explorer beside them printed A^2.
  It now follows the equation renderer's rule (latex/atomicPower.test.ts), pinned in both
  directions: a fix that dropped all brackets would print -3^2 for (-3)^2, a different number.
*/
const A: Expression = { kind: "symbol", termId: "A", quantityId: "stepA" };
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const latex = (tree: Expression) => expressionToDerivationLatex(tree);

describe("a derivation step's power takes brackets only where they change the meaning", () => {
  test("a lone letter, an average, pi and a plain number are atoms", () => {
    expect(latex(square(A))).toBe("A^{2}");
    expect(latex(square({ kind: "average", argument: A }))).toBe(
      "\\left\\langle A\\right\\rangle^{2}",
    );
    expect(latex(square({ kind: "constant", name: "pi" }))).toBe("\\pi^{2}");
    expect(latex(square({ kind: "number", value: "3" }))).toBe("3^{2}");
  });

  test("a sum, a negative number, a scaled letter and a letter with its own power keep them", () => {
    expect(latex(square({ kind: "sum", args: [A, A] }))).toBe("\\left(A + A\\right)^{2}");
    expect(latex(square({ kind: "number", value: "-3" }))).toBe("\\left(-3\\right)^{2}");
    expect(latex(square({ ...A, scale: { num: 1, den: 2 } } as Expression))).toStartWith(
      "\\left(\\frac{1}{2}",
    );
    // termId "x2" prints as x^2; squaring it again needs the brackets, or x^2^{2} is an error.
    expect(latex(square({ kind: "symbol", termId: "x2", quantityId: "x" }))).toBe(
      "\\left(x^2\\right)^{2}",
    );
  });

  test("the shipped Brownian chain prints A² and B², and every step still renders", () => {
    const record = JSON.parse(
      readFileSync(
        new URL("../../../content/equations/derivations/bm-variance.yaml", import.meta.url),
        "utf8",
      ),
    ) as { chain: { steps: { id: string; from: Expression; to: Expression }[] } };
    let squares = 0;
    for (const step of record.chain.steps)
      for (const tree of [step.from, step.to]) {
        const tex = expressionToDerivationLatex(tree, new Set(["totalMeanSquare"]), true);
        squares += (tex.match(/\b[AB]\^\{2\}/g) ?? []).length;
        expect(tex, step.id).not.toMatch(/\\left\([AB]\\right\)\^/);
        expect(() =>
          renderToString(tex, { displayMode: true, throwOnError: true, trust: true }),
        ).not.toThrow();
      }
    expect(squares).toBeGreaterThan(0);
  });
});
