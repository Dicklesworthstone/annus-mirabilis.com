import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BM06_CURVE_PROMPT } from "../../experiments/bm06/prediction.ts";
import type { PreparedBm06Example } from "../../experiments/bm06/session.ts";
import { decodeTapePermalink } from "../../experiments/permalink/codec.ts";
import { LOCAL_PREDICT_PERSISTENCE } from "../../experiments/predict/localPredictPersistence.ts";
import {
  installPredictPersistence,
  REMEMBERS_NOTHING,
} from "../../experiments/predict/predictPersistence.ts";
import {
  getStoredPrompt,
  readPredictionsDocument,
} from "../../experiments/predict/predictStorage.ts";
import rawExample from "../../generated/bm06-example.json";
import { createStorageContext } from "../../platform/storage/store.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { BrownianLab } from "./BrownianLab.tsx";

const example = rawExample as unknown as PreparedBm06Example;
let sequence = 0;

describe("the spreading laboratory's actual prediction controls", () => {
  let root: Root;
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom({ intersections: "visible" });
    installPredictPersistence(LOCAL_PREDICT_PERSISTENCE);
    container = createContainer();
    root = createRoot(container);
    await act(async () =>
      root.render(<BrownianLab example={example} instanceId={`bm06-predict-${sequence++}`} />),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    installPredictPersistence(REMEMBERS_NOTHING);
    await uninstallDom();
  });
  function button(label: string) {
    const element = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.textContent?.trim() === label,
    );
    expect(element, label).toBeDefined();
    return element as HTMLButtonElement;
  }
  async function press(label: string) {
    await act(async () => button(label).click());
  }
  async function enter(input: HTMLInputElement, value: string) {
    await act(async () => {
      input.value = value;
      // This harness does not dispatch React's synthetic change event; invoke the mounted
      // control's actual callback, as the existing PredictGate interaction suite does.
      const key = Object.keys(input).find((name) => name.startsWith("__reactProps$")) as string;
      const props = (
        input as unknown as Record<
          string,
          { onChange: (event: { target: HTMLInputElement }) => void }
        >
      )[key];
      props?.onChange({ target: input });
    });
  }
  const stored = () =>
    getStoredPrompt(readPredictionsDocument(createStorageContext()), "bm-06", BM06_CURVE_PROMPT)
      ?.prediction;

  test("blank or out-of-range heights cannot record; complete values reveal exact original targets and clear removes them", async () => {
    await press("Enter values");
    const inputs = [...container.querySelectorAll<HTMLInputElement>("[data-predict-values] input")];
    expect(inputs.length).toBe(3);
    expect(button("Record values").disabled).toBe(true);
    for (let i = 0; i < inputs.length; i++)
      await enter(inputs[i] as HTMLInputElement, ["0.4", "0.24", "0.05"][i] as string);
    expect(button("Record values").disabled).toBe(false);
    await enter(inputs[2] as HTMLInputElement, "0.51");
    expect(button("Record values").disabled).toBe(true);
    await enter(inputs[2] as HTMLInputElement, "0");
    expect(button("Record values").disabled).toBe(false);
    const identity = container
      .querySelector("[data-instrument-id='bm-06']")
      ?.getAttribute("data-snapshot-version");
    await press("Record values");
    const prediction = {
      form: "values",
      targets: [
        { targetId: "at-zero", value: 0.4 },
        { targetId: "at-one", value: 0.24 },
        { targetId: "at-two", value: 0 },
      ],
    };
    expect(stored()).toEqual(prediction);
    expect(container.querySelector("[data-predict-overlay]")).not.toBeNull();
    expect(container.querySelectorAll('[data-overlay-marker="prediction-square"]').length).toBe(3);
    expect(
      container
        .querySelector("[data-prediction-comparison]")
        ?.closest("[data-predict-response]")
        ?.getAttribute("data-predict-response"),
    ).toBe("shown");
    expect(
      container
        .querySelector("[data-instrument-id='bm-06']")
        ?.getAttribute("data-snapshot-version"),
    ).toBe(identity);
    let url = "";
    for (let tries = 0; tries < 30; tries++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      url =
        container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? "";
      const decoded = decodeTapePermalink(url);
      if (decoded.kind === "success" && decoded.tape.predictions?.length) break;
    }
    const decoded = decodeTapePermalink(url);
    expect(decoded.kind).toBe("success");
    if (decoded.kind === "success")
      expect(decoded.tape.predictions?.[0]?.payload).toEqual({ targets: prediction.targets });
    await press("Clear comparison");
    expect(container.querySelector("[data-predict-overlay]")).toBeNull();
    expect(stored()).toBeUndefined();
    expect(container.textContent).toContain("Prediction cleared");
  });

  test("keyboard drawing records a bounded sketch and its original stays fixed after a later guess", async () => {
    await press("Sketch curve");
    const canvas = container.querySelector<SVGSVGElement>(".predict-sketch-canvas");
    expect(canvas).not.toBeNull();
    if (!canvas) return;
    for (const key of [
      "Enter",
      "ArrowRight",
      "ArrowUp",
      "Enter",
      "ArrowRight",
      "ArrowDown",
      "Enter",
    ])
      await act(async () =>
        canvas.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        ),
      );
    const recordSketch = [...container.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      node.textContent?.startsWith("Record sketch ("),
    );
    expect(recordSketch?.disabled).toBe(false);
    await act(async () => recordSketch?.click());
    const original = stored();
    expect(original?.form).toBe("sketch");
    if (original?.form === "sketch") {
      expect(original.points.length).toBeGreaterThan(0);
      expect(original.points.length).toBeLessThanOrEqual(64);
      for (const [x, y] of original.points) {
        expect(x).toBeGreaterThanOrEqual(-4);
        expect(x).toBeLessThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(0.5);
      }
    }
    expect(container.querySelector("[data-predict-overlay]")).not.toBeNull();
    const later = container.querySelector<HTMLInputElement>('input[name$="-amendment"]');
    await act(async () => later?.click());
    expect(container.querySelector("[data-predict-after-the-fact]")).not.toBeNull();
    expect(stored()).toEqual(original);
  });

  test("format tabs expose one keyboard tab stop and connected panel labels", async () => {
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.length).toBe(3);
    expect(tabs.filter((tab) => tab.tabIndex === 0).length).toBe(1);
    await act(async () => {
      tabs[0]?.focus();
      tabs[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement?.textContent).toBe("Enter values");
    const active = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe(
      active?.id,
    );
  });

  test("a worker failure stays visible while the numerical answer is still waiting for a prediction", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    let worker: EventTarget | undefined;
    class FailingWorker extends EventTarget {
      constructor() {
        super();
        worker = this;
      }
      postMessage() {}
      terminate() {}
    }
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: FailingWorker });
    try {
      await press("Apply settings");
      expect(worker).toBeDefined();
      const status = container.querySelector(".status-line");
      expect(status?.textContent).toContain("Calculating");
      expect(status?.closest('[data-predict-response="awaiting"]')).toBeNull();
      await act(async () => worker?.dispatchEvent(new Event("error")));
      expect(container.querySelector('[data-predict-gate="awaiting"]')).not.toBeNull();
      expect(status?.textContent).toContain("worked result remains readable");
      expect(status?.closest('[data-predict-response="awaiting"]')).toBeNull();
      expect(
        container
          .querySelector('[data-output="intervalProbability"]')
          ?.closest('[data-predict-response="awaiting"]'),
      ).not.toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, "Worker", original);
    }
  });
});
