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
import { transformSI } from "../../physics/reference/fields.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { walk } from "../ast.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real source bindings must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const IDS = ["eq-s6-d5", "eq-s6-d6", "eq-s6-d7", "eq-s6-d8"];
const FIELD = ["-1/2", "1/2", "-1", "0", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((entry) => entry.display === id);
  assert(value, "The checked source contains " + id);
  return value;
}
function parse(value: CheckedDisplay) {
  const guide = RELATIVITY_OPERATION_GUIDES[value.display];
  return parseSourceExpression(value, guide?.symbolIndices, guide?.allowChainedRelations, {
    allowAlignedColumns: guide?.allowAlignedColumns ?? false,
    ...(guide?.functionQuantities ? { functionQuantities: guide.functionQuantities } : {}),
  });
}
function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected source display must carry its operation guide.");
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
function close(actual: number, expected: number) {
  expect(withinTolerance(actual, expected, { absolute: 1e-12, relative: 1e-12 }).ok).toBe(true);
}

/** Mutate non-term source, moving checked offsets with it so the intended change is examined. */
function replace(value: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const at = value.latex.indexOf(from);
  assert(at >= 0 && from !== to, "A planted change must touch real source.");
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

/** Keep every binding valid while exchanging actual same-owner component glyphs. */
function exchangeGlyphs(value: CheckedDisplay, first: string, second: string): CheckedDisplay {
  assert(value.terms.some((term) => term.glyph === first));
  assert(value.terms.some((term) => term.glyph === second));
  let latex = "";
  let cursor = 0;
  const terms = value.terms.map((term) => {
    assert(value.latex.slice(term.start, term.end) === term.glyph);
    const glyph = term.glyph === first ? second : term.glyph === second ? first : term.glyph;
    latex += value.latex.slice(cursor, term.start);
    const start = latex.length;
    latex += glyph;
    cursor = term.end;
    return { ...term, glyph, start, end: latex.length };
  });
  return { ...value, latex: latex + value.latex.slice(cursor), terms };
}

function evaluateRows(value: CheckedDisplay, values: Readonly<Record<string, number>>) {
  const bindings = Object.fromEntries(
    value.terms.map((term) => {
      const number = values[term.glyph];
      assert(number !== undefined, "The numeric comparison supplies " + term.glyph);
      return [term.termId, number];
    }),
  );
  return parse(value).rows.map(({ tree }) => {
    assert(tree.kind === "relation");
    return evaluateExpression(tree.right, bindings);
  });
}

describe("the actual printed section 6 field equations", () => {
  test("the four selected displays preserve source MathML and every term while gaining independent operation targets", () => {
    for (const id of IDS) {
      const value = display(id);
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.operations.some((operation) => operation.primary)).toBe(true);
      const ids = built.semantics.operations.map((operation) => operation.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const operationId of ids) {
        expect(built.html).toContain(`data-op="${operationId}"`);
        expect(value.terms.some((term) => term.termId === operationId)).toBe(false);
      }
      for (const term of value.terms) expect(built.html).toContain(`data-term="${term.termId}"`);
      const physicalTerms = sourceNodes(parse(value)).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree.termId] : [],
      );
      expect(physicalTerms.sort()).toEqual(value.terms.map((term) => term.termId).sort());
    }
  });

  test("the unnormalized field table keeps the source's left-to-right order and all six frame-tagged components", () => {
    for (const id of ["eq-s6-d5"]) {
      const parsed = parse(display(id));
      expect(parsed.continuationRows).toEqual([]);
      expect(
        parsed.rows.map(({ tree }) => {
          assert(tree.kind === "relation" && tree.left.kind === "symbol");
          return [tree.left.quantityId, tree.left.index];
        }),
      ).toEqual([
        ["electricFieldMoving", "x"],
        ["magneticFieldMoving", "x"],
        ["electricFieldMoving", "y"],
        ["magneticFieldMoving", "y"],
        ["electricFieldMoving", "z"],
        ["magneticFieldMoving", "z"],
      ]);
      for (const { tree } of parsed.rows) {
        const dimension = checkDimensions(tree, sourceDimensionRegistry(quantities), {
          context: "gaussian-cgs",
        });
        assert(dimension.status === "consistent");
        expect(
          dimension.dimension.map(({ num, den }) =>
            String(den) === "1" ? String(num) : `${num}/${den}`,
          ),
        ).toEqual(FIELD);
      }
    }
  });

  test("psi(v) and phi(-v) are dimensionless function values, with the argument's sign retained", () => {
    for (const id of ["eq-s6-d5", "eq-s6-d6", "eq-s6-d7", "eq-s6-d8"]) {
      const built = compile(display(id));
      const applications = sourceNodes(parse(display(id))).filter(
        ({ node }) => node.tree.kind === "symbol" && node.tree.at,
      );
      expect(applications.length).toBeGreaterThan(0);
      for (const { path, node } of applications) {
        assert(node.tree.kind === "symbol" && node.tree.at);
        expect(node.tree.quantityId).toBe("fieldScaleFactorUnknown");
        expect(
          walk(node.tree.at)
            .filter((n) => n.kind === "symbol")
            .map((n) => n.quantityId),
        ).toEqual(["frameSpeed"]);
        expect(
          built.semantics.operations.find((op) => op.path === path)?.dimensionExponents,
        ).toEqual(DIMENSIONLESS);
      }
    }
    const reverse = sourceNodes(parse(display("eq-s6-d6"))).find(
      ({ path }) => path === "row1.left.args.1.at",
    );
    expect(reverse?.node.tree.kind).toBe("negate");
    expect(compile(display("eq-s6-d6")).semantics.roundTrip.canonicalLatex).toContain(
      "\\varphi\\left(-",
    );
    const factor = compile(display("eq-s6-d5")).semantics;
    expect(factor.premise).toContain("still undetermined");
    for (const id of ["eq-s6-d6", "eq-s6-d7", "eq-s6-d8"]) {
      const normalized = compile(display(id)).semantics;
      expect(normalized.premise).toContain("identity at rest");
      expect(normalized.premise).toContain("continuity");
      expect(normalized.premise).toContain("Gaussian");
    }
  });

  test("the unnormalized field equations agree with the field owner times the common scale", () => {
    // A normalized comparison: keep one electric scale and represent each magnetic value
    // by c * B_SI. This is not a literal conversion from gauss/statvolt to SI units.
    const V = 3.2;
    for (const beta of [-0.8, -0.3, 0, 0.6, 0.9]) {
      for (const [E, B] of [
        [
          { x: 1.2, y: -2.3, z: 0.7 },
          { x: -0.6, y: 0.4, z: 1.8 },
        ],
        [
          { x: 0, y: 3, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: -2, z: 0 },
        ],
      ]) {
        assert(E && B);
        const actual = transformSI({
          E,
          B: { x: B.x / V, y: B.y / V, z: B.z / V },
          boost: beta * V,
          c: V,
        });
        const values = {
          X: E.x,
          Y: E.y,
          Z: E.z,
          L: B.x,
          M: B.y,
          N: B.z,
          V,
          v: beta * V,
          "\\beta": actual.gamma,
          "X'": actual.E.x,
          "Y'": actual.E.y,
          "Z'": actual.E.z,
          "L'": actual.B.x * V,
          "M'": actual.B.y * V,
          "N'": actual.B.z * V,
        };
        const expected = [
          values["X'"],
          values["L'"],
          values["Y'"],
          values["M'"],
          values["Z'"],
          values["N'"],
        ];
        const scale = 2.3;
        for (const [i, value] of evaluateRows(display("eq-s6-d5"), {
          ...values,
          "\\psi": scale,
        }).entries())
          close(value, scale * expected[i]!);
      }
    }
  });
});

