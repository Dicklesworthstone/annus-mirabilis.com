import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import lqEquations from "../generated/light-quanta-equations.json";
import meEquations from "../generated/mass-energy-equations.json";
import srEquations from "../generated/special-relativity-equations.json";
import { ColouredFormula } from "../reader/ColouredFormula.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { SemanticEquation } from "./SemanticEquation.tsx";
import {
  computingLab,
  dimensionText,
  PURE_NUMBER,
  termFacts,
  termGlyphHtml,
  termRoles,
  unitText,
} from "./termFacts.ts";
import type { CompiledEquation } from "./viewTypes.ts";

/**
 * THE TERM INSPECTOR (dispatch 144 unit c): a pinned quantity's symbol, name, what it does in this
 * formula, unit, dimension and value. The facts are found by exact quantity and term ids; the
 * inspector and its live region change on a pin, never on a pointer move.
 */
const record = (file: { equations: unknown }, id: string) => {
  const found = (file.equations as CompiledEquation[]).find((e) => e.id === id);
  if (!found) throw new Error(`${id} is missing from the generated equations`);
  return found;
};
const lorentz = record(srEquations, "eq-model-sr-lorentz-factor");
const wien = record(lqEquations, "eq-model-lq-wien-spectrum");
const exactDrop = record(meEquations, "eq-model-me-exact-drop");

describe("a dimension in words, in the basis length, mass, time, temperature, current, amount", () => {
  test("each slot is named by its place, with its exact exponent raised", () => {
    expect(dimensionText(["2", "0", "-1", "0", "0", "0"])).toBe("length² × time⁻¹");
    // The fourth slot is temperature and the fifth current: a basis read out of order fails here.
    expect(dimensionText(["0", "0", "0", "1", "0", "0"])).toBe("temperature");
    expect(dimensionText(["-2", "0", "0", "0", "1", "0"])).toBe("length⁻² × current");
    expect(dimensionText(["2", "1", "-2", "-1", "0", "-1"])).toBe(
      "length² × mass × time⁻² × temperature⁻¹ × amount⁻¹",
    );
  });
  test("a root keeps its fraction, written in characters every face draws", () => {
    expect(dimensionText(["1/2", "0", "0", "0", "0", "0"])).toBe("length^(1/2)");
    expect(dimensionText(["-3/2", "0", "0", "0", "0", "0"])).toBe("length^(\u22123/2)");
    expect(unitText("m^(1/2)")).toBe("m^(1/2)");
    expect(dimensionText(["0", "0", "0", "0", "0", "0"])).toBe(PURE_NUMBER);
  });
});

describe("a display unit as a reader reads it", () => {
  test("powers are raised and products joined, and no symbol is renamed", () => {
    expect(unitText("m^2")).toBe("m²");
    expect(unitText("J s^4 m^-3")).toBe("J·s⁴·m⁻³");
    expect(unitText("1/(m^2 s)")).toBe("1/(m²·s)");
    expect(unitText("Pa*s")).toBe("Pa·s");
    expect(unitText("μm²/s")).toBe("μm²/s");
    expect(unitText("1")).toBe(PURE_NUMBER);
  });
});

describe("the facts are found by exact id", () => {
  test("a term's glyph is cut from its own span, never from one whose id it begins", () => {
    const html = [
      '<span class="enclosing" data-term="e.t.v2"><span class="mord">W</span></span>',
      '<span class="enclosing" data-term="e.t.v"><span class="mord">v</span>',
      '<span class="mspace" style="margin-right:0.2778em;"></span></span>',
    ].join("");
    expect(termGlyphHtml(html, "e.t.v")).toBe('<span class="mord">v</span>');
    expect(termGlyphHtml(html, "e.t.v2")).toBe('<span class="mord">W</span>');
    expect(termGlyphHtml(html, "e.t")).toBeUndefined();
    const gamma = termGlyphHtml(lorentz.html, "eq-model-sr-lorentz-factor.t.factor");
    expect(gamma).toContain("γ");
    expect(gamma).not.toContain("mspace");
  });

  test("in the Wien spectrum, frequency's notes are its own and not frequencyEnergyDensity's", () => {
    const notesOf = (quantityId: string) =>
      wien.terms
        .filter((t) => t.quantityId === quantityId)
        .flatMap((t) => wien.notes.filter((n) => n.nodeId === t.termId))
        .map((n) => n.explanation);
    const frequency = termRoles([wien], "frequency").map((r) => r.explanation);
    // Non-vacuous: both quantities have notes of their own before anything is compared.
    expect(frequency.length).toBeGreaterThan(0);
    expect(notesOf("frequencyEnergyDensity").length).toBeGreaterThan(0);
    for (const explanation of frequency) expect(notesOf("frequency")).toContain(explanation);
    for (const explanation of notesOf("frequencyEnergyDensity"))
      if (!notesOf("frequency").includes(explanation)) expect(frequency).not.toContain(explanation);
  });

  test("a laboratory is named only for the quantity its binding names", () => {
    // eq-model-me-exact-drop binds the kinetic-energy difference to ME-02, and nothing else in it.
    expect(computingLab([exactDrop], "kineticEnergyDifference")).toBe("me-02");
    expect(computingLab([exactDrop], "emittedEnergyRestFrame")).toBeUndefined();
    expect(computingLab([exactDrop], "lorentzFactor")).toBeUndefined();
  });

  test("the Lorentz factor is a pure number with one role, its term's own note", () => {
    const factor = lorentz.terms.find((t) => t.quantityId === "lorentzFactor");
    if (!factor) throw new Error("no Lorentz-factor term");
    const facts = termFacts([lorentz], factor.quantity);
    expect(facts.unit).toBe(PURE_NUMBER);
    expect(facts.dimension).toBe(PURE_NUMBER);
    expect(facts.lab).toBeUndefined();
    expect(facts.roles).toEqual([
      {
        title: "Lorentz factor",
        explanation:
          lorentz.notes.find((n) => n.nodeId === factor.termId)?.explanation ?? "missing note",
      },
    ]);
  });
});

