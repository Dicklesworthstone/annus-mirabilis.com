/**
 * Alias redirects for am-read-anchors-navigation-a6o: a thin consumer of
 * `src/content/aliases.ts`'s `resolveAlias` (cycle detection, dangling-link
 * detection, and chain resolution already solved there). This module adds
 * only the reader-navigation policy: a split id resolves to its first
 * successor (noted, per the bead's own wording), a static alias anchor is
 * placed at a retired id's resolved location so old links work without
 * JavaScript, and with JavaScript `location.hash` is rewritten via
 * `history.replaceState` (the actual browser call belongs to whichever
 * module mounts the reader shell; this file only computes the target).
 */

import { type AliasRecord, resolveAlias } from "../../content/aliases.ts";

export interface AliasRedirect {
  readonly requestedId: string;
  readonly resolvedId: string;
  readonly allTargetIds: readonly string[];
  /** Present only when more than one successor existed and the first was chosen. */
  readonly note?: string;
}

export type AliasRedirectOutcome =
  | Readonly<{ kind: "no-alias" }>
  | Readonly<{ kind: "redirect"; redirect: AliasRedirect }>
  | Readonly<{ kind: "error"; error: string; code: "cycle" | "dangling" | "invalid" }>;

function findAliasRecord(
  id: string,
  aliasRecords: readonly AliasRecord[],
): AliasRecord | undefined {
  return aliasRecords.find((a) => a.retiredId === id);
}

/** Resolves a requested id through the alias chain, or reports it was never retired at all. */
export function resolveNavigationAlias(
  id: string,
  aliasRecords: readonly AliasRecord[],
  validCorpusIds?: readonly string[] | Set<string>,
): AliasRedirectOutcome {
  if (!findAliasRecord(id, aliasRecords)) return { kind: "no-alias" };
  const result = resolveAlias(id, aliasRecords, validCorpusIds);
  if (!result.ok) return { kind: "error", error: result.error, code: result.code };
  const [first, ...restIds] = result.targetIds;
  if (first === undefined) {
    return { kind: "error", error: `Alias '${id}' resolved to no targets`, code: "dangling" };
  }
  return {
    kind: "redirect",
    redirect: {
      requestedId: id,
      resolvedId: first,
      allTargetIds: result.targetIds,
      ...(restIds.length > 0
        ? { note: `resolved to the first of ${result.targetIds.length} successors` }
        : {}),
    },
  };
}

/**
 * Every retired or split id whose resolved location is `contentId` -- the
 * static alias anchors a face renderer must also emit there, so an old link
 * lands on the current content without JavaScript.
 */
export function aliasIdsForLocation(
  contentId: string,
  aliasRecords: readonly AliasRecord[],
  validCorpusIds?: readonly string[] | Set<string>,
): readonly string[] {
  const matches: string[] = [];
  for (const record of aliasRecords) {
    const outcome = resolveNavigationAlias(record.retiredId, aliasRecords, validCorpusIds);
    if (outcome.kind === "redirect" && outcome.redirect.resolvedId === contentId) {
      matches.push(record.retiredId);
    }
  }
  return matches;
}

/**
 * The hash `history.replaceState` should rewrite `location.hash` to, or
 * `null` when the current hash needs no rewrite (not a retired id, or
 * already current). Pure: the browser call itself belongs to the caller.
 */
export function rewrittenHashFor(
  currentHash: string,
  aliasRecords: readonly AliasRecord[],
  validCorpusIds?: readonly string[] | Set<string>,
): string | null {
  const id = currentHash.startsWith("#") ? currentHash.slice(1) : currentHash;
  if (!id) return null;
  const outcome = resolveNavigationAlias(id, aliasRecords, validCorpusIds);
  return outcome.kind === "redirect" ? `#${outcome.redirect.resolvedId}` : null;
}
