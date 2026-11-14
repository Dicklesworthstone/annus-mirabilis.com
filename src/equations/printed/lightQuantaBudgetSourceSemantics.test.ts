import { describe, expect, test } from "bun:test";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { walk } from "../ast.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { LIGHT_QUANTA_BUDGET_GUIDES } from "./lightQuantaBudgetOperations.ts";
import { LIGHT_QUANTA_OPERATION_GUIDES } from "./lightQuantaOperations.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import {
  canonicalSourceLatex,
  compilePrintedSourceSemantics,
  type SourceSemanticsError,
  sourceDimensionRegistry,
} from "./sourceSemantics.ts";

const EXPECTED = {
  "eq-s7-d1": { operator: "le", dimension: ["2", "1", "-2", "0", "0", "0"] },
  "eq-s7-d2": { operator: "le", dimension: ["0", "0", "-1", "0", "0", "0"] },
  "eq-s8-d1": { operator: null, dimension: ["2", "1", "-2", "0", "0", "0"] },
  "eq-s8-d2": { operator: "=", dimension: ["2", "1", "-2", "0", "0", "0"] },
  "eq-s8-d3": { operator: "=", dimension: ["2", "1", "-2", "0", "0", "-1"] },
  "eq-s8-d4": { operator: "le", dimension: ["2", "1", "-2", "0", "0", "-1"] },
  "eq-s8-d5": { operator: "ge", dimension: ["2", "1", "-2", "0", "0", "-1"] },
  "eq-s9-d1": { operator: "ge", dimension: ["2", "1", "-2", "0", "0", "-1"] },
  "eq-s9-d3": { operator: "=", dimension: ["0", "0", "0", "0", "0", "1"] },
} as const;
const IDS = Object.keys(EXPECTED);
const checked = await checkPaperDisplays(process.cwd(), "light-quanta");
if (!checked || checked.problems.length) throw new Error("The source must check clean.");
const quantities = getQuantityRegistry().quantities;
const registry = sourceDimensionRegistry(quantities);
function display(id: string): CheckedDisplay {
  const found = checked?.displays.find((d) => d.display === id);
  if (!found) throw new Error(`Missing real source display ${id}`);
  return found;
}
function compile(d: CheckedDisplay, selectedQuantities = quantities) {
  const result = compilePrintedSourceSemantics(d, compilePrintedDisplay(d), selectedQuantities);
  if (!result) throw new Error("An authored display must publish its source semantics.");
  return result;
}
function refuses(action: () => unknown, code: string): string {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as SourceSemanticsError).code).toBe(code);
  return (caught as Error).message;
}
function replaceOperator(d: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const at = d.latex.indexOf(from);
  if (at < 0) throw new Error("The source fixture must contain the replaced operator.");
  const end = at + from.length;
  const delta = to.length - from.length;
  return {
    ...d,
    latex: d.latex.slice(0, at) + to + d.latex.slice(end),
    terms: d.terms.map((term) =>
      term.start >= end ? { ...term, start: term.start + delta, end: term.end + delta } : term,
    ),
  };
}
const exact = (dimension: readonly { num: bigint; den: bigint }[]) =>
  dimension.map(({ num, den }) => (den === 1n ? String(num) : `${num}/${den}`));

