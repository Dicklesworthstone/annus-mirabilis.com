import { describe, expect, test } from "bun:test";
import { createInstanceRegistry, type DeferredScheduler } from "../experiments/store/registry.ts";

function storeOptions() {
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

/** A deterministic scheduler tests control explicitly instead of racing the real clock. */
function manualScheduler(): { scheduler: DeferredScheduler; flush: () => void; pending: number } {
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
    get pending() {
      return callbacks.size;
    },
  };
}

describe("placement-keyed instance registry", () => {
  test("two placements of the same experiment are independent instances", () => {
    const { scheduler } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const a = registry.acquire("/papers/brownian-motion#lab/BM06/left", "BM06", storeOptions);
    const b = registry.acquire("/papers/brownian-motion#lab/BM06/right", "BM06", storeOptions);
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(a.reattached).toBe(false);
    expect(b.reattached).toBe(false);
    const token = a.store.issue("setup-change");
    expect(
      a.store.publish({
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
      }),
    ).toEqual({
      accepted: true,
    });
    expect(b.store.getSnapshot().accepted).toBeNull();
  });

  test("remounting the same placement reattaches: same instanceId, continuing state, zero extra draws", () => {
    const { scheduler } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const placementKey = "/papers/brownian-motion#lab/BM06/main";
    const first = registry.acquire(placementKey, "BM06", storeOptions);
    const token = first.store.issue("setup-change");
    first.store.publish({
      ...token,
      stepIndex: 3,
      simulationTime: 0.75,
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

    // Simulate a `?view=` face switch: the subtree unmounts (release) and
    // remounts (acquire) within the same tick, before the deferred release fires.
    registry.release(placementKey);
    const second = registry.acquire(placementKey, "BM06", storeOptions);

    expect(second.reattached).toBe(true);
    expect(second.instanceId).toBe(first.instanceId);
    expect(second.store).toBe(first.store);
    expect(second.store.getSnapshot().accepted?.runId).toBe(token.runId);
    expect(second.store.getSnapshot().accepted?.stepIndex).toBe(3);

    // Continuing the run issues the next actionIndex, not a fresh run: zero
    // extra "draws" in the sense that no new instance, no new run, and no
    // new instanceId were minted by the remount itself.
    const resumed = second.store.issue("continue");
    expect(resumed.runId).toBe(token.runId);
    expect(resumed.actionIndex).toBe(token.actionIndex + 1);
  });

  test("release defers removal so a same-tick remount never restarts the experiment", () => {
    const { scheduler, flush } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const placementKey = "/papers/brownian-motion#lab/BM06/main";
    const acquired = registry.acquire(placementKey, "BM06", storeOptions);
    registry.release(placementKey);
    expect(registry.has(placementKey)).toBe(true);
    const remounted = registry.acquire(placementKey, "BM06", storeOptions);
    expect(remounted.instanceId).toBe(acquired.instanceId);
    registry.release(placementKey);
    flush();
    expect(registry.has(placementKey)).toBe(false);
  });

  test("a route-segment unmount that never remounts releases the placement once its deferred release fires", () => {
    const { scheduler, flush } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const placementKey = "/papers/brownian-motion#lab/BM06/main";
    registry.acquire(placementKey, "BM06", storeOptions);
    expect(registry.size()).toBe(1);
    registry.release(placementKey);
    expect(registry.size()).toBe(1);
    flush();
    expect(registry.size()).toBe(0);
    const fresh = registry.acquire(placementKey, "BM06", storeOptions);
    expect(fresh.reattached).toBe(false);
  });

  test("instance ids are minted per experiment id, monotone, and never reused across distinct placements", () => {
    const { scheduler } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const a = registry.acquire("/papers/brownian-motion#lab/BM06/left", "BM06", storeOptions);
    const b = registry.acquire("/papers/brownian-motion#lab/BM06/right", "BM06", storeOptions);
    const c = registry.acquire("/papers/light-quanta#lab/LQ02/main", "LQ02", storeOptions);
    expect(a.instanceId).toBe("BM06:1");
    expect(b.instanceId).toBe("BM06:2");
    expect(c.instanceId).toBe("LQ02:1");
  });

  test("multiple concurrent references keep the placement alive until every reference releases", () => {
    const { scheduler, flush } = manualScheduler();
    const registry = createInstanceRegistry({ scheduler });
    const placementKey = "/papers/brownian-motion#lab/BM06/main";
    const first = registry.acquire(placementKey, "BM06", storeOptions);
    const second = registry.acquire(placementKey, "BM06", storeOptions);
    expect(second.reattached).toBe(true);
    registry.release(placementKey);
    flush();
    expect(registry.has(placementKey)).toBe(true);
    registry.release(placementKey);
    flush();
    expect(registry.has(placementKey)).toBe(false);
    void first;
  });
});