describe("incorrect field meanings cannot inherit the source explanations", () => {
  test("dimensionally valid component swaps, field-frame swaps and a change to the coordinate-scale owner are refused", () => {
    for (const id of ["eq-s6-d5"]) {
      for (const [first, second] of [
        ["Y", "Z"],
        ["M", "N"],
        ["Y'", "Z'"],
      ]) {
        assert(first && second);
        const changed = exchangeGlyphs(display(id), first, second);
        expect(changed.latex).not.toBe(display(id).latex);
        for (const { tree } of parse(changed).rows)
          expect(
            checkDimensions(tree, sourceDimensionRegistry(quantities), { context: "gaussian-cgs" })
              .status,
          ).toBe("consistent");
        refuses(() => compile(changed), "printed-source-operation");
      }
    }
    for (const [id, from, to] of [
      ["eq-s6-d5", "electricFieldMoving", "electricFieldStationary"],
      ["eq-s6-d5", "magneticFieldStationary", "electricFieldStationary"],
      ["eq-s6-d5", "frameSpeed", "speedOfLight"],
      ["eq-s6-d5", "fieldScaleFactorUnknown", "scaleFactorUnknown"],
    ]) {
      assert(id && from && to);
      const original = display(id);
      assert(original.terms.some((term) => term.quantityId === from));
      const changed = {
        ...original,
        terms: original.terms.map((term) =>
          term.quantityId === from ? { ...term, quantityId: to } : term,
        ),
      };
      refuses(() => compile(changed), "printed-source-operation");
    }
  });

  test("a lost mixing sign, a negated scale value, and a different normalization fail the operation contract", () => {
    for (const id of ["eq-s6-d5"]) {
      for (const [from, to] of [
        [" - ", " + "],
        [" + ", " - "],
      ]) {
        assert(from && to);
        refuses(() => compile(replace(display(id), from, to)), "printed-source-operation");
      }
    }
    for (const id of ["eq-s6-d6", "eq-s6-d7"]) {
      refuses(() => compile(replace(display(id), "(-", "(")), "printed-source-operation");
    }
    for (const id of ["eq-s6-d6", "eq-s6-d8"]) {
      refuses(() => compile(replace(display(id), "= 1", "= 2")), "printed-source-operation");
    }
    expect(() => compile(display("eq-s6-d5"))).not.toThrow();
  });

  test("omitting Gaussian dimensions cannot certify the source's mixed field expressions", () => {
    const value = display("eq-s6-d5");
    for (const quantityId of [
      "electricFieldStationary",
      "electricFieldMoving",
      "magneticFieldStationary",
      "magneticFieldMoving",
    ]) {
      const quantity = quantities.get(quantityId);
      assert(quantity?.gaussianDimension);
      const { gaussianDimension: omitted, ...withoutGaussian } = quantity;
      assert(omitted);
      refuses(
        () =>
          compilePrintedSourceSemantics(
            value,
            compilePrintedDisplay(value),
            new Map(quantities).set(quantityId, withoutGaussian),
          ),
        "printed-source-dimension",
      );
    }
  });

  test("column and function syntax is explicitly selected, and derivative displays remain unclaimed", () => {
    const table = display("eq-s6-d5");
    refuses(() => parseSourceExpression(table), "printed-expression-unsupported");
    refuses(() => parse(replace(table, "&\\qquad", "&\\quad")), "printed-expression-unsupported");
    const application = display("eq-s6-d8");
    // Without a declaration, adjacent coefficient-and-parenthesis syntax retains multiplication.
    const unselected = parseSourceExpression(application).rows[0]?.tree;
    assert(unselected?.kind === "relation");
    expect(unselected.left.kind).toBe("product");
    expect(walk(unselected).some((node) => node.kind === "symbol" && node.at)).toBe(false);
    for (const [from, to] of [
      ["(", "["],
      [")", ",)"],
      [")", " + 1)"],
    ]) {
      assert(from && to);
      const changed = replace(application, from, to);
      if (to === " + 1)") refuses(() => compile(changed), "printed-source-operation");
      else refuses(() => parse(changed), "printed-expression-unsupported");
    }
    for (const id of ["eq-s6-d1", "eq-s6-d2", "eq-s6-d4"]) {
      const value = display(id);
      expect(
        compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities),
      ).toBeUndefined();
      refuses(() => parse(value), "printed-expression-unsupported");
    }
  });
});

