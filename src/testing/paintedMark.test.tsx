import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createInstanceRegistry } from "../experiments/store/registry.ts";
import {
  ExperimentInstanceProvider,
  useExperimentInstance,
  useExperimentView,
} from "../experiments/store/useExperimentSnapshot.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "./reactDom.ts";

/**
 * THAT SOMETHING CALLS `markPainted`, WHICH IS THE HALF ITS OWN TEST CANNOT SEE (am-snn0).
 *
 * `scheduler.marks.test.ts` calls `markInput`, `markAccepted` and `markPainted` directly and
 * asserts the marks appear. All three passed for weeks while NO product code called the third one,
 * because a test that invokes a function cannot notice that nothing else does. AGENTS.md's "A
 * Gate's Own Test Must Not Live Only In The Lane That Gate Controls" is the same proposition one
 * level up, and this file is the other half: it mounts a real view over the real instance store,
 * publishes a real snapshot, and asks the performance timeline what was marked.
 *
 * THE CASES ARE CHOSEN SO THAT NO SINGLE WRONG IMPLEMENTATION SATISFIES THEM, and the set was
 * settled by planting each wrong implementation rather than by reasoning about them. Removing the
 * call reddens 1, 2, 4 and 5 and leaves 3 green, which is right: 3 is the control for a hook that
 * marks unconditionally. A hook that marks once and never again fails 4. A hook that re-marks a
 * snapshot it has already marked fails 2 and 5.
 *
 * ONE PLANT CAME BACK GREEN AND CHANGED THIS FILE. Deleting the hook's two dedupe guards
 * (`painted` / `scheduled`) left all four original cases passing, because the effect's dependency
 * is the `accepted` object and `useSyncExternalStore` hands back the identical reference between
 * publications, so the effect does not re-run on a repeat render at all. The guards are therefore
 * not what cases 1-4 discriminate, and a comment here said they were. Case 5 is the one that
 * reaches them: it drives a view TRANSITION that keeps the same accepted snapshot, which is what
 * a store rebuilding its accepted object would do on every pending state.
 */

const OUTPUT_CONTRACT = {
  density: {
    statuses: ["value"] as const,
    unit: "1/m",
    semanticKind: "coordinate-density",
    ownerId: "diffusion.ftcs1d",
  },
};

function buildOptions() {
  return {
    initialParameters: { D: 1, seed: "0" },
    parameterClasses: { D: "input" as const, seed: "input" as const },
    outputs: OUTPUT_CONTRACT,
  };
}

type PaintDetail = {
  instanceId: string;
  actionIndex: number;
  snapshotVersion: number;
  timestamp?: number;
};

/** Every `am:painted` detail the timeline holds, in emission order. */
function paintedDetails(): readonly PaintDetail[] {
  return performance
    .getEntriesByName("am:painted")
    .map((entry) => (entry as unknown as { detail?: PaintDetail }).detail)
    .filter((detail): detail is PaintDetail => detail !== undefined && detail !== null);
}

/**
 * Waits for two nested animation frames. Callbacks run first-in-first-out within a frame and the
 * hook's effect has already scheduled its own outer frame by the time this is called, so the
 * hook's inner callback runs before this promise resolves.
 */
async function settleTwoFrames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((done) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => done());
      });
    });
  });
}

beforeEach(async () => {
  await installDom();
  performance.clearMarks?.();
});
afterEach(async () => {
  await uninstallDom();
});

