import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BM02_DRAFT_TAPE } from "../../experiments/bm02/draftTape.ts";
import { type Bm02Inputs, DEFAULT_BM02_INPUTS } from "../../experiments/bm02/session.ts";
import { encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { draftTapeForSettings } from "../../experiments/permalink/draftTape.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { OsmoticPartitionLab } from "./OsmoticPartitionLab.tsx";

const MODERN = "modern-si-2019";
const HISTORICAL = "einstein-1905-brownian-printed";
const CLASSICAL = "classical-thermodynamics-suspended-bodies";

type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

function handlers(control: Element, target: Element = control): Handlers {
  // happy-dom's select and form elements do not enumerate React's expando properties. An input
  // in the same mounted form exposes the renderer's key, which also reads those elements' props.
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.keys(candidate))
    .find((name) => name.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  if (!key) return {};
  const props = (target as unknown as Record<string, Handlers | undefined>)[key];
  expect(props).toBeDefined();
  return props ?? {};
}

/** As in ModeAllocationLab.refusals.test.tsx, happy-dom inputs use their mounted React handlers. */
async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const onChange = handlers(control).onChange;
    expect(onChange).toBeDefined();
    control.value = value;
    onChange?.({ target: control, currentTarget: control });
  });
}

async function apply(container: HTMLElement) {
  const control = element<HTMLInputElement>(container, 'input[name="T"]');
  const form = element<HTMLFormElement>(container, 'form[aria-label="Osmotic partition settings"]');
  await act(async () => {
    const onSubmit = handlers(control, form).onSubmit;
    expect(onSubmit).toBeDefined();
    onSubmit?.({ preventDefault() {} });
  });
}

function pressure(container: HTMLElement): string | null {
  return element(container, '[data-output="osmoticPressure"] .sci').getAttribute("aria-label");
}

function outputs(container: HTMLElement): Readonly<Record<string, string | null>> {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-output]")].map((output) => [
      output.getAttribute("data-output"),
      output.textContent,
    ]),
  );
}

async function withLab(
  run: (container: HTMLElement) => Promise<void>,
  example: Bm02Inputs = DEFAULT_BM02_INPUTS,
  address = "/lab/bm-02/",
) {
  window.history.replaceState(null, "", address);
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () => root.render(<OsmoticPartitionLab example={example} />));
    element<HTMLDetailsElement>(container, ".experiment-settings").open = true;
    await run(container);
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
  }
}

