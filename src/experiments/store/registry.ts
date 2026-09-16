import { createInstanceStore } from "./instanceStore.ts";

type StoreOptions = Parameters<typeof createInstanceStore>[0];
type InstanceStore = ReturnType<typeof createInstanceStore>;

/**
 * Cancels a scheduled deferred release. Injected in tests so release timing
 * is deterministic instead of racing the real clock (`registry.test.ts`).
 */
export type DeferredScheduler = (run: () => void) => () => void;

const realScheduler: DeferredScheduler = (run) => {
  const handle = setTimeout(run, 0);
  return () => clearTimeout(handle);
};

interface Entry {
  readonly instanceId: string;
  readonly store: InstanceStore;
  refCount: number;
  cancelRelease: (() => void) | null;
}

/**
 * Placement-keyed instance registry (requirement 1). A placement is
 * `<route path>#<anchor>/<experimentId>/<slot>`; two placements of the same
 * experiment are independent instances, and a remount of the *same*
 * placement while its owner is still reference-counted reattaches to the
 * running instance instead of creating a fresh one. Keying by placement,
 * never by experiment id alone, is the fix for the donor bug this bead
 * replaces (AGENTS.md "Considerations and Pitfalls").
 *
 * `instanceId` is minted here, page-scoped and monotone per experiment id
 * (`<experimentId>:<counter>`), never random and never supplied by a
 * caller: the registry is the one owner of instance identity.
 */
export function createInstanceRegistry(options: { scheduler?: DeferredScheduler } = {}) {
  const scheduler = options.scheduler ?? realScheduler;
  const entries = new Map<string, Entry>();
  const counters = new Map<string, number>();

  function mintInstanceId(experimentId: string): string {
    const next = (counters.get(experimentId) ?? 0) + 1;
    counters.set(experimentId, next);
    return `${experimentId}:${next}`;
  }

  /**
   * Acquires the instance for `placementKey`, reattaching to a running or
   * pending-release owner, or minting a fresh `instanceId` and constructing
   * one via `buildOptions` otherwise. Returns whether this call reattached
   * an existing owner (for tests asserting zero extra random draws on
   * remount) alongside the instance id and store.
   */
  function acquire(
    placementKey: string,
    experimentId: string,
    buildOptions: (instanceId: string) => Omit<StoreOptions, "instanceId" | "experimentId">,
  ): { instanceId: string; store: InstanceStore; reattached: boolean } {
    const existing = entries.get(placementKey);
    if (existing) {
      if (existing.cancelRelease) {
        existing.cancelRelease();
        existing.cancelRelease = null;
      }
      existing.refCount++;
      return { instanceId: existing.instanceId, store: existing.store, reattached: true };
    }
    const instanceId = mintInstanceId(experimentId);
    const store = createInstanceStore({ ...buildOptions(instanceId), instanceId, experimentId });
    entries.set(placementKey, { instanceId, store, refCount: 1, cancelRelease: null });
    return { instanceId, store, reattached: false };
  }

  /**
   * Releases one reference. At zero references the entry is not removed
   * immediately: release is deferred so a remount within the same tick
   * (a `?view=` face switch simulated by React unmounting and remounting
   * the subtree) reattaches instead of restarting the experiment. The entry
   * is removed only when the deferred release actually fires.
   */
  function release(placementKey: string): void {
    const entry = entries.get(placementKey);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount > 0) return;
    entry.cancelRelease = scheduler(() => {
      const current = entries.get(placementKey);
      if (current === entry && current.refCount <= 0) entries.delete(placementKey);
    });
  }

  return Object.freeze({
    acquire,
    release,
    /** Diagnostic read only; never used to key a second registry by experiment id alone. */
    has: (placementKey: string): boolean => entries.has(placementKey),
    size: (): number => entries.size,
  });
}

export type InstanceRegistry = ReturnType<typeof createInstanceRegistry>;
