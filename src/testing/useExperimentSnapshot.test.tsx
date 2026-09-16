import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ExperimentView } from "../experiments/store/instanceStore.ts";
import { createInstanceRegistry, type DeferredScheduler } from "../experiments/store/registry.ts";
import {
  ExperimentInstanceProvider,
  useExperimentInstance,
  useExperimentView,
} from "../experiments/store/useExperimentSnapshot.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

function manualScheduler(): { scheduler: DeferredScheduler; flush: () => void } {
  const callbacks = new Set<() => void>();
  const scheduler: DeferredScheduler = (run) => {
    const wrapped = () => {
      callbacks.delete(wrapped);
      run();
    };
    callbacks.add(wrapped);
    return () => callbacks.delete(wrapped);
  };
  return {
    scheduler,
    flush: () => {
      for (const callback of [...callbacks]) callback();
    },
  };
}

function draws() {
  const counter = { current: 0 };
  const buildOptions = () => {
    counter.current++;
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
  };
  return { counter, buildOptions };
}

beforeEach(async () => {
  await installDom();
});
afterEach(async () => {
  await uninstallDom();
});

describe("useExperimentInstance / useExperimentView", () => {
  test("getSnapshot returns the same reference across repeated renders between changes", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    const { buildOptions } = draws();
    const seen: ExperimentView[] = [];
    let renderCount = 0;
    function Probe() {
      renderCount++;
      const handle = useExperimentInstance("placement/probe", "BM06", buildOptions);
      const view = useExperimentView(handle);
      seen.push(view);
      return null;
    }
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          <ExperimentInstanceProvider registry={registry}>
            <Probe />
          </ExperimentInstanceProvider>,
        );
      });
      await act(() => {
        root.render(
          <ExperimentInstanceProvider registry={registry}>
            <Probe />
          </ExperimentInstanceProvider>,
        );
      });
      expect(renderCount).toBe(2);
      expect(seen[0]).toBe(seen[1]);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("two placements of the same experiment run, change, and publish independently", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    const left = draws();
    const right = draws();
    const handles: Record<string, ReturnType<typeof useExperimentInstance>> = {};
    function Probe(props: { slot: "left" | "right" }) {
      const handle = useExperimentInstance(
        `placement/${props.slot}`,
        "BM06",
        props.slot === "left" ? left.buildOptions : right.buildOptions,
      );
      handles[props.slot] = handle;
      useExperimentView(handle);
      return null;
    }
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          <ExperimentInstanceProvider registry={registry}>
            <Probe slot="left" />
            <Probe slot="right" />
          </ExperimentInstanceProvider>,
        );
      });
      expect(handles.left?.instanceId).not.toBe(handles.right?.instanceId);
      let token: ReturnType<NonNullable<typeof handles.left>["store"]["issue"]> | undefined;
      await act(() => {
        token = handles.left?.store.issue("setup-change");
      });
      if (!token) throw new Error("expected a request token");
      const requestToken = token;
      let published: ReturnType<NonNullable<typeof handles.left>["store"]["publish"]> | undefined;
      await act(() => {
        published = handles.left?.store.publish({
          ...requestToken,
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
      expect(published).toEqual({ accepted: true });
      expect(handles.right?.store.getSnapshot().accepted).toBeNull();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("a remount of the same placement reattaches: same instanceId, same runId, continuing stepIndex, zero extra draws", async () => {
    const container = createContainer();
    const { scheduler, flush } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const { counter, buildOptions } = draws();
    const lastHandle: { current: ReturnType<typeof useExperimentInstance> | null } = {
      current: null,
    };
    function Probe() {
      const handle = useExperimentInstance("placement/face", "BM06", buildOptions);
      lastHandle.current = handle;
      useExperimentView(handle);
      return null;
    }
    const mounted = (
      <ExperimentInstanceProvider registry={registry}>
        <Probe />
      </ExperimentInstanceProvider>
    );
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(mounted);
      });
      const firstInstanceId = lastHandle.current?.instanceId;
      const store = lastHandle.current?.store;
      if (!store) throw new Error("expected a store");
      let token: ReturnType<typeof store.issue> | undefined;
      await act(() => {
        token = store.issue("setup-change");
        store.publish({
          ...token,
          stepIndex: 4,
          simulationTime: 1,
          final: false,
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
      expect(counter.current).toBe(1);

      // Simulate a `?view=` face switch: unmount the subtree, then mount a
      // fresh element of the same placement before the deferred release fires.
      await act(() => {
        root.render(
          <ExperimentInstanceProvider registry={registry}>{null}</ExperimentInstanceProvider>,
        );
      });
      await act(() => {
        root.render(mounted);
      });

      expect(lastHandle.current?.instanceId).toBe(firstInstanceId);
      expect(lastHandle.current?.store).toBe(store);
      expect(counter.current).toBe(1);
      if (!token) throw new Error("expected a request token");
      expect(store.getSnapshot().accepted?.runId).toBe(token.runId);
      expect(store.getSnapshot().accepted?.stepIndex).toBe(4);
      flush();
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("StrictMode double mounting yields exactly one owner and zero extra draws", async () => {
    const container = createContainer();
    const { scheduler } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const { counter, buildOptions } = draws();
    const instanceIds = new Set<string>();
    function Probe() {
      const handle = useExperimentInstance("placement/strict", "BM06", buildOptions);
      instanceIds.add(handle.instanceId);
      useExperimentView(handle);
      return null;
    }
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          <StrictMode>
            <ExperimentInstanceProvider registry={registry}>
              <Probe />
            </ExperimentInstanceProvider>
          </StrictMode>,
        );
      });
      expect(instanceIds.size).toBe(1);
      expect(counter.current).toBe(1);
      expect(registry.size()).toBe(1);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("a second view of the same placement reuses one owner", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    const { counter, buildOptions } = draws();
    const instanceIds = new Set<string>();
    function Probe() {
      const handle = useExperimentInstance("placement/shared", "BM06", buildOptions);
      instanceIds.add(handle.instanceId);
      useExperimentView(handle);
      return null;
    }
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(
          <ExperimentInstanceProvider registry={registry}>
            <Probe />
            <Probe />
          </ExperimentInstanceProvider>,
        );
      });
      expect(instanceIds.size).toBe(1);
      expect(counter.current).toBe(1);
      expect(registry.size()).toBe(1);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
