import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createInstanceRegistry } from "../experiments/store/registry.ts";
import {
  ExperimentInstanceProvider,
  useExperimentInstance,
  useExperimentView,
} from "../experiments/store/useExperimentSnapshot.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

function buildOptions() {
  return {
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

function Probe() {
  const handle = useExperimentInstance("placement/hydrate", "BM06", buildOptions);
  const view = useExperimentView(handle);
  return (
    <div data-status={view.status} data-pending={String(view.pending)}>
      {view.status}
    </div>
  );
}

function Tree({ registry }: { registry: ReturnType<typeof createInstanceRegistry> }) {
  return (
    <ExperimentInstanceProvider registry={registry}>
      <Probe />
    </ExperimentInstanceProvider>
  );
}

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

describe("server snapshot vs. client hydration", () => {
  test("server-rendered markup equals the client's first hydrated render, with no hydration warning", async () => {
    // A separate registry stands in for the server request's own ephemeral
    // registry: server rendering and client hydration are different
    // processes in production and must never share instance state, only
    // agree on markup for a never-before-run instance.
    const serverHtml = renderToString(<Tree registry={createInstanceRegistry()} />);
    expect(serverHtml).toContain('data-status="idle"');
    expect(serverHtml).toContain('data-pending="false"');

    const container = createContainer();
    container.innerHTML = serverHtml;

    const consoleErrors: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };
    try {
      const root = hydrateRoot(container, <Tree registry={createInstanceRegistry()} />);
      await act(() => {});
      const rendered = container.querySelector("div");
      expect(rendered?.getAttribute("data-status")).toBe("idle");
      expect(rendered?.getAttribute("data-pending")).toBe("false");
      await act(() => {
        root.unmount();
      });
    } finally {
      console.error = originalError;
    }

    const hydrationWarnings = consoleErrors.filter((args) =>
      args.some((arg) => typeof arg === "string" && /hydrat/i.test(arg)),
    );
    expect(hydrationWarnings).toEqual([]);
    removeContainer(container);
  });

  test("getServerSnapshot is fixed at the instance's construction, never a later mutated state", async () => {
    const registry = createInstanceRegistry();
    const container = createContainer();
    const capturedHandle: { current: ReturnType<typeof useExperimentInstance> | null } = {
      current: null,
    };
    function Capture() {
      const handle = useExperimentInstance("placement/fixed", "BM06", buildOptions);
      capturedHandle.current = handle;
      useExperimentView(handle);
      return null;
    }
    const root = hydrateRoot(
      container,
      <ExperimentInstanceProvider registry={registry}>
        <Capture />
      </ExperimentInstanceProvider>,
    );
    try {
      await act(() => {});
      const store = capturedHandle.current?.store;
      if (!store) throw new Error("expected a store");
      const before = store.getServerSnapshot();
      await act(() => {
        const token = store.issue("setup-change");
        store.publish({
          ...token,
          stepIndex: 0,
          simulationTime: 0,
          final: true,
          outputs: [
            {
              quantityId: "density",
              unit: "1/m",
              semanticKind: "coordinate-density",
              ownerId: "diffusion.ftcs1d",
              status: "value",
              value: 1,
            },
          ],
        });
      });
      expect(store.getServerSnapshot()).toBe(before);
      expect(store.getServerSnapshot().status).toBe("idle");
      expect(store.getSnapshot().status).toBe("accepted");
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
