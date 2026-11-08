"use client";

import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LabReference } from "../../reader/stack/stackStore.ts";
import type {
  PreparedRetainedSession,
  RetainedSession,
  SessionRetention,
  SessionRetentionIdentity,
} from "./sessionRetention.ts";

type RetentionContextValue = Readonly<{
  cache: SessionRetention;
  placementKey: string;
  primaryInstanceId: string;
  previous: LabReference | null;
  report(prepared: PreparedRetainedSession, identity: SessionRetentionIdentity): void;
}>;

const RetentionContext = createContext<RetentionContextValue | null>(null);

/** Only reader clarifications provide retention. Standalone and externally owned labs keep it off. */
export function RetainedSessionProvider({
  cache,
  placementKey,
  instanceId,
  previous,
  onReference,
  children,
}: Readonly<{
  cache: SessionRetention;
  placementKey: string;
  instanceId: string;
  previous: LabReference | null;
  onReference(reference: LabReference): void;
  children?: ReactNode;
}>) {
  const [notice, setNotice] = useState("");
  const [childKey, setChildKey] = useState("initial");
  const latestReference = useRef("");
  const context = useMemo<RetentionContextValue>(
    () => ({
      cache,
      placementKey,
      primaryInstanceId: instanceId,
      previous,
      report(prepared, identity) {
        if (identity.instanceId !== instanceId) return;
        if (prepared.sourceChanged) {
          setNotice("The laboratory model has changed. This visit starts a new experiment.");
          // The hook adopted this replacement owner before reporting. Remount its presentation
          // against that owner so every private form/draft starts from the new accepted state.
          // A source key stays stable even if a conflicting active placement cannot be cached.
          setChildKey(identity.sourceDigest ?? "unknown-source");
        } else if (previous && previous.instanceId !== prepared.instanceId) {
          setNotice(
            (current) =>
              current ||
              (prepared.reused
                ? "The earlier laboratory session is no longer available. The latest experiment from this passage is shown."
                : "The earlier laboratory session is no longer available. This visit starts a new experiment."),
          );
        }
        const accepted = prepared.session.getSnapshot().accepted;
        if (!accepted) return;
        const reference: LabReference = {
          instanceId: accepted.instanceId,
          experimentId: identity.experimentId,
          modelIdentity: identity.sourceDigest ?? "",
          runId: accepted.runId,
          // This is an in-memory owner reference, not a claim to hold an archived checkpoint.
          checkpointDigest: "",
          compactTape: "",
        };
        const serialized = JSON.stringify(reference);
        if (serialized !== latestReference.current) {
          latestReference.current = serialized;
          onReference(reference);
        }
      },
    }),
    [cache, placementKey, instanceId, previous, onReference],
  );
  return (
    <RetentionContext.Provider value={context}>
      {notice ? (
        <p className="notice" role="status" data-lab-return-notice>
          {notice}
        </p>
      ) : null}
      <Fragment key={childKey}>{children}</Fragment>
    </RetentionContext.Provider>
  );
}

/**
 * Reuses a committed owner only within the reader's matching placement and source identity.
 * A provisional render is not registered until its effect commits; no hidden React tree or
 * background worker is kept alive to preserve the accepted state.
 */
export function useRetainedSession<T extends RetainedSession>(
  identity: SessionRetentionIdentity,
  create: (instanceId: string) => T,
): T {
  const context = useContext(RetentionContext);
  const { experimentId, instanceId, sourceDigest } = identity;
  const key = JSON.stringify([experimentId, instanceId, sourceDigest]);
  const held = useRef<{
    cache: SessionRetention | null;
    placement: string | null;
    key: string;
    prepared: PreparedRetainedSession<T>;
  } | null>(null);
  if (
    !held.current ||
    held.current.cache !== (context?.cache ?? null) ||
    held.current.placement !== (context?.placementKey ?? null) ||
    held.current.key !== key
  ) {
    held.current = {
      cache: context?.cache ?? null,
      placement: context?.placementKey ?? null,
      key,
      prepared: context
        ? context.cache.prepare(
            context.placementKey,
            identity,
            create,
            identity.instanceId === context.primaryInstanceId
              ? context.previous?.instanceId
              : undefined,
          )
        : {
            session: create(identity.instanceId),
            instanceId: identity.instanceId,
            sourceDigest: identity.sourceDigest,
            reused: false,
            sourceChanged: false,
          },
    };
  }
  const prepared = held.current.prepared;
  useEffect(() => {
    if (!context) return;
    const release = context.cache.retain(prepared);
    const report = () => context.report(prepared, { experimentId, instanceId, sourceDigest });
    report();
    const unsubscribe = prepared.session.subscribe?.(report);
    return () => {
      unsubscribe?.();
      release();
    };
  }, [context, prepared, experimentId, instanceId, sourceDigest]);
  return prepared.session;
}
