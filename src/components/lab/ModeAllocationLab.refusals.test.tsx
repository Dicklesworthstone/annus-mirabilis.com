import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { ModeAllocationLab } from "./ModeAllocationLab.tsx";

/**
 * LQ-02 refuses a field that is not a positive quantity at the form, in words, and states a large
 * accepted temperature in powers of ten. On live on 2026-09-24 a cutoff of -1e300 reached the
 * kernel, and every energy row printed "Not modeled here: Cutoff frequency must be positive and
 * finite (got -1e+300)."; a temperature of 1e300 was stated "at 1e+300 K".
 */
type Props = Record<string, ((event: unknown) => void) | undefined>;
function reactProps(el: Element): Props {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
  return key ? ((el as unknown as Record<string, Props>)[key] ?? {}) : {};
}
function field(container: HTMLElement, label: string): HTMLInputElement {
  const l = [...container.querySelectorAll("label")].find((x) => x.textContent === label);
  const input = container.querySelector<HTMLInputElement>(`#${CSS.escape(l?.htmlFor ?? "")}`);
  if (!input) throw new TypeError(`no field labelled ${label}`);
  return input;
}
/** Under this happy-dom harness dispatched events do not reach React, so the props are called. */
function type(input: HTMLInputElement, value: string) {
  const onChange = reactProps(input).onChange;
  expect(onChange).toBeDefined();
  input.value = value;
  onChange?.({ currentTarget: input, target: input });
}
/**
 * The form's current onSubmit. happy-dom's form element does not list React's expando keys, but
 * reading one by name works, and the name is the input's props key: React gives every element in a
 * root the same suffix.
 */
function submit(input: HTMLInputElement) {
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps$")) ?? "";
  const form = input.closest("form");
  const onSubmit = form
    ? (form as unknown as Record<string, Props | undefined>)[key]?.onSubmit
    : undefined;
  expect(onSubmit).toBeDefined();
  onSubmit?.({ preventDefault() {} });
}

describe("LQ-02 refuses a non-positive field and states a large temperature readably", () => {
  beforeEach(async () => {
    await installDom();
  });
  afterEach(async () => {
    await uninstallDom();
  });

  test("a negative cutoff is refused at the form and never reaches the table", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(ModeAllocationLab));
      });
      const cutoff = field(container, "Highest resonator frequency, the cutoff (Hz)");
      await act(async () => {
        type(cutoff, "-1e300");
      });
      await act(async () => {
        submit(cutoff);
      });
      const alert = container.querySelector("[role=alert]");
      expect(alert?.textContent).toBe("Enter a highest resonator frequency above 0 Hz.");
      expect(container.textContent).not.toContain("Not modeled here: Cutoff frequency");
      expect(container.textContent).not.toMatch(/\de[+-]\d/);

      const temperature = field(container, "Temperature (K)");
      // One field per act: each onChange closes over the draft of the render it came from.
      await act(async () => {
        type(cutoff, "1e14");
      });
      await act(async () => {
        type(temperature, "1e300");
      });
      await act(async () => {
        submit(cutoff);
      });
      expect(container.querySelector("[role=alert]")).toBeNull();
      expect(container.textContent).toContain("at 1 × 10³⁰⁰ K");
      expect(container.textContent).not.toContain("1e+300");
    } finally {
      await act(async () => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
