import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import lqEquations from "../generated/light-quanta-equations.json";
import srEquations from "../generated/special-relativity-equations.json";
import { ColouredFormula } from "../reader/ColouredFormula.tsx";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { elementsOfQuantity, lightQuantity, quantityAt } from "./TermHighlight.tsx";
import { withQuantityIds } from "./termQuantities.ts";
import type { CompiledEquation } from "./viewTypes.ts";

/**
 * TERMS AS TARGETS (dispatch 144): a term span carries its exact quantity id, and lighting a
 * quantity lights every element with that id and no other. The prefix case is real: measured
 * 2026-09-24 over the 157 equations in the six generated files, 15 quantity ids begin another,
 * and ten single equations hold such a pair, among them light quanta's Wien spectrum with
 * frequency beside frequencyEnergyDensity. A fixture of the same shape, speed beside
 * speedOfLight, checks the mechanism apart from the corpus.
 */
const equations = srEquations.equations as unknown as CompiledEquation[];
const lorentz = equations.find((e) => e.id === "eq-model-sr-lorentz-factor");
if (!lorentz) throw new Error("the Lorentz-factor record is missing from the generated equations");

describe("each term span carries its exact quantity id", () => {
  test("every data-term the term list names gains data-quantity-id, and nothing else changes", () => {
    const html = withQuantityIds(lorentz.html, lorentz.terms);
    const spans = [...html.matchAll(/data-term="([^"]*)" data-quantity-id="([^"]*)"/g)];
    expect(spans.length).toBeGreaterThan(0);
    for (const [, termId, quantityId] of spans)
      expect(lorentz.terms.find((t) => t.termId === termId)?.quantityId).toBe(quantityId);
    // Every term span was reached, and the rest of the markup is untouched.
    expect(spans.length).toBe([...lorentz.html.matchAll(/data-term="/g)].length);
    expect(html.replace(/ data-quantity-id="[^"]*"/g, "")).toBe(lorentz.html);
  });

  test("a term the list does not name is left as it was", () => {
    const html = '<span data-term="x.t.unknown">v</span>';
    expect(withQuantityIds(html, lorentz.terms)).toBe(html);
  });

  test("a reading formula renders its term spans with ids, and nothing lit, without JavaScript", () => {
    const html = renderToStaticMarkup(<ColouredFormula equations={[lorentz]} />);
    expect(html).toContain("data-term-highlight");
    expect(html).toContain('data-quantity-id="lorentzFactor"');
    expect(html).not.toContain("data-lit");
    // The legend names the same quantity by the same id, so pointing at either lights both.
    const formulaIds = new Set(
      [...html.matchAll(/data-term="[^"]*" data-quantity-id="([^"]*)"/g)].map((m) => m[1]),
    );
    const legendIds = [
      ...html.matchAll(/<li class="equation-quantity" data-quantity-id="([^"]*)"/g),
    ].map((m) => m[1]);
    expect(legendIds.length).toBeGreaterThan(0);
    for (const id of legendIds) expect(formulaIds.has(id)).toBe(true);
  });
});

describe("lighting a quantity lights that exact id and no other", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  const fixture = () => {
    const root = document.createElement("div");
    root.innerHTML = [
      '<span data-quantity-id="speed" id="v1">v</span>',
      '<span data-quantity-id="speedOfLight" id="c1">c</span>',
      '<span data-quantity-id="speed" id="v2">v</span>',
      '<li data-quantity-id="speed" id="legend-v">Speed</li>',
      '<li data-quantity-id="speedOfLight" id="legend-c">Speed of light</li>',
    ].join("");
    document.body.appendChild(root);
    return root;
  };
  const lit = (root: Element) => [...root.querySelectorAll("[data-lit]")].map((e) => e.id).sort();

  test("speed lights its two glyphs and its legend line, and speedOfLight stays dark", () => {
    const root = fixture();
    lightQuantity(root, "speed");
    expect(lit(root)).toEqual(["legend-v", "v1", "v2"]);
    expect(elementsOfQuantity(root, "speed").map((e) => e.id)).toEqual(["v1", "v2", "legend-v"]);
  });

  test("moving to another quantity clears the first, and null clears everything", () => {
    const root = fixture();
    lightQuantity(root, "speed");
    lightQuantity(root, "speedOfLight");
    expect(lit(root)).toEqual(["c1", "legend-c"]);
    lightQuantity(root, null);
    expect(lit(root)).toEqual([]);
  });

  test("in the Wien spectrum, frequency lights without frequencyEnergyDensity", () => {
    const wien = (lqEquations.equations as unknown as CompiledEquation[]).find(
      (e) => e.id === "eq-model-lq-wien-spectrum",
    );
    if (!wien) throw new Error("the Wien-spectrum record is missing from the generated equations");
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(<ColouredFormula equations={[wien]} />);
    document.body.appendChild(root);
    // Non-vacuous: both quantities are on the page before anything is lit.
    expect(elementsOfQuantity(root, "frequency").length).toBeGreaterThan(0);
    expect(elementsOfQuantity(root, "frequencyEnergyDensity").length).toBeGreaterThan(0);
    lightQuantity(root, "frequency");
    const lit = [...root.querySelectorAll("[data-lit]")];
    expect(lit.length).toBe(elementsOfQuantity(root, "frequency").length);
    expect(lit.every((e) => e.getAttribute("data-quantity-id") === "frequency")).toBe(true);
  });

  test("the quantity under an event is the nearest carrier inside the block, and none outside it", () => {
    const root = fixture();
    const glyph = root.querySelector("#v1");
    const inner = document.createElement("em");
    glyph?.appendChild(inner);
    expect(quantityAt(root, inner)).toBe("speed");
    expect(quantityAt(root, root)).toBeNull();
    const outside = document.createElement("span");
    outside.setAttribute("data-quantity-id", "speed");
    document.body.appendChild(outside);
    expect(quantityAt(root, outside)).toBeNull();
  });
});
