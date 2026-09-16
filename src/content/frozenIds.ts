/**
 * Frozen ID snapshot validation and stability gate.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import { type AliasRecord, resolveAlias } from "./aliases.ts";

export type FrozenFindingKind = "frozen-id-missing" | "retired-id-reused" | "new-id";

export interface FrozenFinding {
  readonly kind: FrozenFindingKind;
  readonly id: string;
  readonly message: string;
}

export interface FrozenIdValidationResult {
  readonly findings: readonly FrozenFinding[];
  readonly missingCount: number;
  readonly reusedCount: number;
  readonly newCount: number;
  readonly ok: boolean;
}

/**
 * Parses snapshot file content, ignoring comments (lines starting with #) and empty lines.
 */
export function parseIdSnapshot(snapshotText: string): string[] {
  const ids: string[] = [];
  const lines = snapshotText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    ids.push(line);
  }
  return ids;
}

/**
 * Validates current content IDs against a frozen snapshot and registered alias records.
 *
 * Rules:
 * 1. Every snapshot ID must be present in currentIds OR be a retiredId in an alias that resolves.
 *    (Otherwise: frozen-id-missing error)
 * 2. No currentId can equal a retiredId in aliases.
 *    (Otherwise: retired-id-reused error)
 * 3. Any currentId absent from snapshot is reported as 'new-id' (informational for review).
 */
export function validateFrozenIds(
  snapshotText: string,
  currentIds: readonly string[],
  aliases: readonly AliasRecord[],
): FrozenIdValidationResult {
  const snapshotIds = parseIdSnapshot(snapshotText);
  const currentSet = new Set(currentIds);
  const snapshotSet = new Set(snapshotIds);
  const retiredAliasMap = new Map<string, AliasRecord>();

  for (const alias of aliases) {
    retiredAliasMap.set(alias.retiredId, alias);
  }

  const findings: FrozenFinding[] = [];
  let missingCount = 0;
  let reusedCount = 0;
  let newCount = 0;

  // 1. Check every snapshot ID
  for (const snapId of snapshotIds) {
    if (currentSet.has(snapId)) {
      continue;
    }
    // Check if retired with valid alias
    const alias = retiredAliasMap.get(snapId);
    if (alias) {
      const resolution = resolveAlias(snapId, aliases);
      if (resolution.ok) {
        continue; // Explained by alias
      }
    }
    findings.push({
      kind: "frozen-id-missing",
      id: snapId,
      message: `Frozen ID '${snapId}' is missing from current manifest without a valid alias record`,
    });
    missingCount++;
  }

  // 2. Check for reused retired IDs and new IDs
  for (const currId of currentIds) {
    if (retiredAliasMap.has(currId)) {
      findings.push({
        kind: "retired-id-reused",
        id: currId,
        message: `Current ID '${currId}' reuses a retired ID that was previously retired in an alias record`,
      });
      reusedCount++;
      continue;
    }

    if (!snapshotSet.has(currId)) {
      findings.push({
        kind: "new-id",
        id: currId,
        message: `New ID '${currId}' added since frozen snapshot`,
      });
      newCount++;
    }
  }

  const ok = missingCount === 0 && reusedCount === 0;

  return {
    findings,
    missingCount,
    reusedCount,
    newCount,
    ok,
  };
}
