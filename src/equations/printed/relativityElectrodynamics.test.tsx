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
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { transformGaussianHistorical } from "../../physics/reference/fields.ts";
import { PrintedDisplayTerms } from "../../reader/faces/PrintedDisplayTerms.tsx";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_ELECTRODYNAMICS_GUIDES } from "./relativityElectrodynamics.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real relativity source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const ids = ["eq-s6-d3", ...Object.keys(RELATIVITY_ELECTRODYNAMICS_GUIDES)];
const selected = checked.displays.filter((value) => ids.includes(value.display));
const FIELD = ["-1/2", "1/2", "-1", "0", "0", "0"];
const TIME = ["0", "0", "1", "0", "0", "0"];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((item) => item.display === id);
  assert(value, "The checked source contains " + id);
  return value;
}

function parse(value: CheckedDisplay) {
  const guide = RELATIVITY_OPERATION_GUIDES[value.display];
  return parseSourceExpression(value, guide?.symbolIndices, guide?.allowChainedRelations, {
    allowAlignedColumns: guide?.allowAlignedColumns ?? false,
  });
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected source display must have an authored operation guide.");
  return result;
}

function close(actual: number, expected: number): void {
  expect(Number.isFinite(actual)).toBe(true);
  expect(withinTolerance(actual, expected, { absolute: 1e-11, relative: 1e-12 }).ok).toBe(true);
}

function closeValues(actual: readonly number[], expected: readonly number[]): void {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, index) => close(value, expected[index]!));
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

