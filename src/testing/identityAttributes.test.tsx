import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseInstrumentRoot, parseInstrumentView } from "../../scripts/e2e/domContract.ts";
import {
  instrumentRootAttributes,
  RETIRED_SNAPSHOT_VERSION_ATTRIBUTE,
  viewRootAttributes,
} from "../experiments/store/identityAttributes.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

function options() {
  return {
    experimentId: "BM06",
    instanceId: "BM06:1",
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

describe("identityAttributes vs. the harness DOM contract parser", () => {
  test("a view root's attributes round-trip through the DOM and parse with parseInstrumentView", async () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    const attrs = viewRootAttributes(store.getSnapshot());
    if (!attrs) throw new Error("expected view root attributes after acceptance");

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(createElement("div", { "data-testid": "view-root", ...attrs }));
      });
      const element = container.querySelector('[data-testid="view-root"]');
      if (!element) throw new Error("expected the view root element");
      const captured: Record<string, string | null> = {};
      for (const name of Object.keys(attrs)) captured[name] = element.getAttribute(name);
      const parsed = parseInstrumentView(captured);
      expect(parsed).toEqual({
        instanceId: "BM06:1",
        runId: token.runId,
        snapshotVersion: "1",
      });
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("an instrument root's attributes parse with parseInstrumentRoot, data-pending tracks the pending state exactly", async () => {
    const store = createInstanceStore(options());
    const first = store.issue("setup-change");
    store.publish({ ...first, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    const second = store.issue("continue");
    const pendingAttrs = instrumentRootAttributes(store.getSnapshot());
    if (!pendingAttrs) throw new Error("expected instrument root attributes while pending");
    expect(pendingAttrs["data-pending"]).toBe("true");

    const container = createContainer();
    const root = createRoot(container);
    try {
      // `data-execution-label` is emitted by a different bead
      // (am-inst-execution-labels-5ywv) on the same root; this test supplies
      // a stub value so `parseInstrumentRoot`'s contract can be exercised in
      // full without pretending this bead owns that attribute.
      await act(() => {
        root.render(
          createElement("div", {
            "data-testid": "instrument-root",
            "data-instrument-id": "bm-06",
            "data-execution-label": "static",
            ...pendingAttrs,
          }),
        );
      });
      const captureAttrs = (): Record<string, string | null> => {
        const element = container.querySelector('[data-testid="instrument-root"]');
        if (!element) throw new Error("expected the instrument root element");
        const captured: Record<string, string | null> = {
          "data-instrument-id": element.getAttribute("data-instrument-id"),
          "data-execution-label": element.getAttribute("data-execution-label"),
        };
        for (const name of Object.keys(pendingAttrs)) captured[name] = element.getAttribute(name);
        return captured;
      };

      const pendingParsed = parseInstrumentRoot(captureAttrs());
      expect(pendingParsed.pending).toBe(true);
      expect(pendingParsed.inputRevision).toBe(String(second.revisions.input));
      expect(pendingParsed.acceptedInputRevision).toBe(String(first.revisions.input));

      store.publish({
        ...second,
        stepIndex: 1,
        simulationTime: 0.25,
        final: true,
        outputs: [output],
      });
      const acceptedAttrs = instrumentRootAttributes(store.getSnapshot());
      if (!acceptedAttrs) throw new Error("expected instrument root attributes after acceptance");
      expect(acceptedAttrs["data-pending"]).toBe("false");
      await act(() => {
        root.render(
          createElement("div", {
            "data-testid": "instrument-root",
            "data-instrument-id": "bm-06",
            "data-execution-label": "static",
            ...acceptedAttrs,
          }),
        );
      });
      const acceptedParsed = parseInstrumentRoot(captureAttrs());
      expect(acceptedParsed.pending).toBe(false);
      expect(acceptedParsed.acceptedInputRevision).toBe(String(second.revisions.input));
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("no root ever carries the retired data-accepted-snapshot-version attribute", async () => {
    const store = createInstanceStore(options());
    const token = store.issue("setup-change");
    store.publish({ ...token, stepIndex: 0, simulationTime: 0, final: true, outputs: [output] });
    const view = viewRootAttributes(store.getSnapshot());
    const instrument = instrumentRootAttributes(store.getSnapshot());
    expect(Object.keys(view ?? {})).not.toContain(RETIRED_SNAPSHOT_VERSION_ATTRIBUTE);
    expect(Object.keys(instrument ?? {})).not.toContain(RETIRED_SNAPSHOT_VERSION_ATTRIBUTE);

    const container = createContainer();
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(createElement("div", { "data-testid": "scan-target", ...instrument }));
      });
      const element = container.querySelector('[data-testid="scan-target"]');
      expect(element?.getAttribute(RETIRED_SNAPSHOT_VERSION_ATTRIBUTE)).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("no attributes are published before any snapshot has ever been accepted", () => {
    const store = createInstanceStore(options());
    expect(viewRootAttributes(store.getSnapshot())).toBeUndefined();
    expect(instrumentRootAttributes(store.getSnapshot())).toBeUndefined();
    store.issue("setup-change");
    expect(viewRootAttributes(store.getSnapshot())).toBeUndefined();
  });
});
