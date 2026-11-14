import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clearAnnouncement,
  getLastAnnouncement,
  setLiveRegionElement,
} from "../../a11y/announce.ts";
import { checkDimensions } from "../../content/dimensions/check.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { lightComplexFactors } from "../../physics/reference/waves.ts";
import { PrintedDisplayTerms } from "../../reader/faces/PrintedDisplayTerms.tsx";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import type { Expression } from "../ast.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_LIGHT_COMPLEX_GUIDES } from "./relativityLightComplex.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The actual source records must check cleanly.");
const selected = checked.displays.filter((value) => RELATIVITY_LIGHT_COMPLEX_GUIDES[value.display]);
const quantities = getQuantityRegistry().quantities;
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((entry) => entry.display === id);
  assert(value, "The checked source contains " + id);
  return value;
}

function parse(value: CheckedDisplay) {
  const guide = RELATIVITY_OPERATION_GUIDES[value.display];
  return parseSourceExpression(value, guide?.symbolIndices, guide?.allowChainedRelations);
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected display must have authored source semantics.");
  return result;
}

function refuses(action: () => unknown, code: string): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught).toMatchObject({ code });
}

function close(actual: number, expected: number): void {
  expect(withinTolerance(actual, expected, { absolute: 1e-12, relative: 1e-12 }).ok).toBe(true);
}

