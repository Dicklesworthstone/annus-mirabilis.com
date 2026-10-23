import type { ReactElement, ReactNode } from "react";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { markPainted } from "../../workers/scheduler/marks.ts";
import type { AcceptedSnapshot, createInstanceStore, ExperimentView } from "./instanceStore.ts";
import { createInstanceRegistry, type InstanceRegistry } from "./registry.ts";

type StoreOptions = Parameters<typeof createInstanceStore>[0];
type BuildOptions = (instanceId: string) => Omit<StoreOptions, "instanceId" | "experimentId">;
type InstanceStore = ReturnType<typeof createInstanceStore>;

const RegistryContext = createContext<InstanceRegistry | null>(null);

/**
 * Owns one registry for the subtree beneath it. Mounting a second view of
 * the same placement (a second instrument face, a second plot) subscribes
 * to the existing instance through this provider instead of creating a new
 * registry per view (requirement 8). A caller may pass its own `registry`
 * (route-scoped, shared across page transitions); otherwise one is created
 * and owned for the provider's lifetime.
 */
export function ExperimentInstanceProvider(props: {
  registry?: InstanceRegistry;
  children: ReactNode;
}): ReactElement {
  const owned = useMemo(() => props.registry ?? createInstanceRegistry(), [props.registry]);
  return createElement(RegistryContext.Provider, { value: owned }, props.children);
}

function useRegistry(): InstanceRegistry {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error("This hook must be used within an ExperimentInstanceProvider.");
  return registry;
}

export interface ExperimentInstanceHandle {
  readonly instanceId: string;
  readonly store: InstanceStore;
}

/**
 * Acquires the instance for `placementKey` for this component's mounted
 * lifetime and releases it on unmount (requirement 8). Acquisition happens
 * during render, in a lazily-initialized ref, not inside the mount effect:
 * React 19 StrictMode's development-only double render calls this function
 * body twice back to back before either commits, and the ref already being
 * set on the second call is what keeps that double render from acquiring
 * twice. StrictMode's separate double-*effect* behavior (mount, cleanup,
 * mount again) is handled by the effect below reacquiring on its second
 * mount after the first cleanup released; because release is deferred
 * (registry.ts), that reacquire reattaches to the same instance instead of
 * building a fresh one, so exactly one owner ever exists and the instance's
 * factory (`buildOptions`, which mints seeds and other one-time state) runs
 * exactly once.
 *
 * Call this once per placement per subtree; sibling views of the same
 * instance read it with `useExperimentView`/`useExperimentSnapshot` off the
 * returned handle, not by calling this hook again for the same placement.
 */