describe("the printed light-quanta energy budgets", () => {
  test("only the nine authored budgets join the nine entropy displays; the unit-bearing numeric check stays unchanged", async () => {
    expect(Object.keys(LIGHT_QUANTA_BUDGET_GUIDES).sort()).toEqual([...IDS].sort());
    const published = await printedDisplays(process.cwd(), ["light-quanta"], []);
    expect(published.problems).toEqual([]);
    const admitted = [...IDS, ...Object.keys(LIGHT_QUANTA_OPERATION_GUIDES)].sort();
    expect(
      published.displays
        .filter((d) => d.semantics)
        .map((d) => d.display)
        .sort(),
    ).toEqual(admitted);
    for (const d of checked.displays.filter((d) => !admitted.includes(d.display))) {
      const original = compilePrintedDisplay(d);
      expect(compilePrintedSourceSemantics(d, original, quantities)).toBeUndefined();
      expect(published.displays.find((p) => p.display === d.display)?.html).toBe(original.html);
    }
    const numeric = display("eq-s9-d2");
    expect(numeric.latex).toContain("\\text{ Erg}");
    expect(
      published.displays.find((d) => d.display === numeric.display)?.semantics,
    ).toBeUndefined();
  });

  test("every occurrence retains its source quantity, including distinct frequency and amount scales", () => {
    for (const id of IDS) {
      const d = display(id);
      const parsed = parseSourceExpression(d);
      const symbols = sourceNodes(parsed).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree] : [],
      );
      expect(symbols.map((s) => [s.termId, s.quantityId]).sort()).toEqual(
        d.terms.map((t) => [t.termId, t.quantityId]).sort(),
      );
      expect(new Set(symbols.map((s) => s.termId)).size).toBe(d.terms.length);
      expect(symbols.every((s) => s.index === undefined)).toBe(true);
      const result = compile(d);
      for (const operation of result.semantics.operations)
        expect(result.html).toContain(`data-op="${operation.id}"`);
    }
    expect(
      display("eq-s7-d1")
        .terms.filter((t) => t.glyph.startsWith("\\nu"))
        .map((t) => t.quantityId),
    ).toEqual(["emittedFrequency", "incidentFrequency"]);
    expect(display("eq-s8-d1").terms.find((t) => t.glyph === "P")?.quantityId).toBe("workFunction");
    expect(display("eq-s8-d3").terms.find((t) => t.glyph === "P'")?.quantityId).toBe(
      "workFunctionPerGramEquivalent",
    );
    expect(display("eq-s8-d3").terms.find((t) => t.glyph === "E")?.quantityId).toBe(
      "gramEquivalentCharge",
    );
    expect(display("eq-s9-d3").terms.find((t) => t.glyph === "L")?.quantityId).toBe(
      "absorbedLightEnergy",
    );
    expect(display("eq-s9-d3").terms.find((t) => t.glyph === "j")?.quantityId).toBe(
      "ionizedGramMolecules",
    );
  });

  test("canonical yield is measured while the exact source bytes and complete MathML remain original", () => {
    const tally = { examined: 0, identical: 0, typographyExceptions: 0 };
    for (const id of IDS) {
      const d = display(id);
      const before = JSON.stringify(d);
      const original = compilePrintedDisplay(d);
      const result = compile(d);
      const canonical = canonicalSourceLatex(d, parseSourceExpression(d));
      tally.examined++;
      tally[canonical === d.latex ? "identical" : "typographyExceptions"]++;
      expect(result.semantics.roundTrip.canonicalLatex).toBe(canonical);
      expect(result.semantics.roundTrip.status).toBe(
        canonical === d.latex ? "identical" : "typography-exception",
      );
      const boundary = '<span class="katex-html"';
      expect(result.html.slice(0, result.html.indexOf(boundary))).toBe(
        original.html.slice(0, original.html.indexOf(boundary)),
      );
      expect(JSON.stringify(d)).toBe(before);
      expect(JSON.parse(JSON.stringify(result.semantics)).rows).toEqual(result.semantics.rows);
    }
    expect(tally).toEqual({ examined: IDS.length, identical: 0, typographyExceptions: IDS.length });
    console.log(`[printed LQ budget round trip] ${JSON.stringify(tally)}`);
  });

  test("the standalone energy expression has no invented equality, side or quantity", () => {
    const d = display("eq-s8-d1");
    const result = compile(d).semantics;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.kind).toBe("sum");
    expect(result.rows.flatMap((tree) => walk(tree)).some((n) => n.kind === "relation")).toBe(
      false,
    );
    expect([...(result.operations.find((o) => o.path === "row1")?.termIds ?? [])].sort()).toEqual(
      d.terms.map((t) => t.termId).sort(),
    );
    expect(result.operations.some((o) => o.path.startsWith("row1.right"))).toBe(false);
    expect(result.premise).toContain("negative residual is an energy deficit");
  });
});

