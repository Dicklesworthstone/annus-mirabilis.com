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
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { RELATIVITY_SYNCHRONIZATION_GUIDES } from "./relativitySynchronization.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real relativity source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const IDS = ["eq-s1-d1", "eq-s1-d2", "eq-s2-d2", "eq-s2-d3"] as const;
const TIME = ["0", "0", "1", "0", "0", "0"];
const SPEED = ["1", "0", "-1", "0", "0", "0"];
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((item) => item.display === id);
  assert(value, "The checked source must contain " + id);
  return value;
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "A selected source needs its authored operation guide.");
  return result;
}

function refuses(action: () => unknown): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(caught).toMatchObject({ code: "printed-source-operation" });
}

/** Values bind each printed occurrence, so the three clock readings cannot collapse to one. */
function sides(
  id: string,
  glyphValues: Readonly<Record<string, number>>,
): readonly [number, number] {
  const value = display(id);
  const parsed = parseSourceExpression(value, RELATIVITY_SYNCHRONIZATION_GUIDES[id]?.symbolIndices);
  assert(parsed.rows.length === 1 && parsed.rows[0]?.tree.kind === "relation");
  const bindings = Object.fromEntries(
    value.terms.map((term): [string, number] => {
      const number = glyphValues[term.glyph];
      assert(typeof number === "number" && Number.isFinite(number));
      return [term.termId, number];
    }),
  );
  return [
    evaluateExpression(parsed.rows[0].tree.left, bindings),
    evaluateExpression(parsed.rows[0].tree.right, bindings),
  ];
}

