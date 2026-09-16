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
  return useMemo(() => (selector ? selector(view) : (view as unknown as T)), [view, selector]);
}

/** The accepted snapshot only, or `null` before any publication (requirement 7). */
export function useExperimentSnapshot(handle: ExperimentInstanceHandle): AcceptedSnapshot | null {
  return useExperimentView(handle, (view) => view.accepted);
}
