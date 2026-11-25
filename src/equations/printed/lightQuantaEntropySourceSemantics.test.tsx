import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { spectralConstantsSI } from "../../physics/reference/radiation/spectralConstants.ts";
import {
  wienFrequencyEnergyDensity,
  wienSpectralEntropyDensity,
  wienTemperatureFromDensity,
} from "../../physics/reference/radiation.ts";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { withinTolerance } from "../../units/tolerance.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { LIGHT_QUANTA_ENTROPY_GUIDES } from "./lightQuantaEntropyOperations.ts";
import { checkPaperDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const IDS = ["eq-s3-d1", "eq-s3-d8", "eq-s4-d1", "eq-s4-d2", "eq-s4-d3"];
const checked = await checkPaperDisplays(process.cwd(), "light-quanta");
assert(checked && checked.problems.length === 0, "The actual paper's source must check cleanly.");
const quantities = getQuantityRegistry().quantities;

function display(id: string) {
  const source = checked?.displays.find((item) => item.display === id);
  assert(source, `The source must contain ${id}.`);
  return source;
}
function parse(source: CheckedDisplay) {
  const guide = LIGHT_QUANTA_ENTROPY_GUIDES[source.display];
  assert(guide);
  return parseSourceExpression(source, {}, false, {
    ...(guide.functionArities ? { functionArities: guide.functionArities } : {}),
    allowCalculus: guide.allowCalculus ?? false,
    allowExponentials: guide.allowExponentials ?? false,
  });
}
function compile(source: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(source, compilePrintedDisplay(source), quantities);
  assert(result, "An authored entropy display must have operation explanations.");
  return result;
}
function number(result: { status: string; value?: unknown }) {
  assert(result.status === "value" && typeof result.value === "number");
  return result.value;
}
function close(actual: number, expected: number, relative = 2e-12) {
  expect(Number.isFinite(actual)).toBe(true);
  expect(withinTolerance(actual, expected, { relative }).ok).toBe(true);
}
function right(id: string, values: Readonly<Record<string, number>>) {
  const source = display(id);
  const row = parse(source).rows[0]?.tree;
  assert(row?.kind === "relation");
  const bindings = Object.fromEntries(
    source.terms.map((term) => {
      const value = values[term.quantityId];
      assert(
        value !== undefined,
        `An independent fixture input is required for ${term.quantityId}.`,
      );
      return [term.termId, value];
    }),
  );
  return evaluateExpression(row.right, bindings);
}
/** Preserve checked physical spans so the negative is about algebra, not stale source offsets. */
function replace(source: CheckedDisplay, from: string, to: string, occurrence = 0): CheckedDisplay {
  let at = source.latex.indexOf(from);
  for (let index = 0; index < occurrence && at >= 0; index++)
    at = source.latex.indexOf(from, at + from.length);
  assert(at >= 0, "The mutation must change an actual source operation.");
  const end = at + from.length;
  assert(source.terms.every((term) => term.end <= at || term.start >= end));
  return {
    ...source,
    latex: source.latex.slice(0, at) + to + source.latex.slice(end),
    terms: source.terms.map((term) =>
      term.start >= end
        ? {
            ...term,
            start: term.start + to.length - from.length,
            end: term.end + to.length - from.length,
          }
        : term,
    ),
  };
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

describe("the printed route from Wien's spectrum to radiation entropy", () => {
  test("all selected source formulas retain their exact source, MathML and physical occurrences", () => {
    expect(Object.keys(LIGHT_QUANTA_ENTROPY_GUIDES).sort()).toEqual([...IDS].sort());
    const selected = checked.displays.filter((source) => IDS.includes(source.display));
    expect(selected.length).toBeGreaterThan(0);
    for (const id of IDS) expect(selected.some((source) => source.display === id)).toBe(true);
    let operations = 0;
    let terms = 0;
    for (const source of selected) {
      const before = JSON.stringify(source);
      const original = compilePrintedDisplay(source);
      const built = compile(source);
      const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));
      expect(JSON.stringify(source)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.dimensionStatus).toBe("consistent");
      const parsedTerms = sourceNodes(parse(source)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [[node.tree.termId, node.tree.quantityId]] : [],
      );
      expect(parsedTerms.sort()).toEqual(
        source.terms.map((term) => [term.termId, term.quantityId]).sort(),
      );
      expect(built.semantics.operations.length).toBeGreaterThan(0);
      for (const operation of built.semantics.operations)
        expect(built.html).toContain(`data-op="${operation.id}"`);
      for (const term of source.terms) expect(built.html).toContain(`data-term="${term.termId}"`);
      operations += built.semantics.operations.length;
      terms += source.terms.length;
    }
    console.info(
      JSON.stringify({
        event: "printed-entropy-source-coverage",
        displays: selected.length,
        operations,
        terms,
      }),
    );
  });

  test("spectral integration, function arguments and a fixed-frequency derivative have distinct meanings", () => {
    const integral = compile(display("eq-s3-d1")).semantics;
    const operator = integral.operations.find((operation) => operation.kind === "integral");
    expect(operator?.dimensionExponents).toEqual(["-1", "1", "-2", "-1", "0", "0"]);
    expect(operator?.does).toContain("zero to infinity");
    const functionNode = sourceNodes(parse(display("eq-s4-d3"))).find(
      ({ path }) => path === "row1.left",
    )?.node.tree;
    expect(functionNode).toMatchObject({
      kind: "symbol",
      quantityId: "spectralEntropyDensity",
      args: [
        { kind: "symbol", quantityId: "frequencyEnergyDensity" },
        { kind: "symbol", quantityId: "frequency" },
      ],
    });
    const derivative = compile(display("eq-s3-d8")).semantics;
    expect(derivative.dimension).toBe("temperature⁻¹");
    expect(
      derivative.operations.find((operation) => operation.kind === "derivative")?.does,
    ).toContain("same nu");
    expect(
      derivative.operations.find((operation) => operation.kind === "derivative")
        ?.dimensionExponents,
    ).toEqual(["0", "0", "0", "-1", "0", "0"]);
    expect(compile(display("eq-s4-d3")).semantics.dimension).toBe(
      "length⁻¹ × mass × time⁻¹ × temperature⁻¹",
    );
  });

  test("the source spectrum, inverse and entropy agree with the actual numerical owners", () => {
    for (const setId of ["einstein-1905-light-quanta-printed", "modern-si-2019"]) {
      const set = getConstantSet(setId);
      const { A, B } = spectralConstantsSI(set);
      for (const frequency of [3e14, 6e14, 1e15]) {
        for (const temperature of [1000, 3000]) {
          const rho = number(wienFrequencyEnergyDensity(frequency, temperature, set));
          const phi = number(wienSpectralEntropyDensity(rho, frequency, set));
          const values = {
            frequency,
            temperature,
            wienConstantAlpha: A,
            wienConstantBeta: B,
            frequencyEnergyDensity: rho,
            spectralEntropyDensity: phi,
          };
          close(right("eq-s4-d1", values), rho);
          close(
            right("eq-s4-d2", values),
            1 / number(wienTemperatureFromDensity(rho, frequency, set)),
          );
          close(right("eq-s4-d3", values), phi);
          // An independent derivative of the parsed entropy expression must recover 1/T.
          // This fails if the dimensionally harmless integration term -1 is missing or reversed.
          const step = rho * 1e-4;
          const lower = right("eq-s4-d3", { ...values, frequencyEnergyDensity: rho - step });
          const upper = right("eq-s4-d3", { ...values, frequencyEnergyDensity: rho + step });
          close((upper - lower) / (2 * step), 1 / temperature, 1e-8);
        }
      }
    }
  });

  test("wrong signs, powers and integration constants cannot inherit the authored physical reading", () => {
    for (const id of ["eq-s4-d1", "eq-s4-d2", "eq-s4-d3"])
      refuses(() => compile(replace(display(id), "^3", "^2")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s4-d1"), "{-", "{")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s4-d1"), "e^", "\\lg")), "printed-source-operation");
    for (const id of ["eq-s3-d1", "eq-s4-d1"])
      refuses(() => compile(replace(display(id), "= ", "= -")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s4-d2"), "= -", "= ")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s4-d3"), "- 1", "+ 1")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s4-d3"), "- 1", "- 2")), "printed-source-operation");
    refuses(() => compile(replace(display("eq-s3-d1"), "_0", "_1")), "printed-source-operation");
  });

  test("derivative orders, frequency arguments and quantity dimensions remain independently checked", () => {
    const source = display("eq-s3-d8");
    const numeratorOrder = replace(source, "\\partial", "\\partial^2");
    const denominator = numeratorOrder.terms.find(
      (term) => term.quantityId === "frequencyEnergyDensity",
    );
    assert(denominator);
    const changedOrder = {
      ...numeratorOrder,
      latex:
        numeratorOrder.latex.slice(0, denominator.end) +
        "^2" +
        numeratorOrder.latex.slice(denominator.end),
      terms: numeratorOrder.terms.map((term) =>
        term.start >= denominator.end
          ? { ...term, start: term.start + 2, end: term.end + 2 }
          : term,
      ),
    };
    refuses(() => compile(changedOrder), "printed-source-operation");
    const functionSource = display("eq-s4-d3");
    const frequencyArgument = functionSource.terms.find((term) => term.glyph === "\\nu");
    assert(frequencyArgument);
    refuses(
      () =>
        compile({
          ...functionSource,
          terms: functionSource.terms.map((term) =>
            term === frequencyArgument ? { ...term, quantityId: "temperature" } : term,
          ),
        }),
      "printed-source-operation",
    );
    const density = quantities.get("spectralEntropyDensity");
    assert(density);
    const altered = new Map(quantities);
    altered.set(density.id, {
      ...density,
      dimension: [2, 1, -2, -1, 0, 0].map((num) => ({ num, den: 1 })),
    });
    refuses(
      () => compilePrintedSourceSemantics(source, compilePrintedDisplay(source), altered),
      "printed-source-dimension",
    );
  });

  test("the source reference remains readable without scripts and preserves the Wien and boundary qualifications", () => {
    const source = display("eq-s4-d3");
    const html = renderToStaticMarkup(
      <PrintedOperationReference reading={compile(source).semantics} spoken={source.spoken} />,
    );
    expect(html).toContain("What each operation does");
    expect(html).toContain("C(nu)");
    expect(html).toContain("zero as rho tends to zero");
    expect(html).toContain("weaker than being well inside the Wien regime");
    expect(html).toContain('href="/foundations/integration/"');
    expect(html).toContain('href="/papers/light-quanta/s4/#lq-wien-entropy-derivation"');
    // Variations remain outside this opt-in grammar. They must not receive a guessed operation.
    const variation = display("eq-s3-d2");
    expect(
      compilePrintedSourceSemantics(variation, compilePrintedDisplay(variation), quantities),
    ).toBeUndefined();
  });
});
