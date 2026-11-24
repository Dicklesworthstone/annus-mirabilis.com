import { afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LQ04_DEFAULTS } from "../../../experiments/lq04/definition.ts";
import generated from "../../../generated/lq04-example.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { EntropyWorkbenchLab } from "./EntropyWorkbenchLab.tsx";

const HISTORICAL = "einstein-1905-light-quanta-printed";
type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.keys(candidate))
    .find((name) => name.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  if (!key) return;
  const onChange = (control as unknown as Record<string, Handlers | undefined>)[key]?.onChange;
  expect(onChange).toBeDefined();
  await act(async () => {
    control.value = value;
    onChange?.({ target: control, currentTarget: control });
  });
}

async function submit(container: HTMLElement) {
  await act(async () =>
    element<HTMLFormElement>(container, "form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}

beforeEach(installDom);
afterEach(uninstallDom);

test("the entropy selector applies historical constants without relabeling an unaccepted draft", async () => {
  const container = createContainer();
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <EntropyWorkbenchLab
          restoreFromLocation={false}
          example={{ sourceDigest: generated.sourceDigest, parameters: LQ04_DEFAULTS }}
        />,
      ),
    );
    const lab = element(container, '[data-instrument-id="lq-04"]');
    const selector = element<HTMLSelectElement>(container, 'select[name="constantSetId"]');
    const initialRun = lab.getAttribute("data-run-id");
    expect(lab.getAttribute("data-constant-set")).toBe("modern-si-2019");
    await change(selector, HISTORICAL);
    expect(lab.getAttribute("data-constant-set")).toBe("modern-si-2019");
    expect(lab.getAttribute("data-run-id")).toBe(initialRun);
    await submit(container);
    expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
    expect(lab.getAttribute("data-run-id")).not.toBe(initialRun);
    expect(lab.getAttribute("data-execution-label")).toBe("host");
    const constants = element(container, "[data-accepted-constants]");
    expect(constants.getAttribute("data-accepted-constants")).toBe(HISTORICAL);
    expect(constants.textContent).toContain("corrected exponent");
    expect(constants.textContent).toContain("editorial gas constant");
    expect(container.textContent).toContain("E/[(R/N)βν]");
    const historicalRun = lab.getAttribute("data-run-id");
    const half = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Half",
    );
    expect(half).toBeDefined();
    await act(async () => half?.click());
    expect(lab.getAttribute("data-run-id")).toBe(historicalRun);
    expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
    const acceptedNumbers = [...container.querySelectorAll(".lab-results .sci")].map((value) =>
      value.getAttribute("aria-label"),
    );
    expect(acceptedNumbers.length).toBeGreaterThan(0);

    await change(element(container, 'input[id$="-frequency"]'), "0");
    await change(selector, "modern-si-2019");
    await submit(container);
    expect(lab.getAttribute("data-run-id")).toBe(historicalRun);
    expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
    expect(constants.getAttribute("data-accepted-constants")).toBe(HISTORICAL);
    expect(
      [...container.querySelectorAll(".lab-results .sci")].map((value) =>
        value.getAttribute("aria-label"),
      ),
    ).toEqual(acceptedNumbers);
    expect(container.querySelector('[data-currency-state="refused"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    removeContainer(container);
  }
});
