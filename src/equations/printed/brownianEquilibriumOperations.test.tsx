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
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  configurationVolumeTerm,
  driftDiffusionFlux,
  stokesMobility,
} from "../../physics/reference/diffusion/routeA.ts";
import { PrintedDisplayTerms } from "../../reader/faces/PrintedDisplayTerms.tsx";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { BROWNIAN_EQUILIBRIUM_GUIDES } from "./brownianEquilibriumOperations.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression, sourceNodes } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics, sourceDimensionRegistry } from "./sourceSemantics.ts";

const ROOT = process.cwd();
const checked = await checkPaperDisplays(ROOT, "brownian-motion");
assert(checked && checked.problems.length === 0, "The real Brownian source must check cleanly.");
const quantities = getQuantityRegistry().quantities;
const registry = sourceDimensionRegistry(quantities);
const IDS = ["eq-s2-d12", "eq-s3-1", "eq-s3-d4", "eq-s3-d8", "eq-2"] as const;
const PRESSURE = ["-1", "1", "-2", "0", "0", "0"];
const FORCE_DENSITY = ["-2", "1", "-2", "0", "0", "0"];
const NUMBER_FLUX = ["-2", "0", "-1", "0", "0", "0"];
const DENSITY_GRADIENT = ["-4", "0", "0", "0", "0", "0"];
const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));

function display(id: string): CheckedDisplay {
  const value = checked?.displays.find((item) => item.display === id);
  assert(value, "The checked source must contain " + id);
  return value;
}

function compile(value: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(value, compilePrintedDisplay(value), quantities);
  assert(result, "Each selected display needs its authored equilibrium operation guide.");
  return result;
}

