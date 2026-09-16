/**
 * Rule 1 pinned-asset presence (am-cm-audit-scripts-d34).
 * publish → missing file is an error; pin-local-only → not-available unless
 * --require-local; reference-only has no file to check.
 */

import { existsSync } from "node:fs";
import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export type PublicationDecision = "publish" | "pin-local-only" | "reference-only";

export type PinnedAsset = Readonly<{
  id: string;
  path: string;
  publicationDecision: PublicationDecision;
}>;

export function auditPinnedAssets(
  assets: readonly PinnedAsset[],
  options: Readonly<{ requireLocal?: boolean; exists?: (path: string) => boolean }> = {},
): AuditReport {
  const exists = options.exists ?? existsSync;
  const findings: AuditFinding[] = [];

  for (const asset of assets) {
    if (asset.publicationDecision === "reference-only") continue;
    const present = exists(asset.path);
    if (present) continue;
    if (asset.publicationDecision === "publish") {
      findings.push({
        check: "pinned-asset-present",
        family: "audit",
        severity: "error",
        recordId: asset.id,
        message: `Published asset ${asset.id} is missing at ${asset.path}.`,
      });
      continue;
    }
    if (options.requireLocal) {
      findings.push({
        check: "pinned-asset-present",
        family: "audit",
        severity: "error",
        recordId: asset.id,
        message: `pin-local-only asset ${asset.id} is missing at ${asset.path} (--require-local).`,
      });
      continue;
    }
    findings.push({
      check: "pinned-asset-not-available",
      family: "audit",
      severity: "flag",
      recordId: asset.id,
      message: `pin-local-only asset ${asset.id} is not-available at ${asset.path}.`,
    });
  }

  return summarize("audit-pinned-assets", findings);
}
