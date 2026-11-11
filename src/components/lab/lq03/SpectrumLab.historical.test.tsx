import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { LQ03_DEFAULTS } from "../../../experiments/lq03/definition.ts";
import { evaluateLq03 } from "../../../experiments/lq03/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { SpectrumLab } from "./SpectrumLab.tsx";

const HISTORICAL = "einstein-1905-light-quanta-printed";
type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  // happy-dom exposes the mounted React key on an input in the same form as the select.
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

function density(container: HTMLElement) {
  return element(container, '[data-output="frequencyEnergyDensity"] .sci').getAttribute(
    "aria-label",
  );
}

describe("SpectrumLab keeps the historical calculation with its accepted constants", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("changing constants recalculates the spectrum; an invalid draft cannot relabel the retained result", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <SpectrumLab
            restoreFromLocation={false}
            example={{
              parameters: LQ03_DEFAULTS,
              evaluation: evaluateLq03(LQ03_DEFAULTS),
              sourceDigest: labDigests["lq-03"],
            }}
          />,
        ),
      );
      const lab = element(container, '[data-instrument-id="lq-03"]');
      const initialRun = lab.getAttribute("data-run-id");
      const modernDensity = density(container);
      expect(lab.getAttribute("data-constant-set")).toBe("modern-si-2019");
      const selector = element<HTMLSelectElement>(container, 'select[name="constantSetId"]');
      await change(selector, HISTORICAL);
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).not.toBe(initialRun);
      expect(lab.getAttribute("data-execution-label")).toBe("host");
      expect(density(container)).toBe("3.846958 times 10 to the power minus 16");
      expect(density(container)).not.toBe(modernDensity);
      expect(element(container, "[data-accepted-constants]").textContent).toContain("corrected");
      expect(element(container, "[data-accepted-constants]").textContent).toContain("editorial");
      const acceptedRun = lab.getAttribute("data-run-id");
      await change(element(container, 'input[id$="-T"]'), "not a temperature");
      await change(selector, "modern-si-2019");
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).toBe(acceptedRun);
      expect(density(container)).toBe("3.846958 times 10 to the power minus 16");
      expect(
        element(container, "[data-accepted-constants]").getAttribute("data-accepted-constants"),
      ).toBe(HISTORICAL);
      expect(container.querySelector('[data-currency-state="refused"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });
});
