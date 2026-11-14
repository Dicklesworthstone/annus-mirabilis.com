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
import { RELATIVITY_CONSEQUENCE_GUIDES } from "./relativityConsequences.ts";
import { RELATIVITY_OPERATION_GUIDES } from "./relativityOperations.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "special-relativity");
assert(checked && checked.problems.length === 0, "The real relativity source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const selected = checked.displays.filter((value) => RELATIVITY_CONSEQUENCE_GUIDES[value.display]);
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((entry) => entry.display === id);
  assert(value, "The checked source contains " + id);
  return value;
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

/** Keep checked term spans valid, so a changed-length mutation tests meaning, not bad offsets. */
function replace(value: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const at = value.latex.indexOf(from);
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

/** Evaluate the real parsed source; separate a/b/c occurrences must not collapse by quantity id. */
function rhs(id: string, glyphValues: Readonly<Record<string, number>>): number {
  const value = display(id);
  const parsed = parseSourceExpression(value, RELATIVITY_OPERATION_GUIDES[id]?.symbolIndices);
  assert(parsed.rows.length === 1 && parsed.rows[0]?.tree.kind === "relation");
  const assignment = Object.fromEntries(
    value.terms.flatMap((term) =>
      glyphValues[term.glyph] === undefined ? [] : [[term.termId, glyphValues[term.glyph]]],
    ),
  );
  const result = evaluateExpression(parsed.rows[0].tree.right, assignment);
  assert(Number.isFinite(result), "Every numerical check must evaluate a bound source tree.");
  return result;
}

describe("printed velocity, wave and light-complex operations", () => {
  test("every selected source has exact term bindings, unchanged MathML, and a measured round trip", () => {
    expect(new Set(selected.map((value) => value.display)).size).toBe(
      Object.keys(RELATIVITY_CONSEQUENCE_GUIDES).length,
    );
    let identical = 0;
    for (const value of selected) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      const parsed = parseSourceExpression(
        value,
        RELATIVITY_OPERATION_GUIDES[value.display]?.symbolIndices,
      );
      const symbols = sourceNodes(parsed).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [[node.tree.termId, node.tree.quantityId]] : [],
      );
      expect(symbols.sort()).toEqual(
        value.terms.map((term) => [term.termId, term.quantityId]).sort(),
      );
      // Every occurrence has an independent expected owner at its mathematical position.
      for (const { path, node } of sourceNodes(parsed)) {
        if (node.tree.kind !== "symbol") continue;
        expect(RELATIVITY_CONSEQUENCE_GUIDES[value.display]?.primary[path]).toMatchObject({
          kind: "symbol",
          quantities: [node.tree.quantityId],
        });
      }
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      if (built.semantics.roundTrip.status === "identical") identical++;
      else expect(built.semantics.roundTrip.reason).toContain("original source typography");
      const ids = built.semantics.operations.map((operation) => operation.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(built.html).toContain('data-op="' + id + '"');
      for (const term of value.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
    }
    console.info(
      "SR consequence source round trips: " +
        identical +
        "/" +
        selected.length +
        " identical; " +
        (selected.length - identical) +
        " explicit typography exceptions.",
    );
  });

  test("speed, frequency and Gaussian squared-amplitude dimensions are independently checked", () => {
    const registry = sourceDimensionRegistry(quantities);
    for (const value of selected) {
      const expected =
        value.display === "eq-s5-d6"
          ? ["1", "0", "-1", "0", "0", "0"]
          : ["eq-s7-d3", "eq-s7-d7", "eq-s7-d8"].includes(value.display)
            ? ["0", "0", "-1", "0", "0", "0"]
            : ["eq-s7-d11", "eq-s7-d12"].includes(value.display)
              ? ["-1", "1", "-2", "0", "0", "0"]
              : ["0", "0", "0", "0", "0", "0"];
      for (const tree of compile(value).semantics.rows) {
        const result = checkDimensions(tree, registry, { context: "gaussian-cgs" });
        assert(result.status === "consistent");
        expect(
          result.dimension.map(({ num, den }) =>
            String(den) === "1" ? String(num) : String(num) + "/" + String(den),
          ),
        ).toEqual(expected);
      }
    }
  });

  test("direction cosines keep their x/y/z identities, including printed c beside light speed V", () => {
    for (const [id, glyph, axis] of [
      ["eq-s7-d5", "b", "y"],
      ["eq-s7-d6", "c", "z"],
    ] as const) {
      const value = display(id);
      const parsed = parseSourceExpression(value, RELATIVITY_OPERATION_GUIDES[id]?.symbolIndices);
      const symbols = sourceNodes(parsed).flatMap(({ node }) =>
        node.tree.kind === "symbol" ? [node.tree] : [],
      );
      for (const term of value.terms) {
        const symbol = symbols.find((entry) => entry.termId === term.termId);
        if (term.glyph === glyph || term.glyph === glyph + "'") expect(symbol?.index).toBe(axis);
        if (term.glyph === "a") expect(symbol?.index).toBe("x");
        if (term.glyph === "V") expect(symbol?.quantityId).toBe("speedOfLight");
      }
      const canonical = compile(value).semantics.roundTrip.canonicalLatex;
      expect(canonical).toContain(glyph);
      expect(canonical).toContain("a");
      expect(canonical).toContain("V");
    }
    expect(display("eq-s7-d6").terms.find((term) => term.glyph === "c")?.quantityId).toBe(
      "directionCosineStationary",
    );
  });

  test("velocity composition changes the time denominator and handles opposite directions", () => {
    expect(rhs("eq-s5-d6", { v: 6, w: 6, V: 10 })).toBeCloseTo(150 / 17, 12);
    expect(rhs("eq-s5-d6", { v: 6, w: 6, V: 10 })).not.toBe(12);
    expect(rhs("eq-s5-d6", { v: 6, w: -6, V: 10 })).toBe(0);
    expect(rhs("eq-s5-d6", { v: 0, w: 6, V: 10 })).toBe(6);
    expect(compile(display("eq-s5-d6")).semantics.premise).toContain("inverse direction");
  });

  test("angular and cyclic frequency share a Doppler factor without becoming the same quantity", () => {
    const cyclic = rhs("eq-s7-d7", { "\\nu": 100, "\\varphi": Math.PI / 3, v: 6, V: 10 });
    const angular = rhs("eq-s7-d3", {
      "\\omega": 200 * Math.PI,
      "\\beta": 1.25,
      a: 0.5,
      v: 6,
      V: 10,
    });
    expect(cyclic).toBeCloseTo(87.5, 12);
    expect(angular).toBeCloseTo(2 * Math.PI * cyclic, 12);
    expect(angular).not.toBeCloseTo(cyclic, 8);
    expect(rhs("eq-s7-d8", { "\\nu": 100, v: 6, V: 10 })).toBeCloseTo(50, 12);
    expect(rhs("eq-s7-d8", { "\\nu": 100, v: -6, V: 10 })).toBeCloseTo(200, 12);
  });

  test("aberration transforms all direction components and preserves a unit direction", () => {
    const values = { a: 0, b: 0.6, c: 0.8, "\\beta": 1.25, v: 6, V: 10 };
    const a = rhs("eq-s7-d4", values);
    const b = rhs("eq-s7-d5", values);
    const c = rhs("eq-s7-d6", values);
    expect(a).toBeCloseTo(-0.6, 12);
    expect(b).toBeCloseTo(0.48, 12);
    expect(c).toBeCloseTo(0.64, 12);
    expect(a * a + b * b + c * c).toBeCloseTo(1, 12);
    expect(a * a + values.b ** 2 + values.c ** 2).not.toBeCloseTo(1, 8);
    expect(rhs("eq-s7-d9", { "\\varphi": Math.PI / 2, v: 6, V: 10 })).toBeCloseTo(a, 12);
    expect(rhs("eq-s7-d10", { v: 6, V: 10 })).toBeCloseTo(a, 12);
  });

  test("squared amplitude, bounding volume and total light energy have different factors", () => {
    const values = { A: 2, "\\nu": 100, "\\varphi": Math.PI / 3, v: 6, V: 10 };
    const q = rhs("eq-s7-d7", values) / values["\\nu"];
    const densityFactor = rhs("eq-s7-d11", values) / values.A ** 2;
    const volumeFactor = rhs("eq-s8-d3", values);
    expect(densityFactor).toBeCloseTo(q * q, 12);
    expect(volumeFactor).toBeCloseTo(8 / 7, 12);
    expect(densityFactor * volumeFactor).toBeCloseTo(q, 12);
    // A transverse K ray would make 1/q = 1/gamma; use an oblique ray to catch that substitution.
    expect(densityFactor * 0.8).not.toBeCloseTo(q, 8);
    expect(rhs("eq-s8-d3", { "\\varphi": 0, v: 6, V: 10 })).toBeCloseTo(2, 12);
    const longitudinalDensity = rhs("eq-s7-d12", { A: 2, v: 6, V: 10 }) / 4;
    const longitudinalEnergy = rhs("eq-s8-d5", { v: 6, V: 10 });
    expect(longitudinalDensity).toBeCloseTo(0.25, 12);
    expect(longitudinalEnergy).toBeCloseTo(0.5, 12);
    expect(longitudinalDensity).not.toBeCloseTo(longitudinalEnergy, 8);
    expect(compile(display("eq-s8-d5")).semantics.next.href).toBe("/papers/mass-energy/#eq-s0-d1");
  });
});

describe("a dimensionally plausible substitution cannot inherit a different scientific reading", () => {
  test("frequency kind, angle frame, amplitude frame and light/body energy bindings stay distinct", () => {
    for (const [id, from, to] of [
      ["eq-s7-d3", "waveAngularFrequencyStationary", "waveFrequencyStationary"],
      ["eq-s7-d7", "waveFrequencyMoving", "waveAngularFrequencyMoving"],
      ["eq-s7-d9", "propagationAngleStationary", "propagationAngleMoving"],
      ["eq-s7-d11", "lightAmplitudeMoving", "lightAmplitudeStationary"],
      ["eq-s8-d5", "lightComplexEnergyMoving", "bodyEnergyMovingBefore"],
    ] as const) {
      const value = display(id);
      assert(value.terms.some((term) => term.quantityId === from));
      const changed = {
        ...value,
        terms: value.terms.map((term) =>
          term.quantityId === from ? { ...term, quantityId: to } : term,
        ),
      };
      const parsed = parseSourceExpression(changed, RELATIVITY_OPERATION_GUIDES[id]?.symbolIndices);
      for (const { tree } of parsed.rows)
        expect(
          checkDimensions(tree, sourceDimensionRegistry(quantities), { context: "gaussian-cgs" })
            .status,
        ).toBe("consistent");
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("exchanging two same-dimension owners cannot preserve a reversed ratio or frame assignment", () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ...Object.keys(RELATIVITY_CONSEQUENCE_GUIDES).map((id): readonly [string, string, string] => [
        id,
        "frameSpeed",
        "speedOfLight",
      ]),
      ["eq-s7-d3", "waveAngularFrequencyMoving", "waveAngularFrequencyStationary"],
      ["eq-s7-d7", "waveFrequencyMoving", "waveFrequencyStationary"],
      ["eq-s7-d9", "propagationAngleMoving", "propagationAngleStationary"],
      ["eq-s7-d11", "lightAmplitudeMoving", "lightAmplitudeStationary"],
      ["eq-s8-d3", "lightComplexVolumeMoving", "lightComplexVolumeStationary"],
      ["eq-s8-d5", "lightComplexEnergyMoving", "lightComplexEnergyStationary"],
    ];
    for (const [id, first, second] of cases) {
      const value = display(id);
      assert(value.terms.some((term) => term.quantityId === first));
      assert(value.terms.some((term) => term.quantityId === second));
      const changed = {
        ...value,
        terms: value.terms.map((term) => ({
          ...term,
          quantityId:
            term.quantityId === first
              ? second
              : term.quantityId === second
                ? first
                : term.quantityId,
        })),
      };
      // The set of owners and the complete physical dimensions still match the positive source.
      expect([...new Set(changed.terms.map((term) => term.quantityId))].sort()).toEqual(
        [...new Set(value.terms.map((term) => term.quantityId))].sort(),
      );
      const parsed = parseSourceExpression(changed, RELATIVITY_OPERATION_GUIDES[id]?.symbolIndices);
      for (const { tree } of parsed.rows)
        expect(
          checkDimensions(tree, sourceDimensionRegistry(quantities), { context: "gaussian-cgs" })
            .status,
        ).toBe("consistent");
      refuses(() => compile(changed), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("the plus sign of the velocity-composition denominator is part of its meaning", () => {
    const value = display("eq-s5-d6");
    refuses(() => compile(replace(value, "1 + ", "1 - ")), "printed-source-operation");
    expect(() => compile(value)).not.toThrow();
  });

  test("directional and longitudinal signs cannot silently change", () => {
    for (const id of ["eq-s7-d3", "eq-s7-d7", "eq-s7-d8", "eq-s7-d11", "eq-s8-d3", "eq-s8-d5"]) {
      const value = display(id);
      refuses(() => compile(replace(value, "1 - ", "1 + ")), "printed-source-operation");
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("a changed coefficient, field power, or unapproved function is refused", () => {
    refuses(
      () => compile(replace(display("eq-s7-d8"), "1 - ", "2 - ")),
      "printed-source-operation",
    );
    refuses(() => compile(replace(display("eq-s7-d11"), "^2", "^4")), "printed-source-dimension");
    refuses(
      () => compile(replace(display("eq-s7-d9"), "\\cos", "\\lg")),
      "printed-source-operation",
    );
  });

  test("internally consistent but physically wrong frequency dimensions are refused", () => {
    const value = display("eq-s7-d7");
    const altered = new Map(quantities);
    for (const id of ["waveFrequencyMoving", "waveFrequencyStationary"]) {
      const quantity = altered.get(id);
      assert(quantity);
      altered.set(id, {
        ...quantity,
        dimension: [1, 0, 0, 0, 0, 0].map((num) => ({ num, den: 1 })),
      });
    }
    const parsed = parseSourceExpression(value);
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

  test("wave phases, chained equalities and mirror-pressure formulas are not silently opted in", () => {
    for (const id of ["eq-s7-d1", "eq-s8-d4", "eq-s8-d6"]) {
      const value = display(id);
      expect(
        compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities),
      ).toBeUndefined();
    }
  });
});

describe("readers can explore each consequence in place or without JavaScript", () => {
  test("every selected source publishes its permanent operation reference and prerequisite links", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    expect(result.problems).toEqual([]);
    for (const id of Object.keys(RELATIVITY_CONSEQUENCE_GUIDES)) {
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
        for (const operation of value.semantics.operations) {
          expect(reference).toContain('id="operation-' + operation.id + '"');
          expect(reference).toContain('href="/foundations/' + operation.foundation + '/"');
        }
        expect(reference).toContain(value.semantics.next.href);
      }
    }
  });

  test("selecting the light-volume factor highlights its exact source occurrences and announces it", async () => {
    const result = await printedDisplays(ROOT, ["special-relativity"], []);
    const value = result.displays.find((item) => item.display === "eq-s8-d3");
    assert(value?.semantics);
    const factor = value.semantics.operations.find((operation) => operation.path === "row1.right");
    assert(factor);
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
        select.value = factor.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(
        container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
      ).toBe(factor.id);
      expect(getLastAnnouncement()).toContain(factor.does);
      const terms = [...container.querySelectorAll("[data-term][data-operation-selected]")]
        .map((element) => element.getAttribute("data-term"))
        .sort();
      expect(terms).toEqual([...factor.termIds].sort());
      const selectedQuantities = value.terms
        .filter((term) => terms.includes(term.termId))
        .map((term) => term.quantityId);
      expect(selectedQuantities).toContain("propagationAngleStationary");
      expect(selectedQuantities).toContain("frameSpeed");
      expect(selectedQuantities).not.toContain("lightComplexVolumeMoving");
      expect(selectedQuantities).not.toContain("lightComplexVolumeStationary");
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
