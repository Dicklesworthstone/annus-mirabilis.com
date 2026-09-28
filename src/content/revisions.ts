/**
 * Revision lineage validation, canonical content hashing, and cross-commit revision checks.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import { createHash } from "node:crypto";
import type { AliasRecord } from "./aliases.ts";
import { ISO_DATE_PATTERN } from "./aliases.ts";
import type { ParseResult } from "./ids.ts";

export interface RevisionLineageEntry {
  readonly revision: number;
  readonly reason: string;
  readonly date: string; // YYYY-MM-DD
}

export interface VersionedRecord {
  readonly id: string;
  readonly revision: number;
  readonly lineage?: readonly RevisionLineageEntry[];
  readonly [key: string]: unknown;
}

export interface ContentEntityIdentities {
  readonly contentRevision?: number;
  readonly sourceAssetDigest?: string;
  readonly translationRevision?: number;
  readonly modelVersion?: string;
  readonly artifactDigest?: string;
}

/**
 * Validates that distinct identity dimensions remain separate and are not collapsed.
 */
export function validateDistinctIdentities(identities: Record<string, unknown>): ParseResult<true> {
  const _allowedKeys = new Set([
    "contentRevision",
    "sourceAssetDigest",
    "translationRevision",
    "modelVersion",
    "artifactDigest",
  ]);

  // Ensure no single aggregated composite key like "combinedVersion" or "allInOneDigest" replaces them
  const forbiddenCollapses = ["compositeVersion", "allDigest", "versionHash", "unifiedRevision"];
  for (const key of forbiddenCollapses) {
    if (key in identities) {
      return {
        ok: false,
        error: `Forbidden collapsed identity field '${key}' found. AGENTS.md requires distinct identity fields.`,
        rule: "distinct-identity-dimensions",
      };
    }
  }

  return { ok: true, value: true };
}

/**
 * Validates that a versioned record's lineage is strictly increasing without gaps.
 */
export function validateRecordLineage(record: VersionedRecord): ParseResult<true> {
  if (
    typeof record.revision !== "number" ||
    !Number.isInteger(record.revision) ||
    record.revision < 1
  ) {
    return {
      ok: false,
      error: `Record '${record.id}' has invalid revision '${String(record.revision)}': must be a positive integer >= 1`,
      rule: "revision-positive-integer",
    };
  }

  const lineage = record.lineage;
  if (!lineage || lineage.length === 0) {
    if (record.revision === 1) {
      return { ok: true, value: true };
    }
    return {
      ok: false,
      error: `Record '${record.id}' at revision ${record.revision} requires a lineage array documenting earlier revisions`,
      rule: "lineage-required",
    };
  }

  // Check lineage entries
  let expectedRevision = 1;
  const maxLineageRev = lineage[lineage.length - 1]?.revision ?? 0;

  // Lineage must cover revisions 1 through (record.revision - 1) or 1 through record.revision
  for (const [i, entry] of lineage.entries()) {
    if (entry.revision !== expectedRevision) {
      return {
        ok: false,
        error: `Record '${record.id}' lineage gap at index ${i}: expected revision ${expectedRevision}, got ${entry.revision}`,
        rule: "lineage-gap",
      };
    }
    if (typeof entry.reason !== "string" || !entry.reason.trim()) {
      return {
        ok: false,
        error: `Record '${record.id}' lineage revision ${entry.revision} requires a non-empty reason string`,
        rule: "lineage-reason",
      };
    }
    if (typeof entry.date !== "string" || !ISO_DATE_PATTERN.test(entry.date)) {
      return {
        ok: false,
        error: `Record '${record.id}' lineage revision ${entry.revision} date '${entry.date}' must be YYYY-MM-DD`,
        rule: "lineage-date",
      };
    }
    expectedRevision++;
  }

  if (maxLineageRev !== record.revision && maxLineageRev !== record.revision - 1) {
    return {
      ok: false,
      error: `Record '${record.id}' lineage terminates at revision ${maxLineageRev}, but current revision is ${record.revision}`,
      rule: "lineage-gap",
    };
  }

  return { ok: true, value: true };
}

/**
 * Deterministically computes the SHA-256 hash of a record's substantive content (excluding revision metadata).
 */
export function computeCanonicalRecordHash(record: VersionedRecord): string {
  const substantive: Record<string, unknown> = {};
  const excludedKeys = new Set(["revision", "lineage", "updatedAt", "idsFrozenAt", "frozenBy"]);

  const sortedKeys = Object.keys(record)
    .filter((k) => !excludedKeys.has(k))
    .sort();

  for (const k of sortedKeys) {
    substantive[k] = record[k];
  }

  const jsonStr = JSON.stringify(substantive, (_, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sortedObj: Record<string, unknown> = {};
      for (const subKey of Object.keys(value).sort()) {
        sortedObj[subKey] = value[subKey];
      }
      return sortedObj;
    }
    return value;
  });

  return createHash("sha256").update(jsonStr).digest("hex");
}

