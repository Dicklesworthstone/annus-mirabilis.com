import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import type { ConcordanceEntry, GroupPattern } from "../content/schemas/concordance.ts";
import type { Expression } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import type { SymbolExpression } from "./latex/types.ts";
import { printedForm } from "./notationForms.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import type { EquationRecord } from "./record.ts";
import { compileEquation, compileEquationWithNotation } from "./render.ts";
import { teachingProfile } from "./teachingProfiles.ts";

const lq = loadConcordanceForPaper("light-quanta").entries;
const me = loadConcordanceForPaper("mass-energy").entries;
const lqTable = teachingProfile("light-quanta")!.quantities;
const meTable = teachingProfile("mass-energy")!.quantities;
const record = (paper: string, id: string): EquationRecord =>
  JSON.parse(readFileSync(join(process.cwd(), "content/equations", paper, `${id}.json`), "utf8"));
const symbol = (quantityId: string): Extract<Expression, { kind: "symbol" }> => ({
  kind: "symbol",
  quantityId,
  termId: `eq-model-compound.t.${quantityId}`,
});
const reasons = (tree: Expression, entries = me, table = meTable, section = "s0") => {
  const form = printedForm(tree, table, entries, section);
  return form.state === "modern" ? form.unprinted.map((u) => u.reason) : [];
};
const draw = (tree: Expression, entries = me, table = meTable, section = "s0") => {
  const form = printedForm(tree, table, entries, section);
  if (form.state !== "printed") throw new Error(JSON.stringify(form.unprinted));
  return expressionLatex(tree, {
    registry: recordQuantities(
      table,
      Object.fromEntries(
        Object.entries(form.letters)
          .filter(([, l]) => !l.expression)
          .map(([q, l]) => [q, l.latex]),
      ),
    ),
    symbolExpressions: Object.fromEntries(
      Object.entries(form.letters).flatMap(([q, l]) => (l.expression ? [[q, l.expression]] : [])),
    ) as Readonly<Record<string, SymbolExpression>>,
    strictConcordance: false,
  });
};
const withPattern = (
  entries: readonly ConcordanceEntry[],
  id: string,
  pattern: GroupPattern,
): readonly ConcordanceEntry[] =>
  entries.map((entry) => {
    if (
      entry.id !== id ||
      entry.operation.kind !== "rename" ||
      entry.operation.target.form !== "group"
    )
      return entry;
    return {
      ...entry,
      operation: { ...entry.operation, target: { ...entry.operation.target, pattern } },
    };
  });

