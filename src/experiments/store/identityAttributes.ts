import type { ExperimentView } from "./instanceStore.ts";

/**
 * The harness DOM contract's identity attributes (am-rt-snapshot-store-aft
 * requirement 11), validated at the browser boundary by
 * `scripts/e2e/domContract.ts`'s `parseInstrumentView` / `parseInstrumentRoot`.
 * `undefined` before any snapshot has ever been accepted: there is no
 * identity to publish yet, and a root with no accepted snapshot renders its
 * own "not started" state instead of fabricating attribute values.
 */
export type ViewRootAttributes = Readonly<{
  "data-instance-id": string;
  "data-run-id": string;
  "data-snapshot-version": string;
}>;

export type InstrumentRootAttributes = ViewRootAttributes &
  Readonly<{
    "data-input-revision": string;
    "data-accepted-input-revision": string;
    "data-pending": "true" | "false";
    "data-accepted-action-index": string;
    "data-view-state": ExperimentView["status"];
  }>;

/** The retired name a test must never find on rendered markup (requirement 11). */
export const RETIRED_SNAPSHOT_VERSION_ATTRIBUTE = "data-accepted-snapshot-version";

export function viewRootAttributes(view: ExperimentView): ViewRootAttributes | undefined {
  const accepted = view.accepted;
  if (!accepted) return undefined;
  return Object.freeze({
    "data-instance-id": accepted.instanceId,
    "data-run-id": accepted.runId,
    "data-snapshot-version": String(accepted.snapshotVersion),
  });
}

export function instrumentRootAttributes(
  view: ExperimentView,
): InstrumentRootAttributes | undefined {
  const base = viewRootAttributes(view);
  const accepted = view.accepted;
  if (!base || !accepted) return undefined;
  const requestedInputRevision = view.requested?.revisions.input ?? accepted.revisions.input;
  return Object.freeze({
    ...base,
    "data-input-revision": String(requestedInputRevision),
    "data-accepted-input-revision": String(accepted.revisions.input),
    "data-pending": view.pending ? "true" : "false",
    "data-accepted-action-index": String(accepted.actionIndex),
    "data-view-state": view.status,
  });
}
