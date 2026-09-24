import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";
import { parseDerivationStep } from "./schema.ts";

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

describe('a step side authored "terms" is set one term per row', () => {
  const B: Expression = { kind: "symbol", termId: "B", quantityId: "stepB" };
  const sum: Expression = { kind: "sum", args: [A, B, A], opId: "total" } as Expression;

  test("each term on its own row, the highlight boxing the whole, and still valid KaTeX", () => {
    const tex = expressionToDerivationLatex(sum, new Set(["total"]), true, "terms");
    expect(tex).toStartWith("\\htmlData{expression-id=total}{\\boxed{\\begin{aligned}");
    expect(tex.split("\\\\").length).toBe(3);
    expect(tex.match(/\{\}\+/g)?.length).toBe(2);
    expect(() =>
      renderToString(tex, { displayMode: true, throwOnError: true, trust: true }),
    ).not.toThrow();
    // Without the layout, the same sum is one line: the renderer never breaks on its own.
    expect(expressionToDerivationLatex(sum, new Set(["total"]), true)).not.toContain("aligned");
  });

  test("the shipped chain breaks exactly the two sides that ran wider than a phone", () => {
    const record = JSON.parse(
      readFileSync(
        new URL("../../../content/equations/derivations/bm-variance.yaml", import.meta.url),
        "utf8",
      ),
    ) as { chain: { steps: { id: string; layout?: Record<string, string> }[] } };
    // Measured on live at 320px, 2026-09-24: these two ran 309 and 307px in a 254px box.
    const broken = record.chain.steps.flatMap((s) =>
      Object.keys(s.layout ?? {}).map((side) => `${s.id}.${side}`),
    );
    expect(broken.sort()).toEqual(["bm-variance-average.to", "bm-variance-cross.from"]);
  });

  test("planted: the schema refuses a layout on a side that is not a sum, or an unknown one", () => {
    const step = (layout: unknown, to: Expression = sum) => ({
      id: "s",
      from: sum,
      to,
      changedSubexpressionIds: [],
      rule: { kind: "expand", params: {} },
      reasonKind: "algebra",
      reasons: { r0: "a", r1: "b", r2: "c" },
      premiseRefs: [],
      isMove: false,
      verification: { status: "authored-unverified" },
      layout,
    });
    expect(() => parseDerivationStep(step({ to: "terms" }), "s")).not.toThrow();
    expect(() => parseDerivationStep(step({ to: "terms" }, A), "s")).toThrow(/not a sum/);
    expect(() => parseDerivationStep(step({ to: "rows" }), "s")).toThrow(/only step layout/);
    expect(() => parseDerivationStep(step({ middle: "terms" }), "s")).toThrow(/"from" or "to"/);
  });
});