describe("readers can inspect the printed fields with or without JavaScript", () => {
  test("all selected displays reach permanent operation references with their premises and prerequisite links", async () => {
    // Reader components import generated payloads. Core source/compiler cases above can run
    // independently; these UI cases still require the real generation output when selected.
    const [{ PrintedDisplayTerms }, { PrintedOperationReference }] = await Promise.all([
      import("../../reader/faces/PrintedDisplayTerms.tsx"),
      import("../../reader/faces/PrintedOperationReference.tsx"),
    ]);
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of IDS) {
      const value = result.displays.find((item) => item.display === id);
      assert(value?.semantics);
      const html = renderToStaticMarkup(
        <PrintedDisplayTerms display={value} inline={false}>
          <span>Source equation</span>
        </PrintedDisplayTerms>,
      );
      expect(html).toContain(`href="/equations/special-relativity/${id}/#operations"`);
      expect(html).not.toContain("<select");
      const reference = renderToStaticMarkup(
        <PrintedOperationReference reading={value.semantics} spoken={value.spoken} />,
      );
      expect(reference).toContain("same event");
      expect(reference).toContain("Gaussian");
      expect(reference).toContain("/papers/special-relativity/s6/#sr-field-derivation");
      for (const operation of value.semantics.operations) {
        expect(reference).toContain(`id="operation-${operation.id}"`);
        expect(reference).toContain(`href="/foundations/${operation.foundation}/"`);
      }
    }
  });

  test("the explorer selects one scale application and a second-column field mixture without conflating term ids", async () => {
    const { PrintedDisplayTerms } = await import("../../reader/faces/PrintedDisplayTerms.tsx");
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s6-d5");
    assert(value?.semantics);
    const scale = value.semantics.operations.find(
      (operation) => operation.path === "row1.right.args.0",
    );
    const magnetic = value.semantics.operations.find(
      (operation) => operation.path === "row4.right.args.2.argument",
    );
    assert(scale && magnetic);
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
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the trusted source compiler output is the subject of this reader test. */}
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
      for (const operation of [scale, magnetic]) {
        await act(async () => {
          select.value = operation.id;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(
          container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
        ).toBe(operation.id);
        expect(getLastAnnouncement()).toContain(operation.does);
        const terms = [...container.querySelectorAll("[data-term][data-operation-selected]")].map(
          (element) => element.getAttribute("data-term"),
        );
        expect(terms.sort()).toEqual([...operation.termIds].sort());
        const owners = value.terms
          .filter((term) => terms.includes(term.termId))
          .map((term) => term.quantityId);
        if (operation === scale)
          expect(owners.sort()).toEqual(["fieldScaleFactorUnknown", "frameSpeed"]);
        else {
          expect(owners).toContain("magneticFieldStationary");
          expect(owners).toContain("electricFieldStationary");
          expect(owners).not.toContain("fieldScaleFactorUnknown");
          expect(owners).not.toContain("magneticFieldMoving");
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
