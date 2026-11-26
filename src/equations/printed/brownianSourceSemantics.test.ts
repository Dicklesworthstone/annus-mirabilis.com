import { describe, expect, test } from "bun:test";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { gaussianPropagator } from "../../physics/reference/diffusion/distributions.ts";
import { walk } from "../ast.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
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

const IDS = [
  "eq-s1-d1",
  "eq-s1-d2",
  "eq-s2-d12",
  "eq-s3-1",
  "eq-s3-d4",
  "eq-s3-d8",
  "eq-2",
  "eq-s3-d5",
  "eq-s3-d6",
  "eq-s3-d9",
  "eq-s4-d2",
  "eq-s4-d3",
  "eq-s4-d8",
  "eq-s4-d9",
  "eq-s4-1",
  "eq-s4-d11",
  "eq-s4-d12",
  "eq-s5-d1",
  "eq-s5-d2",
  "eq-s5-d3",
  "eq-s5-d5",
];
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

function parse(source: CheckedDisplay) {
  const guide = BROWNIAN_OPERATION_GUIDES[source.display];
  return parseSourceExpression(source, guide?.symbolIndices, guide?.allowChainedRelations, {
    ...(guide?.functionArities ? { functionArities: guide.functionArities } : {}),
    allowCalculus: guide?.allowCalculus ?? false,
    allowExponentials: guide?.allowExponentials ?? false,
  });
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
  test("the named displays publish and other printed forms keep their original rendering", async () => {
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
      const parsed = parse(source);
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
    const squared = sourceNodes(parse(inference)).find(({ node }) => node.tree.kind === "power")
      ?.node.tree;
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
      expect(restored.roundTrip.canonicalLatex).toBe(canonicalSourceLatex(source, parse(source)));
      expect(restored.roundTrip.status).toBe(
        restored.roundTrip.canonicalLatex === source.latex ? "identical" : "typography-exception",
      );
      expect(restored.operations.filter((operation) => operation.primary).length).toBeGreaterThan(
        1,
      );
    }
  });

  test("the RMS definition and diffusion prediction retain different statistical and time roles", () => {
    const source = display("eq-s4-d12");
    const parsed = parse(source);
    const built = compile(source);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.continuationRows).toEqual([1]);
    const meanSquare = source.terms.find((term) => term.glyph === "\\overline{x^2}");
    expect(meanSquare?.quantityId).toBe("meanSquareDisplacement1d");
    expect(source.terms.find((term) => term.glyph === "t")?.quantityId).toBe("observationInterval");
    const definition = parsed.rows[0]?.tree;
    if (definition?.kind !== "relation" || definition.right.kind !== "root")
      throw new Error("The first equality must define RMS by a square root.");
    expect(definition.right.radicand).toMatchObject({
      kind: "symbol",
      quantityId: "meanSquareDisplacement1d",
      termId: meanSquare?.termId,
    });
    const prediction = built.semantics.operations.find((operation) => operation.path === "row2");
    expect(prediction?.primary).toBe(true);
    expect(prediction?.why).toContain("not part of the definition of RMS");
    expect(prediction?.dimensionExponents).toEqual(["1", "0", "0", "0", "0", "0"]);
    expect(
      built.semantics.operations.find((operation) => operation.path === "row2.right.radicand")
        ?.dimensionExponents,
    ).toEqual(["2", "0", "0", "0", "0", "0"]);
    expect(built.semantics.premise).toContain("not a signed mean or a variance");
    // These quantities have matching dimensions but mean different things. Neither the
    // zero-drift assumption nor dimensional consistency licenses changing the source's role.
    for (const [original, replacement] of [
      ["meanSquareDisplacement1d", "displacementVariance1d"],
      ["observationInterval", "fieldTimeCoordinate"],
    ] as const)
      refuses(
        () =>
          compile({
            ...source,
            terms: source.terms.map((term) =>
              term.quantityId === original ? { ...term, quantityId: replacement } : term,
            ),
          }),
        "printed-source-operation",
      );
    refuses(() => compile(replaceOperator(source, "2 D", "6 D")), "printed-source-operation");
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

  test("the printed calculus retains its measure, derivative orders and distinct density roles", () => {
    const normalized = parse(display("eq-s4-d2")).rows[0]?.tree;
    expect(normalized).toMatchObject({
      kind: "relation",
      left: {
        kind: "integral",
        lower: { kind: "negate", argument: { kind: "constant", name: "infinity" } },
        upper: { kind: "constant", name: "infinity" },
        expression: {
          kind: "symbol",
          quantityId: "transitionKernel",
          at: { quantityId: "displacementIncrement" },
        },
        variable: { kind: "symbol", quantityId: "displacementIncrement" },
      },
      right: { kind: "number", value: "1" },
    });
    expect(compile(display("eq-s4-d2")).semantics.dimension).toBe("none: a pure number");
    const pde = parse(display("eq-s4-1")).rows[0]?.tree;
    expect(pde).toMatchObject({
      kind: "relation",
      left: {
        kind: "derivative",
        partial: true,
        order: 1,
        expression: { quantityId: "numberDensity" },
        variable: { quantityId: "fieldTimeCoordinate" },
      },
      right: {
        kind: "product",
        args: [
          { quantityId: "diffusionCoefficient" },
          {
            kind: "derivative",
            partial: true,
            order: 2,
            expression: { quantityId: "numberDensity" },
            variable: { quantityId: "positionCoordinate1d" },
          },
        ],
      },
    });
    expect(compile(display("eq-s4-1")).semantics.dimension).toBe("length⁻³ × time⁻¹");
    expect(compile(display("eq-s4-d11")).semantics.dimension).toBe("length⁻¹");
    for (const id of ["eq-s4-d10", "eq-s4-d11"])
      expect(
        display(id)
          .terms.filter((term) => term.glyph === "f")
          .every((term) => term.quantityId === "numberDensity1d"),
      ).toBe(true);
    // The source's point-source initial condition also needs its surrounding t=0, x!=0 prose.
    // Publishing f(x,t)=0 as an unconditional relation would change its meaning.
    expect(
      compilePrintedSourceSemantics(
        display("eq-s4-d10"),
        compilePrintedDisplay(display("eq-s4-d10")),
        quantities,
      ),
    ).toBeUndefined();
  });

  test("the actual printed Gaussian evaluates to n times the independent probability-density owner", () => {
    const source = display("eq-s4-d11");
    const tree = parse(source).rows[0]?.tree;
    if (tree?.kind !== "relation") throw new Error("The Gaussian source is a relation.");
    for (const [x, t, D, n] of [
      [0, 1, 0.25, 12],
      [-0.75, 2, 0.5, 37],
      [2, 0.5, 3, 1000],
    ] as const) {
      const values: Record<string, number> = {
        positionCoordinate1d: x,
        fieldTimeCoordinate: t,
        diffusionCoefficient: D,
        particleCount: n,
      };
      const bindings = Object.fromEntries(
        source.terms.map((term) => [term.termId, values[term.quantityId] ?? 0]),
      );
      const density = gaussianPropagator(x, t, D).result;
      if (density.status !== "value" || typeof density.value !== "number")
        throw new Error("The reference density must be a finite scalar at this point.");
      expect(evaluateExpression(tree.right, bindings)).toBeCloseTo(n * density.value, 11);
    }
    expect(compile(source).semantics.premise).toContain("integrates to n");
    expect(compile(source).semantics.premise).toContain("t > 0");
  });

  test("malformed calculus and changed bounds cannot inherit authored operation readings", () => {
    const normalization = display("eq-s4-d2");
    refuses(
      () => compile(replaceOperator(normalization, " d ", " ")),
      "printed-expression-unsupported",
    );
    refuses(
      () => compile(replaceOperator(normalization, "_{-", "_{+")),
      "printed-source-operation",
    );
    refuses(
      () => compile(replaceOperator(normalization, "= 1", "= 2")),
      "printed-source-operation",
    );
    // A quantity function's dimensional output alone cannot detect a wrong argument.
    refuses(() => compile(replaceOperator(normalization, ")", "^2)")), "printed-source-operation");
    const pde = display("eq-s4-1");
    refuses(
      () => compile(replaceOperator(pde, "\\partial^2", "\\partial")),
      "printed-expression-unsupported",
    );
    const firstOrder = replaceOperator(replaceOperator(pde, "^2", "^1"), "^2", "^1");
    refuses(() => compile(firstOrder), "printed-source-operation");
    const moment = display("eq-s4-d9");
    refuses(() => compile(replaceOperator(moment, "}{2}", "}{3}")), "printed-source-operation");
    refuses(() => parseSourceExpression(normalization), "printed-expression-unsupported");
    refuses(
      () =>
        parseSourceExpression({ ...normalization, latex: "\\infty = 1", terms: [] }, {}, false, {
          allowCalculus: true,
        }),
      "printed-expression-unsupported",
    );
    for (const id of ["eq-s4-d6", "eq-s4-d7"])
      refuses(
        () =>
          parseSourceExpression(display(id), {}, false, {
            allowCalculus: true,
            functionArities: { numberDensity: [0, 2], transitionKernel: [1] },
          }),
        "printed-expression-unsupported",
      );
  });

  test("the Gaussian refuses changed normalization, argument order, sign and dimensional exponent", () => {
    const source = display("eq-s4-d11");
    for (const quantityId of ["numberDensity", "probabilityDensity"])
      refuses(
        () =>
          compile({
            ...source,
            terms: source.terms.map((term) =>
              term.quantityId === "numberDensity1d" ? { ...term, quantityId } : term,
            ),
          }),
        "printed-expression-unsupported",
      );
    const leftTerms = source.terms.filter((term) => term.end < source.latex.indexOf("="));
    refuses(
      () =>
        compile({
          ...source,
          terms: source.terms.map((term) =>
            leftTerms.includes(term) && ["x", "t"].includes(term.glyph)
              ? {
                  ...term,
                  quantityId: term.glyph === "x" ? "fieldTimeCoordinate" : "positionCoordinate1d",
                }
              : term,
          ),
        }),
      "printed-source-operation",
    );
    refuses(() => compile(replaceOperator(source, "e^{-", "e^{")), "printed-source-operation");
    refuses(() => compile(replaceOperator(source, "4 ", "2 ")), "printed-source-operation");
    const position = quantities.get("positionCoordinate1d");
    if (!position) throw new Error("The coordinate must be registered.");
    const altered = new Map(quantities);
    altered.set(position.id, {
      ...position,
      dimension: [2, 0, 0, 0, 0, 0].map((num) => ({ num, den: 1 })),
    });
    refuses(
      () => compilePrintedSourceSemantics(source, compilePrintedDisplay(source), altered),
      "printed-source-dimension",
    );
  });
});