export type RevisionFindingKind =
  | "content-changed-revision-unchanged"
  | "revision-decreased"
  | "record-removed-without-alias"
  | "invalid-lineage";

export interface RevisionFinding {
  readonly kind: RevisionFindingKind;
  readonly recordId: string;
  readonly message: string;
  readonly baseRevision?: number;
  readonly headRevision?: number;
  readonly baseHash?: string;
  readonly headHash?: string;
}

export interface RevisionCheckResult {
  readonly findings: readonly RevisionFinding[];
  readonly ok: boolean;
}

/**
 * WHAT MAKES TWO RECORDS THE SAME RECORD AT TWO COMMITS (am-9755).
 *
 * `id`, until 2026-09-27, and an id is unique only inside its layer and its paper. Measured over
 * content/: 1,816 records carry an id and a revision, and they use 770 distinct ids, so 537 ids
 * name more than one file. `masthead-title`, `closing-dateline`, `closing-received` and
 * `masthead-author` each name TWELVE files, one per paper in each of the source-block, translation
 * and gloss layers.
 *
 * Keyed by id, the map kept whichever file was read last, so the check compared light-quanta's
 * masthead against relativity's and reported that its content had changed while its revision had
 * not. It reported 223 such findings between two commits that touched no content file at all, and
 * it could never have reported none. A check that cannot pass cannot report a real omission
 * either: it had been red long enough to be read as scenery.
 *
 * So a record pairs on its own `key` when its loader sets one, which for the cross-commit check is
 * the file's path, the one thing that identifies the same record at two commits. `id` stays what
 * the finding NAMES, because a reader needs the record's own id, and the alias check stays keyed
 * by id, because a retirement alias retires an id and not a path.
 */
function pairingKey(record: VersionedRecord): string {
  return typeof record.key === "string" && record.key ? record.key : record.id;
}

/**
 * Pure core check comparing base records with head records.
 */
export function checkRevisionChanges(
  baseRecords: readonly VersionedRecord[],
  headRecords: readonly VersionedRecord[],
  aliases: readonly AliasRecord[] = [],
): RevisionCheckResult {
  const findings: RevisionFinding[] = [];
  const baseMap = new Map<string, VersionedRecord>();
  const headMap = new Map<string, VersionedRecord>();
  const retiredAliasIds = new Set(aliases.map((a) => a.retiredId));

  for (const rec of baseRecords) baseMap.set(pairingKey(rec), rec);
  for (const rec of headRecords) headMap.set(pairingKey(rec), rec);

  // 1. Check all base records
  for (const [key, baseRec] of baseMap.entries()) {
    const headRec = headMap.get(key);
    const id = baseRec.id;

    if (!headRec) {
      if (!retiredAliasIds.has(id)) {
        findings.push({
          kind: "record-removed-without-alias",
          recordId: id,
          message: `Record '${id}' was removed at HEAD without a registered retirement alias`,
          baseRevision: baseRec.revision,
        });
      }
      continue;
    }

    // Validate lineage on head record
    const lineageVal = validateRecordLineage(headRec);
    if (!lineageVal.ok) {
      findings.push({
        kind: "invalid-lineage",
        recordId: id,
        message: `Record '${id}' has invalid lineage: ${lineageVal.error}`,
        baseRevision: baseRec.revision,
        headRevision: headRec.revision,
      });
    }

    if (headRec.revision < baseRec.revision) {
      findings.push({
        kind: "revision-decreased",
        recordId: id,
        message: `Record '${id}' revision decreased from ${baseRec.revision} at base to ${headRec.revision} at HEAD`,
        baseRevision: baseRec.revision,
        headRevision: headRec.revision,
      });
      continue;
    }

    const baseHash = computeCanonicalRecordHash(baseRec);
    const headHash = computeCanonicalRecordHash(headRec);

    if (baseHash !== headHash && headRec.revision === baseRec.revision) {
      findings.push({
        kind: "content-changed-revision-unchanged",
        recordId: id,
        message: `Record '${id}' substantive content changed but revision remained ${baseRec.revision}`,
        baseRevision: baseRec.revision,
        headRevision: headRec.revision,
        baseHash,
        headHash,
      });
    }
  }

  // 2. Validate all new head records
  for (const [key, headRec] of headMap.entries()) {
    if (!baseMap.has(key)) {
      const lineageVal = validateRecordLineage(headRec);
      if (!lineageVal.ok) {
        findings.push({
          kind: "invalid-lineage",
          recordId: headRec.id,
          message: `New record '${headRec.id}' has invalid lineage: ${lineageVal.error}`,
          headRevision: headRec.revision,
        });
      }
    }
  }

  return {
    findings,
    ok: findings.length === 0,
  };
}