describe("the printed clock convention and moving-rod light paths", () => {
  test("all four source displays gain operation readings while retaining exact source and MathML", () => {
    for (const id of IDS) {
      const value = display(id);
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      const guide = RELATIVITY_SYNCHRONIZATION_GUIDES[id];
      assert(guide);
      const parsed = parseSourceExpression(value, guide.symbolIndices);
      expect(parsed.rows.length).toBeGreaterThan(0);
      expect(built.semantics.operations.some((operation) => operation.primary)).toBe(true);
      for (const { path, node } of sourceNodes(parsed)) {
        if (node.tree.kind !== "symbol") continue;
        expect(guide.primary[path]).toMatchObject({
          kind: "symbol",
          quantities: [node.tree.quantityId],
        });
        if (node.tree.quantityId === "coordinateTimeStationary")
          expect(guide.primary[path]?.symbolIndex).toBe(node.tree.index);
      }
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      for (const term of value.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      const operationIds = built.semantics.operations.map((operation) => operation.id);
      expect(new Set(operationIds).size).toBe(operationIds.length);
      for (const operationId of operationIds)
        expect(built.html).toContain('data-op="' + operationId + '"');
    }
    console.info("SR clock source operations: examined " + IDS.length + " printed displays.");
  });

  test("the equality of intervals has time dimensions and the round-trip quotient has speed dimensions", () => {
    const registry = sourceDimensionRegistry(quantities);
    for (const id of IDS) {
      const built = compile(display(id));
      const expected = id === "eq-s1-d2" ? SPEED : TIME;
      for (const tree of built.semantics.rows) {
        const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
        assert(result.status === "consistent");
        expect(
          result.dimension.map(({ num, den }) =>
            String(den) === "1" ? String(num) : String(num) + "/" + String(den),
          ),
        ).toEqual(expected);
      }
    }
    const roundTrip = compile(display("eq-s1-d2")).semantics.operations;
    expect(
      roundTrip.find((operation) => operation.path === "row1.left.denominator")?.dimensionExponents,
    ).toEqual(TIME);
    for (const id of ["eq-s2-d2", "eq-s2-d3"]) {
      const operations = compile(display(id)).semantics.operations;
      expect(
        operations.find((operation) => operation.path === "row1.right")?.dimensionExponents,
      ).toEqual(TIME);
      expect(
        operations.find((operation) => operation.path === "row1.right.denominator")
          ?.dimensionExponents,
      ).toEqual(SPEED);
    }
  });

  test("departure, reflection and return retain distinct meanings despite sharing one quantity owner", () => {
    const value = display("eq-s1-d1");
    const parsed = parseSourceExpression(
      value,
      RELATIVITY_SYNCHRONIZATION_GUIDES[value.display]?.symbolIndices,
    );
    const symbols = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree] : [],
    );
    expect(symbols.map((symbol) => symbol.index)).toEqual(["b", "a0", "a1", "b"]);
    expect(symbols.every((symbol) => symbol.quantityId === "coordinateTimeStationary")).toBe(true);
    const built = compile(value);
    for (const glyph of ["t_A", "t_B", "t'_A"])
      expect(built.semantics.roundTrip.canonicalLatex).toContain(glyph);
    expect(built.semantics.premise).toContain("not a different frame");
    expect(built.semantics.premise).toContain("not an independent measurement");
  });

  test("the real source accepts the midpoint convention and distinguishes an offset B clock", () => {
    expect(sides("eq-s1-d1", { t_A: 0, t_B: 5, "t'_A": 10 })).toEqual([5, 5]);
    expect(sides("eq-s1-d1", { t_A: 20, t_B: 25, "t'_A": 30 })).toEqual([5, 5]);
    expect(sides("eq-s1-d1", { t_A: 0, t_B: 6, "t'_A": 10 })).toEqual([6, 4]);
  });

  test("the round-trip speed uses both paths and is independent of the arbitrary clock zero", () => {
    const path = { "\\overline{AB}": 15, V: 3 };
    expect(sides("eq-s1-d2", { ...path, t_A: 0, "t'_A": 10 })).toEqual([3, 3]);
    expect(sides("eq-s1-d2", { ...path, t_A: 20, "t'_A": 30 })).toEqual([3, 3]);
    expect(display("eq-s1-d2").terms.some((term) => term.glyph === "t_B")).toBe(false);
  });

  test("the moving rod has unequal legs, exchanges them when reversed, and has equal legs at rest", () => {
    const resting = { "r_{AB}": 4, V: 10, v: 0, t_A: 0, t_B: 0.4, "t'_A": 0.8 };
    for (const id of ["eq-s2-d2", "eq-s2-d3"]) expect(sides(id, resting)).toEqual([0.4, 0.4]);
    const outward = sides("eq-s2-d2", { ...resting, v: 6, t_B: 1 });
    const returning = sides("eq-s2-d3", { ...resting, v: 6, t_B: 1, "t'_A": 1.25 });
    expect(outward).toEqual([1, 1]);
    expect(returning).toEqual([0.25, 0.25]);
    expect(sides("eq-s2-d2", { ...resting, v: -6, t_B: 0.25 })).toEqual([0.25, 0.25]);
    expect(sides("eq-s2-d3", { ...resting, v: -6, t_B: 0.25, "t'_A": 1.25 })).toEqual([1, 1]);
    for (const id of ["eq-s2-d2", "eq-s2-d3"]) {
      const semantics = compile(display(id)).semantics;
      expect(semantics.premise).toContain("|v| < V");
      expect(semantics.premise).toContain("not the rod's proper length");
      expect(semantics.premise).toContain("closing rates");
    }
    expect(
      compile(display("eq-s2-d3")).semantics.operations.find(
        (operation) => operation.path === "row1.right.denominator",
      )?.why,
    ).toContain("without light exceeding V");
  });

  test("changed signs or the wrong path multiplier cannot inherit the original physical readings", () => {
    for (const [id, from, to] of [
      ["eq-s1-d1", "t_B - t_A", "t_B + t_A"],
      ["eq-s1-d2", "\\frac{2 ", "\\frac{3 "],
      ["eq-s2-d2", "V - v", "V + v"],
      ["eq-s2-d3", "V + v", "V - v"],
    ] as const) {
      const value = display(id);
      assert(from.length === to.length && value.latex.includes(from));
      const changed = { ...value, latex: value.latex.replace(from, to) };
      expect(changed.latex).not.toBe(value.latex);
      refuses(() => compile(changed));
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("dimensionally equal clock-event or quantity swaps are refused", () => {
    const value = display("eq-s1-d1");
    const swap = (glyph: string) => (glyph === "t_A" ? "t_B" : glyph === "t_B" ? "t_A" : glyph);
    const changed = {
      ...value,
      latex: value.latex.replace(/t_A|t_B/g, swap),
      terms: value.terms.map((term) => ({ ...term, glyph: swap(term.glyph) })),
    };
    const parsed = parseSourceExpression(
      changed,
      RELATIVITY_SYNCHRONIZATION_GUIDES[value.display]?.symbolIndices,
    );
    for (const { tree } of parsed.rows)
      expect(
        checkDimensions(tree, sourceDimensionRegistry(quantities), { context: "gaussian-cgs" })
          .status,
      ).toBe("consistent");
    refuses(() => compile(changed));
    for (const id of ["eq-s2-d2", "eq-s2-d3"]) {
      const source = display(id);
      for (const [from, to] of [
        ["coordinateTimeStationary", "properTimeElapsed"],
        ["lengthMeasuredStationary", "coordinatePositionStationary"],
        ["frameSpeed", "speedOfLight"],
      ] as const) {
        refuses(() =>
          compile({
            ...source,
            terms: source.terms.map((term) =>
              term.quantityId === from ? { ...term, quantityId: to } : term,
            ),
          }),
        );
      }
    }
    expect(() => compile(value)).not.toThrow();
  });

  test("every clock display has a real operation reference and foundation links without JavaScript", async () => {
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
      expect(html).toContain('href="/equations/special-relativity/' + id + '/#operations"');
      expect(html).not.toContain("<select");
      const reference = renderToStaticMarkup(
        <PrintedOperationReference reading={value.semantics} spoken={value.spoken} />,
      );
      expect(reference).toContain(value.semantics.next.href);
      for (const operation of value.semantics.operations) {
        expect(reference).toContain('id="operation-' + operation.id + '"');
        expect(reference).toContain('href="/foundations/' + operation.foundation + '/"');
      }
    }
  });

  test("selecting the outward closing rate highlights only its two speeds and announces its meaning", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s2-d2");
    assert(value?.semantics);
    const closing = value.semantics.operations.find(
      (operation) => operation.path === "row1.right.denominator",
    );
    assert(closing);
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
        select.value = closing.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(
        container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
      ).toBe(closing.id);
      expect(getLastAnnouncement()).toContain(closing.does);
      const selectedTerms = [...container.querySelectorAll("[data-term][data-operation-selected]")]
        .map((element) => element.getAttribute("data-term"))
        .sort();
      expect(selectedTerms).toEqual([...closing.termIds].sort());
      expect(
        value.terms
          .filter((term) => selectedTerms.includes(term.termId))
          .map((term) => term.quantityId)
          .sort(),
      ).toEqual(["frameSpeed", "speedOfLight"]);
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
