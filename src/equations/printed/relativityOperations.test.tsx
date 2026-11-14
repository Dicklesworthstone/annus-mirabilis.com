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
import { PrintedDisplayTerms } from "../../reader/faces/PrintedDisplayTerms.tsx";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real relativity source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const selected = checked.displays.filter((display) => RELATIVITY_OPERATION_GUIDES[display.display]);
const TIME = ["0", "0", "1", "0", "0", "0"];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];

function display(id: string): CheckedDisplay {
  const result = checked?.displays.find((value) => value.display === id);
  assert(result, `The checked source contains ${id}`);
  return result;
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "The selected source display must have an authored operation guide.");
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
  expect(caught).toMatchObject({ code });
  return (caught as Error).message;
}

const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

describe("the printed section 3 coordinate transformation", () => {
  test("the final transformation and both factor definitions opt in, without guessing the unknown scale", () => {
    for (const id of ["eq-s3-d16", "eq-s3-d25", "eq-s3-d26"])
      expect(selected.some((value) => value.display === id)).toBe(true);
    for (const value of selected) {
      const built = compile(value);
      expect(built.semantics.kind).toBe("validated-source-binding");
      expect(built.semantics.operations.some((operation) => operation.primary)).toBe(true);
    }
    const undetermined = display("eq-s3-d15");
    expect(
      compilePrintedSourceSemantics(undetermined, compilePrintedDisplay(undetermined), quantities),
    ).toBeUndefined();
  });

  test("time and position owners retain their frames, and vector components retain their printed glyphs", () => {
    const value = display("eq-s3-d25");
    const guide = RELATIVITY_OPERATION_GUIDES[value.display];
    assert(guide);
    const parsed = parseSourceExpression(value, guide.symbolIndices);
    expect(parsed.continuationRows).toEqual([]);
    const symbols = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree] : [],
    );
    expect(symbols.map(({ termId, quantityId }) => [termId, quantityId]).sort()).toEqual(
      value.terms.map(({ termId, quantityId }) => [termId, quantityId]).sort(),
    );
    for (const term of value.terms) {
      const symbol = symbols.find((entry) => entry.termId === term.termId);
      expect(symbol?.index).toBe(guide.symbolIndices[term.glyph]);
    }
    expect(
      parsed.rows.map(({ tree }) => {
        assert(tree.kind === "relation" && tree.left.kind === "symbol");
        return [tree.left.quantityId, tree.left.index];
      }),
    ).toEqual([
      ["coordinateTimeMoving", undefined],
      ["coordinatePositionMoving", "x"],
      ["coordinatePositionMoving", "y"],
      ["coordinatePositionMoving", "z"],
    ]);
    expect(quantities.get("coordinateTimeMoving")?.frame).toBe("moving-system");
    expect(quantities.get("coordinateTimeMoving")?.timeKind).toBe("coordinate");
    expect(quantities.get("coordinateTimeStationary")?.frame).toBe("stationary-system");
    expect(quantities.get("coordinatePositionMoving")?.frame).toBe("moving-system");
    expect(quantities.get("coordinatePositionStationary")?.frame).toBe("stationary-system");
    expect(symbols.some((entry) => entry.quantityId === "properTimeElapsed")).toBe(false);
    expect(symbols.some((entry) => entry.quantityId === "speedRatio")).toBe(false);
    expect(symbols.some((entry) => entry.quantityId === "auxiliaryGalileanCoordinate")).toBe(false);
    const canonical = compile(value).semantics.roundTrip.canonicalLatex;
    expect(canonical).toContain("\\xi");
    expect(canonical).toContain("\\eta = y");
    expect(canonical).toContain("\\zeta = z");
    expect(canonical).not.toContain("\\zeta = x");
  });

  test("every row is independently dimension checked, with time followed by three lengths", () => {
    const built = compile(display("eq-s3-d25"));
    const registry = sourceDimensionRegistry(quantities);
    const dimensions = built.semantics.rows.map((tree) => {
      const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
      assert(result.status === "consistent");
      return result.dimension.map(({ num, den }) =>
        String(den) === "1" ? String(num) : `${num}/${den}`,
      );
    });
    expect(dimensions).toEqual([TIME, LENGTH, LENGTH, LENGTH]);
    expect(built.semantics.dimension).toContain("row 1: time");
    for (const row of [2, 3, 4]) expect(built.semantics.dimension).toContain(`row ${row}: length`);
    const byPath = new Map(
      built.semantics.operations.map((operation) => [operation.path, operation]),
    );
    expect(byPath.get("row1.right.args.1.argument")?.dimensionExponents).toEqual(TIME);
    expect(
      byPath.get("row1.right.args.1.argument.args.1.argument.args.0")?.dimensionExponents,
    ).toEqual(["-1", "0", "1", "0", "0", "0"]);
    expect(byPath.get("row2.right.args.1.argument.args.1.argument")?.dimensionExponents).toEqual(
      LENGTH,
    );
    for (const id of ["eq-s3-d16", "eq-s3-d26"]) {
      const factor = compile(display(id));
      expect(
        factor.semantics.operations.every(
          (operation) => operation.dimensionExponents.join(",") === DIMENSIONLESS.join(","),
        ),
      ).toBe(true);
    }
  });

  test("the interpretation states synchronization, scale normalization, and the subluminal domain", () => {
    const transform = compile(display("eq-s3-d25")).semantics;
    expect(transform.premise).toContain("synchronizes its own clocks");
    expect(transform.premise).toContain("|v| < V");
    expect(transform.premise).toContain("not an elapsed proper time");
    expect(transform.premise).toContain("phi(v) = 1");
    expect(transform.premise).toContain("reciprocity");
    expect(transform.premise).toContain("spatial isotropy");
    expect(
      transform.operations.find((operation) => operation.path === "row2.right")?.why,
    ).toContain("not yet the moving coordinate xi");
    for (const id of ["eq-s3-d16", "eq-s3-d26"]) {
      const factor = compile(display(id)).semantics;
      expect(factor.operations.find((operation) => operation.path === "row1")?.does).toContain(
        "gamma",
      );
      expect(factor.operations.find((operation) => operation.path === "row1")?.why).toContain(
        "not the speed ratio",
      );
      expect(factor.operations.find((operation) => operation.path === "row1.right")?.why).toContain(
        "does not assign a finite value at light speed",
      );
    }
  });

  test("operation wrapping preserves the original MathML, source bytes, and every stable term identity", () => {
    for (const value of selected) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      const ids = built.semantics.operations.map((operation) => operation.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id.startsWith(`special-relativity.${value.display}.op.`)).toBe(true);
        expect(built.html).toContain(`data-op="${id}"`);
      }
      for (const term of value.terms) {
        expect(built.html).toContain(`data-term="${term.termId}"`);
        expect(built.html).toContain(`data-quantity-id="${term.quantityId}"`);
      }
    }
  });
});