/** A mutation outside term spans must update offsets so the intended algebra reaches the parser. */
function replace(value: CheckedDisplay, from: string, to: string, last = false): CheckedDisplay {
  const at = last ? value.latex.lastIndexOf(from) : value.latex.indexOf(from);
  assert(at >= 0, "The planted mutation must change real source.");
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

/** Change actual printed components and their checked spans together, preserving quantity owners. */
function exchangeGlyphs(value: CheckedDisplay, first: string, second: string): CheckedDisplay {
  assert(value.terms.some((term) => term.glyph === first));
  assert(value.terms.some((term) => term.glyph === second));
  let latex = "";
  let cursor = 0;
  const terms = value.terms.map((term) => {
    const glyph = term.glyph === first ? second : term.glyph === second ? first : term.glyph;
    const original = value.latex.slice(term.start, term.end);
    assert(
      original === term.glyph,
      "This component mutation must cover the complete printed glyph.",
    );
    latex += value.latex.slice(cursor, term.start);
    const start = latex.length;
    latex += glyph;
    cursor = term.end;
    return { ...term, glyph, start, end: latex.length };
  });
  return { ...value, latex: latex + value.latex.slice(cursor), terms };
}

function assignment(value: CheckedDisplay, glyphValues: Readonly<Record<string, number>>) {
  return Object.fromEntries(
    value.terms.flatMap((term) => {
      const assigned = glyphValues[term.glyph];
      return assigned === undefined ? [] : [[term.termId, assigned] as const];
    }),
  );
}

function evaluate(id: string, path: string, glyphValues: Readonly<Record<string, number>>): number {
  const value = display(id);
  const node = sourceNodes(parse(value)).find((entry) => entry.path === path)?.node;
  assert(node, "The real source contains " + path);
  const result = evaluateExpression(node.tree, assignment(value, glyphValues));
  assert(Number.isFinite(result), "The numeric check must evaluate a finite source expression.");
  return result;
}

function dimension(tree: Expression) {
  const result = checkDimensions(tree, sourceDimensionRegistry(quantities), {
    context: "gaussian-cgs",
  });
  assert(result.status === "consistent");
  return result.dimension.map(({ num, den }) =>
    String(den) === "1" ? String(num) : String(num) + "/" + String(den),
  );
}

describe("the printed finite-light-complex argument", () => {
  test("all three new source displays preserve bytes, MathML, physical occurrences and operation spans", () => {
    expect(selected.length).toBeGreaterThan(0);
    for (const id of ["eq-s8-d1", "eq-s8-d2", "eq-s8-d4"])
      expect(selected.some((value) => value.display === id)).toBe(true);
    let identical = 0;
    let operations = 0;
    let terms = 0;
    for (const value of selected) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      const parsed = parse(value);
      const nodes = sourceNodes(parsed);
      const symbols = nodes.filter(({ node }) => node.tree.kind === "symbol");
      expect(
        symbols
          .map(({ node }) => {
            assert(node.tree.kind === "symbol");
            return [node.tree.termId, node.tree.quantityId];
          })
          .sort(),
      ).toEqual(value.terms.map((term) => [term.termId, term.quantityId]).sort());
      for (const { path, node } of symbols) {
        assert(node.tree.kind === "symbol");
        const owner = RELATIVITY_LIGHT_COMPLEX_GUIDES[value.display]?.primary[path];
        expect(owner).toMatchObject({ kind: "symbol", quantities: [node.tree.quantityId] });
        if (node.tree.index !== undefined) expect(owner?.symbolIndex).toBe(node.tree.index);
      }
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.operations.length).toBeGreaterThan(0);
      expect(built.semantics.operations.length).toBe(
        nodes.filter(({ node }) => node.marker).length,
      );
      const ids = built.semantics.operations.map((operation) => operation.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(built.html).toContain('data-op="' + id + '"');
      for (const term of value.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      if (built.semantics.roundTrip.status === "identical") identical++;
      else expect(built.semantics.roundTrip.reason).toContain("original source typography");
      operations += ids.length;
      terms += symbols.length;
    }
    console.info(
      JSON.stringify({
        event: "printed-light-complex-source-coverage",
        paper: "special-relativity",
        sourceVariants: selected.length,
        displayIds: [...new Set(selected.map((value) => value.display))],
        identicalRoundTrips: identical,
        typographyExceptions: selected.length - identical,
        operations,
        physicalTerms: terms,
      }),
    );
  });

  test("the chained equality is opt-in and reuses its left expression without inventing printed terms", () => {
    const value = display("eq-s8-d4");
    refuses(() => parseSourceExpression(value), "printed-expression-unsupported");
    refuses(() => parseSourceExpression(value, {}, false), "printed-expression-unsupported");
    const parsed = parse(value);
    expect(parsed.continuationRows).toEqual([1]);
    const first = parsed.rows[0];
    const second = parsed.rows[1];
    assert(first?.tree.kind === "relation" && second?.tree.kind === "relation");
    expect(second.tree.left).toBe(first.tree.left);
    expect(second.parts.map((part) => part.name)).toEqual(["right"]);
    expect(value.latex.slice(second.marker!.start, second.marker!.end)).toBe("=");
    expect(sourceNodes(parsed).some(({ path }) => path.startsWith("row2.left"))).toBe(false);
    const ids = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree.termId] : [],
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(value.terms.map((term) => term.termId).sort());
    expect(
      compile(value)
        .semantics.operations.filter((operation) => operation.kind === "relation")
        .map((operation) => operation.path),
    ).toEqual(["row1", "row2"]);
  });

  test("each geometry side is a squared length, while density, volume, energy and their ratio remain distinct", () => {
    for (const id of ["eq-s8-d1", "eq-s8-d2"])
      for (const { tree } of parse(display(id)).rows)
        expect(dimension(tree)).toEqual(["2", "0", "0", "0", "0", "0"]);
    const value = display("eq-s8-d4");
    const nodes = sourceNodes(parse(value));
    const expected: Readonly<Record<string, readonly string[]>> = {
      row1: ["0", "0", "0", "0", "0", "0"],
      row2: ["0", "0", "0", "0", "0", "0"],
      "row1.right.numerator": ["2", "1", "-2", "0", "0", "0"],
      "row1.right.denominator": ["2", "1", "-2", "0", "0", "0"],
      "row1.right.numerator.args.0": ["-1", "1", "-2", "0", "0", "0"],
      "row1.right.denominator.args.0": ["-1", "1", "-2", "0", "0", "0"],
      "row1.right.numerator.args.1": ["3", "0", "0", "0", "0", "0"],
      "row1.right.denominator.args.1": ["3", "0", "0", "0", "0", "0"],
    };
    for (const [path, exponents] of Object.entries(expected)) {
      const node = nodes.find((entry) => entry.path === path)?.node;
      assert(node);
      expect(dimension(node.tree)).toEqual(exponents);
    }
    for (const quantityId of ["lightAmplitudeMoving", "lightAmplitudeStationary"]) {
      const quantity = quantities.get(quantityId);
      assert(quantity);
      const { gaussianDimension: omitted, ...withoutGaussian } = quantity;
      assert(omitted);
      const altered = new Map(quantities).set(quantityId, withoutGaussian);
      refuses(
        () => compilePrintedSourceSemantics(value, compilePrintedDisplay(value), altered),
        "printed-source-dimension",
      );
    }
  });

  test("a translating sphere keeps its radius for longitudinal and oblique propagation", () => {
    const R = 2;
    const V = 3;
    for (const [a, b, c] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0.6, 0.8, 0],
      [2 / 3, -1 / 3, 2 / 3],
    ] as const) {
      for (const t of [-0.7, 0, 1.3]) {
        const values = {
          R,
          V,
          a,
          b,
          c,
          t,
          x: V * a * t + (2 * R) / 3,
          y: V * b * t - R / 3,
          z: V * c * t + (2 * R) / 3,
        };
        close(evaluate("eq-s8-d1", "row1.left", values), R * R);
        close(evaluate("eq-s8-d1", "row1.right", values), R * R);
      }
    }
  });

  test("the ellipsoid is the original sphere evaluated on tau = 0, including all transverse travel terms", () => {
    const V = 5;
    const xi = 1.7;
    const eta = -0.4;
    const zeta = 0.9;
    for (const beta of [-0.8, -0.3, 0, 0.6]) {
      const lorentz = 1 / Math.sqrt(1 - beta * beta);
      for (const [a, b, c] of [
        [1, 0, 0],
        [0, 1, 0],
        [2 / 3, -1 / 3, 2 / 3],
      ] as const) {
        const sphere = evaluate("eq-s8-d1", "row1.left", {
          V,
          a,
          b,
          c,
          x: lorentz * xi,
          y: eta,
          z: zeta,
          t: (lorentz * beta * xi) / V,
        });
        const ellipsoid = evaluate("eq-s8-d2", "row1.left", {
          V,
          v: beta * V,
          a,
          b,
          c,
          "\\beta": lorentz,
          "\\xi": xi,
          "\\eta": eta,
          "\\zeta": zeta,
        });
        close(ellipsoid, sphere);
      }
    }
  });

  test("the actual ellipsoid offsets yield the light-volume factor, not a material contraction", () => {
    for (const beta of [-0.6, 0, 0.6, 0.9]) {
      for (const angle of [0, Math.PI / 3, Math.PI / 2, Math.PI]) {
        const a = Math.cos(angle);
        const b = 0.6 * Math.sin(angle);
        const c = 0.8 * Math.sin(angle);
        const common = { V: 10, v: 10 * beta, a, b, c, "\\beta": 1 / Math.sqrt(1 - beta * beta) };
        const matrix = [0, 1, 2].map((row) =>
          [0, 1, 2].map((column) =>
            evaluate("eq-s8-d2", `row1.left.args.${row}.base.argument`, {
              ...common,
              "\\xi": column === 0 ? 1 : 0,
              "\\eta": column === 1 ? 1 : 0,
              "\\zeta": column === 2 ? 1 : 0,
            }),
          ),
        );
        const [x, y, z] = matrix;
        assert(x && y && z);
        const determinant =
          x[0]! * (y[1]! * z[2]! - y[2]! * z[1]!) -
          x[1]! * (y[0]! * z[2]! - y[2]! * z[0]!) +
          x[2]! * (y[0]! * z[1]! - y[1]! * z[0]!);
        expect(determinant).toBeGreaterThan(0);
        const volume = 1 / determinant;
        close(volume, lightComplexFactors(beta, angle).volumeFactor);
        close(
          volume,
          evaluate("eq-s8-d3", "row1.right", { V: 10, v: 10 * beta, "\\varphi": angle }),
        );
      }
    }
    const oblique = lightComplexFactors(0.6, Math.acos(0.6));
    close(oblique.volumeFactor, 1.25);
    expect(withinTolerance(oblique.volumeFactor, 0.8, { absolute: 1e-12 }).ok).toBe(false);
    // A K-transverse ray really does coincide with the material factor. It cannot expose the bug.
    close(lightComplexFactors(0.6, Math.PI / 2).volumeFactor, 0.8);
  });

  test("both equals signs agree with the wave owner, and the total ratio differs from the density ratio", () => {
    const amplitude = 2.3;
    const volume = 7.2;
    const energy = (amplitude * amplitude * volume) / (8 * Math.PI);
    for (const beta of [-0.8, -0.6, 0, 0.6, 0.8]) {
      for (const angle of [0, Math.PI / 3, Math.PI / 2, Math.PI]) {
        const factors = lightComplexFactors(beta, angle);
        const values = {
          V: 10,
          v: 10 * beta,
          "\\varphi": angle,
          A: amplitude,
          "A'": amplitude * factors.amplitudeFactor,
          S: volume,
          "S'": volume * factors.volumeFactor,
          E: energy,
          "E'": energy * factors.energyFactor,
        };
        close(evaluate("eq-s8-d4", "row1.left", values), factors.energyFactor);
        close(evaluate("eq-s8-d4", "row1.right", values), factors.energyFactor);
        close(evaluate("eq-s8-d4", "row2.right", values), factors.energyFactor);
      }
    }
    close(evaluate("eq-s8-d4", "row2.right", { V: 10, v: 6, "\\varphi": 0 }), 0.5);
    close(evaluate("eq-s8-d4", "row2.right", { V: 10, v: 6, "\\varphi": Math.PI }), 2);
    const wrongVolume = {
      A: amplitude,
      "A'": amplitude * 0.5,
      S: volume,
      "S'": volume * 0.8,
    };
    close(evaluate("eq-s8-d4", "row1.right", wrongVolume), 0.2);
    expect(
      withinTolerance(evaluate("eq-s8-d4", "row1.right", wrongVolume), 0.5, { absolute: 1e-12 }).ok,
    ).toBe(false);
  });
});