describe("exact relation and dimension contracts", () => {
  test("bounds keep their authored direction even when reversed bounds remain dimensionally consistent (sourceSemantics.ts:313)", () => {
    for (const [id, expected] of Object.entries(EXPECTED)) {
      const original = display(id);
      const tree = compile(original).semantics.rows[0];
      expect(tree?.kind === "relation" ? tree.operator : null).toBe(expected.operator);
      if (expected.operator !== "le" && expected.operator !== "ge") continue;
      const reversed = replaceOperator(
        original,
        expected.operator === "le" ? "\\leqq" : "\\geqq",
        expected.operator === "le" ? "\\geqq" : "\\leqq",
      );
      expect(
        checkDimensions(parseSourceExpression(reversed).rows[0]!.tree, registry, {
          context: "emu-cgs",
        }).status,
      ).toBe("consistent");
      expect(refuses(() => compile(reversed), "printed-source-operation")).toContain(
        `authored ${expected.operator} relation`,
      );
      expect(() => compile(original)).not.toThrow();
    }
  });

  test("old equalities cannot become standalone expressions or bounds, and the standalone source cannot gain an equality (sourceSemantics.ts:313)", async () => {
    const mass = await checkPaperDisplays(process.cwd(), "mass-energy");
    const energy = mass?.displays.find((d) => d.display === "eq-s0-d2");
    if (!energy) throw new Error("The real mass-energy equality must exist.");
    for (const d of [energy, display("eq-s5-d3")]) {
      for (const replacement of ["", "\\leqq"]) {
        const changed = replaceOperator(d, "=", replacement);
        expect(() => parseSourceExpression(changed)).not.toThrow();
        expect(refuses(() => compile(changed), "printed-source-operation")).toContain(
          "authored = relation",
        );
      }
      expect(() => compile(d)).not.toThrow();
    }
    const standalone = display("eq-s8-d1");
    const invented = replaceOperator(standalone, ".", "= 0 .");
    expect(refuses(() => compile(invented), "printed-source-operation")).toContain(
      "authored standalone expression",
    );
    expect(() => compile(standalone)).not.toThrow();
  });

  test("the independent whole-display dimensions retain energy, frequency, energy per amount and amount", () => {
    for (const [id, expected] of Object.entries(EXPECTED)) {
      expect(LIGHT_QUANTA_BUDGET_GUIDES[id]?.unitSystem).toBe("emu-cgs");
      const result = compile(display(id)).semantics;
      expect(result.operations.find((o) => o.path === "row1")?.dimensionExponents).toEqual(
        expected.dimension,
      );
      for (const tree of result.rows) {
        const dimensions = checkDimensions(tree, registry, { context: "emu-cgs" });
        expect(dimensions.status).toBe("consistent");
        if (dimensions.status !== "consistent") throw new Error(dimensions.reason);
        expect(exact(dimensions.dimension)).toEqual(expected.dimension);
      }
    }
    const source = compile(display("eq-s8-d3")).semantics.rows[0];
    if (!source) throw new Error("The electrical row must exist.");
    for (const [id, expected] of [
      ["stoppingPotentialMagnitude", ["3/2", "1/2", "-2", "0", "0", "0"]],
      ["gramEquivalentCharge", ["1/2", "1/2", "0", "0", "0", "-1"]],
    ] as const) {
      const node = walk(source).find((n) => n.kind === "symbol" && n.quantityId === id);
      if (!node) throw new Error("The source electrical factor must exist.");
      const dimensions = checkDimensions(node, registry, { context: "emu-cgs" });
      if (dimensions.status !== "consistent") throw new Error(dimensions.reason);
      expect(exact(dimensions.dimension)).toEqual(expected);
    }
  });

  test("the electrical check uses EMU dimensions and refuses missing or corrupted EMU data without falling back (sourceSemantics.ts:375)", () => {
    const d = display("eq-s8-d2");
    const charge = quantities.get("elementaryCharge");
    if (!charge) throw new Error("The source charge must be registered.");
    const zero = [0, 0, 0, 0, 0, 0].map((num) => ({ num, den: 1 }));
    const unrelatedGaussian = new Map(quantities);
    unrelatedGaussian.set(charge.id, { ...charge, gaussianDimension: zero });
    expect(() => compile(d, unrelatedGaussian)).not.toThrow();
    const broken = new Map(quantities);
    broken.set(charge.id, { ...charge, emuDimension: zero });
    expect(refuses(() => compile(d, broken), "printed-source-dimension")).toContain("inconsistent");
    const withoutEmu = { ...charge };
    delete withoutEmu.emuDimension;
    broken.set(charge.id, withoutEmu);
    expect(refuses(() => compile(d, broken), "printed-source-dimension")).toContain("emuDimension");
    expect(() => compile(d)).not.toThrow();
  });

  test("a consistent dimensionless rewrite cannot masquerade as the printed amount j (sourceSemantics.ts:400)", () => {
    const d = display("eq-s9-d3");
    const altered = new Map(quantities);
    for (const id of ["molarGasConstant", "ionizedGramMolecules"]) {
      const q = quantities.get(id);
      if (!q?.dimension) throw new Error("The amount-bearing quantity must exist.");
      altered.set(id, {
        ...q,
        dimension: q.dimension.map((power, i) => (i === 5 ? { num: 0, den: 1 } : power)),
      });
    }
    expect(
      checkDimensions(parseSourceExpression(d).rows[0]!.tree, sourceDimensionRegistry(altered), {
        context: "emu-cgs",
      }).status,
    ).toBe("consistent");
    expect(refuses(() => compile(d, altered), "printed-source-dimension")).toContain(
      "expects amount",
    );
    expect(compile(d).semantics.dimension).toBe("amount");
  });

  test("expanded relation grammar still refuses unknown, chained and partially parsed mathematics (sourceExpression.ts:108)", () => {
    for (const id of ["eq-s7-d1", "eq-s8-d1"]) {
      const d = display(id);
      expect(
        refuses(
          () => parseSourceExpression({ ...d, latex: d.latex + " \\int" }),
          "printed-expression-unsupported",
        ),
      ).toContain("Unsupported token");
      expect(() => parseSourceExpression(d)).not.toThrow();
    }
    const d = display("eq-s7-d1");
    expect(
      refuses(
        () => parseSourceExpression({ ...d, latex: d.latex + " \\leqq 1" }),
        "printed-expression-unsupported",
      ),
    ).toContain("Unsupported token");
    expect(
      refuses(() => parseSourceExpression(display("eq-s9-d2")), "printed-expression-unsupported"),
    ).toContain("Unsupported token");
  });
});