describe("a changed source cannot inherit the coordinate explanation", () => {
  test("coordinate time cannot be rebound to proper time, nor Einstein's beta to a speed ratio", () => {
    const value = display("eq-s3-d25");
    for (const [from, to] of [
      ["coordinateTimeMoving", "properTimeElapsed"],
      ["lorentzFactor", "speedRatio"],
      ["coordinatePositionMoving", "coordinatePositionStationary"],
    ] as const) {
      const changed = {
        ...value,
        terms: value.terms.map((term) =>
          term.quantityId === from ? { ...term, quantityId: to } : term,
        ),
      };
      refuses(() => compile(changed), "printed-source-operation");
    }
    expect(() => compile(value)).not.toThrow();
  });

  test("changing either coordinate subtraction or the Lorentz factor's minus sign is refused", () => {
    const transform = display("eq-s3-d25");
    for (const [from, to] of [
      [" t - ", " t + "],
      ["x - v t", "x + v t"],
    ] as const) {
      const latex = transform.latex.replace(from, to);
      expect(latex).not.toBe(transform.latex);
      refuses(() => compile({ ...transform, latex }), "printed-source-operation");
    }
    const factor = display("eq-s3-d26");
    refuses(
      () => compile({ ...factor, latex: factor.latex.replace("1 - ", "1 + ") }),
      "printed-source-operation",
    );
    expect(() => compile(transform)).not.toThrow();
    expect(() => compile(factor)).not.toThrow();
  });

  test("a changed numerator, constant, or power cannot keep the stated Lorentz factor", () => {
    const value = display("eq-s3-d26");
    for (const [from, to] of [
      ["\\frac{1}", "\\frac{2}"],
      ["\\sqrt{1", "\\sqrt{2"],
      ["^2", "^4"],
    ] as const) {
      const latex = value.latex.replace(from, to);
      expect(latex).not.toBe(value.latex);
      refuses(() => compile({ ...value, latex }), "printed-source-operation");
    }
    expect(() => compile(value)).not.toThrow();
  });

  test("a fifth dimensionally valid row cannot silently join the four-coordinate transformation", () => {
    const value = display("eq-s3-d25");
    const changed = {
      ...value,
      latex: value.latex.replace("\\end{aligned}", "\\\\ 1 = 1, \\end{aligned}"),
    };
    expect(
      parseSourceExpression(changed, RELATIVITY_OPERATION_GUIDES[value.display]?.symbolIndices).rows
        .length,
    ).toBe(5);
    refuses(() => compile(changed), "printed-source-dimension");
    expect(() => compile(value)).not.toThrow();
  });

  test("omitting the final transverse coordinate cannot publish an incomplete transformation", () => {
    const value = display("eq-s3-d25");
    const finalRow = value.latex.lastIndexOf("\\\\");
    const alignmentEnd = value.latex.indexOf("\\end{aligned}");
    assert(finalRow > 0 && alignmentEnd > finalRow);
    const changed = {
      ...value,
      latex: value.latex.slice(0, finalRow) + value.latex.slice(alignmentEnd),
      terms: value.terms.filter((term) => term.end <= finalRow),
    };
    expect(parseSourceExpression(changed).rows.length).toBe(3);
    refuses(() => compile(changed), "printed-source-binding");
    expect(() => compile(value)).not.toThrow();
  });

  test("internally consistent but exchanged time and length dimensions are refused", () => {
    const value = display("eq-s3-d25");
    const altered = new Map(quantities);
    const replacements: readonly [string, readonly number[]][] = [
      ["coordinateTimeStationary", [1, 0, 0, 0, 0, 0]],
      ["coordinateTimeMoving", [1, 0, 0, 0, 0, 0]],
      ["coordinatePositionStationary", [0, 0, 1, 0, 0, 0]],
      ["coordinatePositionMoving", [0, 0, 1, 0, 0, 0]],
      ["frameSpeed", [-1, 0, 1, 0, 0, 0]],
      ["speedOfLight", [-1, 0, 1, 0, 0, 0]],
    ];
    for (const [id, dimension] of replacements) {
      const quantity = altered.get(id);
      assert(quantity);
      altered.set(id, { ...quantity, dimension: dimension.map((num) => ({ num, den: 1 })) });
    }
    const parsed = parseSourceExpression(
      value,
      RELATIVITY_OPERATION_GUIDES[value.display]?.symbolIndices,
    );
    for (const { tree } of parsed.rows)
      expect(
        checkDimensions(tree, sourceDimensionRegistry(altered), { context: "gaussian-cgs" }).status,
      ).toBe("consistent");
    refuses(
      () => compilePrintedSourceSemantics(value, compilePrintedDisplay(value), altered),
      "printed-source-dimension",
    );
    expect(() => compile(value)).not.toThrow();
  });
});