/** Change only unbound source syntax, retaining exact offsets of every physical occurrence. */
function replace(value: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const at = value.latex.indexOf(from);
  assert(at >= 0, "The planted source mutation must change a real occurrence.");
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

/**
 * Equal-dimension components keep their quantity owners, so only a checked axis can refuse this.
 */
function exchangeGlyphs(value: CheckedDisplay, first: string, second: string): CheckedDisplay {
  assert(value.terms.some((term) => term.glyph === first));
  assert(value.terms.some((term) => term.glyph === second));
  let latex = "";
  let cursor = 0;
  const terms = value.terms.map((term) => {
    assert(value.latex.slice(term.start, term.end) === term.glyph);
    latex += value.latex.slice(cursor, term.start);
    const glyph = term.glyph === first ? second : term.glyph === second ? first : term.glyph;
    const start = latex.length;
    latex += glyph;
    cursor = term.end;
    return { ...term, glyph, start, end: latex.length };
  });
  return { ...value, latex: latex + value.latex.slice(cursor), terms };
}

function rhs(id: string, glyphValues: Readonly<Record<string, number>>): number[] {
  const value = display(id);
  const bindings = Object.fromEntries(
    value.terms.flatMap((term) =>
      glyphValues[term.glyph] === undefined ? [] : [[term.termId, glyphValues[term.glyph]!]],
    ),
  );
  return parse(value).rows.map(({ tree }) => {
    assert(tree.kind === "relation");
    const result = evaluateExpression(tree.right, bindings);
    assert(Number.isFinite(result), "The chosen physical fixture must remain within its domain.");
    return result;
  });
}

describe("the printed field transformations and electron prediction", () => {
  test("every authored source variant retains its source, MathML, terms and nested operations", () => {
    expect(ids.length).toBe(4);
    for (const id of ids) expect(selected.some((value) => value.display === id)).toBe(true);
    let operationCount = 0;
    let termCount = 0;
    for (const value of selected) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.dimensionStatus).toBe("consistent");
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      if (built.semantics.roundTrip.status === "typography-exception")
        expect(built.semantics.roundTrip.reason).toContain("original source typography");
      const physical = sourceNodes(parse(value)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree.termId] : [],
      );
      expect(physical.sort()).toEqual(value.terms.map((term) => term.termId).sort());
      expect(new Set(physical).size).toBe(value.terms.length);
      const operations = built.semantics.operations;
      expect(operations.length).toBeGreaterThan(0);
      expect(new Set(operations.map((operation) => operation.id)).size).toBe(operations.length);
      for (const operation of operations)
        expect(built.html).toContain('data-op="' + operation.id + '"');
      for (const term of value.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      operationCount += operations.length;
      termCount += value.terms.length;
    }
    console.info(
      JSON.stringify({
        event: "printed-electrodynamics-source-coverage",
        displays: ids.length,
        sourceVariants: selected.length,
        operations: operationCount,
        terms: termCount,
      }),
    );
  });

  test("adjacent equalities are independent rows with the correct field, time and length dimensions", () => {
    const fields = compile(display("eq-s6-d9")).semantics;
    const electron = compile(display("eq-s10-d3")).semantics;
    expect(fields.rows.length).toBe(6);
    expect(electron.rows.length).toBe(7);
    expect(fields.continuationRows).toEqual([]);
    expect(electron.continuationRows).toEqual([]);
    const dimensions = (reading: typeof fields) =>
      reading.operations
        .filter((operation) => /^row\d+$/.test(operation.path))
        .map((operation) => operation.dimensionExponents);
    expect(dimensions(fields)).toEqual([FIELD, FIELD, FIELD, FIELD, FIELD, FIELD]);
    expect(dimensions(electron)).toEqual([TIME, LENGTH, FIELD, LENGTH, FIELD, LENGTH, FIELD]);
    expect(fields.premise).toContain("Gaussian");
    expect(fields.premise).toContain("covariance alone did not fix it");
    expect(electron.premise).toContain("instantaneously comoving");
    expect(electron.premise).toContain("same event");
  });

  test("the source agrees with the Gaussian physics owner, preserves both invariants, and reverses the boost", () => {
    const E = { x: 3, y: -5, z: 7 };
    const B = { x: -11, y: 13, z: -17 };
    const c = 5;
    for (const ratio of [-0.8, -0.6, 0, 0.6, 0.8]) {
      const v = c * ratio;
      const expected = transformGaussianHistorical({ E, B, boost: v, c });
      const transformed = rhs("eq-s6-d9", {
        X: E.x,
        Y: E.y,
        Z: E.z,
        L: B.x,
        M: B.y,
        N: B.z,
        v,
        V: c,
        "\\beta": expected.beta,
      });
      closeValues(transformed, [
        expected.E.x,
        expected.B.x,
        expected.E.y,
        expected.B.y,
        expected.E.z,
        expected.B.z,
      ]);
      const [ex, bx, ey, by, ez, bz] = transformed;
      assert(ex !== undefined && ey !== undefined && ez !== undefined);
      assert(bx !== undefined && by !== undefined && bz !== undefined);
      close(
        ex ** 2 + ey ** 2 + ez ** 2 - bx ** 2 - by ** 2 - bz ** 2,
        E.x ** 2 + E.y ** 2 + E.z ** 2 - B.x ** 2 - B.y ** 2 - B.z ** 2,
      );
      close(ex * bx + ey * by + ez * bz, E.x * B.x + E.y * B.y + E.z * B.z);
      closeValues(
        rhs("eq-s6-d9", {
          X: ex,
          Y: ey,
          Z: ez,
          L: bx,
          M: by,
          N: bz,
          v: -v,
          V: c,
          "\\beta": expected.beta,
        }),
        [E.x, B.x, E.y, B.y, E.z, B.z],
      );
    }
  });

  test("the instantaneous-rest-frame table transforms one event and its electric field", () => {
    const values = {
      t: 5,
      x: 4,
      y: 2,
      z: -3,
      X: 3,
      Y: -5,
      Z: 7,
      M: 13,
      N: -17,
      v: 0.6,
      V: 1,
      "\\beta": 1.25,
    };
    const transformed = rhs("eq-s10-d3", values);
    closeValues(transformed, [3.25, 1.25, 3, 2, 6.5, -3, 18.5]);
    close(
      transformed[0]! ** 2 - transformed[1]! ** 2 - transformed[3]! ** 2 - transformed[5]! ** 2,
      values.t ** 2 - values.x ** 2 - values.y ** 2 - values.z ** 2,
    );
    const inverse = rhs("eq-s10-d3", {
      ...values,
      t: transformed[0]!,
      x: transformed[1]!,
      v: -values.v,
    });
    close(inverse[0]!, values.t);
    close(inverse[1]!, values.x);
  });

  test("the repeated beta definition remains the Lorentz factor, including a reversed boost", () => {
    for (const ratio of [-0.8, 0, 0.6]) {
      const value = rhs("eq-s6-d3", { v: ratio, V: 1 })[0]!;
      close(value, 1 / Math.sqrt(1 - ratio ** 2));
      expect(value).toBeGreaterThanOrEqual(1);
    }
    expect(compile(display("eq-s6-d3")).semantics.context).toContain("not the speed ratio");
  });

  test("magnetic curvature has length units, Gaussian normalization and the Newtonian limit", () => {
    const values = { V: 10, "\\mu": 2, "\\varepsilon": 3, v: 6, N: 5 };
    const radius = rhs("eq-s10-d12", values)[0]!;
    close(radius, (1.25 * 2 * 6 * 10) / (3 * 5));
    close(rhs("eq-s10-d12", { ...values, N: 10 })[0]!, radius / 2);
    close(rhs("eq-s10-d12", { ...values, "\\mu": 4 })[0]!, 2 * radius);
    close(rhs("eq-s10-d12", { ...values, "\\varepsilon": 6 })[0]!, radius / 2);
    const slow = { ...values, v: 0.001 };
    const newtonian = (slow["\\mu"] * slow.v * slow.V) / (slow["\\varepsilon"] * slow.N);
    close(
      rhs("eq-s10-d12", slow)[0]! / newtonian,
      1 / Math.sqrt(1 - (slow.v / slow.V) ** 2),
    );
    const reading = compile(display("eq-s10-d12")).semantics;
    expect(
      reading.operations.find((operation) => operation.path === "row1")?.dimensionExponents,
    ).toEqual(LENGTH);
    expect(reading.premise).toContain("At zero field");
    expect(reading.premise).toContain("magnitudes");
  });
});

