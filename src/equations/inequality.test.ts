import { describe, expect, test } from "bun:test";
import { parseEquationRecord } from "./record.ts";
import { compileEquation } from "./render.ts";

/*
  A relation may state a bound. Light-quanta sections 7 and 9 are bounds (h nu_out <= h nu_in,
  h nu >= I, n <= E / h nu), and the grammar could only say "=", "approx" and "define", so those
  formulas could not become records. A bound is still a relation between two sides of one
  dimension: the dimension check applies to it exactly as to an equality.
*/
const id = "eq-model-lq-bound-fixture";
const sym = (name: string, quantityId: string) => ({
  kind: "symbol",
  termId: `${id}.t.${name}`,
  quantityId,
});
function record(operator: string, right: unknown) {
  return {
    schemaVersion: 1,
    kind: "equation",
    id,
    paper: "light-quanta",
    argument: "arg-lq-photoelectric-energy",
    title: "A bound",
    spoken: "The largest kinetic energy is at most h times the frequency.",
    explanation: "No electron leaves with more than one quantum brings.",
    review: "draft",
    notation: "modern-pedagogical",
    unitSystem: "si",
    assumptions: ["One quantum per electron."],
    tree: {
      kind: "relation",
      opId: `${id}.op.bound`,
      operator,
      left: sym("kmax", "maxKineticEnergy"),
      right,
    },
    notes: [
      {
        nodeId: `${id}.t.kmax`,
        title: "K max",
        explanation: "The ceiling.",
        foundation: "work-energy",
      },
      {
        nodeId: `${id}.op.bound`,
        title: "Bound",
        explanation: "At most.",
        foundation: "work-energy",
      },
      ...(typeof right === "object" && right && "kind" in right && right.kind === "product"
        ? [
            { nodeId: `${id}.t.h`, title: "h", explanation: "Planck.", foundation: "work-energy" },
            {
              nodeId: `${id}.t.nu`,
              title: "nu",
              explanation: "Frequency.",
              foundation: "work-energy",
            },
          ]
        : [
            {
              nodeId: `${id}.t.nu`,
              title: "nu",
              explanation: "Frequency.",
              foundation: "work-energy",
            },
          ]),
    ],
    bindings: [],
    sentence: [{ text: "At most one quantum." }],
  };
}
const quantum = { kind: "product", args: [sym("h", "planckConstant"), sym("nu", "frequency")] };

describe("a relation may state a bound", () => {
  test("le and ge parse, and render as \\le and \\ge", () => {
    expect(compileEquation(parseEquationRecord(record("le", quantum), "fixture")).plainLatex).toBe(
      "K_{\\mathrm{max}} \\le h\\,\\nu",
    );
    expect(compileEquation(parseEquationRecord(record("ge", quantum), "fixture")).plainLatex).toBe(
      "K_{\\mathrm{max}} \\ge h\\,\\nu",
    );
  });

  test("a bound between an energy and a frequency is refused, as an equality would be", () => {
    expect(() => parseEquationRecord(record("le", sym("nu", "frequency")), "fixture")).toThrow(
      /exponents differ/,
    );
  });

  test("an operator the grammar does not name is still refused", () => {
    expect(() => parseEquationRecord(record("lt", quantum), "fixture")).toThrow();
  });
});
