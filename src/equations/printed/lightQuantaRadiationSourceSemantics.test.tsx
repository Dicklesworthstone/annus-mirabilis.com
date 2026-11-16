import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  avogadroFromPlanckConstants,
  planckFrequencyEnergyDensity,
  rayleighJeansFrequencyEnergyDensity,
} from "../../physics/reference/radiation.ts";
import { spectralConstantsSI } from "../../physics/reference/radiation/spectralConstants.ts";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { withinTolerance } from "../../units/tolerance.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { LIGHT_QUANTA_RADIATION_GUIDES } from "./lightQuantaRadiationOperations.ts";
import { checkPaperDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import {
  compilePrintedSourceSemantics,
  sourceDimensionRegistry,
} from "./sourceSemantics.ts";

const IDS = ["eq-s1-d1", "eq-s1-d2", "eq-s1-d6", "eq-s1-d7", "eq-s2-d4", "eq-s2-d5"];
const checked = await checkPaperDisplays(process.cwd(), "light-quanta");
assert(checked && checked.problems.length === 0, "The real light-quanta source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const selected = checked.displays.filter((value) => IDS.includes(value.display));
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((item) => item.display === id);
  assert(value, "The real source must contain " + id);
  return value;
}

function parse(value: CheckedDisplay) {
  return parseSourceExpression(
    value,
    {},
    LIGHT_QUANTA_RADIATION_GUIDES[value.display]?.allowChainedRelations,
  );
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected display must have a source-operation guide.");
  return result;
}

function refuses(action: () => unknown, code: string) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught).toMatchObject({ code });
}

/** Move checked spans with a changed unbound operator, so stale offsets cannot cause the refusal. */
function replace(value: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const at = value.latex.indexOf(from);
  assert(at >= 0, "The planted mutation must change an actual source occurrence.");
  const end = at + from.length;
  assert(value.terms.every((term) => term.end <= at || term.start >= end));
  const delta = to.length - from.length;
  return {
    ...value,
    latex: value.latex.slice(0, at) + to + value.latex.slice(end),
    terms: value.terms.map((term) =>
      term.start >= end ? { ...term, start: term.start + delta, end: term.end + delta } : term,
    ),
  };
}

function close(actual: number, expected: number) {
  expect(Number.isFinite(actual)).toBe(true);
  expect(withinTolerance(actual, expected, { relative: 2e-12 }).ok).toBe(true);
}

function value(result: { status: string; value?: unknown }): number {
  expect(result.status).toBe("value");
  expect(typeof result.value).toBe("number");
  return result.value as number;
}

function sides(id: string, values: Readonly<Record<string, number>>) {
  const source = display(id);
  const bindings = Object.fromEntries(
    source.terms.map((term) => {
      const number = values[term.quantityId];
      assert(number !== undefined, "Every source quantity needs an independent fixture input.");
      return [term.termId, number];
    }),
  );
  return parse(source).rows.map(({ tree }) => {
    assert(tree.kind === "relation");
    return [
      evaluateExpression(tree.left, bindings),
      evaluateExpression(tree.right, bindings),
    ] as const;
  });
}

