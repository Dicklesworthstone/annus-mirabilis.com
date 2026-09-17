/**
 * Explicit many-to-many alignment (am-edn-alignment-tooling-do1).
 * Edges name permanent ids. Array positions are not an alignment.
 */

import type { Alignment, AlignmentEdge } from "../schemas/source.ts";
import { isPermanentEnglishId, isPermanentGermanId } from "./alignableIds.ts";

export type AlignmentIssue = Readonly<{
  code:
    | "index-based-edge"
    | "missing-source-id"
    | "missing-target-id"
    | "unknown-source"
    | "unknown-target"
    | "empty-alignment"
    | "math-atoms-differ";
  message: string;
  sourceId?: string | undefined;
  targetId?: string | undefined;
}>;

export type ExplicitEdge = Readonly<{
  sourceId: string;
  targetId: string;
}>;

function looksLikeIndex(value: unknown): boolean {
  return typeof value === "number" || (typeof value === "string" && /^(index:)?\d+$/.test(value));
}

export function edgesFromAlignment(alignment: Alignment): readonly ExplicitEdge[] {
  return Object.freeze(
    alignment.edges.map((edge) => ({
      sourceId: edge.source.sentenceId ?? edge.source.blockId,
      targetId: edge.target.translationUnitId,
    })),
  );
}

export function validateManyToManyAlignment(input: {
  edges: readonly ExplicitEdge[];
  germanIds: readonly string[];
  englishIds: readonly string[];
}): readonly AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  if (input.edges.length === 0) {
    issues.push({
      code: "empty-alignment",
      message:
        "Alignment has no edges. Many-to-many edges must be authored; paragraph counts are not an alignment.",
    });
    return Object.freeze(issues);
  }
  const german = new Set(input.germanIds);
  const english = new Set(input.englishIds);
  for (const edge of input.edges) {
    if (looksLikeIndex(edge.sourceId) || looksLikeIndex(edge.targetId)) {
      issues.push({
        code: "index-based-edge",
        message: `Edge uses an array index (${edge.sourceId} → ${edge.targetId}). Alignment is by permanent id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!edge.sourceId || !isPermanentGermanId(edge.sourceId)) {
      issues.push({
        code: "missing-source-id",
        message: `Source "${edge.sourceId}" is not a permanent German alignable id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!edge.targetId || !isPermanentEnglishId(edge.targetId)) {
      issues.push({
        code: "missing-target-id",
        message: `Target "${edge.targetId}" is not a permanent English translation-unit id.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
      continue;
    }
    if (!german.has(edge.sourceId)) {
      issues.push({
        code: "unknown-source",
        message: `Alignment source "${edge.sourceId}" is not in the German id set.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
    }
    if (!english.has(edge.targetId)) {
      issues.push({
        code: "unknown-target",
        message: `Alignment target "${edge.targetId}" is not in the English id set.`,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
      });
    }
  }
  return Object.freeze(issues);
}

/**
 * Notation is not translated. An English display must be byte-identical
 * to the aligned German display. A rename such as V → c is not alignment.
 */
export function validateDisplayByteIdentity(
  germanDisplay: string,
  englishDisplay: string,
): AlignmentIssue | null {
  if (germanDisplay === englishDisplay) return null;
  return {
    code: "math-atoms-differ",
    message:
      "English display is not byte-identical to the German display. Notation is not translated.",
  };
}

/**
 * Donor scheme: pair the nth German block with the nth English unit.
 * Inserting a paragraph shifts every later pair. Kept only as the planted
 * negative this tooling exists to replace.
 */
export function donorIndexAlignment(
  germanIds: readonly string[],
  englishIds: readonly string[],
): readonly Readonly<{ sourceIndex: number; targetIndex: number }>[] {
  const n = Math.min(germanIds.length, englishIds.length);
  return Object.freeze(Array.from({ length: n }, (_, i) => ({ sourceIndex: i, targetIndex: i })));
}

export function insertGermanUnit(
  germanIds: readonly string[],
  at: number,
  newId: string,
): readonly string[] {
  const next = germanIds.slice();
  next.splice(at, 0, newId);
  return Object.freeze(next);
}

export function edgeStillPointsAtPair(
  edges: readonly ExplicitEdge[],
  sourceId: string,
  targetId: string,
): boolean {
  return edges.some((e) => e.sourceId === sourceId && e.targetId === targetId);
}

export function toAlignmentRecord(paper: string, edges: readonly ExplicitEdge[]): Alignment {
  const recordEdges: AlignmentEdge[] = edges.map((e) => ({
    source: {
      paper,
      blockId: e.sourceId.includes("-s") ? e.sourceId.replace(/-s[1-9]\d*$/, "") : e.sourceId,
      sentenceId: e.sourceId.match(/-s[1-9]\d*$/) ? e.sourceId : undefined,
    },
    target: { translationUnitId: e.targetId },
  }));
  return { id: `align-${paper}`, paper, edges: Object.freeze(recordEdges) };
}