describe("BM-02 keeps its selected constants with the accepted calculation", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("selecting historical constants changes the draft, and Apply updates the real outputs", async () => {
    await withLab(async (container) => {
      const lab = element(container, '[data-instrument-id="bm-02"]');
      const selector = element<HTMLSelectElement>(container, 'select[name="constantSetId"]');
      const firstRun = lab.getAttribute("data-run-id");
      const firstDensity = element(container, '[data-output="numberDensity"]').textContent;
      expect(lab.getAttribute("data-constant-set")).toBe(MODERN);
      expect(pressure(container)).toBe("4.047373 times 10 to the power minus 6");

      await change(selector, HISTORICAL);
      expect(selector.value).toBe(HISTORICAL);
      expect(lab.getAttribute("data-constant-set")).toBe(MODERN);
      expect(lab.getAttribute("data-run-id")).toBe(firstRun);
      expect(pressure(container)).toBe("4.047373 times 10 to the power minus 6");

      await apply(container);
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).not.toBe(firstRun);
      expect(lab.getAttribute("data-execution-label")).toBe("host");
      // n = 10^15 m^-3, T = 293.15 K and the historical thermal constant 8.31/(6 × 10^23).
      expect(pressure(container)).toBe("4.060128 times 10 to the power minus 6");
      expect(element(container, '[data-output="numberDensity"]').textContent).toBe(firstDensity);
      expect(element(container, "[data-accepted-constants]").textContent).toContain(
        "editorial input, not a number printed in this paper",
      );
    });
  });

  test("a malformed temperature retains the historical calculation and explains its currency", async () => {
    await withLab(async (container) => {
      const lab = element(container, '[data-instrument-id="bm-02"]');
      await change(element(container, 'select[name="constantSetId"]'), HISTORICAL);
      await apply(container);
      const acceptedRun = lab.getAttribute("data-run-id");
      const acceptedOutputs = outputs(container);
      expect(pressure(container)).toBe("4.060128 times 10 to the power minus 6");
      const temperature = element<HTMLInputElement>(container, 'input[name="T"]');
      await change(temperature, "not a temperature");
      await apply(container);

      expect(temperature.value).toBe("not a temperature");
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).toBe(acceptedRun);
      expect(outputs(container)).toEqual(acceptedOutputs);
      const currency = element(container, '[data-currency-state="refused"]');
      expect(currency.getAttribute("data-refusal-code")).toBe("invalid-parameter");
      expect(currency.textContent).toContain(
        "The numbers shown belong to the last accepted inputs",
      );
      expect(element(container, "form [role=alert]").textContent).toContain(
        "still those of the last accepted settings",
      );

      await change(temperature, "293.15");
      await apply(container);
      expect(container.querySelector("[data-currency-state=refused]")).toBeNull();
      expect(container.querySelector("form [role=alert]")).toBeNull();
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(pressure(container)).toBe("4.060128 times 10 to the power minus 6");
    });
  });

  test("a historical classical tape loads both choices into the form and calculates only on Apply", async () => {
    const shared: Bm02Inputs = {
      ...DEFAULT_BM02_INPUTS,
      constantSetId: HISTORICAL,
      model: CLASSICAL,
      Np: 4000,
      T: 310,
    };
    const tape = draftTapeForSettings(BM02_DRAFT_TAPE, shared);
    expect(tape).not.toBeNull();
    if (!tape) return;
    await withLab(
      async (container) => {
        for (let i = 0; i < 100 && !container.querySelector("[data-tape-loaded]"); i++) {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
          });
        }
        expect(element(container, "[data-tape-loaded]").textContent).toContain(
          "Apply them to calculate",
        );
        expect(container.querySelector("[data-tape-notice]")).toBeNull();
        const lab = element(container, '[data-instrument-id="bm-02"]');
        expect(element<HTMLSelectElement>(container, 'select[name="constantSetId"]').value).toBe(
          HISTORICAL,
        );
        const classical = [...container.querySelectorAll(".model-toggle button")].find((button) =>
          button.textContent?.startsWith("Classical expectation"),
        );
        expect(classical?.getAttribute("aria-pressed")).toBe("true");
        expect(element<HTMLInputElement>(container, 'input[name="Np"]').value).toBe("4000");
        expect(element<HTMLInputElement>(container, 'input[name="T"]').value).toBe("310");
        expect(lab.getAttribute("data-constant-set")).toBe(MODERN);
        expect(lab.getAttribute("data-model")).toBe("molecular-kinetic");
        expect(lab.getAttribute("data-accepted-input-revision")).toBe("0");
        expect(lab.getAttribute("data-execution-label")).toBe("static");
        expect(pressure(container)).toBe("4.047373 times 10 to the power minus 6");

        await apply(container);
        expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
        expect(lab.getAttribute("data-model")).toBe(CLASSICAL);
        expect(lab.getAttribute("data-execution-label")).toBe("host");
        expect(Number(element(container, '[data-output="osmoticPressure"] .sci').textContent)).toBe(
          0,
        );
        expect(element(container, '[data-output="osmoticPressure"]').textContent).toMatch(/ Pa$/);
        expect(Number(element(container, '[data-output="partitionForce"] .sci').textContent)).toBe(
          0,
        );
        expect(element(container, '[data-output="partitionForce"]').textContent).toMatch(/ N$/);
      },
      DEFAULT_BM02_INPUTS,
      `/lab/bm-02/?tape=${encodeTapePermalink(tape)}`,
    );
  });

  test("the sugar preset explicitly restores modern SI constants and the molecular model", async () => {
    await withLab(
      async (container) => {
        const lab = element(container, '[data-instrument-id="bm-02"]');
        expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
        expect(lab.getAttribute("data-model")).toBe(CLASSICAL);
        const sugar = [...container.querySelectorAll("button")].find((button) =>
          button.textContent?.startsWith("Compare: 0.01 mol/L sugar"),
        );
        expect(sugar).toBeDefined();
        if (!sugar) return;
        await act(async () => {
          const onClick = handlers(sugar).onClick;
          expect(onClick).toBeDefined();
          onClick?.({});
        });
        expect(lab.getAttribute("data-constant-set")).toBe(MODERN);
        expect(lab.getAttribute("data-model")).toBe("molecular-kinetic");
        expect(lab.getAttribute("data-execution-label")).toBe("host");
        expect(element<HTMLSelectElement>(container, 'select[name="constantSetId"]').value).toBe(
          MODERN,
        );
        expect(element<HTMLInputElement>(container, 'input[name="Np"]').value).toBe("602214076000");
        expect(pressure(container)).toBe("2.437385 times 10 to the power 4");
        expect(element(container, "[data-accepted-constants]").textContent).toContain(
          "exact SI Boltzmann constant",
        );
      },
      { ...DEFAULT_BM02_INPUTS, constantSetId: HISTORICAL, model: CLASSICAL },
    );
  });
});