describe("compound notation on the real explanation records", () => {
  test("R/N is an AST-owned group, including as a power's entire base", () => {
    const constant = symbol("boltzmannConstant");
    expect(draw(constant, lq, lqTable, "s1")).toBe("\\left(\\frac{R}{N}\\right)");
    expect(
      draw({ kind: "power", base: constant, exponent: { num: 2, den: 1 } }, lq, lqTable, "s1"),
    ).toBe("\\left(\\frac{R}{N}\\right)^{2}");
  });

  test("Stokes's energy budget switches h to R beta/N without losing any selectable identity", () => {
    const input = record("light-quanta", "eq-model-lq-fluorescence-bound");
    const modern = compileEquation(input);
    const compiled = compileEquationWithNotation(input, { entries: lq, section: "s7" });
    const form = compiled.notationForm;
    expect(form?.state).toBe("printed");
    if (form?.state !== "printed") throw new Error("No printed fluorescence budget");
    expect(form.plainLatex).toBe(
      "\\left(\\frac{R\\,\\beta}{N}\\right)\\,\\nu_2 \\le \\left(\\frac{R\\,\\beta}{N}\\right)\\,\\nu_1",
    );
    expect(form.mathml).toContain("<mi>β</mi>");
    expect(form.glyphHtml.planckConstant).toContain("β");
    expect(form.html).not.toContain("notation.t.");
    for (const node of compiled.navigation)
      expect(form.html).toContain(`data-${node.kind === "term" ? "term" : "op"}="${node.id}"`);
    expect(compiled.tree).toEqual(modern.tree);
    expect(compiled.treeDigest).toBe(modern.treeDigest);
    expect(compiled.terms).toEqual(modern.terms);
    expect(compiled.navigation).toEqual(modern.navigation);
    expect(compiled.html).toBe(modern.html);
  });

  test("the exact drop keeps its premise and binding when gamma and Delta K expand", () => {
    const input = record("mass-energy", "eq-model-me-exact-drop");
    const modern = compileEquation(input);
    const compiled = compileEquationWithNotation(input, { entries: me, section: "s0" });
    const form = compiled.notationForm;
    expect(form?.state).toBe("printed");
    if (form?.state !== "printed") throw new Error("No printed kinetic-energy drop");
    expect(form.plainLatex).toContain("\\left(K_0 - K_1\\right) = L");
    expect(form.plainLatex).toContain("\\frac{1}{\\sqrt{1 - \\frac{v^{2}}{V^{2}}}}");
    expect(form.plainLatex).not.toContain("\\gamma");
    expect(form.plainLatex).not.toContain("\\Delta K");
    expect(compiled.treeDigest).toBe(modern.treeDigest);
    expect(compiled.tree).toEqual(input.tree);
    expect(compiled.bindings).toEqual(input.bindings);
    expect(compiled.assumptions).toEqual(input.assumptions);
    expect(compiled.assumptions.some((a) => a.includes("This is a premise"))).toBe(true);
    for (const node of compiled.navigation)
      expect(form.html).toContain(`data-${node.kind === "term" ? "term" : "op"}="${node.id}"`);
  });

  test("differences remain grouped in products, powers and negations", () => {
    const difference = symbol("kineticEnergyDifference");
    expect(draw({ kind: "product", args: [{ kind: "number", value: "2" }, difference] })).toBe(
      "2\\,\\left(K_0 - K_1\\right)",
    );
    expect(draw({ kind: "power", base: difference, exponent: { num: 2, den: 1 } })).toBe(
      "\\left(K_0 - K_1\\right)^{2}",
    );
    expect(draw({ kind: "negate", argument: difference })).toBe("-\\left(K_0 - K_1\\right)");
  });

  test("L/2 cannot replace L or apply its half a second time", () => {
    const whole = symbol("emittedEnergyRestFrame");
    const half: Expression = { ...whole, kind: "symbol", scale: { num: 1, den: 2 } };
    expect(draw(whole)).toBe("L");
    expect(draw(half)).toBe("\\frac{1}{2}\\left(L\\right)");
    // The half-pulse entry alone does NOT name the whole quantity, even when a node has a scale.
    const onlyHalf = me.filter((e) => e.id !== "me.L.emittedEnergyRestFrame");
    expect(reasons(whole, onlyHalf)).toEqual(["no-entry"]);
    expect(reasons(half, onlyHalf)).toEqual(["no-entry"]);
  });

  test("H and H_0 are distinguished by the record's target only after the quantity is matched", () => {
    const compiled = compileEquationWithNotation(record("mass-energy", "eq-model-me-moving-ledger"), {
      entries: me,
      section: "s0",
    });
    expect(compiled.notationForm?.state).toBe("printed");
    if (compiled.notationForm?.state === "printed")
      expect(compiled.notationForm.plainLatex.startsWith("H_0 - H_1 = ")).toBe(true);
  });
});

