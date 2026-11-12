import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  decodeLightThreadParameters,
  encodeLightThreadParameters,
  LIGHT_THREAD_DEFAULTS,
} from "../../../experiments/lightThread/definition.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../../testing/reactDom.ts";
import { LightThreadLab } from "./LightThreadLab.tsx";

const HISTORICAL = "einstein-1905-light-quanta-printed";
type Handlers = Record<string, ((event: unknown) => void) | undefined>;

function element<T extends Element>(container: HTMLElement, selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found).not.toBeNull();
  return found as T;
}

/** The mounted form's handlers, using the repository's Happy DOM interaction convention. */
function handler(control: Element, name: string) {
  const input = control.closest("form")?.querySelector("input");
  const key = [control, ...(input ? [input] : [])]
    .flatMap((candidate) => Object.keys(candidate))
    .find((candidate) => candidate.startsWith("__reactProps$"));
  expect(key).toBeDefined();
  const callback = key ? (control as unknown as Record<string, Handlers>)[key]?.[name] : undefined;
  expect(callback).toBeDefined();
  return callback;
}

async function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const onChange = handler(control, "onChange");
  await act(async () => {
    control.value = value;
    onChange?.({ target: control, currentTarget: control });
  });
}

async function apply(container: HTMLElement) {
  const form = element<HTMLFormElement>(container, "form");
  const onSubmit = handler(form, "onSubmit");
  await act(async () => onSubmit?.({ preventDefault() {} }));
}

function reading(container: HTMLElement, quantity: string) {
  return element(container, `[data-quantity-id="${quantity}"]`).textContent;
}

function bookmark(container: HTMLElement) {
  const link = element<HTMLAnchorElement>(container, 'a[href^="/lab/light-thread/?"]');
  return decodeLightThreadParameters(new URL(link.href).search);
}

function exported(container: HTMLElement) {
  const link = element<HTMLAnchorElement>(container, "[data-light-thread-export]");
  return JSON.parse(decodeURIComponent(link.href.slice(link.href.indexOf(",") + 1)));
}

describe("light-thread historical constants follow the accepted comparison", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("selection, observer changes, refusal, bookmark and download use one accepted state", async () => {
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <LightThreadLab sourceDigest={labDigests["light-thread"]} restoreFromLocation={false} />,
        ),
      );
      const lab = element(container, '[data-instrument-id="light-thread"]');
      const modernRun = lab.getAttribute("data-run-id");
      const modernCount = reading(container, "quantumRatioStationary");
      const modernMass = reading(container, "bodyMassLoss");
      const selector = element<HTMLSelectElement>(container, 'select[name="constantSetId"]');
      await change(selector, HISTORICAL);
      expect(lab.getAttribute("data-constant-set")).toBe("modern-si-2019");
      expect(exported(container).constantSetId).toBe("modern-si-2019");
      await apply(container);
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).not.toBe(modernRun);
      expect(lab.getAttribute("data-execution-label")).toBe("host");
      expect(reading(container, "quantumRatioStationary")).not.toBe(modernCount);
      expect(reading(container, "bodyMassLoss")).not.toBe(modernMass);
      expect(element(container, "[data-accepted-constants]").textContent).toContain("editorial");
      expect(container.textContent).toContain("Wien regime");
      expect(bookmark(container)).toMatchObject({
        kind: "accepted",
        parameters: { constantSetId: HISTORICAL },
      });
      const historicalRun = lab.getAttribute("data-run-id");
      const historicalCount = reading(container, "quantumRatioStationary");
      const historicalEnergy = reading(container, "energyMoving");
      const record = exported(container);
      expect(record.constantSetId).toBe(HISTORICAL);
      expect(record.accepted.runId).toBe(historicalRun);
      expect(record.accepted.parameters.constantSetId).toBe(HISTORICAL);

      await change(element(container, 'input[name="beta"]'), "-0.6");
      await apply(container);
      expect(lab.getAttribute("data-run-id")).toBe(historicalRun);
      expect(reading(container, "quantumRatioStationary")).toBe(historicalCount);
      expect(reading(container, "energyMoving")).not.toBe(historicalEnergy);
      expect(exported(container).accepted.parameters.beta).toBe(-0.6);
      const beforeRefusal = exported(container);

      await change(selector, "modern-si-2019");
      await change(element(container, 'input[name="beta"]'), "1");
      await apply(container);
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(lab.getAttribute("data-run-id")).toBe(historicalRun);
      expect(element(container, '[role="alert"]').textContent).toContain("admission bounds");
      expect(reading(container, "quantumRatioStationary")).toBe(historicalCount);
      expect(bookmark(container)).toMatchObject({
        kind: "accepted",
        parameters: { constantSetId: HISTORICAL, beta: -0.6 },
      });
      expect(exported(container)).toEqual(beforeRefusal);
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });

  test("restoring a historical bookmark calculates its set; a malformed link cannot relabel it", async () => {
    const parameters = {
      ...LIGHT_THREAD_DEFAULTS,
      constantSetId: HISTORICAL,
      pulseEnergyJ: 3,
      beta: -0.4,
    } as const;
    window.history.replaceState(
      null,
      "",
      `/lab/light-thread/?${encodeLightThreadParameters(parameters)}`,
    );
    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(<LightThreadLab sourceDigest={labDigests["light-thread"]} />),
      );
      const lab = element(container, '[data-instrument-id="light-thread"]');
      expect(lab.getAttribute("data-constant-set")).toBe(HISTORICAL);
      expect(exported(container).accepted.parameters).toEqual(parameters);
      expect(element<HTMLSelectElement>(container, 'select[name="constantSetId"]').value).toBe(
        HISTORICAL,
      );
      const record = exported(container);
      window.history.replaceState(null, "", `${window.location.href}&constantSetId=modern-si-2019`);
      await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
      expect(element(container, '[role="alert"]').textContent).toContain(
        "Repeated bookmark setting",
      );
      expect(exported(container)).toEqual(record);
    } finally {
      await act(async () => root.unmount());
      removeContainer(container);
    }
  });
});