describe("source meaning cannot be exchanged for dimensionally plausible alternatives", () => {
  test("same-owner direction and position components must retain their exact mathematical positions", () => {
    for (const [id, first, second] of [
      ["eq-s8-d1", "a", "b"],
      ["eq-s8-d1", "x", "y"],
      ["eq-s8-d2", "a", "c"],
      ["eq-s8-d2", "\\xi", "\\eta"],
    ] as const) {
      const original = display(id);
      const changed = exchangeGlyphs(original, first, second);
      expect(changed.latex).not.toBe(original.latex);
      expect(changed.terms.map((term) => term.quantityId)).toEqual(
        original.terms.map((term) => term.quantityId),
      );
      for (const { tree } of parse(changed).rows)
        expect(dimension(tree)).toEqual(["2", "0", "0", "0", "0", "0"]);
      expect(() => compilePrintedDisplay(changed)).not.toThrow();
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(original)).not.toThrow();
    }
  });

  test("stationary/moving energy, amplitude, volume, direction and speed owners cannot be swapped", () => {
    for (const [id, first, second] of [
      ["eq-s8-d4", "lightComplexEnergyMoving", "lightComplexEnergyStationary"],
      ["eq-s8-d4", "lightAmplitudeMoving", "lightAmplitudeStationary"],
      ["eq-s8-d4", "lightComplexVolumeMoving", "lightComplexVolumeStationary"],
      ["eq-s8-d4", "frameSpeed", "speedOfLight"],
      ["eq-s8-d2", "frameSpeed", "speedOfLight"],
    ] as const) {
      const original = display(id);
      assert(original.terms.some((term) => term.quantityId === first));
      assert(original.terms.some((term) => term.quantityId === second));
      const changed = {
        ...original,
        terms: original.terms.map((term) => ({
          ...term,
          quantityId:
            term.quantityId === first
              ? second
              : term.quantityId === second
                ? first
                : term.quantityId,
        })),
      };
      expect([...new Set(changed.terms.map((term) => term.quantityId))].sort()).toEqual(
        [...new Set(original.terms.map((term) => term.quantityId))].sort(),
      );
      for (const { tree } of parse(changed).rows) expect(() => dimension(tree)).not.toThrow();
      refuses(() => compile(changed), "printed-source-operation");
    }
    for (const [id, from, to] of [
      ["eq-s8-d1", "coordinateTimeStationary", "coordinateTimeMoving"],
      ["eq-s8-d2", "directionCosineStationary", "directionCosineMoving"],
      ["eq-s8-d4", "propagationAngleStationary", "propagationAngleMoving"],
      ["eq-s8-d4", "lightComplexEnergyMoving", "bodyEnergyMovingBefore"],
    ] as const) {
      const original = display(id);
      assert(original.terms.some((term) => term.quantityId === from));
      const changed = {
        ...original,
        terms: original.terms.map((term) =>
          term.quantityId === from ? { ...term, quantityId: to } : term,
        ),
      };
      for (const { tree } of parse(changed).rows) expect(() => dimension(tree)).not.toThrow();
      refuses(() => compile(changed), "printed-source-operation");
    }
  });

  test("signs, Gaussian coefficients, squared powers and the cosine reading cannot silently change", () => {
    for (const id of ["eq-s8-d1", "eq-s8-d2", "eq-s8-d4"])
      refuses(() => compile(replace(display(id), " - ", " + ")), "printed-source-operation");
    refuses(
      () => compile(replace(display("eq-s8-d4"), "8\\pi", "4\\pi")),
      "printed-source-operation",
    );
    refuses(
      () => compile(replace(display("eq-s8-d4"), "\\cos", "\\lg")),
      "printed-source-operation",
    );
    for (const id of ["eq-s8-d1", "eq-s8-d2", "eq-s8-d4"])
      refuses(() => compile(replace(display(id), "^2", "^4")), "printed-source-dimension");
  });

  test("malformed, mixed and nested relation chains remain outside the source grammar", () => {
    const value = display("eq-s8-d4");
    for (const [from, to, last] of [
      [" = ", " = = ", false],
      [" = ", " = = ", true],
      [" = ", " \\leqq ", false],
      [" = ", " \\leqq ", true],
      [" ,", " = ,", true],
      ["\\sqrt{1 - ", "\\sqrt{1 = ", false],
      [" ,", " , \\int", true],
    ] as const) {
      const changed = replace(value, from, to, last);
      expect(changed.latex).not.toBe(value.latex);
      refuses(() => parse(changed), "printed-expression-unsupported");
    }
    const extraEquality = replace(value, " ,", " = 1 ,", true);
    expect(parse(extraEquality).continuationRows).toEqual([1, 2]);
    refuses(() => compile(extraEquality), "printed-source-dimension");
    expect(() => compile(value)).not.toThrow();
  });

  test("the new chain grammar is unavailable to unrelated guides or unselected source displays", () => {
    const volume = display("eq-s8-d3");
    const chain = replace(volume, " .", " = 1 .", true);
    refuses(() => parse(chain), "printed-expression-unsupported");
    refuses(() => compile(chain), "printed-expression-unsupported");
    expect(() => compile(volume)).not.toThrow();
    for (const id of ["eq-s7-d1", "eq-s7-d2", "eq-s8-d6"])
      expect(
        compilePrintedSourceSemantics(display(id), compilePrintedDisplay(display(id)), quantities),
      ).toBeUndefined();
  });
});

