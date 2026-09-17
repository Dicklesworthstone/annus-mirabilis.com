/**
 * Content-id lookup for am-read-anchors-navigation-a6o.
 *
 * Anchors are content ids, never array positions. The donor keyed parallel
 * readings by block index, so inserting a paragraph shifted every annotation
 * after it. This module looks up by id; the donor-index scheme lives only in
 * the planted-negative test, where it is required to fail.
 */

import type { AliasRecord } from "../../content/aliases.ts";
import { resolveNavigationAlias } from "./aliases.ts";

export type ContentUnit = Readonly<{
  id: string;
  text: string;
}>;

/**
 * A paper's addressable units, keyed by content id. Construction refuses
 * duplicate ids. There is no index-based getter on this type.
 */
export type ContentDocument = ReadonlyMap<string, ContentUnit>;

export function documentByContentId(units: readonly ContentUnit[]): ContentDocument {
  const map = new Map<string, ContentUnit>();
  for (const unit of units) {
    if (map.has(unit.id)) {
      throw new Error(`Duplicate content id '${unit.id}'.`);
    }
    map.set(unit.id, unit);
  }
  return map;
}

/** The unit with this content id, or undefined. Never an array index. */
export function lookupByContentId(document: ContentDocument, id: string): ContentUnit | undefined {
  return document.get(id);
}

export type ResolvedAnchor =
  | Readonly<{
      kind: "found";
      requestedId: string;
      id: string;
      unit: ContentUnit;
      viaAlias: boolean;
    }>
  | Readonly<{ kind: "missing"; requestedId: string }>;

/**
 * Resolves a hash or bare id against a content-id document, consuming the
 * alias table so a retired id lands on its successor. The alias table is not
 * decoration: a retired id that is absent from the document still resolves
 * when an alias names a living successor.
 */
export function resolveRequestedAnchor(
  requested: string,
  document: ContentDocument,
  aliasRecords: readonly AliasRecord[] = [],
): ResolvedAnchor {
  const requestedId = requested.startsWith("#") ? requested.slice(1) : requested;
  if (!requestedId) return { kind: "missing", requestedId };

  const direct = lookupByContentId(document, requestedId);
  if (direct) {
    return { kind: "found", requestedId, id: requestedId, unit: direct, viaAlias: false };
  }

  const outcome = resolveNavigationAlias(requestedId, aliasRecords, [...document.keys()]);
  if (outcome.kind === "redirect") {
    const successor = lookupByContentId(document, outcome.redirect.resolvedId);
    if (successor) {
      return {
        kind: "found",
        requestedId,
        id: outcome.redirect.resolvedId,
        unit: successor,
        viaAlias: true,
      };
    }
  }

  return { kind: "missing", requestedId };
}

/**
 * Registry-hash resolution used by parseReaderLocation: a living id, else an
 * alias successor that is still in the registry, else the first authored
 * passage. Still never "the id at this array index."
 */
export function resolveRegistryAnchor(
  requestedId: string,
  knownIds: readonly string[],
  aliasRecords: readonly AliasRecord[] = [],
): string {
  if (knownIds.includes(requestedId)) return requestedId;
  if (aliasRecords.length > 0 && requestedId) {
    const outcome = resolveNavigationAlias(requestedId, aliasRecords, knownIds);
    if (outcome.kind === "redirect" && knownIds.includes(outcome.redirect.resolvedId)) {
      return outcome.redirect.resolvedId;
    }
  }
  return knownIds[0] ?? "";
}
