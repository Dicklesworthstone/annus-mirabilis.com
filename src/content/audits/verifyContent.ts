/**
 * Orchestrator for scripts/verify-content.ts (am-cm-audit-scripts-d34).
 * Rule 0 is not machine-checkable; the help text says so.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listRegisteredChecks } from "../compiler/checks/registry.ts";
import { compileContent } from "../compiler/compile.ts";
import {
  compareCheckInventory,
  type InventoriedCheck,
  registerVerifyContentChecks,
} from "./inventory.ts";
import { auditPinnedAssets, type PinnedAsset } from "./pinnedAssets.ts";
import { type AuditFinding, type AuditReport, findingLine } from "./types.ts";

export const RULE_0_HELP =
  "Rule 0 (the user's override prerogative) is not machine-checkable and is not pretended to be.";

export type ContentFile = Readonly<{ path: string; text: string }>;

export type VerifyContentOptions = Readonly<{
  root: string;
  baseRef?: string;
  requireLocal?: boolean;
  architecture: () => number;
  loadFiles: () => Promise<readonly ContentFile[]>;
  revisionCheck?: (baseRef: string) => Promise<boolean | "skipped">;
  inventory: readonly InventoriedCheck[];
  pinnedAssets?: readonly PinnedAsset[];
  extraReports?: readonly AuditReport[];
}>;

export type VerifyContentResult = Readonly<{
  ok: boolean;
  exitCode: number;
  errors: readonly string[];
  flags: readonly string[];
  skipped: readonly string[];
  findings: readonly AuditFinding[];
}>;

export function parseInventoryFile(text: string): readonly InventoriedCheck[] {
  const parsed = JSON.parse(text) as { checks?: InventoriedCheck[] };
  if (!Array.isArray(parsed.checks)) {
    throw new Error("verify-content.checks.json must have a checks array.");
  }
  return parsed.checks;
}

export async function runVerifyContent(
  options: VerifyContentOptions,
): Promise<VerifyContentResult> {
  const errors: string[] = [];
  const flags: string[] = [];
  const skipped: string[] = [];
  const findings: AuditFinding[] = [];

  if (options.architecture() !== 0) {
    errors.push("architecture-gate: App Router / root-file allowlist failed.");
  }

  registerVerifyContentChecks();
  const files = await options.loadFiles();
  const compiled = await compileContent(files);
  for (const diagnostic of compiled.diagnostics) {
    const line = `${diagnostic.code}: ${diagnostic.path}: ${diagnostic.message}`;
    if (diagnostic.severity === "error") errors.push(line);
    else flags.push(line);
  }

  const inventoryFindings = compareCheckInventory(options.inventory, listRegisteredChecks());
  findings.push(...inventoryFindings);
  for (const finding of inventoryFindings) {
    if (finding.severity === "error") errors.push(findingLine(finding));
    else flags.push(findingLine(finding));
  }

  if (options.baseRef) {
    const revision = options.revisionCheck
      ? await options.revisionCheck(options.baseRef)
      : "skipped";
    if (revision === "skipped") skipped.push("revision-check-skipped");
    else if (revision === false) errors.push("revision-check: content revision identities failed.");
  } else {
    skipped.push("revision-check-skipped");
  }

  if (options.pinnedAssets) {
    const pinned = auditPinnedAssets(
      options.pinnedAssets,
      options.requireLocal === undefined ? {} : { requireLocal: options.requireLocal },
    );
    findings.push(...pinned.findings);
    for (const finding of pinned.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
  }

  for (const report of options.extraReports ?? []) {
    findings.push(...report.findings);
    for (const finding of report.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
  }

  return Object.freeze({
    ok: errors.length === 0,
    exitCode: errors.length === 0 ? 0 : 1,
    errors,
    flags,
    skipped,
    findings,
  });
}

export function loadCommittedInventory(root: string): readonly InventoriedCheck[] {
  const path = resolve(root, "scripts/verify-content.checks.json");
  return parseInventoryFile(readFileSync(path, "utf8"));
}
