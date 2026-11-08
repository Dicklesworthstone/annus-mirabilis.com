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
import type { ReaderCheckpointBinding } from "./readerCheckpoint.ts";
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
  report(
    prepared: PreparedRetainedSession,
    identity: SessionRetentionIdentity,
    checkpoint?: ReaderCheckpointBinding | undefined,
  ): void;
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
      report(prepared, identity, checkpoint) {
        if (identity.instanceId !== instanceId) return;
        if (prepared.sourceChanged) {
          // The replacement owner was adopted before reporting; its presentation may now remount
          // from accepted state without constructing another owner or retaining an old form.
          setChildKey(identity.sourceDigest ?? "unknown-source");
        }
        if (!prepared.reused && prepared.restoredFromArchive) {
          setNotice(
            "Restored the recorded accepted experiment. Its run, settings and results have been verified.",
          );
        } else if (!prepared.reused && prepared.restoreNotice) {
          setNotice(
            `The earlier experiment could not be restored. ${prepared.restoreNotice} This visit starts a new experiment.`,
          );
        } else if (prepared.sourceChanged) {
          setNotice("The laboratory model has changed. This visit starts a new experiment.");
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
        const archive = checkpoint?.capture(prepared.session, identity, placementKey);
        const reference: LabReference = {
          instanceId: accepted.instanceId,
          experimentId: identity.experimentId,
          modelIdentity: identity.sourceDigest ?? "",
          runId: accepted.runId,
          // Unsupported or oversized owners stay honest in-memory references without an archive.
          checkpointDigest: archive?.checkpointDigest ?? "",
          compactTape: archive?.compactTape ?? "",
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
  checkpoint?: ReaderCheckpointBinding,
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
            checkpoint &&
              identity.instanceId === context.primaryInstanceId &&
              context.previous?.compactTape
              ? () =>
                  checkpoint.restore(
                    context.previous as LabReference,
                    identity,
                    context.placementKey,
                    create,
                  )
              : undefined,
          )
        : {
            session: create(identity.instanceId),
            instanceId: identity.instanceId,
            sourceDigest: identity.sourceDigest,
            reused: false,
            sourceChanged: false,
            restoredFromArchive: false,
            restoreNotice: null,
          },
    };
  }
  const prepared = held.current.prepared;
  useEffect(() => {
    if (!context) return;
    const release = context.cache.retain(prepared);
    const report = () =>
      context.report(prepared, { experimentId, instanceId, sourceDigest }, checkpoint);
    report();
    const unsubscribe = prepared.session.subscribe?.(report);
    return () => {
      unsubscribe?.();
      release();
    };
  }, [context, prepared, experimentId, instanceId, sourceDigest, checkpoint]);
  return prepared.session;
}