function parse(value: CheckedDisplay) {
  const guide = BROWNIAN_EQUILIBRIUM_GUIDES[value.display];
  assert(guide);
  return parseSourceExpression(value, guide.symbolIndices, guide.allowChainedRelations, {
    allowCalculus: true,
  });
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

/** Replace an operator while retaining the checked offsets of every unchanged physical glyph. */
function replaceOperator(value: CheckedDisplay, from: string, to: string): CheckedDisplay {
  const start = value.latex.indexOf(from);
  assert(start >= 0, "The real source must contain the operator under test.");
  const end = start + from.length;
  const delta = to.length - from.length;
  return {
    ...value,
    latex: value.latex.slice(0, start) + to + value.latex.slice(end),
    terms: value.terms.map((term) =>
      term.start >= end ? { ...term, start: term.start + delta, end: term.end + delta } : term,
    ),
  };
}

function bindings(value: CheckedDisplay, values: Readonly<Record<string, number>>) {
  return Object.fromEntries(
    value.terms.map((term): [string, number] => {
      const number = values[term.quantityId];
      assert(typeof number === "number" && Number.isFinite(number));
      return [term.termId, number];
    }),
  );
}

describe("the printed Brownian pressure and equilibrium argument", () => {
  test("five real source displays gain complete operation readings without changing their source or MathML", () => {
    expect(Object.keys(BROWNIAN_EQUILIBRIUM_GUIDES).sort()).toEqual([...IDS].sort());
    for (const value of checked.displays.filter((item) => IDS.some((id) => id === item.display))) {
      const before = JSON.stringify(value);
      const original = compilePrintedDisplay(value);
      const built = compile(value);
      expect(JSON.stringify(value)).toBe(before);
      expect(mathml(built.html)).toBe(mathml(original.html));
      expect(built.semantics.operations.some((operation) => operation.primary)).toBe(true);
      expect(built.semantics.roundTrip.canonicalLatex.length).toBeGreaterThan(0);
      const nodes = sourceNodes(parse(value));
      const symbols = nodes.flatMap(({ node }) => (node.tree.kind === "symbol" ? [node.tree] : []));
      expect(symbols.map((symbol) => [symbol.termId, symbol.quantityId]).sort()).toEqual(
        value.terms.map((term) => [term.termId, term.quantityId]).sort(),
      );
      expect(new Set(symbols.map((symbol) => symbol.termId)).size).toBe(value.terms.length);
      for (const term of value.terms)
        expect(built.html).toContain('data-term="' + term.termId + '"');
      const marked = nodes.filter(({ node }) => node.marker);
      expect(built.semantics.operations).toHaveLength(marked.length);
      for (const operation of built.semantics.operations)
        expect(built.html).toContain('data-op="' + operation.id + '"');
    }
  });

  test("pressure, force density, number flux and density gradient retain their different dimensions", () => {
    for (const id of IDS) {
      const built = compile(display(id));
      const expected =
        id === "eq-s2-d12"
          ? PRESSURE
          : id === "eq-s3-1" || id === "eq-s3-d4"
            ? FORCE_DENSITY
            : NUMBER_FLUX;
      for (const row of built.semantics.rows) {
        const dimension = checkDimensions(row, registry, { context: "gaussian-cgs" });
        assert(dimension.status === "consistent");
        expect(
          dimension.dimension.map(({ num, den }) =>
            den === 1n ? String(num) : String(num) + "/" + String(den),
          ),
        ).toEqual(expected);
      }
    }
    for (const [id, path] of [
      ["eq-s3-1", "row1.left.args.1.args.1"],
      ["eq-s3-d8", "row1.args.1"],
      ["eq-2", "row1.left.args.1.argument.args.1"],
    ] as const) {
      const gradient = compile(display(id)).semantics.operations.find(
        (operation) => operation.path === path,
      );
      expect(gradient?.kind).toBe("derivative");
      expect(gradient?.dimensionExponents).toEqual(DENSITY_GRADIENT);
    }
    const pressureGradient = compile(display("eq-s3-d4")).semantics.operations.find(
      (operation) => operation.path === "row1.left.args.1.argument",
    );
    expect(pressureGradient?.dimensionExponents).toEqual(FORCE_DENSITY);
  });

  test("the pressure chain reuses its printed left side and the diffusion flux remains a standalone expression", () => {
    const source = display("eq-s2-d12");
    const parsed = parse(source);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.continuationRows).toEqual([1, 2]);
    const first = parsed.rows[0]?.tree;
    assert(first?.kind === "relation");
    for (const row of parsed.rows) {
      assert(row.tree.kind === "relation");
      expect(row.tree.left).toEqual(first.left);
    }
    const symbols = sourceNodes(parsed).flatMap(({ node }) =>
      node.tree.kind === "symbol" ? [node.tree] : [],
    );
    expect(symbols.filter((symbol) => symbol.quantityId === "osmoticPressure")).toHaveLength(1);
    expect(symbols).toHaveLength(source.terms.length);
    const flux = compile(display("eq-s3-d8"));
    expect(flux.semantics.rows).toHaveLength(1);
    expect(flux.semantics.rows[0]?.kind).toBe("product");
    expect(flux.semantics.operations.some((operation) => operation.kind === "relation")).toBe(
      false,
    );
  });

  test("the two algebraic pressure forms agree with the existing configuration-volume owner", () => {
    const set = getConstantSet("modern-si-2019");
    const input = { Np: 100, V: 0.01, V0: 0.02, T: 300 };
    const reference = configurationVolumeTerm(input, set);
    assert("pressure" in reference && reference.pressure.result.status === "value");
    assert(typeof reference.pressure.result.value === "number");
    const source = display("eq-s2-d12");
    const algebraOnly = {
      ...source,
      terms: source.terms.filter((term) => term.quantityId !== "freeEnergy"),
    };
    const values = bindings(algebraOnly, {
      osmoticPressure: reference.pressure.result.value,
      volume: input.V,
      particleCount: input.Np,
      numberDensity: input.Np / input.V,
      temperature: input.T,
      molarGasConstant: constantValue(set, "molarGasConstant").value,
      avogadroConstant: constantValue(set, "avogadroConstant").value,
    });
    // Evaluate the actual parsed algebra, without treating the unknown free-energy offset as data.
    for (const row of parse(source).rows.slice(1)) {
      assert(row.tree.kind === "relation");
      const left = evaluateExpression(row.tree.left, values);
      const right = evaluateExpression(row.tree.right, values);
      expect(right / left).toBeCloseTo(1, 12);
      expect(right / reference.pressure.result.value).toBeCloseTo(1, 12);
    }
    expect(reference.freeEnergyOffset.status).toBe("symbolic");
    expect(reference.volumeIndependentFactor.status).toBe("symbolic");
  });

  test("the printed drift contribution agrees with the flux owner for both force directions", () => {
    const source = display("eq-2");
    const drift = sourceNodes(parse(source)).find(({ path }) => path === "row1.left.args.0")?.node
      .tree;
    assert(drift?.kind === "quotient");
    const eta = 1e-3;
    const radius = 1e-6;
    const density = 1e15;
    const diffusivity = 1e-12;
    const mobility = stokesMobility(eta, radius);
    assert(mobility.result.status === "value" && typeof mobility.result.value === "number");
    for (const force of [-1e-18, 1e-18]) {
      const reference = driftDiffusionFlux(density, 0, force, mobility.result.value, diffusivity);
      assert("drift" in reference && reference.drift.result.status === "value");
      assert(typeof reference.drift.result.value === "number");
      const values = bindings(source, {
        numberDensity: density,
        externalForcePerParticle: force,
        viscosity: eta,
        particleRadius: radius,
        diffusionCoefficient: diffusivity,
        positionCoordinate1d: 0,
      });
      expect(evaluateExpression(drift, values) / reference.drift.result.value).toBeCloseTo(1, 12);
      expect(Math.sign(evaluateExpression(drift, values))).toBe(Math.sign(force));
    }
  });

  test("lost or reversed signs cannot inherit the original pressure and equilibrium explanations", () => {
    for (const [id, replacement] of [
      ["eq-s2-d12", ""],
      ["eq-s3-1", ""],
      ["eq-s3-d4", "+"],
      ["eq-s3-d8", ""],
      ["eq-2", "+"],
    ] as const) {
      const value = display(id);
      const changed = replaceOperator(value, "-", replacement);
      expect(changed.latex).not.toBe(value.latex);
      refuses(() => compile(changed));
      expect(() => compile(value)).not.toThrow();
    }
  });

  test("a changed Stokes factor, a missing pi, or a nonzero right side cannot retain zero-flux readings", () => {
    for (const [from, to] of [
      ["6", "3"],
      ["\\pi ", ""],
      ["= 0", "= 1"],
    ] as const) {
      const changed = replaceOperator(display("eq-2"), from, to);
      refuses(() => compile(changed));
    }
  });

  test("dimensionally equal free-energy and spatial-variable substitutions are refused", () => {
    for (const [id, from, to] of [
      ["eq-s2-d12", "freeEnergy", "bodyEnergyRestBefore"],
      ["eq-s3-d4", "positionCoordinate1d", "displacementIncrement"],
      ["eq-s3-d8", "positionCoordinate1d", "displacementIncrement"],
    ] as const) {
      const value = display(id);
      const changed = {
        ...value,
        terms: value.terms.map((term) =>
          term.quantityId === from ? { ...term, quantityId: to } : term,
        ),
      };
      for (const row of parse(changed).rows)
        expect(checkDimensions(row.tree, registry, { context: "gaussian-cgs" }).status).toBe(
          "consistent",
        );
      refuses(() => compile(changed));
    }
  });

  test("first derivatives cannot silently acquire curvature meanings", () => {
    const value = display("eq-s3-d4");
    const numerator = replaceOperator(value, "\\partial ", "\\partial^2 ");
    const changed = replaceOperator(numerator, "{\\partial x}", "{\\partial x^2}");
    const derivative = sourceNodes(parse(changed)).find(
      ({ node }) => node.tree.kind === "derivative",
    )?.node.tree;
    expect(derivative).toMatchObject({ kind: "derivative", partial: true, order: 2 });
    refuses(() => compile(changed));
  });

  test("the explanation distinguishes continuing motion, radius, viscosity and the zero-force limit", () => {
    const flux = compile(display("eq-2")).semantics;
    expect(flux.premise).toContain("radius P");
    expect(flux.premise).toContain("viscosity k");
    expect(flux.premise).toContain("0 = 0");
    expect(flux.premise).toContain("cannot determine D");
    expect(flux.operations.find((operation) => operation.path === "row1")?.why).toContain(
      "particles continue moving",
    );
    expect(
      flux.operations.find((operation) => operation.path === "row1.left.args.0.denominator")?.why,
    ).toContain("radius, not a diameter");
    expect(compile(display("eq-s2-d12")).semantics.premise).toContain(
      "fixed temperature T and fixed particle count n",
    );
  });

  test("every equilibrium display has a real operation reference and foundation links without JavaScript", async () => {
    const result = await printedDisplays(ROOT, ["brownian-motion"], []);
    expect(result.problems).toEqual([]);
    for (const id of IDS) {
      const value = result.displays.find((item) => item.display === id);
      assert(value?.semantics);
      const html = renderToStaticMarkup(
        <PrintedDisplayTerms display={value} inline={false}>
          <span>Source equation</span>
        </PrintedDisplayTerms>,
      );
      expect(html).toContain('href="/equations/brownian-motion/' + id + '/#operations"');
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

  test("selecting a density gradient highlights its density and position without selecting D", async () => {
    const result = await printedDisplays(ROOT, ["brownian-motion"], []);
    const value = result.displays.find((item) => item.display === "eq-s3-d8");
    assert(value?.semantics);
    const gradient = value.semantics.operations.find(
      (operation) => operation.path === "row1.args.1",
    );
    assert(gradient);
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
        select.value = gradient.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(
        container.querySelector("[data-operation-note]")?.getAttribute("data-operation-note"),
      ).toBe(gradient.id);
      expect(getLastAnnouncement()).toContain(gradient.does);
      const selectedTerms = [...container.querySelectorAll("[data-term][data-operation-selected]")]
        .map((element) => element.getAttribute("data-term"))
        .sort();
      expect(selectedTerms).toEqual([...gradient.termIds].sort());
      expect(
        value.terms
          .filter((term) => selectedTerms.includes(term.termId))
          .map((term) => term.quantityId)
          .sort(),
      ).toEqual(["numberDensity", "positionCoordinate1d"]);
      expect(
        value.terms
          .filter((term) => term.quantityId === "diffusionCoefficient")
          .every((term) => !selectedTerms.includes(term.termId)),
      ).toBe(true);
    } finally {
      await act(async () => root.unmount());
      clearAnnouncement();
      setLiveRegionElement(null);
      await uninstallDom();
    }
  });
});
