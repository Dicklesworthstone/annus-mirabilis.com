/**
 * Test-build-only diagnostics registry (requirement 12). Owners register on
 * acquire and unregister on release; a subscription count and per-stream
 * draw counters round out what stress and conformance lanes read. This is
 * the ONE registry: am-rt-memory-lifecycle-5ws extends it with lifecycle
 * counters in src/experiments/lifecycle/diagnostics.ts rather than creating
 * a second one.
 *
 * `registry` is guarded by `process.env.NODE_ENV !== "production"`, the
 * literal comparison a bundler's `define` + dead-code elimination folds to
 * `false` in a production build, eliminating the registry and every
 * function body that touches it. `diagnostics.bundle.test.ts` proves this
 * with a real bundle, not an assertion about the source text.
 */

export interface InstanceDiagnostics {
  readonly instanceId: string;
  ownerCount: number;
  subscriptionCount: number;
  readonly drawCounters: Record<string, number>;
}

const registry: Map<string, InstanceDiagnostics> | undefined =
  process.env.NODE_ENV !== "production" ? new Map() : undefined;

function entry(instanceId: string): InstanceDiagnostics {
  const existing = registry?.get(instanceId);
  if (existing) return existing;
  const created: InstanceDiagnostics = {
    instanceId,
    ownerCount: 0,
    subscriptionCount: 0,
    drawCounters: {},
  };
  registry?.set(instanceId, created);
  return created;
}

function pruneIfIdle(instanceId: string): void {
  const current = registry?.get(instanceId);
  if (current && current.ownerCount <= 0 && current.subscriptionCount <= 0)
    registry?.delete(instanceId);
}

export function registerOwner(instanceId: string): void {
  if (!registry) return;
  entry(instanceId).ownerCount++;
}

export function unregisterOwner(instanceId: string): void {
  if (!registry) return;
  const current = registry.get(instanceId);
  if (!current) return;
  current.ownerCount--;
  pruneIfIdle(instanceId);
}

/** Returns the unsubscribe function; calling it more than once is a no-op. */
export function registerSubscription(instanceId: string): () => void {
  if (!registry) return () => {};
  entry(instanceId).subscriptionCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = registry?.get(instanceId);
    if (!current) return;
    current.subscriptionCount--;
    pruneIfIdle(instanceId);
  };
}

export function recordDraw(instanceId: string, streamKey: string, count = 1): void {
  if (!registry) return;
  const current = entry(instanceId);
  current.drawCounters[streamKey] = (current.drawCounters[streamKey] ?? 0) + count;
}

export function readDiagnostics(instanceId: string): InstanceDiagnostics | undefined {
  const current = registry?.get(instanceId);
  return current ? { ...current, drawCounters: { ...current.drawCounters } } : undefined;
}

export function isDiagnosticsRegistryEnabled(): boolean {
  return registry !== undefined;
}
