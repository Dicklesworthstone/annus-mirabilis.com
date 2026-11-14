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

const IDS = [
  "eq-s4-d5",
  "eq-s5-d3",
  "eq-s5-d6",
  "eq-s5-d7",
  "eq-s5-d8",
  "eq-s6-d1",
  "eq-s6-d2",
  "eq-s6-d3",
  "eq-s6-d4",
];
const ENTROPY = ["2", "1", "-2", "-1", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const PROBABILITIES = new Set(["eq-s5-d3", "eq-s5-d7", "eq-s6-d4"]);
const checked = await checkPaperDisplays(process.cwd(), "light-quanta");
if (!checked || checked.problems.length)
  throw new Error("The light-quanta source must check clean.");
const quantities = getQuantityRegistry().quantities;
const registry = sourceDimensionRegistry(quantities);
function display(id: string): CheckedDisplay {
  const found = checked?.displays.find((d) => d.display === id);
  if (!found) throw new Error("Missing source display " + id);
  return found;
}
function compile(d: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(d, compilePrintedDisplay(d), quantities);
  if (!result) throw new Error("An admitted light-quanta display must have semantics.");
  return result;
}
function parse(d: CheckedDisplay) {
  return parseSourceExpression(d, LIGHT_QUANTA_OPERATION_GUIDES[d.display]?.symbolIndices);
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
  if (at < 0) throw new Error("The real source fixture must contain the operator.");
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

describe("the source entropy and probability comparison", () => {
  test("exactly the authored displays opt in, and every other printed LQ form stays unchanged", async () => {
    expect(Object.keys(LIGHT_QUANTA_OPERATION_GUIDES).sort()).toEqual([...IDS].sort());
    const published = await printedDisplays(process.cwd(), ["light-quanta"], []);
    expect(published.problems).toEqual([]);
    expect(published.displays.map((d) => [d.display, d.latex])).toEqual(
      checked.displays.map((d) => [d.display, d.latex]),
    );
    const actual = [
      ...new Set(published.displays.filter((d) => d.semantics).map((d) => d.display)),
    ];
    const authored = [...IDS, ...Object.keys(LIGHT_QUANTA_BUDGET_GUIDES)];
    expect(actual.sort()).toEqual(authored.sort());
    const remaining = checked.displays.filter((d) => !authored.includes(d.display));
    expect(remaining.length).toBeGreaterThan(0);
    for (const d of remaining) {
      const original = compilePrintedDisplay(d);
      expect(compilePrintedSourceSemantics(d, original, quantities)).toBeUndefined();
      expect(
        published.displays.find((p) => p.display === d.display && p.latex === d.latex)?.html,
      ).toBe(original.html);
    }
    // A grammar extension alone never opts this already parseable equality into the feature.
    expect(() => parseSourceExpression(display("eq-s1-d1"))).not.toThrow();
    expect(actual).not.toContain("eq-s1-d1");
  });

  test("all physical terms, including every exponent occurrence, keep their exact bindings", () => {
    for (const id of IDS) {
      const d = display(id);
      const nodes = sourceNodes(parse(d));
      const terms = nodes.flatMap(({ node }) => (node.tree.kind === "symbol" ? [node.tree] : []));
      expect(terms.map((t) => [t.termId, t.quantityId]).sort()).toEqual(
        d.terms.map((t) => [t.termId, t.quantityId]).sort(),
      );
      expect(new Set(terms.map((t) => t.termId)).size).toBe(d.terms.length);
      const compiled = compile(d);
      for (const term of d.terms)
        expect(compiled.html).toContain('data-term="' + term.termId + '"');
      for (const operation of compiled.semantics.operations)
        expect(compiled.html).toContain('data-op="' + operation.id + '"');
    }
    const point = parse(display("eq-s5-d7")).rows[0]?.tree;
    expect(point?.kind).toBe("relation");
    if (point?.kind !== "relation" || point.right.kind !== "symbolPower")
      throw new Error("The point probability must have a symbolic exponent.");
    expect(point.right.exponent).toMatchObject({
      kind: "symbol",
      quantityId: "independentPointCount",
    });
    const radiation = compile(display("eq-s6-d4")).semantics;
    const exponent = radiation.operations.find((o) => o.path === "row1.right.exponent");
    expect(
      exponent?.termIds
        .map((id) => display("eq-s6-d4").terms.find((t) => t.termId === id)?.quantityId)
        .sort(),
    ).toEqual(
      [
        "avogadroConstant",
        "molarGasConstant",
        "radiationEnergy",
        "wienConstantBeta",
        "frequency",
      ].sort(),
    );
  });

  test("state and event indices survive serialization and canonical rendering without collapsing ratios", () => {
    for (const id of IDS) {
      const d = display(id);
      const built = compile(d);
      const restored = JSON.parse(JSON.stringify(built.semantics)) as typeof built.semantics;
      const symbols = restored.rows.flatMap((tree) =>
        walk(tree).flatMap((n) => (n.kind === "symbol" ? [n] : [])),
      );
      for (const term of d.terms)
        expect(symbols.find((s) => s.termId === term.termId)?.index).toBe(
          LIGHT_QUANTA_OPERATION_GUIDES[id]?.symbolIndices[term.glyph],
        );
      const canonical = built.semantics.roundTrip.canonicalLatex;
      if (d.latex.includes("v_0")) {
        expect(canonical).toContain("\\frac{v}{v_0}");
        expect(canonical).not.toContain("\\frac{v_0}{v_0}");
      }
      if (d.latex.includes("S_0")) expect(canonical).toContain("S - S_0");
      if (id === "eq-s5-d3") expect(canonical).toContain("W = W_1\\,W_2");
      expect(restored.rows).toEqual(built.semantics.rows);
    }
    const tree = compile(display("eq-s6-d4")).semantics.rows[0];
    if (tree?.kind !== "relation" || tree.right.kind !== "symbolPower")
      throw new Error("The radiation probability must retain its complete exponent.");
    expect(tree.right.exponent.kind).toBe("product");
    // Source semantics use the admitted Expression visitor directly, not the narrower record parser.
    expect(
      walk(tree.right.exponent)
        .filter((n) => n.kind === "symbol")
        .map((n) => n.quantityId)
        .sort(),
    ).toEqual(
      [
        "avogadroConstant",
        "molarGasConstant",
        "radiationEnergy",
        "wienConstantBeta",
        "frequency",
      ].sort(),
    );
  });

  test("canonical yield is reported honestly while the original LaTeX and complete MathML are preserved", () => {
    const tally = { examined: 0, identical: 0, typographyExceptions: 0 };
    for (const d of checked.displays.filter((entry) => IDS.includes(entry.display))) {
      const before = JSON.stringify(d);
      const original = compilePrintedDisplay(d);
      const built = compile(d);
      const canonical = canonicalSourceLatex(d, parse(d));
      tally.examined++;
      tally[canonical === d.latex ? "identical" : "typographyExceptions"]++;
      expect(built.semantics.roundTrip.canonicalLatex).toBe(canonical);
      expect(built.semantics.roundTrip.status).toBe(
        canonical === d.latex ? "identical" : "typography-exception",
      );
      if (canonical !== d.latex)
        expect(built.semantics.roundTrip.reason).toContain("original source typography");
      const boundary = '<span class="katex-html"';
      expect(built.html.slice(0, built.html.indexOf(boundary))).toBe(
        original.html.slice(0, original.html.indexOf(boundary)),
      );
      expect(JSON.stringify(d)).toBe(before);
      if (d.latex.includes("\\lg")) {
        expect(canonical).toContain("\\ln");
        expect(built.html.slice(0, built.html.indexOf(boundary))).toContain("\\lg");
      }
    }
    expect(tally.examined).toBeGreaterThan(0);
    console.log("[printed LQ source round trip] " + JSON.stringify(tally));
  });
});

describe("independent dimension premises and truthful operation readings", () => {
  test("entropy coefficients, dimensionless probabilities, and amount are not conflated", () => {
    for (const id of IDS) {
      const built = compile(display(id));
      for (const tree of built.semantics.rows) {
        const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
        expect(result.status).toBe("consistent");
        if (result.status !== "consistent") throw new Error(result.reason);
        expect(
          result.dimension.map(({ num, den }) => (den === 1n ? String(num) : `${num}/${den}`)),
        ).toEqual(PROBABILITIES.has(id) ? DIMENSIONLESS : ENTROPY);
      }
    }
    expect(
      compile(display("eq-s4-d5")).semantics.operations.find((o) => o.path === "row1.right.args.0")
        ?.dimensionExponents,
    ).toEqual(ENTROPY);
    expect(
      compile(display("eq-s6-d4")).semantics.operations.find(
        (o) => o.path === "row1.right.exponent",
      )?.dimensionExponents,
    ).toEqual(DIMENSIONLESS);
    expect(
      compile(display("eq-s5-d8")).semantics.operations.find(
        (o) => o.path === "row1.right.args.1.argument",
      )?.dimensionExponents,
    ).toEqual(["0", "0", "0", "0", "0", "1"]);
  });

  test("dimensionful logarithm arguments and symbolic-power exponents are refused (sourceSemantics.ts:375)", () => {
    const logarithm = parse(display("eq-s5-d6")).rows[0]?.tree;
    if (logarithm?.kind !== "relation") throw new Error("The entropy law must be an equality.");
    const altered = {
      ...registry,
      configurationProbability: {
        ...registry.configurationProbability!,
        dimension: ["1", "0", "0", "0", "0", "0"],
      },
    };
    expect(checkDimensions(logarithm, altered).status).toBe("inconsistent");
    expect(checkDimensions(logarithm, registry).status).toBe("consistent");
    const q = quantities.get("independentPointCount");
    if (!q) throw new Error("The independent point count must exist.");
    const dimensionfulCount = new Map(quantities);
    dimensionfulCount.set(q.id, {
      ...q,
      dimension: [0, 0, 1, 0, 0, 0].map((num) => ({ num, den: 1 })),
    });
    const d = display("eq-s5-d7");
    const invalidPower = checkDimensions(
      parse(d).rows[0]?.tree,
      sourceDimensionRegistry(dimensionfulCount),
    );
    expect(invalidPower.status).toBe("inconsistent");
    if (invalidPower.status !== "inconsistent")
      throw new Error("The dimensional exponent must be rejected.");
    expect(invalidPower.subexpression).toContain("power exponent");
    expect(
      refuses(
        () => compilePrintedSourceSemantics(d, compilePrintedDisplay(d), dimensionfulCount),
        "printed-source-dimension",
      ),
    ).toContain("time exponents differ");
    expect(() => compile(d)).not.toThrow();
  });

  test("dimensionally consistent but non-entropy laws fail the independently authored premise (sourceSemantics.ts:400)", () => {
    const altered = new Map(quantities);
    for (const id of ["entropy", "molarGasConstant"]) {
      const q = quantities.get(id);
      if (!q) throw new Error("The entropy coefficient's canonical quantity must exist.");
      altered.set(id, {
        ...q,
        dimension: (id === "entropy" ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, -1]).map((num) => ({
          num,
          den: 1,
        })),
      });
    }
    const d = display("eq-s5-d6");
    const tree = parse(d).rows[0]?.tree;
    expect(checkDimensions(tree, sourceDimensionRegistry(altered)).status).toBe("consistent");
    expect(
      refuses(
        () => compilePrintedSourceSemantics(d, compilePrintedDisplay(d), altered),
        "printed-source-dimension",
      ),
    ).toContain("The authored display expects");
    expect(() => compile(d)).not.toThrow();
  });

  test("a cosine cannot inherit logarithm prose, nor a logarithm inherit the mass-energy cosine reading (sourceSemantics.ts:439)", async () => {
    const lq = display("eq-s4-d5");
    const wrongCosine = replaceOperator(lq, "\\lg", "\\cos");
    expect(refuses(() => compile(wrongCosine), "printed-source-operation")).toContain(
      "No authored reading",
    );
    expect(() => compile(lq)).not.toThrow();
    const massEnergy = await checkPaperDisplays(process.cwd(), "mass-energy");
    const me = massEnergy?.displays.find((d) => d.display === "eq-s0-d1");
    if (!me) throw new Error("The actual light transformation must exist.");
    const wrongLogarithm = replaceOperator(me, "\\cos", "\\lg");
    expect(refuses(() => compile(wrongLogarithm), "printed-source-operation")).toContain(
      "No authored reading",
    );
    expect(() => compile(me)).not.toThrow();
  });

  test("a lost reference-state glyph cannot silently drop its authored instance binding (sourceSemantics.ts:340)", () => {
    const d = display("eq-s5-d7");
    const changed = {
      ...d,
      latex: d.latex.replace("v_0", "v_1"),
      terms: d.terms.map((t) => (t.glyph === "v_0" ? { ...t, glyph: "v_1" } : t)),
    };
    expect(refuses(() => compile(changed), "printed-source-binding")).toContain(
      "bind every printed term",
    );
    expect(() => compile(d)).not.toThrow();
  });

  test("the expanded grammar still rejects trailing mathematics and malformed products (sourceExpression.ts:108)", () => {
    const d = display("eq-s5-d3");
    for (const latex of [d.latex + " \\int", d.latex.replace("\\cdot W_2", "\\cdot")]) {
      expect(
        refuses(() => parseSourceExpression({ ...d, latex }), "printed-expression-unsupported"),
      ).toBeTruthy();
    }
    expect(() => parse(d)).not.toThrow();
    expect(() => parse(display("eq-s5-d7"))).not.toThrow();
  });

  test("domain and physical premises stay distinct from logarithm algebra and count dimensions", () => {
    const radiation = compile(display("eq-s6-d4")).semantics;
    expect(radiation.premise).toContain("Both endpoint states");
    expect(radiation.premise).toContain(
      "same radiation energy E, frequency nu and narrow bandwidth",
    );
    expect(radiation.premise).toContain("zero-density entropy boundary");
    expect(radiation.premise).toContain("heuristic correspondence");
    expect(radiation.premise).toContain("need not be an integer and is not rounded");
    expect(radiation.operations.find((o) => o.path === "row1.right.exponent")?.why).toContain(
      "do not divide by the zero logarithm at v = v0",
    );
    expect(compile(display("eq-s5-d7")).semantics.premise).toContain(
      "independent and uniformly distributed",
    );
    expect(
      compile(display("eq-s5-d8")).semantics.operations.find((o) => o.path === "row1.right")?.why,
    ).toContain("negative");
    for (const id of IDS) {
      const operations = compile(display(id)).semantics.operations;
      for (const op of operations) {
        expect(op.foundationTitle.length).toBeGreaterThan(0);
        expect(JSON.stringify(op)).not.toMatch(/observer speed|body energy|cosine|speed-dependent/);
      }
    }
  });
});
