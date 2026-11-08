import type { ExperimentView } from "./instanceStore.ts";

/** Retain the owner, not a second copy or a reconstruction of its accepted result. */
export type RetainedSession = Readonly<{
  getSnapshot(): ExperimentView;
  subscribe?(listener: () => void): () => void;
  disconnect?(): void;
  stop?(): void;
}>;

export type SessionRetentionIdentity = Readonly<{
  experimentId: string;
  instanceId: string;
  sourceDigest?: string | undefined;
}>;

export type PreparedRetainedSession<T extends RetainedSession = RetainedSession> = Readonly<{
  session: T;
  instanceId: string;
  sourceDigest: string | undefined;
  reused: boolean;
  sourceChanged: boolean;
}>;

type Entry = {
  key: string;
  session: RetainedSession;
  instanceId: string;
  sourceDigest: string | undefined;
  cacheable: boolean;
  references: number;
  releaseTicket: number;
  lastUsed: number;
  disconnected: boolean;
};

export const MAX_IDLE_RETAINED_SESSIONS = 12;
let scopeNumber = 0;

/**
 * Only committed views enter this cache. `prepare` can run in an abandoned React render: a new
 * session then belongs solely to its returned handle and is collectable with that render.
 * Constructors must remain pure, as they already must for server rendering; workers start only
 * after a reader action. Inactive owners keep their accepted stores while their workers stop.
 */
export function createSessionRetention(options: { maxIdleSessions?: number } = {}) {
  const requestedLimit = options.maxIdleSessions ?? MAX_IDLE_RETAINED_SESSIONS;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(64, Math.floor(requestedLimit)))
    : MAX_IDLE_RETAINED_SESSIONS;
  const scopeId = ++scopeNumber;
  let nextInstance = 0;
  let clock = 0;
  let disposed = false;
  const entries = new Map<string, Entry>();
  const owned = new Set<Entry>();
  const preparations = new WeakMap<PreparedRetainedSession, Entry>();

  function disconnect(entry: Entry): void {
    if (entry.disconnected) return;
    entry.disconnected = true;
    if (entry.session.disconnect) entry.session.disconnect();
    else entry.session.stop?.();
  }

  function forget(entry: Entry): void {
    disconnect(entry);
    owned.delete(entry);
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
  }

  function trim(): void {
    const idle = [...entries.values()]
      .filter((entry) => entry.references === 0)
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const entry of idle.slice(0, Math.max(0, idle.length - limit))) forget(entry);
  }

  function prepare<T extends RetainedSession>(
    placementKey: string,
    identity: SessionRetentionIdentity,
    create: (instanceId: string) => T,
    previousInstanceId?: string,
  ): PreparedRetainedSession<T> {
    const key = JSON.stringify([placementKey, identity.experimentId, identity.instanceId]);
    const existing = disposed ? undefined : entries.get(key);
    const cacheable = /^source:sha256:[a-f0-9]{64}$/.test(identity.sourceDigest ?? "");
    const reused =
      cacheable && existing !== undefined && existing.sourceDigest === identity.sourceDigest;
    let entry = reused ? existing : undefined;
    if (!entry) {
      // A recreated document/cache must not accidentally imitate the identity in old history.
      let instanceId: string;
      do {
        instanceId = `${identity.instanceId}/retained-${scopeId}-${++nextInstance}`;
      } while (instanceId === previousInstanceId);
      entry = {
        key,
        session: create(instanceId),
        instanceId,
        sourceDigest: identity.sourceDigest,
        cacheable,
        references: 0,
        releaseTicket: 0,
        lastUsed: 0,
        disconnected: false,
      };
    }
    const prepared: PreparedRetainedSession<T> = Object.freeze({
      session: entry.session as T,
      instanceId: entry.instanceId,
      sourceDigest: entry.sourceDigest,
      reused,
      sourceChanged: existing !== undefined && existing.sourceDigest !== identity.sourceDigest,
    });
    preparations.set(prepared, entry);
    return prepared;
  }

  function retain(prepared: PreparedRetainedSession): () => void {
    const entry = preparations.get(prepared);
    if (!entry) return () => {};
    let released = false;
    entry.references++;
    entry.releaseTicket++;
    entry.disconnected = false;
    if (!disposed) {
      const current = entries.get(entry.key);
      // A concurrently mounted different model cannot evict an active owner. This lease remains
      // independently owned until it closes, rather than silently sharing the wrong session.
      if (current && current !== entry && current.references > 0) entry.cacheable = false;
      else {
        if (current && current !== entry) forget(current);
        entries.set(entry.key, entry);
      }
      owned.add(entry);
    }
    return () => {
      if (released) return;
      released = true;
      entry.references--;
      const ticket = ++entry.releaseTicket;
      queueMicrotask(() => {
        if (entry.references > 0 || entry.releaseTicket !== ticket) return;
        disconnect(entry);
        if (disposed || !entry.cacheable || entries.get(entry.key) !== entry) forget(entry);
        else {
          entry.lastUsed = ++clock;
          trim();
        }
      });
    };
  }

  return Object.freeze({
    prepare,
    retain,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of owned) disconnect(entry);
      entries.clear();
      owned.clear();
    },
    /** Diagnostic counts measure committed owners; abandoned preparations never enter them. */
    size: () => owned.size,
    idleSize: () => [...owned].filter((entry) => entry.references === 0).length,
  });
}

export type SessionRetention = ReturnType<typeof createSessionRetention>;