describe("one unsafe group holds the entire formula in modern notation", () => {
  const input = record("light-quanta", "eq-model-lq-fluorescence-bound");

  test("a missing leaf, a wrong quantity and an out-of-scope group each refuse", () => {
    for (const entries of [
      lq.filter((entry) => entry.id !== "lq.N.avogadroConstant"),
      lq.map((entry) =>
        entry.id === "lq.R_beta_N.planckConstant"
          ? { ...entry, binding: { quantityId: "boltzmannConstant" } }
          : entry,
      ),
      lq.map((entry) =>
        entry.id === "lq.R_beta_N.planckConstant" ? { ...entry, scope: ["lq-s2"] } : entry,
      ),
    ]) {
      const compiled = compileEquationWithNotation(input, { entries, section: "s7" });
      expect(compiled.notationForm).toEqual({ state: "modern" });
      expect(compiled.html).toBe(compileEquation(input).html);
    }
  });

  test("a dimensional change or an incomplete arithmetic pattern cannot become a display form", () => {
    const wrongDimension = withPattern(lq, "lq.R_beta_N.planckConstant", {
      kind: "divide",
      left: { kind: "multiply", terms: ["molarGasConstant", "wienConstantBeta"] },
      right: { kind: "term", terms: ["molarGasConstant"] },
    });
    expect(reasons(symbol("planckConstant"), wrongDimension, lqTable, "s7")).toEqual([
      "unsupported-group",
    ]);
    const incomplete = withPattern(me, "me.root.lorentzFactor", {
      kind: "divide",
      left: { kind: "number", value: 1 },
      right: { kind: "root", terms: ["speedOfLight", "frameSpeed"] },
    });
    expect(reasons(symbol("lorentzFactor"), incomplete)).toEqual(["unsupported-group"]);
  });

  test("a changed modern target still refuses despite an otherwise complete group", () => {
    const wrongTarget = lq.map((entry) =>
      entry.id === "lq.R_beta_N.planckConstant" && entry.operation.kind === "rename"
        ? {
            ...entry,
            operation: {
              ...entry.operation,
              target: { ...entry.operation.target, modernGlyph: "\\hbar" },
            },
          }
        : entry,
    );
    expect(reasons(symbol("planckConstant"), wrongTarget, lqTable, "s7")).toEqual([
      "target-differs",
    ]);
  });

  test("target matching removes braces around one token, never a multi-letter subscript", () => {
    const speed = me.find((entry) => entry.id === "me.V.speedOfLight")!;
    const target = (modernGlyph: string): ConcordanceEntry => ({
      ...speed,
      operation: { kind: "rename", target: { form: "symbol", modernGlyph } },
    });
    const table = (glyph: string) => ({
      ...meTable,
      speedOfLight: { ...meTable.speedOfLight!, glyph },
    });
    expect(reasons(symbol("speedOfLight"), [target("E_{ab}")], table("E_ab"))).toEqual([
      "target-differs",
    ]);
    expect(reasons(symbol("speedOfLight"), [target("E_{a}")], table("E_a"))).toEqual([]);
    expect(
      reasons(symbol("speedOfLight"), [target("E_{\\alpha}")], table("E_\\alpha")),
    ).toEqual([]);
  });

  test("a group with no current dimension cannot borrow a current-bearing leaf", () => {
    const chargedLeaf = {
      ...lqTable,
      wienConstantBeta: {
        ...lqTable.wienConstantBeta!,
        dimension: ["0", "0", "1", "1", "1", "0"],
      },
    };
    expect(reasons(symbol("planckConstant"), lq, chargedLeaf, "s7")).toEqual(["unsupported-group"]);
  });

  test("function arguments and indices do not invent substitutions inside a compound form", () => {
    const bare = symbol("lorentzFactor");
    for (const qualified of [
      { ...bare, kind: "symbol", index: "0" },
      { ...bare, kind: "symbol", at: symbol("frameSpeed") },
    ] as Expression[]) {
      expect(reasons({ kind: "product", args: [bare, qualified] })).toContain("unsupported-group");
    }
  });

  test("modern identifications and SI electromagnetic formulas cannot become renames", () => {
    expect(reasons(symbol("wienConstantBeta"), lq, lqTable, "s2")).toEqual(["not-a-rename"]);
    const stopping = record("light-quanta", "eq-model-lq-stopping-energy");
    expect(reasons(stopping.tree, lq, lqTable, "s8")).toContain("electromagnetic-units");
    expect(compileEquationWithNotation(stopping, { entries: lq, section: "s8" }).notationForm).toEqual({
      state: "modern",
    });
    expect(reasons(symbol("inertialMassDecrease"))).toEqual(["not-a-rename"]);
  });
});
