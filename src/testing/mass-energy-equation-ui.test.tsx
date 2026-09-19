import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { CoefficientLab, CoefficientComparison } from "../components/lab/CoefficientLab.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import type { PreparedMe02Example } from "../experiments/me02/session.ts";
import payload from "../generated/mass-energy-equations.json";
import prepared from "../generated/me02-example.json";
import { ArgumentEquations } from "../reader/ArgumentEquations.tsx";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

beforeEach(installDom);
afterEach(uninstallDom);
const equations = payload.equations as readonly CompiledEquation[];
const example = prepared as PreparedMe02Example;
const dropSelector = '[data-term-value="eq-model-me-exact-drop.t.kineticEnergyDifference"]';
async function mounted(element: ReactNode, check: (container: HTMLElement) => Promise<void>) {
  const container = createContainer(), root = createRoot(container);
  try { await act(async () => { root.render(element); }); await check(container); }
  finally { await act(async () => { root.unmount(); }); removeContainer(container); }
}
async function selectUnit(container: HTMLElement, unit: string) {
  const select = container.querySelector<HTMLSelectElement>('select[name="energyUnit"]')!;
  await act(async () => { select.value = unit; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function apply(container: HTMLElement) {
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

test("reader disclosures contain every equation exactly once, scoped to its own argument", () => {
  const args = [...new Set(equations.map(e => e.argument))];
  const shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(<>{args.map(argumentId =>
    <ArgumentEquations key={argumentId} paperId="mass-energy" argumentId={argumentId} />)}</>);
  expect(shell.querySelectorAll("[data-equation-id]").length).toBe(15);
  expect(new Set([...shell.querySelectorAll("[data-equation-id]")].map(e => e.getAttribute("data-equation-id"))).size).toBe(15);
  expect(shell.querySelectorAll("[data-equation-id] math").length).toBe(15);
  for (const eq of equations) {
    const disclosure = shell.querySelector(`[data-argument-equations="${eq.argument}"]`)!;
    expect(disclosure.querySelector(`[data-equation-id^="${eq.id}-"]`)).not.toBeNull();
    for (const note of eq.notes) expect(disclosure.textContent).toContain(note.explanation);
  }
  expect(renderToStaticMarkup(<ArgumentEquations paperId="light-quanta" argumentId={args[0]!} />)).toBe("");
});

test("the static normalized laboratory cannot print its values as SI and never hides the worked answer", () => {
  const shell = document.createElement("div");
  shell.innerHTML = renderToStaticMarkup(<CoefficientLab example={example} equations={equations} />);
  expect(shell.querySelector("[data-response]")?.hasAttribute("hidden")).toBe(false);
  expect(shell.querySelector(dropSelector)?.getAttribute("data-value-kind")).toBe("symbolic");
  expect(shell.querySelector(dropSelector)?.textContent).toContain("normalized units");
  expect(shell.querySelectorAll("[data-coefficient-equations] math").length).toBe(5);
  expect(shell.querySelectorAll('[data-coefficient-equations] [data-value-kind="value"]').length).toBe(0);
});

test("applying units changes substitutions, while draft units do not relabel accepted results", async () => {
  await mounted(<CoefficientLab example={example} equations={equations} />, async container => {
    expect(container.querySelector(dropSelector)?.getAttribute("data-value-kind")).toBe("symbolic");
    await selectUnit(container, "joule");
    expect(container.querySelector(dropSelector)?.getAttribute("data-value-kind")).toBe("symbolic");
    await apply(container);
    expect(container.querySelector(dropSelector)?.textContent).toBe("0.25 J");
    await selectUnit(container, "normalized");
    expect(container.querySelector(dropSelector)?.textContent).toBe("0.25 J");
    await apply(container);
    expect(container.querySelector(dropSelector)?.getAttribute("data-value-kind")).toBe("symbolic");
    expect(container.querySelector("[data-response]")?.hasAttribute("hidden")).toBe(false);
  });
});

test("standalone settings restore into the same accepted equation snapshot; embedded labs stay independent", async () => {
  window.history.replaceState({}, "", "/lab/me-02/?beta=0.6&L=2&unit=joule");
  await mounted(<><CoefficientComparison example={example} equations={equations} />
    <CoefficientLab example={example} equations={equations} /></>, async container => {
    const labs = container.querySelectorAll<HTMLElement>('[data-instrument-id="me-02"]');
    expect(labs.length).toBe(2);
    expect(labs[0]!.querySelector(dropSelector)?.textContent).toBe("0.5 J");
    expect(labs[1]!.querySelector(dropSelector)?.getAttribute("data-value-kind")).toBe("symbolic");
    const identities = [...labs].map(lab => lab.querySelector("[data-equation-values]")?.getAttribute("data-instance-id"));
    expect(identities[0]).not.toBe(identities[1]);
  });
});

test("term selection opens the exact prerequisite without requiring pointer-only math interaction", async () => {
  await mounted(<ArgumentEquations paperId="mass-energy" argumentId="arg-me-constant-premise" />, async container => {
    const chip = container.querySelector<HTMLButtonElement>('[data-node-id="eq-model-me-exact-drop.t.kineticEnergyDifference"]')!;
    expect(chip.disabled).toBe(false);
    await act(async () => { chip.click(); });
    const inspector = container.querySelector('[data-inspector-node="eq-model-me-exact-drop.t.kineticEnergyDifference"]');
    expect(inspector).not.toBeNull();
    expect(inspector?.textContent).toContain("before minus after");
    expect(inspector?.querySelector('a[data-foundation]')?.getAttribute("href")).toBe("/foundations/work-energy/");
  });
});