describe("the source route from classical radiation to Planck's coefficient", () => {
  test("the named displays preserve their source, complete MathML, physical terms and operations", () => {
    expect(Object.keys(LIGHT_QUANTA_RADIATION_GUIDES).sort()).toEqual([...IDS].sort());
    expect(selected.length).toBeGreaterThan(0);
    for (const id of IDS) expect(selected.some((source) => source.display === id)).toBe(true);
    let operations = 0;
    let terms = 0;
    for (const source of selected) {
      const before = JSON.stringify(source);
      const original = compilePrintedDisplay(source);
      const built = compile(source);
      expect(JSON.stringify(source)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.dimensionStatus).toBe("consistent");
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      const physical = sourceNodes(parse(source)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree.termId] : [],
      );
      expect(physical.sort()).toEqual(source.terms.map((term) => term.termId).sort());
      expect(new Set(physical).size).toBe(source.terms.length);
      expect(built.semantics.operations.length).toBeGreaterThan(0);
      for (const operation of built.semantics.operations)
        expect(built.html).toContain('data-op="' + operation.id + '"');
      for (const term of source.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      operations += built.semantics.operations.length;
      terms += source.terms.length;
    }
    console.info(
      JSON.stringify({
        event: "printed-radiation-source-coverage",
        displays: IDS.length,
        sourceVariants: selected.length,
        operations,
        terms,
      }),
    );
  });

  test("the chained equalities retain three arguments and do not duplicate physical source terms", () => {
    const built = compile(display("eq-s1-d6")).semantics;
    expect(built.rows).toHaveLength(3);
    const [general, frequency, field] = built.rows;
    assert(general?.kind === "relation" && frequency?.kind === "relation");
    assert(field?.kind === "relation");
    expect(general.right).toMatchObject({
      kind: "symbol",
      quantityId: "meanResonatorEnergy",
    });
    expect(frequency.right).toMatchObject({
      kind: "symbol",
      quantityId: "meanResonatorEnergyAtFrequency",
    });
    expect(frequency.left).toEqual(general.left);
    expect(field.left).toEqual(general.left);
    expect(field.right.kind).toBe("product");
    expect(built.operations.filter((operation) => operation.kind === "relation")).toHaveLength(3);
  });

  test("energy, frequency density and the factored coefficient keep different exact dimensions", () => {
    for (const source of selected) {
      const expected = LIGHT_QUANTA_RADIATION_GUIDES[source.display]?.expectedDimension;
      for (const { tree } of parse(source).rows) {
        const result = checkDimensions(tree, sourceDimensionRegistry(quantities), {
          context: "gaussian-cgs",
        });
        assert(result.status === "consistent");
        expect(
          result.dimension.map(({ num, den }) =>
            String(den) === "1" ? String(num) : String(num) + "/" + String(den),
          ),
        ).toEqual(expected);
      }
    }
    const modes = compile(display("eq-s1-d7")).semantics.operations.find(
      (operation) => operation.path === "row1.right.args.1",
    );
    expect(modes?.dimensionExponents).toEqual(["-3", "0", "1", "0", "0", "0"]);
    const reciprocal = compile(display("eq-s1-d2")).semantics.operations.find(
      (operation) => operation.path === "row1.right.args.0",
    );
    expect(reciprocal?.dimensionExponents).toEqual(["3", "0", "-1", "0", "0", "0"]);
    const thermal = compile(display("eq-s1-d1")).semantics.operations.find(
      (operation) => operation.path === "row1.right.args.0",
    );
    expect(thermal?.dimensionExponents).toEqual(["2", "1", "-2", "-1", "0", "0"]);
  });

  test("all source equalities agree with the historical spectrum owner without inserting modern N", () => {
    const set = getConstantSet("einstein-1905-light-quanta-printed");
    const { A, B, c } = spectralConstantsSI(set);
    const inferred = avogadroFromPlanckConstants(set);
    assert(inferred.status === "value");
    // R = 8.31 J/(mol K) is the set's separately supplied historical gas-law input.
    const R = 8.31;
    const N = inferred.avogadroConstant;
    for (const temperature of [300, 3000]) {
      for (const frequency of [1e10, 1e12, 1e14]) {
        const density = value(rayleighJeansFrequencyEnergyDensity(frequency, temperature, set));
        const inputs = {
          molarGasConstant: R,
          avogadroConstant: N,
          temperature,
          frequency,
          speedOfLight: c,
          frequencyEnergyDensity: density,
          meanResonatorEnergy: (R * temperature) / N,
          meanResonatorEnergyAtFrequency: (R * temperature) / N,
          wienConstantAlpha: A,
          wienConstantBeta: B,
        };
        for (const id of IDS)
          for (const [left, right] of sides(id, inputs)) close(left, right);
      }
    }
  });

  test("the Planck limiting form is close at small beta nu/T and is not the full finite-frequency law", () => {
    const set = getConstantSet("einstein-1905-light-quanta-printed");
    const { A, B } = spectralConstantsSI(set);
    const temperature = 300;
    const errors = [1e-5, 1].map((x) => {
      const frequency = (x * temperature) / B;
      const exact = value(planckFrequencyEnergyDensity(frequency, temperature, set));
      const [, leading] = sides("eq-s2-d4", {
        frequencyEnergyDensity: exact,
        wienConstantAlpha: A,
        wienConstantBeta: B,
        frequency,
        temperature,
      })[0]!;
      return (leading - exact) / exact;
    });
    expect(errors[0]).toBeGreaterThan(0);
    expect(errors[0]).toBeLessThan(0.00001);
    expect(errors[1]).toBeGreaterThan(0.7);
    const reading = compile(display("eq-s2-d4")).semantics;
    expect(reading.premise).toContain("limiting form");
    expect(reading.premise).toContain("opposite regime from the Wien approximation");
  });

  test("altered coefficients, powers and same-dimension quantity substitutions invalidate the authored readings", () => {
    const density = display("eq-s1-d7");
    refuses(() => compile(replace(density, "8", "4")), "printed-source-operation");
    refuses(() => compile(replace(density, "^3", "^2")), "printed-source-operation");
    refuses(() => compile(replace(density, "^2", "^3")), "printed-source-operation");
    const resonator = display("eq-s1-d2");
    refuses(
      () =>
        compile({
          ...resonator,
          terms: resonator.terms.map((term) =>
            term.quantityId === "meanResonatorEnergyAtFrequency"
              ? { ...term, quantityId: "meanResonatorEnergy" }
              : term,
          ),
        }),
      "printed-source-operation",
    );
    expect(() => compile(density)).not.toThrow();
    expect(() => compile(resonator)).not.toThrow();
  });

  test("wrong density dimensions and stale source spans cannot acquire operation markup", () => {
    const source = display("eq-s1-d7");
    const density = quantities.get("frequencyEnergyDensity");
    assert(density);
    const wrongUnits = new Map(quantities);
    wrongUnits.set(density.id, {
      ...density,
      dimension: [-2, 1, -2, 0, 0, 0].map((num) => ({ num, den: 1 })),
    });
    refuses(
      () => compilePrintedSourceSemantics(source, compilePrintedDisplay(source), wrongUnits),
      "printed-source-dimension",
    );
    expect(() =>
      compile({
        ...source,
        terms: source.terms.map((term, index) =>
          index === 0 ? { ...term, start: term.start + 1, end: term.end + 1 } : term,
        ),
      }),
    ).toThrow();
    expect(() => compile(source)).not.toThrow();
  });

  test("the no-script operation reference explains the physical premises and links to the actual laboratories", () => {
    for (const id of IDS) {
      const source = display(id);
      const built = compile(source);
      const html = renderToStaticMarkup(
        <PrintedOperationReference reading={built.semantics} spoken={source.spoken} />,
      );
      expect(html).toContain('id="operations"');
      expect(html).toContain("What each operation does");
      expect(html).toContain("What it does.");
      expect(html).toContain("Why this is allowed.");
      expect(html).toContain('href="' + built.semantics.next.href + '"');
      for (const operation of built.semantics.operations)
        expect(html).toContain('id="operation-' + operation.id + '"');
    }
    expect(compile(display("eq-s1-d7")).semantics.next.href).toBe("/lab/lq-02/");
    expect(compile(display("eq-s2-d4")).semantics.next.href).toBe("/lab/lq-03/");
    const inference = compile(display("eq-s2-d5")).semantics;
    expect(inference.premise).toContain("independent inputs");
    expect(inference.premise).toContain("defined molecular number");
    expect(inference.premise).toContain("does not establish independently moving light quanta");
  });
});