describe("the interpretation refuses changed physical meaning", () => {
  test("a reversed printed subtraction cannot inherit a field, time or radius explanation", () => {
    for (const id of ["eq-s6-d9", "eq-s10-d3", "eq-s10-d12"])
      refuses(() => compile(replace(display(id), " - ", " + ")), "printed-source-operation");
  });

  test("equal-dimension component swaps cannot hide behind a shared vector quantity", () => {
    for (const [id, first, second] of [
      ["eq-s6-d9", "M", "N"],
      ["eq-s6-d9", "Y'", "Z'"],
      ["eq-s10-d3", "y", "z"],
    ] as const)
      refuses(
        () => compile(exchangeGlyphs(display(id), first, second)),
        "printed-source-operation",
      );
  });

  test("wrong light-speed powers and altered literal factors are refused", () => {
    refuses(
      () => compile(replace(display("eq-s10-d12"), "^2", "^4")),
      "printed-source-dimension",
    );
    refuses(
      () => compile(replace(display("eq-s10-d12"), "{1}", "{2}")),
      "printed-source-operation",
    );
    refuses(
      () => compile(replace(display("eq-s6-d3"), "^2", "^4")),
      "printed-source-operation",
    );
  });

  test("undefined deflectability dimensions and literal source misprints are not silently certified", () => {
    for (const id of ["eq-s10-d4", "eq-s10-d8", "eq-s10-d9"]) {
      const value = display(id);
      expect(
        compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities),
      ).toBeUndefined();
    }
    expect(display("eq-s10-d4").latex).toContain("\\mu \\beta^3 \\frac{d^2 z}");
    expect(display("eq-s10-d8").latex).toContain("\\int_0^v \\beta^3 v d v");
    expect(quantities.get("magneticDeflectability")?.dimensionStatus).toBe("undefined-in-source");
    expect(quantities.get("electricDeflectability")?.dimensionStatus).toBe("undefined-in-source");
  });
});

describe("source-reader access to electrodynamics operations", () => {
  test("every added display has a complete no-script reference and an onward science route", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of ids) {
      const values = result.displays.filter((value) => value.display === id);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
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
        expect(reference).toContain(value.semantics.next.href);
        expect(reference).toContain("does not prove a");
        for (const operation of value.semantics.operations) {
          expect(reference).toContain('id="operation-' + operation.id + '"');
          expect(reference).toContain('href="/foundations/' + operation.foundation + '/"');
        }
      }
    }
  });

  test("the live explorer selects only the physical terms of each adjacent field operation", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s6-d9");
    assert(value?.semantics);
    const source = checked?.displays.find(
      (item) => item.display === value.display && item.latex === value.latex,
    );
    assert(source, "The reader payload must retain an exact checked source variant.");
    const selections = [
      ["row3.right.args.1.argument", ["Y", "v", "V", "N"]],
      ["row4.right.args.1.argument", ["M", "v", "V", "Z"]],
    ] as const;
    await installDom();
    setLiveRegionElement(null);
    clearAnnouncement();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          <PrintedDisplayTerms display={value} inline={false}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted checked source compiler output is the subject of this reader test. */}
            <span dangerouslySetInnerHTML={{ __html: value.html }} />
          </PrintedDisplayTerms>,
        );
      });
      const toggle = container.querySelector<HTMLAnchorElement>(".printed-operation-toggle");
      assert(toggle);
      await act(async () => {
        toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      const select = container.querySelector<HTMLSelectElement>(".printed-operation-choice select");
      assert(select);
      for (const [path, glyphs] of selections) {
        const operation = value.semantics.operations.find((item) => item.path === path);
        assert(operation);
        await act(async () => {
          select.value = operation.id;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(
          container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
        ).toBe(operation.id);
        expect(getLastAnnouncement()).toContain(operation.does);
        const terms = [...container.querySelectorAll("[data-term][data-operation-selected]")]
          .map((element) => element.getAttribute("data-term"))
          .sort();
        expect(terms).toEqual([...operation.termIds].sort());
        expect(
          source.terms.filter((term) => terms.includes(term.termId)).map((term) => term.glyph),
        ).toEqual([...glyphs]);
      }
    } finally {
      await act(async () => {
        root.unmount();
      });
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