export function useExperimentInstance(
  placementKey: string,
  experimentId: string,
  buildOptions: BuildOptions,
): ExperimentInstanceHandle {
  const registry = useRegistry();
  const buildOptionsRef = useRef(buildOptions);
  buildOptionsRef.current = buildOptions;
  const handleRef = useRef<ExperimentInstanceHandle | null>(null);
  if (!handleRef.current) {
    const acquired = registry.acquire(placementKey, experimentId, (instanceId) =>
      buildOptionsRef.current(instanceId),
    );
    handleRef.current = { instanceId: acquired.instanceId, store: acquired.store };
  }
  useEffect(() => {
    if (!handleRef.current) {
      const acquired = registry.acquire(placementKey, experimentId, (instanceId) =>
        buildOptionsRef.current(instanceId),
      );
      handleRef.current = { instanceId: acquired.instanceId, store: acquired.store };
    }
    return () => {
      registry.release(placementKey);
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, placementKey, experimentId]);
  return handleRef.current;
}

/**
 * THE THIRD SCHEDULER MARK, WHICH NOTHING EMITTED (am-snn0).
 *
 * `scheduler.ts`'s own requirement list says it "Emits `am:input`, `am:accepted`, `am:painted`",
 * and it imports two of the three. `markPainted` was written, exported, documented ("emitted after
 * the frame that commits a new snapshotVersion") and tested by calling it directly in
 * `src/testing/scheduler.marks.test.ts` -- a test that proves the function works and cannot notice
 * that no caller exists. The consequence is the `instrument-feedback` budget: AGENTS.md asks for
 * "parameter feedback within 100 ms once loaded, measured to the accepted VISIBLE snapshot", and
 * `evaluateInstrumentFeedback` joins input to paint, so with no paint mark it matches nothing,
 * measures zero actions, and returns `maxFeedbackMs: 0` with `overBudget: false`. A budget that
 * reads as met over an empty population is the shape AGENTS.md leads with, so the mark belongs
 * here, in the one hook every instrument view reads its published snapshot through.
 *
 * WHY THE SECOND FRAME, AND WHICH WAY THE ERROR GOES. A passive effect runs after React has
 * mutated the DOM and BEFORE the browser paints, so marking there would time the commit, not the
 * pixels. One `requestAnimationFrame` callback runs at the start of the frame that paints the
 * commit, still before it. The mark is therefore emitted from a second nested frame, which is the
 * first moment the snapshot is known to have been displayed. That OVERSTATES the paint instant by
 * up to one frame interval, and the direction is the safe one: it can only make a slow page fail,
 * never make a failing page pass.
 *
 * WHERE IT DELIBERATELY STAYS SILENT. With no `requestAnimationFrame` (server rendering, a DOM
 * stub) nothing is marked rather than marked from the effect, because two different definitions
 * under one mark name would make the budget's number mean whichever environment produced it. The
 * harness then reports `instrument-feedback` as `not-available`, which is true.
 *
 * Two views of one instance each mark the snapshot they painted. That is not deduplicated here:
 * `evaluateInstrumentFeedback` takes the first paint matching the accepted snapshotVersion, so the
 * reported figure is the earliest view that displayed it, which is the claim the budget makes.
 */
function usePaintedMark(view: ExperimentView): void {
  const painted = useRef<string | null>(null);
  const scheduled = useRef<string | null>(null);
  const accepted = view.accepted;
  const key = accepted
    ? `${accepted.instanceId}:${accepted.actionIndex}:${accepted.snapshotVersion}`
    : null;
  useEffect(() => {
    if (accepted === null || key === null) return;
    if (painted.current === key || scheduled.current === key) return;
    if (typeof requestAnimationFrame !== "function" || typeof cancelAnimationFrame !== "function") {
      return;
    }
    scheduled.current = key;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        scheduled.current = null;
        painted.current = key;
        markPainted(accepted.instanceId, accepted.actionIndex, accepted.snapshotVersion);
      });
    });
    return () => {
      // StrictMode mounts, cleans up, and mounts again. Clearing the scheduled key here rather
      // than treating it as already painted is what keeps that second mount emitting the mark.
      if (scheduled.current === key) scheduled.current = null;
      cancelAnimationFrame(outer);
      if (inner !== 0) cancelAnimationFrame(inner);
    };
  }, [accepted, key]);
}

/**
 * Wraps `useSyncExternalStore` over the instance's own `subscribe` /
 * `getSnapshot` / `getServerSnapshot`. `getSnapshot` returns the identical
 * cached reference until the store's next publication or requested-state
 * change (instanceStore.ts's `emit` only replaces `view` on an actual
 * transition), so this hook never manufactures a new object from unchanged
 * state. `selector` is applied through `useMemo` keyed on the view
 * reference itself, which is already the finest-grained stable identity the
 * store exposes; a later bead (am-bm-slice-retrospective-pp09) may widen
 * this if a narrower memo key proves necessary.
 */
export function useExperimentView<T = ExperimentView>(
  handle: ExperimentInstanceHandle,
  selector?: (view: ExperimentView) => T,
): T {
  const view = useSyncExternalStore(
    handle.store.subscribe,
    handle.store.getSnapshot,
    handle.store.getServerSnapshot,
  );
  usePaintedMark(view);
  return useMemo(() => (selector ? selector(view) : (view as unknown as T)), [view, selector]);
}

/** The accepted snapshot only, or `null` before any publication (requirement 7). */
export function useExperimentSnapshot(handle: ExperimentInstanceHandle): AcceptedSnapshot | null {
  return useExperimentView(handle, (view) => view.accepted);
}
