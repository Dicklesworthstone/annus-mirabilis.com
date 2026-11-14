import { describe, expect, test } from "bun:test";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { walk } from "../ast.ts";
import { BROWNIAN_OPERATION_GUIDES } from "./brownianOperations.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import {
  canonicalSourceLatex,
  compilePrintedSourceSemantics,
  type SourceSemanticsError,
  sourceDimensionRegistry,
} from "./sourceSemantics.ts";

const IDS = ["eq-s3-d9", "eq-s5-d1", "eq-s5-d2", "eq-s5-d3", "eq-s5-d5"];
const checked = await checkPaperDisplays(process.cwd(), "brownian-motion");
if (!checked || checked.problems.length) throw new Error("The Brownian source must check clean.");
const quantities = getQuantityRegistry().quantities;
const registry = sourceDimensionRegistry(quantities);

function display(id: string): CheckedDisplay {
  const found = checked?.displays.find((entry) => entry.display === id);
  if (!found) throw new Error("Missing Brownian source display " + id);
  return found;
}

function compile(source: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(source, compilePrintedDisplay(source), quantities);
  if (!result) throw new Error("The named Brownian display must publish source semantics.");
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

function replaceOperator(source: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const start = source.latex.indexOf(from);
  if (start < 0) throw new Error("The checked source must contain the mutated operator.");
  const end = start + from.length;
  const delta = to.length - from.length;
  return {
    ...source,
    latex: source.latex.slice(0, start) + to + source.latex.slice(end),
    terms: source.terms.map((term) =>
      term.start >= end ? { ...term, start: term.start + delta, end: term.end + delta } : term,
    ),
  };
}

describe("the Brownian source's diffusivity, displacement and inference operations", () => {
  test("the five named relations publish and other printed forms keep their original rendering", async () => {
    expect(Object.keys(BROWNIAN_OPERATION_GUIDES).sort()).toEqual([...IDS].sort());
    const published = await printedDisplays(process.cwd(), ["brownian-motion"], []);
    expect(published.problems).toEqual([]);
    expect(published.displays.map((entry) => [entry.display, entry.latex])).toEqual(
      checked.displays.map((entry) => [entry.display, entry.latex]),
    );
    expect(
      [
        ...new Set(
          published.displays.filter((entry) => entry.semantics).map((entry) => entry.display),
        ),
      ].sort(),
    ).toEqual([...IDS].sort());
    for (const source of checked.displays.filter((entry) => !IDS.includes(entry.display))) {
      const original = compilePrintedDisplay(source);
      expect(compilePrintedSourceSemantics(source, original, quantities)).toBeUndefined();
      expect(
        published.displays.find(
          (entry) => entry.display === source.display && entry.latex === source.latex,
        )?.html,
      ).toBe(original.html);
    }
    // The rounded historical fixture is not silently presented as exact source algebra.
    expect(
      published.displays.find((entry) => entry.display === "eq-s5-d4")?.semantics,
    ).toBeUndefined();
  });

  test("pi stays an exact named constant and every printed physical occurrence retains its binding", () => {
    for (const id of IDS) {
      const source = display(id);
      const parsed = parseSourceExpression(source);
      const terms = sourceNodes(parsed).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree] : [],
      );
      expect(terms.map((term) => [term.termId, term.quantityId]).sort()).toEqual(
        source.terms.map((term) => [term.termId, term.quantityId]).sort(),
      );
      expect(new Set(terms.map((term) => term.termId)).size).toBe(source.terms.length);
      if (source.latex.includes("\\pi")) {
        const constants = parsed.rows.flatMap(({ tree }) =>
          walk(tree).filter((node) => node.kind === "constant"),
        );
        expect(constants).toContainEqual({ kind: "constant", name: "pi" });
        expect(canonicalSourceLatex(source, parsed)).toContain("\\pi");
      }
      const built = compile(source);
      for (const term of source.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      for (const operation of built.semantics.operations)
        expect(built.html).toContain('data-op="' + operation.id + '"');
    }
  });

  test("exact dimensions distinguish D, RMS length, square-root factors and inferred number per mole", () => {
    for (const id of IDS) {
      const built = compile(display(id));
      for (const tree of built.semantics.rows) {
        const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
        expect(result.status).toBe("consistent");
        if (result.status !== "consistent") throw new Error(result.reason);
        expect(
          result.dimension.map(({ num, den }) => (den === 1n ? String(num) : `${num}/${den}`)),
        ).toEqual(BROWNIAN_OPERATION_GUIDES[id]?.expectedDimension);
      }
    }
    const expanded = compile(display("eq-s5-d3")).semantics;
    expect(
      expanded.operations.find((operation) => operation.path === "row1.right.args.0")
        ?.dimensionExponents,
    ).toEqual(["0", "0", "1/2", "0", "0", "0"]);
    expect(
      expanded.operations.find((operation) => operation.path === "row1.right.args.1")
        ?.dimensionExponents,
    ).toEqual(["1", "0", "-1/2", "0", "0", "0"]);
    expect(compile(display("eq-s5-d5")).semantics.dimension).toBe("amount⁻¹");
    const inference = display("eq-s5-d5");
    const displacement = inference.terms.find((term) => term.quantityId === "rmsDisplacement1d");
    if (!displacement) throw new Error("The inferred number uses the observed displacement.");
    // KaTeX marks only lambda's base when its subscript and a square share a math atom.
    // Parsing still consumes the whole checked name before reading the independent power.
    expect(inference.latex.slice(displacement.start, displacement.end)).toBe("\\lambda");
    const squared = sourceNodes(parseSourceExpression(inference)).find(
      ({ node }) => node.tree.kind === "power",
    )?.node.tree;
    expect(squared?.kind).toBe("power");
    if (squared?.kind !== "power") throw new Error("The observed RMS must remain squared.");
    expect(squared.exponent).toEqual({ num: 2, den: 1 });
    expect(squared.base).toMatchObject({
      kind: "symbol",
      quantityId: "rmsDisplacement1d",
      termId: displacement.termId,
    });
  });

  test("source bytes, MathML and exact roles survive serialization and operation markup", () => {
    for (const id of IDS) {
      const source = display(id);
      const before = JSON.stringify(source);
      const original = compilePrintedDisplay(source);
      const built = compile(source);
      const boundary = '<span class="katex-html"';
      expect(built.html.slice(0, built.html.indexOf(boundary))).toBe(
        original.html.slice(0, original.html.indexOf(boundary)),
      );
      expect(JSON.stringify(source)).toBe(before);
      const restored = JSON.parse(JSON.stringify(built.semantics)) as typeof built.semantics;
      expect(restored.rows).toEqual(built.semantics.rows);
      expect(restored.roundTrip.canonicalLatex).toBe(
        canonicalSourceLatex(source, parseSourceExpression(source)),
      );
      expect(restored.roundTrip.status).toBe(
        restored.roundTrip.canonicalLatex === source.latex ? "identical" : "typography-exception",
      );
      expect(restored.operations.filter((operation) => operation.primary).length).toBeGreaterThan(
        1,
      );
    }
  });

  test("the same printed N changes role only in the inference display", () => {
    for (const id of ["eq-s3-d9", "eq-s5-d1", "eq-s5-d3"]) {
      expect(display(id).terms.find((term) => term.glyph === "N")?.quantityId).toBe(
        "avogadroConstant",
      );
      expect(display(id).terms.find((term) => term.glyph === "k")?.quantityId).toBe("viscosity");
    }
    const inference = display("eq-s5-d5");
    expect(inference.terms.find((term) => term.glyph === "N")?.quantityId).toBe(
      "avogadroNumberEstimate",
    );
    const swapped = {
      ...inference,
      terms: inference.terms.map((term) =>
        term.glyph === "N" ? { ...term, quantityId: "avogadroConstant" } : term,
      ),
    };
    // The two N quantities have matching units. The physical-role contract must still refuse.
    expect(refuses(() => compile(swapped), "printed-source-operation")).toContain(
      "no longer matches",
    );
    const text = compile(inference).semantics;
    expect(text.premise).toContain("known independently");
    expect(
      text.operations.find((operation) => operation.path === "row1.right.args.1")?.why,
    ).toContain("product of radius and molecular number");
  });

  test("changed operations, missing glyphs and incorrect dimensions cannot inherit the source explanation", () => {
    refuses(
      () => compile(replaceOperator(display("eq-s5-d2"), "\\sqrt", "-\\sqrt")),
      "printed-source-operation",
    );
    refuses(
      () => compile(replaceOperator(display("eq-s5-d5"), "^2", "^3")),
      "printed-source-dimension",
    );
    const source = display("eq-s5-d1");
    refuses(
      () => compile({ ...source, terms: source.terms.filter((term) => term.glyph !== "k") }),
      "printed-expression-unsupported",
    );
    const viscosity = quantities.get("viscosity");
    if (!viscosity) throw new Error("The source viscosity must have a canonical quantity.");
    const altered = new Map(quantities);
    altered.set(viscosity.id, {
      ...viscosity,
      dimension: [2, 1, -2, -1, 0, 0].map((num) => ({ num, den: 1 })),
    });
    refuses(
      () => compilePrintedSourceSemantics(source, compilePrintedDisplay(source), altered),
      "printed-source-dimension",
    );
    expect(() => compile(source)).not.toThrow();
  });

  test("changed numerical coefficients and a missing pi cannot retain the physical operation notes", () => {
    for (const [id, from, to] of [
      ["eq-s5-d1", "6", "5"],
      ["eq-s5-d2", "2", "3"],
      ["eq-s5-d3", "3", "6"],
      ["eq-s5-d5", "3", "6"],
      ["eq-s5-d1", "\\pi ", ""],
      ["eq-s5-d5", "\\pi ", ""],
    ] as const) {
      const altered = replaceOperator(display(id), from, to);
      // These changes retain all physical quantities and dimensions. The independently authored
      // coefficient and named-constant contract must refuse the different source algebra.
      expect(refuses(() => compile(altered), "printed-source-operation")).toContain(
        "no longer matches",
      );
    }
  });

  test("paper-local display ids cannot import another paper's operation meanings", async () => {
    const brownian = compile(display("eq-s5-d3")).semantics;
    const light = await checkPaperDisplays(process.cwd(), "light-quanta");
    const probability = light?.displays.find((entry) => entry.display === "eq-s5-d3");
    if (!probability) throw new Error("The cross-paper collision must use a real source display.");
    const other = compilePrintedSourceSemantics(
      probability,
      compilePrintedDisplay(probability),
      quantities,
    );
    expect(other?.semantics.dimension).toBe("none: a pure number");
    expect(brownian.dimension).toBe("length");
    expect(
      brownian.operations.every((operation) => operation.id.startsWith("brownian-motion.")),
    ).toBe(true);
    expect(
      other?.semantics.operations.every((operation) => operation.id.startsWith("light-quanta.")),
    ).toBe(true);
    refuses(
      () => compile({ ...display("eq-s5-d3"), paper: "light-quanta" }),
      "printed-source-binding",
    );
    const prose = brownian.operations
      .map((operation) => operation.does + " " + operation.why)
      .join(" ");
    expect(prose).not.toContain("observer speed");
    expect(prose).not.toContain("cosine");
  });
});
