/**
 * Alias records, resolution chains, cycle detection, and sequence gap explanation.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import type { ParseResult } from "./ids.ts";

export type AliasKind = "retired" | "split" | "merged";

export interface AliasRecord {
  readonly retiredId: string;
  readonly kind: AliasKind;
  readonly replacementIds: readonly string[];
  readonly reason: string;
  readonly date: string; // YYYY-MM-DD ISO calendar date
  readonly editor: string;
}

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the structure and constraints of an alias record.
 */
export function validateAliasRecord(raw: unknown): ParseResult<AliasRecord> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Alias record must be an object", rule: "alias-schema" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.retiredId !== "string" || !obj.retiredId.trim()) {
    return {
      ok: false,
      error: "Alias record requires a non-empty 'retiredId' string",
      rule: "alias-schema",
    };
  }

  const kind = obj.kind;
  if (kind !== "retired" && kind !== "split" && kind !== "merged") {
    return {
      ok: false,
      error: `Invalid alias kind '${String(kind)}': must be 'retired', 'split', or 'merged'`,
      rule: "alias-kind-grammar",
    };
  }

  if (!Array.isArray(obj.replacementIds)) {
    return {
      ok: false,
      error: "Alias record 'replacementIds' must be an array of strings",
      rule: "alias-schema",
    };
  }
  const replacementIds: string[] = [];
  for (const rep of obj.replacementIds) {
    if (typeof rep !== "string" || !rep.trim()) {
      return {
        ok: false,
        error: "Alias replacement IDs must be non-empty strings",
        rule: "alias-schema",
      };
    }
    replacementIds.push(rep.trim());
  }

  if (kind === "retired" && replacementIds.length !== 1) {
    return {
      ok: false,
      error: `Retired alias '${obj.retiredId}' must specify exactly one replacement ID, got ${replacementIds.length}`,
      rule: "alias-replacement-count",
    };
  }

  if (kind === "merged" && replacementIds.length !== 1) {
    return {
      ok: false,
      error: `Merged alias '${obj.retiredId}' must specify exactly one replacement ID, got ${replacementIds.length}`,
      rule: "alias-replacement-count",
    };
  }

  if (kind === "split" && replacementIds.length < 2) {
    return {
      ok: false,
      error: `Split alias '${obj.retiredId}' must specify at least two replacement IDs in reading order, got ${replacementIds.length}`,
      rule: "alias-replacement-count",
    };
  }

  if (typeof obj.date !== "string" || !ISO_DATE_PATTERN.test(obj.date)) {
    return {
      ok: false,
      error: `Alias record date '${String(obj.date)}' must be an ISO calendar date string in YYYY-MM-DD format (not a Date object)`,
      rule: "alias-date-format",
    };
  }

  if (typeof obj.reason !== "string" || !obj.reason.trim()) {
    return {
      ok: false,
      error: "Alias record requires a non-empty 'reason' string",
      rule: "alias-schema",
    };
  }

  if (typeof obj.editor !== "string" || !obj.editor.trim()) {
    return {
      ok: false,
      error: "Alias record requires a non-empty 'editor' string",
      rule: "alias-schema",
    };
  }

  return {
    ok: true,
    value: {
      retiredId: obj.retiredId.trim(),
      kind: kind as AliasKind,
      replacementIds,
      reason: obj.reason.trim(),
      date: obj.date,
      editor: obj.editor.trim(),
    },
  };
}

export type AliasResolutionResult =
  | { readonly ok: true; readonly targetIds: readonly string[] }
  | { readonly ok: false; readonly error: string; readonly code: "cycle" | "dangling" | "invalid" };

/**
 * Resolves an ID through alias chains (e.g. A -> B, B -> [C, D]), detecting cycles and dangling links.
 */
export function resolveAlias(
  id: string,
  aliasRecords: readonly AliasRecord[],
  validCorpusIds?: readonly string[] | Set<string>,
): AliasResolutionResult {
  const aliasMap = new Map<string, AliasRecord>();
  for (const record of aliasRecords) {
    const val = validateAliasRecord(record);
    if (!val.ok) {
      return { ok: false, error: `Invalid alias record: ${val.error}`, code: "invalid" };
    }
    aliasMap.set(val.value.retiredId, val.value);
  }

  const corpusSet = validCorpusIds
    ? validCorpusIds instanceof Set
      ? validCorpusIds
      : new Set(validCorpusIds)
    : undefined;

  const visited = new Set<string>();

  function resolveHelper(currentId: string, path: string[]): AliasResolutionResult {
    if (path.includes(currentId)) {
      const cycleStr = [...path, currentId].join(" -> ");
      return {
        ok: false,
        error: `Alias cycle detected: ${cycleStr}`,
        code: "cycle",
      };
    }

    const alias = aliasMap.get(currentId);
    if (!alias) {
      // Leaf node reached
      if (corpusSet && !corpusSet.has(currentId)) {
        return {
          ok: false,
          error: `Alias replacement ID '${currentId}' is missing from the corpus and has no alias`,
          code: "dangling",
        };
      }
      return { ok: true, targetIds: [currentId] };
    }

    const resultIds: string[] = [];
    const nextPath = [...path, currentId];

    for (const rep of alias.replacementIds) {
      const childRes = resolveHelper(rep, nextPath);
      if (!childRes.ok) {
        return childRes;
      }
      resultIds.push(...childRes.targetIds);
    }

    return { ok: true, targetIds: resultIds };
  }

  return resolveHelper(id, []);
}

/**
 * Explains a missing sequence gap using registered alias records.
 */
export function explainGap(
  missingId: string,
  aliases: readonly AliasRecord[],
):
  | { readonly status: "explained"; readonly alias: AliasRecord }
  | { readonly status: "unexplained" } {
  const alias = aliases.find((a) => a.retiredId === missingId);
  if (alias) {
    return { status: "explained", alias };
  }
  return { status: "unexplained" };
}