test("the explanations preserve source conditions, thresholds, separate processes and the absorption premise", () => {
  const all = IDS.map((id) => compile(display(id)).semantics);
  const byId = (id: string) => compile(display(id)).semantics;
  expect(byId("eq-s7-d1").premise).toContain("Additional outgoing quanta and heat");
  expect(byId("eq-s7-d1").premise).toContain("Wien's range");
  expect(byId("eq-s7-d2").operations[0]?.why).toContain("positive");
  expect(byId("eq-s8-d2").operations.find((o) => o.path === "row1")?.does).toContain(
    "nonnegative residual",
  );
  expect(byId("eq-s8-d4").context).toContain("photoelectric emission");
  expect(byId("eq-s8-d5").context).toContain("inverse process");
  expect(byId("eq-s8-d5").operations.find((o) => o.path === "row1")?.why).toContain(
    "cannot be combined to force equality",
  );
  expect(byId("eq-s9-d3").premise).toContain(
    "no appreciable absorption unaccompanied by ionization",
  );
  expect(byId("eq-s9-d3").premise).toContain("not an ionization rate");
  for (const semantics of all) {
    const text = semantics.operations.map((o) => `${o.title} ${o.does} ${o.why}`).join(" ");
    expect(text).not.toContain("reference entropy");
    expect(text).not.toContain("observer speed");
    expect(text).not.toContain("logarithm");
  }
});
