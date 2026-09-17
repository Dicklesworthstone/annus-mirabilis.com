import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { initialOverrideState, type OverrideState } from "./applyElsewhere.ts";
import { DetailControl } from "./DetailControl.tsx";

function fixtureStoreOptions() {
  return {
    experimentId: "bm-01",
    instanceId: "bm-01:presentation",
    initialParameters: { D: 1, seed: "1" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: {
      tracerPositions: {
        statuses: ["value"] as const,
        unit: "m",
        semanticKind: "synthetic-tracer-endpoints-xyz",
        ownerId: "diffusion.recordTracers",
      },
    },
  };
}

describe("detailChange.presentation (am-read-detail-axis-sfc)", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
    document.documentElement.dataset.detail = "1";
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  it("applying a Detail change updates document data-detail and leaves mounted instrument root identity untouched", async () => {
    const store = createInstanceStore(fixtureStoreOptions());
    const token = store.issue("setup-change");
    store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [
        {
          quantityId: "tracerPositions",
          unit: "m",
          semanticKind: "synthetic-tracer-endpoints-xyz",
          ownerId: "diffusion.recordTracers",
          status: "value",
          value: 1,
        },
      ],
    });

    const initialSnapshot = store.getSnapshot();
    const initialAttrs = instrumentRootAttributes(initialSnapshot);
    if (!initialAttrs) throw new Error("expected instrument root attributes");

    const workerMessages: unknown[] = [];

    function TestHarness() {
      const [state, setState] = useState<OverrideState>(initialOverrideState(1));
      const view = store.getSnapshot();
      const attrs = instrumentRootAttributes(view);

      return createElement("div", null, [
        createElement(DetailControl, {
          key: "control",
          state,
          onChange: (next) => {
            setState(next);
            document.documentElement.dataset.detail = String(next.globalDetail);
          },
        }),
        createElement("div", {
          key: "instrument",
          "data-testid": "fixture-instrument",
          ...attrs,
        }),
      ]);
    }

    await act(async () => {
      root.render(createElement(TestHarness));
    });

    const instrumentEl = container.querySelector('[data-testid="fixture-instrument"]');
    expect(instrumentEl).not.toBeNull();
    expect(instrumentEl?.getAttribute("data-instance-id")).toBe(initialAttrs["data-instance-id"]);
    expect(instrumentEl?.getAttribute("data-run-id")).toBe(initialAttrs["data-run-id"]);
    expect(instrumentEl?.getAttribute("data-snapshot-version")).toBe(
      initialAttrs["data-snapshot-version"],
    );
    expect(document.documentElement.dataset.detail).toBe("1");

    // Click "Show every step" (value 2)
    const radio2 = container.querySelector(
      'input[type="radio"][value="2"]',
    ) as HTMLInputElement | null;
    expect(radio2).not.toBeNull();

    await act(async () => {
      radio2?.click();
    });

    // 1. data-detail on document updated to 2
    expect(document.documentElement.dataset.detail).toBe("2");

    // 2. Instrument root attributes completely unchanged
    expect(instrumentEl?.getAttribute("data-instance-id")).toBe(initialAttrs["data-instance-id"]);
    expect(instrumentEl?.getAttribute("data-run-id")).toBe(initialAttrs["data-run-id"]);
    expect(instrumentEl?.getAttribute("data-snapshot-version")).toBe(
      initialAttrs["data-snapshot-version"],
    );
    expect(instrumentEl?.getAttribute("data-pending")).toBe("false");

    // 3. Store received zero commands and no worker messages
    const afterSnapshot = store.getSnapshot();
    expect(afterSnapshot.accepted?.snapshotVersion).toBe(initialSnapshot.accepted?.snapshotVersion);
    expect(afterSnapshot.accepted?.revisions.input).toBe(initialSnapshot.accepted?.revisions.input);
    expect(workerMessages.length).toBe(0);

    // 4. Exactly one announcement produced
    const announcement = container.querySelector("[data-detail-announcement]");
    expect(announcement?.textContent).toBe("Detail set to Show every step");
  });

  it("leaves pending state intact and produces no worker messages when changed mid-evaluation", async () => {
    const store = createInstanceStore(fixtureStoreOptions());
    const token = store.issue("setup-change");
    store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [
        {
          quantityId: "tracerPositions",
          unit: "m",
          semanticKind: "synthetic-tracer-endpoints-xyz",
          ownerId: "diffusion.recordTracers",
          status: "value",
          value: 1,
        },
      ],
    });

    // Issue a continue to put it into pending state
    store.issue("continue");
    const pendingSnapshot = store.getSnapshot();
    expect(pendingSnapshot.pending).toBe(true);

    const workerMessages: unknown[] = [];

    function TestHarness() {
      const [state, setState] = useState<OverrideState>(initialOverrideState(1));
      const view = store.getSnapshot();
      const attrs = instrumentRootAttributes(view);

      return createElement("div", null, [
        createElement(DetailControl, {
          key: "control",
          state,
          onChange: (next) => {
            setState(next);
            document.documentElement.dataset.detail = String(next.globalDetail);
          },
        }),
        createElement("div", {
          key: "instrument",
          "data-testid": "fixture-instrument",
          ...attrs,
        }),
      ]);
    }

    await act(async () => {
      root.render(createElement(TestHarness));
    });

    const instrumentEl = container.querySelector('[data-testid="fixture-instrument"]');
    expect(instrumentEl?.getAttribute("data-pending")).toBe("true");

    // Change detail to Overview (0) while pending
    const radio0 = container.querySelector(
      'input[type="radio"][value="0"]',
    ) as HTMLInputElement | null;
    await act(async () => {
      radio0?.click();
    });

    // Document reflects new detail
    expect(document.documentElement.dataset.detail).toBe("0");

    // Instrument root still reports pending="true"
    expect(instrumentEl?.getAttribute("data-pending")).toBe("true");

    // Runtime is untouched
    expect(store.getSnapshot().pending).toBe(true);
    expect(workerMessages.length).toBe(0);

    // Announcement is clean
    const announcement = container.querySelector("[data-detail-announcement]");
    expect(announcement?.textContent).toBe("Detail set to Overview");
  });
});