describe("am:painted is emitted by the view that displays an accepted snapshot", () => {
  test("case 1: publishing a snapshot marks it painted, with the triple the feedback budget joins on", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    let handle: ReturnType<typeof useExperimentInstance> | null = null;
    function Probe() {
      const acquired = useExperimentInstance("placement/painted-1", "BM06", buildOptions);
      handle = acquired;
      useExperimentView(acquired);
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
      const store = handle?.store;
      if (!store) throw new Error("expected an acquired instance");
      // Nothing has been published, so nothing can have been painted yet. Asserted before the
      // publication rather than after, so a hook that marks on mount is caught here too.
      expect(paintedDetails()).toHaveLength(0);

      let token: ReturnType<typeof store.issue> | undefined;
      await act(() => {
        token = store.issue("setup-change");
      });
      if (!token) throw new Error("expected a request token");
      const issued = token;
      await act(() => {
        store.publish({
          ...issued,
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
      await settleTwoFrames();

      const details = paintedDetails();
      expect(details).toHaveLength(1);
      const accepted = store.getSnapshot().accepted;
      expect(accepted).not.toBeNull();
      // The join `evaluateInstrumentFeedback` performs is on all three fields at once: it keys by
      // instanceId and actionIndex and then requires the paint's snapshotVersion to equal the
      // accepted one. A mark carrying any two of the three would measure nothing.
      expect(details[0]?.instanceId).toBe(accepted?.instanceId);
      expect(details[0]?.actionIndex).toBe(accepted?.actionIndex);
      expect(details[0]?.snapshotVersion).toBe(accepted?.snapshotVersion);
      // The detail also carries `performance.now()` at emission, which is what makes the mark a
      // measurement rather than a flag. Asserted finite rather than equal to anything: its value
      // is the thing being measured.
      expect(Number.isFinite(details[0]?.timestamp ?? Number.NaN)).toBe(true);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("case 2: re-rendering without a new publication marks nothing further", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    let handle: ReturnType<typeof useExperimentInstance> | null = null;
    function Probe() {
      const acquired = useExperimentInstance("placement/painted-2", "BM06", buildOptions);
      handle = acquired;
      useExperimentView(acquired);
      return null;
    }
    const tree = (
      <ExperimentInstanceProvider registry={registry}>
        <Probe />
      </ExperimentInstanceProvider>
    );
    const root = createRoot(container);
    try {
      await act(() => {
        root.render(tree);
      });
      const store = handle?.store;
      if (!store) throw new Error("expected an acquired instance");
      let token: ReturnType<typeof store.issue> | undefined;
      await act(() => {
        token = store.issue("setup-change");
      });
      if (!token) throw new Error("expected a request token");
      const issued = token;
      await act(() => {
        store.publish({
          ...issued,
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
      await settleTwoFrames();
      expect(paintedDetails()).toHaveLength(1);

      for (let i = 0; i < 3; i++) {
        await act(() => {
          root.render(tree);
        });
        await settleTwoFrames();
      }
      // Three further commits of the same snapshot. A per-render mark would read as three extra
      // paints of a snapshot that was painted once, and `evaluateInstrumentFeedback` takes the
      // FIRST matching paint, so the duplicates would not change the number -- they would make
      // the population a count of renders. The assertion is about what the mark means.
      expect(paintedDetails()).toHaveLength(1);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("case 3: a view that never accepts a snapshot marks nothing", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    function Probe() {
      const acquired = useExperimentInstance("placement/painted-3", "BM06", buildOptions);
      useExperimentView(acquired);
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
      await settleTwoFrames();
      // The control for "mark unconditionally". An instrument on arrival shows its static worked
      // example and has published nothing, which is most of the laboratory shelf most of the time.
      expect(paintedDetails()).toHaveLength(0);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("case 5: a view transition that keeps the accepted snapshot does not re-mark it", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    let handle: ReturnType<typeof useExperimentInstance> | null = null;
    function Probe() {
      const acquired = useExperimentInstance("placement/painted-5", "BM06", buildOptions);
      handle = acquired;
      useExperimentView(acquired);
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
      const store = handle?.store;
      if (!store) throw new Error("expected an acquired instance");
      let token: ReturnType<typeof store.issue> | undefined;
      await act(() => {
        token = store.issue("setup-change");
      });
      if (!token) throw new Error("expected a request token");
      const issued = token;
      await act(() => {
        store.publish({
          ...issued,
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
      await settleTwoFrames();
      const afterPublication = paintedDetails();
      expect(afterPublication).toHaveLength(1);
      const paintedVersion = afterPublication[0]?.snapshotVersion;

      // Issue two further requests and publish NEITHER. Each moves the view to pending and
      // replaces the view object while the accepted snapshot stays the one already painted. A
      // reader is looking at the same pixels throughout; nothing was painted again.
      for (let i = 0; i < 2; i++) {
        await act(() => {
          store.issue("setup-change");
        });
        await settleTwoFrames();
      }
      expect(store.getSnapshot().pending).toBe(true);
      expect(store.getSnapshot().accepted?.snapshotVersion).toBe(paintedVersion);
      expect(paintedDetails()).toHaveLength(1);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });

  test("case 4: a second publication is marked as its own paint, at its own snapshotVersion", async () => {
    const container = createContainer();
    const registry = createInstanceRegistry();
    let handle: ReturnType<typeof useExperimentInstance> | null = null;
    function Probe() {
      const acquired = useExperimentInstance("placement/painted-4", "BM06", buildOptions);
      handle = acquired;
      useExperimentView(acquired);
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
      const store = handle?.store;
      if (!store) throw new Error("expected an acquired instance");
      for (let step = 0; step < 2; step++) {
        let token: ReturnType<typeof store.issue> | undefined;
        await act(() => {
          token = store.issue("setup-change");
        });
        if (!token) throw new Error("expected a request token");
        const issued = token;
        await act(() => {
          store.publish({
            ...issued,
            stepIndex: step,
            simulationTime: step,
            final: true,
            outputs: [
              {
                quantityId: "density",
                unit: "1/m",
                semanticKind: "coordinate-density",
                ownerId: "diffusion.ftcs1d",
                status: "value",
                value: 1 + step,
              },
            ],
          });
        });
        await settleTwoFrames();
      }
      const details = paintedDetails();
      expect(details).toHaveLength(2);
      // Monotone and distinct: the budget asks for the feedback of EACH action, so two actions
      // must not collapse onto one snapshotVersion.
      expect(details[1]?.snapshotVersion).toBeGreaterThan(details[0]?.snapshotVersion ?? 0);
      expect(details[1]?.actionIndex).toBeGreaterThan(details[0]?.actionIndex ?? 0);
    } finally {
      await act(() => {
        root.unmount();
      });
      removeContainer(container);
    }
  });
});