describe("the real source reader and its permanent operation reference", () => {
  test("the compiler publishes explanations, frame facts, and a complete no-script reference", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of ["eq-s3-d16", "eq-s3-d25", "eq-s3-d26"]) {
      const values = result.displays.filter((value) => value.display === id);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        assert(value.semantics);
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
        for (const operation of value.semantics.operations) {
          expect(reference).toContain(`id="operation-${operation.id}"`);
          expect(reference).toContain(`href="/foundations/${operation.foundation}/"`);
        }
        expect(reference).toContain("/papers/special-relativity/s3/#sr-coordinate-derivation");
        if (id === "eq-s3-d25") {
          expect(reference).toContain("row 1: time");
          expect(reference).toContain("row 4: length");
          expect(value.facts.coordinateTimeMoving?.about).toContain("moving system k");
          expect(value.facts.coordinateTimeStationary?.about).toContain("stationary system K");
        }
      }
    }
  });

  test("the reader can select the time offset and highlight only its printed terms", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s3-d25");
    assert(value?.semantics);
    const offset = value.semantics.operations.find(
      (operation) => operation.path === "row1.right.args.1.argument.args.1",
    );
    assert(offset);
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
      await act(async () => {
        select.value = offset.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(
        container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
      ).toBe(offset.id);
      expect(getLastAnnouncement()).toContain(offset.does);
      const selectedTerms = [...container.querySelectorAll("[data-term][data-operation-selected]")]
        .map((element) => element.getAttribute("data-term"))
        .sort();
      expect(selectedTerms).toEqual([...offset.termIds].sort());
      const selectedQuantities = value.terms
        .filter((term) => selectedTerms.includes(term.termId))
        .map((term) => term.quantityId);
      expect(selectedQuantities).toContain("coordinatePositionStationary");
      expect(selectedQuantities).not.toContain("coordinateTimeMoving");
      expect(selectedQuantities).not.toContain("coordinatePositionMoving");
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