describe("readers can follow the complete light-complex source argument", () => {
  test("each new source has a permanent no-JavaScript operation reference and a meaningful next argument", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of Object.keys(RELATIVITY_LIGHT_COMPLEX_GUIDES)) {
      const variants = result.displays.filter((value) => value.display === id);
      expect(variants.length).toBeGreaterThan(0);
      for (const value of variants) {
        assert(value.semantics);
        const html = renderToStaticMarkup(
          <PrintedDisplayTerms display={value} inline={false}>
            <span>Source equation</span>
          </PrintedDisplayTerms>,
        );
        expect(html).toContain('href="/equations/special-relativity/' + id + '/#operations"');
        expect(html).not.toContain("<select");
        const reference = renderToStaticMarkup(
          <PrintedOperationReference reading={value.semantics} spoken={value.spoken} />,
        );
        expect(reference).toContain("Read it aloud");
        expect(reference).toContain("Why this is allowed.");
        for (const operation of value.semantics.operations) {
          expect(reference).toContain('id="operation-' + operation.id + '"');
          expect(reference).toContain('href="/foundations/' + operation.foundation + '/"');
        }
        expect(reference).toContain(value.semantics.next.href);
      }
    }
  });

  test("the live explorer selects one frame's density-volume product and the second equality independently", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s8-d4");
    assert(value?.semantics);
    const product = value.semantics.operations.find(
      (operation) => operation.path === "row1.right.numerator",
    );
    const equality = value.semantics.operations.find((operation) => operation.path === "row2");
    assert(product && equality);
    await installDom();
    setLiveRegionElement(null);
    clearAnnouncement();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <PrintedDisplayTerms display={value} inline={false}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted checked source compiler output is the subject of this reader test. */}
            <span dangerouslySetInnerHTML={{ __html: value.html }} />
          </PrintedDisplayTerms>,
        ),
      );
      const toggle = container.querySelector<HTMLAnchorElement>(".printed-operation-toggle");
      assert(toggle);
      await act(async () => {
        toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      const select = container.querySelector<HTMLSelectElement>(".printed-operation-choice select");
      assert(select);
      for (const operation of [product, equality]) {
        await act(async () => {
          select.value = operation.id;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(
          container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
        ).toBe(operation.id);
        expect(getLastAnnouncement()).toContain(operation.does);
        const selectedTerms = [
          ...container.querySelectorAll("[data-term][data-operation-selected]"),
        ].map((element) => element.getAttribute("data-term"));
        expect(selectedTerms.sort()).toEqual([...operation.termIds].sort());
        const owners = value.terms
          .filter((term) => selectedTerms.includes(term.termId))
          .map((term) => term.quantityId);
        if (operation === product) {
          expect(owners.sort()).toEqual(["lightAmplitudeMoving", "lightComplexVolumeMoving"]);
          expect(container.textContent).toContain("energy density");
        } else {
          expect(owners).toContain("propagationAngleStationary");
          expect(owners).toContain("frameSpeed");
          expect(owners).not.toContain("lightComplexEnergyMoving");
          expect(container.textContent).toContain("same E prime/E ratio");
        }
      }
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
