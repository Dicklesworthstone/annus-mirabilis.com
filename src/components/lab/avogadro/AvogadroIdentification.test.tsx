import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AVOGADRO_DEFAULTS,
  type AvogadroParameters,
  encodeAvogadroParameters,
} from "../../../experiments/avogadro/definition.ts";
import { installDom, uninstallDom } from "../../../testing/reactDom.ts";
import { AvogadroLab } from "./AvogadroLab.tsx";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;

test("the served laboratory already contains the owner-computed diffusion family and a reachable preview anchor", () => {
  const html = renderToStaticMarkup(<AvogadroLab sourceDigest={sourceDigest} />);
  expect(html).toContain('id="identify-two-observations"');
  expect(html).toContain('data-identification-pinned="false"');
  expect(html).toContain('data-identification-basis="modern-si-2019"');
  expect(html).toContain("Candidate pairs under the same accepted observations");
  expect(html).toContain(
    'data-identification-quantity="molecularNumber" data-result-status="underdetermined"',
  );
  expect(html).toContain("historical dissertation datasets remain in preparation");
  expect(html).not.toContain('data-satisfies-both="true"');
  expect(html).toMatch(/disabled=""[^>]*>Pin accepted solute observations/);
});

describe("the mounted Avogadro second-observation workflow", () => {
  let root: Root;
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom();
    history.replaceState(null, "", "/lab/avogadro-lab/");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    await uninstallDom();
  });
  function element<T extends Element = HTMLElement>(selector: string): T {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Missing production control: ${selector}`);
    return found;
  }
  function workflow() {
    return element<HTMLElement>("[data-avogadro-identification]");
  }
  function observation() {
    return element<HTMLElement>("[data-identification-observation-version]");
  }
  function table() {
    return element("[data-avogadro-identification] table");
  }
  function conclusions() {
    return element("[data-identification-conclusions]");
  }
  async function show() {
    await act(async () => root.render(<AvogadroLab sourceDigest={sourceDigest} />));
  }
  async function click(label: string) {
    const button = [...workflow().querySelectorAll("button")].find(
      (node) => node.textContent === label,
    );
    if (!button) throw new Error(`Missing button: ${label}`);
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
  }
  async function restore(parameters: AvogadroParameters) {
    history.replaceState(null, "", `/lab/avogadro-lab/?${encodeAvogadroParameters(parameters)}`);
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  }
  async function draft(name: string, value: string) {
    const control = element<HTMLInputElement>(`[name="${name}"]`);
    const key = Object.getOwnPropertyNames(control).find((name) =>
      name.startsWith("__reactProps$"),
    );
    if (!key) throw new Error("Missing mounted React input handler.");
    const handlers = (control as unknown as Record<string, { onChange: (event: unknown) => void }>)[
      key
    ];
    if (!handlers) throw new Error("Missing mounted React input handlers.");
    await act(async () => {
      control.value = value;
      handlers.onChange({ target: control, currentTarget: control });
    });
  }

  test("pin, admit and withhold update the real inference without changing the main laboratory", async () => {
    await show();
    const lab = element<HTMLElement>('[data-instrument-id="avogadro-lab"]');
    const revision = lab.dataset.snapshotVersion;
    const run = lab.dataset.runId;
    const main = element('[aria-label="Molecular-number comparison"]').innerHTML;
    const admit = [...workflow().querySelectorAll("button")].find(
      (node) => node.textContent === "Admit the pinned viscosity observation",
    )!;
    expect(admit.disabled).toBe(true);
    await click("Pin accepted solute observations");
    const family = table().innerHTML;
    const source = observation().dataset.identificationObservationVersion;
    expect(conclusions().querySelector('[data-result-status="value"]')).toBeNull();
    await click("Admit the pinned viscosity observation");
    expect(workflow().dataset.viscosityAdmitted).toBe("true");
    expect(table().querySelectorAll('[data-satisfies-both="true"]')).toHaveLength(1);
    expect(table().textContent).toContain("Both relations");
    expect(table().textContent).toContain("Diffusion only");
    expect(conclusions().querySelectorAll('[data-result-status="value"]')).toHaveLength(2);
    expect(observation().dataset.identificationObservationVersion).toBe(source);
    await click("Withhold viscosity again");
    expect(table().innerHTML).toBe(family);
    expect(conclusions().querySelectorAll('[data-result-status="underdetermined"]')).toHaveLength(
      2,
    );
    expect(element('[aria-label="Molecular-number comparison"]').innerHTML).toBe(main);
    expect(lab.dataset.snapshotVersion).toBe(revision);
    expect(lab.dataset.runId).toBe(run);
    expect(workflow().querySelector('[role="status"]')?.textContent).toContain(
      "pinned observations are unchanged",
    );
  });

  test("accepted main-lab changes preserve the pinned basis, candidates and admission until explicit replacement", async () => {
    await show();
    await click("Pin accepted solute observations");
    await click("Admit the pinned viscosity observation");
    const saved = observation().innerHTML;
    const source = observation().dataset.identificationObservationVersion;
    await restore({
      ...AVOGADRO_DEFAULTS,
      constantBasis: 1,
      soluteDiffusionUm2S: 1000,
      coefficient: 1,
    });
    expect(observation().innerHTML).toBe(saved);
    expect(observation().dataset.identificationBasis).toBe("modern-si-2019");
    expect(workflow().dataset.viscosityAdmitted).toBe("true");
    expect(element("[data-identification-source-changed]").textContent).toContain(
      "newer accepted result",
    );
    await click("Replace with current accepted solute observations");
    expect(workflow().dataset.viscosityAdmitted).toBe("false");
    expect(observation().dataset.identificationObservationVersion).not.toBe(source);
    expect(observation().dataset.identificationBasis).toBe("einstein-1905-brownian-printed");
    expect(observation().textContent).toContain("R = 8.31");
    expect(workflow().querySelector("[data-identification-source-changed]")).toBeNull();
    expect(conclusions().querySelectorAll('[data-result-status="underdetermined"]')).toHaveLength(
      2,
    );
    await click("Admit the pinned viscosity observation");
    expect(table().querySelectorAll('[data-satisfies-both="true"]')).toHaveLength(1);
    expect(observation().innerHTML).not.toBe(saved);
  });

  test("unsubmitted draft inputs do not enter a new pin and a refused draft cannot rewrite pinned work", async () => {
    await show();
    const before = table().innerHTML;
    await draft("soluteDiffusionUm2S", "1000");
    await click("Pin accepted solute observations");
    expect(element<HTMLInputElement>('[name="soluteDiffusionUm2S"]').value).toBe("1000");
    expect(table().querySelector("tbody")?.innerHTML).toBe(
      new DOMParser()
        .parseFromString(`<table>${before}</table>`, "text/html")
        .querySelector("tbody")?.innerHTML,
    );
    await click("Admit the pinned viscosity observation");
    const pinned = observation().innerHTML;
    await draft("specificViscosity", "-1");
    await act(async () =>
      element<HTMLFormElement>('form[aria-label="Three-method comparison settings"]').dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    expect(element('[data-refusal-code="invalid-parameter"]').textContent).toContain(
      "last accepted example",
    );
    expect(observation().innerHTML).toBe(pinned);
    expect(workflow().dataset.viscosityAdmitted).toBe("true");
  });

  test("an admitted observation outside the dilute model keeps its explanation and never draws an intersection", async () => {
    await show();
    await restore({ ...AVOGADRO_DEFAULTS, specificViscosity: 0.2 });
    await click("Pin accepted solute observations");
    expect(conclusions().querySelectorAll('[data-result-status="underdetermined"]')).toHaveLength(
      2,
    );
    await click("Admit the pinned viscosity observation");
    expect(conclusions().textContent).toContain("5%");
    expect(conclusions().querySelectorAll('[data-result-status="outside-domain"]')).toHaveLength(2);
    expect(table().querySelector('[data-satisfies-both="true"]')).toBeNull();
    expect(table().textContent).not.toContain("Intersection");
    await click("Withhold viscosity again");
    expect(conclusions().querySelectorAll('[data-result-status="underdetermined"]')).toHaveLength(
      2,
    );
  });

  test("a zero concentration and zero viscosity excess cannot become an invented molecular number", async () => {
    await show();
    await restore({ ...AVOGADRO_DEFAULTS, molarConcentration: 0, specificViscosity: 0 });
    await click("Pin accepted solute observations");
    await click("Admit the pinned viscosity observation");
    expect(conclusions().querySelectorAll('[data-result-status="underdetermined"]')).toHaveLength(
      2,
    );
    expect(table().querySelector('[data-satisfies-both="true"]')).toBeNull();
    expect(workflow().textContent).not.toMatch(/NaN|Infinity/);
  });
});