type Handlers = Record<string, ((...args: unknown[]) => void) | undefined>;
/** Under this happy-dom harness a dispatched event does not reach React, so handlers are called. */
function handlers(el: Element | null | undefined): Handlers {
  if (!el) return {};
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$")) ?? "";
  return (el as unknown as Record<string, Handlers>)[key] ?? {};
}

describe("the reading formula's inspector opens on a pin, never on a pointer move", () => {
  test("without JavaScript there is no inspector, and the live region is present and empty", () => {
    const html = renderToStaticMarkup(<ColouredFormula equations={[lorentz]} />);
    expect(html).not.toContain("term-inspector");
    expect(html).toContain('<p class="visually-hidden" role="status" aria-live="polite"');
    expect(/role="status"[^>]*><\/p>/.test(html)).toBe(true);
  });

  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    act(() => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("pinning opens the facts and announces them; pointing elsewhere changes neither", async () => {
    await act(async () => root.render(<ColouredFormula equations={[lorentz]} />));
    const block = container.querySelector("[data-term-highlight]");
    const chip = (id: string) =>
      [...container.querySelectorAll(".term-chip")].find(
        (c) => c.getAttribute("data-quantity-id") === id,
      );
    const live = () => container.querySelector('[role="status"]')?.textContent ?? null;
    const inspector = () => container.querySelector(".term-inspector");
    expect(chip("lorentzFactor")?.hasAttribute("disabled")).toBe(false);
    expect(inspector()).toBeNull();
    expect(live()).toBe("");

    await act(async () => handlers(block).onClick?.({ target: chip("lorentzFactor") }));
    expect(inspector()?.getAttribute("aria-label")).toBe("About Lorentz factor");
    const text = inspector()?.textContent ?? "";
    for (const part of ["In this formula", "Unit", PURE_NUMBER, "Dimension", "Symbolic here."])
      expect(text).toContain(part);
    const announced = live();
    expect(announced?.startsWith("Lorentz factor. ")).toBe(true);

    // A pointer crossing another quantity lights it, and says nothing new.
    expect(chip("frameSpeed")).toBeDefined();
    await act(async () => handlers(block).onPointerOver?.({ target: chip("frameSpeed") }));
    expect(block?.getAttribute("data-active-quantity-id")).toBe("frameSpeed");
    expect(inspector()?.getAttribute("aria-label")).toBe("About Lorentz factor");
    expect(live()).toBe(announced);

    await act(async () => handlers(block).onKeyDown?.({ key: "Escape" }));
    expect(inspector()).toBeNull();
    expect(live()).toBe("");
  });

  test("the explorer's term inspector names the laboratory that computes a bound quantity", async () => {
    await act(async () => root.render(<SemanticEquation equation={exactDrop} />));
    const chip = (id: string) =>
      [...container.querySelectorAll(".term-chip")].find(
        (c) => c.getAttribute("data-quantity-id") === id,
      );
    await act(async () => handlers(chip("kineticEnergyDifference")).onClick?.());
    let panel = container.querySelector(".equation-inspector.term-inspector");
    expect(panel?.querySelector('a[href="/lab/me-02/"]')?.textContent).toBe("ME-02");
    expect(panel?.querySelector(".term-inspector-glyph")?.innerHTML.length).toBeGreaterThan(0);

    await act(async () => handlers(chip("emittedEnergyRestFrame")).onClick?.());
    panel = container.querySelector(".equation-inspector.term-inspector");
    expect(panel?.textContent).toContain("No laboratory computes it on this page.");
    expect(panel?.querySelector('a[href^="/lab/"]')).toBeNull();
  });
});
