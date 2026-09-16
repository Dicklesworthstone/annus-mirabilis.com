import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseInstrumentRoot } from "../../../scripts/e2e/domContract.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { makeRefusal } from "../results/refusals.ts";
import { instrumentRootAttributes } from "../store/identityAttributes.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { deriveCurrencyState } from "./currencyState.ts";
import {
  executionLabelAttributes,
  labelRootAttributes,
  resultAttributes,
} from "./resultAttributes.ts";

function options() {
  return {
    experimentId: "bm-06",
    instanceId: "bm-06:1",
    initialParameters: { D: 1, seed: "0" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: {
      density: {
        statuses: ["value"] as const,
        unit: "1/m",
        semanticKind: "coordinate-density",
        ownerId: "diffusion.ftcs1d",
      },
    },
  };
}

const output = {
  quantityId: "density",
  unit: "1/m",
  semanticKind: "coordinate-density",
  ownerId: "diffusion.ftcs1d",
  status: "value" as const,
  value: 1,
};

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

describe("resultAttributes + executionLabelAttributes on the instrument root (am-inst-execution-labels-5ywv)", () => {
  test("an accepted snapshot's primary output status becomes data-result-status, and the label round-trips through the real DOM contract parser", async () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });

    const identity = instrumentRootAttributes(store.getSnapshot());
    if (!identity) throw new Error("expected instrument root attributes after acceptance");
    const result = resultAttributes(store.getSnapshot(), "density");
    const label = executionLabelAttributes("host-accepted");

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          createElement("div", {
            "data-testid": "instrument-root",
            "data-instrument-id": "bm-06",
            ...identity,
            ...label,
            ...result,
          }),
        );
      });
      const element = container.querySelector('[data-testid="instrument-root"]');
      if (!element) throw new Error("expected the instrument root element");
      const captured: Record<string, string | null> = {};
      for (const name of [
        "data-instrument-id",
        ...Object.keys(identity),
        ...Object.keys(label),
        ...Object.keys(result),
      ]) {
        captured[name] = element.getAttribute(name);
      }
      const parsed = parseInstrumentRoot(captured);
      expect(parsed.executionLabel).toBe("host");
      expect(parsed.resultStatus).toBe("value");
      expect(parsed.refusalCode).toBeUndefined();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("a refusal carries data-refusal-code and no data-result-status, and the visible text is not the code", async () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    const refusal = makeRefusal("invalid-parameter", { parameterIds: ["D"] });
    store.refuse(token, refusal);

    const result = resultAttributes(store.getSnapshot(), "density");
    expect(result["data-refusal-code"]).toBe("invalid-parameter");
    expect(result["data-result-status"]).toBeUndefined();

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          createElement(
            "div",
            { "data-testid": "refusal-message", ...result },
            "These inputs do not meet the calculation's stated requirements.",
          ),
        );
      });
      const element = container.querySelector('[data-testid="refusal-message"]');
      if (!element) throw new Error("expected the refusal message element");
      expect(element.getAttribute("data-refusal-code")).toBe("invalid-parameter");
      expect(element.textContent).not.toContain("invalid-parameter");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("labelRootAttributes on a paused setup-change carries data-currency-state=stale beside the last accepted engine label", async () => {
    const store = createInstanceStore(options());
    const first = store.issue("setup-change");
    store.publish({ ...first, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    store.issue("setup-change", { D: 2 });
    store.pause();
    const view = store.getSnapshot();
    expect(deriveCurrencyState(view)).toBe("stale");
    const identity = instrumentRootAttributes(view);
    if (!identity) throw new Error("expected instrument root attributes after pause");
    const labels = labelRootAttributes("host-accepted", view, "density");

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          createElement("div", {
            "data-testid": "instrument-root",
            "data-instrument-id": "bm-06",
            ...identity,
            ...labels,
          }),
        );
      });
      const element = container.querySelector('[data-testid="instrument-root"]');
      if (!element) throw new Error("expected the instrument root element");
      expect(element.getAttribute("data-execution-label")).toBe("host");
      expect(element.getAttribute("data-currency-state")).toBe("stale");
      expect(element.getAttribute("data-pending")).toBe("false");
      expect(element.getAttribute("data-input-revision")).not.toBe(
        element.getAttribute("data-accepted-input-revision"),
      );
      const captured: Record<string, string | null> = {
        "data-instrument-id": element.getAttribute("data-instrument-id"),
        "data-execution-label": element.getAttribute("data-execution-label"),
      };
      for (const name of Object.keys(identity)) captured[name] = element.getAttribute(name);
      const parsed = parseInstrumentRoot(captured);
      expect(parsed.executionLabel).toBe("host");
      expect(parsed.pending).toBe(false);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("executionLabelAttributes emits exactly one of the four values the DOM contract parser accepts, never a fifth", () => {
    for (const state of [
      "frankensim-accepted",
      "host-accepted",
      "static-example",
      "unavailable",
    ] as const) {
      const attrs = executionLabelAttributes(state);
      expect(["frankensim", "host", "static", "unavailable"]).toContain(
        attrs["data-execution-label"],
      );
    }
  });
});
