/**
 * Identity attribute helpers for view kit primitives (am-inst-2d-view-kit-u75r).
 *
 * Every visual primitive maps identity props to data-instance-id, data-run-id,
 * and data-snapshot-version on its container root.
 */

import type { OptionalViewIdentityProps, ViewIdentityProps } from "./types.ts";

export type { OptionalViewIdentityProps, ViewIdentityProps };

export interface IdentityAttributes {
  readonly "data-instance-id": string;
  readonly "data-run-id": string;
  readonly "data-snapshot-version": string;
}

export function viewIdentityAttributes(props: ViewIdentityProps): IdentityAttributes {
  if (!props || typeof props !== "object") {
    throw new TypeError("Identity props must be an object");
  }
  const { instanceId, runId, snapshotVersion } = props;
  if (typeof instanceId !== "string" || instanceId.trim().length === 0) {
    throw new TypeError("Invalid or missing instanceId");
  }
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new TypeError("Invalid or missing runId");
  }
  if (
    snapshotVersion === undefined ||
    snapshotVersion === null ||
    String(snapshotVersion).trim().length === 0
  ) {
    throw new TypeError("Invalid or missing snapshotVersion");
  }

  return Object.freeze({
    "data-instance-id": instanceId,
    "data-run-id": runId,
    "data-snapshot-version": String(snapshotVersion),
  });
}

/**
 * Extracts identity attributes if provided, omitting undefined or blank fields.
 */
export function optionalIdentityAttributes(
  props?: OptionalViewIdentityProps | undefined,
): Record<string, string> {
  if (!props || typeof props !== "object") return Object.freeze({});
  const attrs: Record<string, string> = {};
  if (typeof props.instanceId === "string" && props.instanceId.trim().length > 0) {
    attrs["data-instance-id"] = props.instanceId.trim();
  }
  if (typeof props.runId === "string" && props.runId.trim().length > 0) {
    attrs["data-run-id"] = props.runId.trim();
  }
  if (
    props.snapshotVersion !== undefined &&
    props.snapshotVersion !== null &&
    String(props.snapshotVersion).trim().length > 0
  ) {
    attrs["data-snapshot-version"] = String(props.snapshotVersion).trim();
  }
  return Object.freeze(attrs);
}

