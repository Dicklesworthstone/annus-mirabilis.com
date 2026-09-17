import {
  type AlignmentIndex,
  getAlignedSources,
  getAlignedTargets,
  getSentenceIndex,
} from "./alignment.ts";

export type ActiveHighlightKind = "source" | "target";

export interface HighlightResult {
  readonly activeId: string | null;
  readonly activeKind: ActiveHighlightKind | null;
  readonly highlightedSourceIds: ReadonlySet<string>;
  readonly highlightedTargetIds: ReadonlySet<string>;
}

const EMPTY_SET: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * Computes highlighted source and target IDs given an active source sentence or translation unit ID.
 */
export function computeHighlights(
  index: AlignmentIndex,
  activeId: string | null | undefined,
  activeKind?: ActiveHighlightKind | null | undefined,
): HighlightResult {
  if (!activeId) {
    return Object.freeze({
      activeId: null,
      activeKind: null,
      highlightedSourceIds: EMPTY_SET,
      highlightedTargetIds: EMPTY_SET,
    });
  }

  // Infer kind if not passed
  let kind = activeKind;
  if (!kind) {
    if (index.sourceToTarget.has(activeId) || index.orderedSentenceIds.includes(activeId)) {
      kind = "source";
    } else if (index.targetToSource.has(activeId) || index.orderedUnitIds.includes(activeId)) {
      kind = "target";
    } else {
      kind = "source";
    }
  }

  const sourceIds = new Set<string>();
  const targetIds = new Set<string>();

  if (kind === "source") {
    sourceIds.add(activeId);
    const targets = getAlignedTargets(index, activeId);
    for (const tid of targets) {
      targetIds.add(tid);
    }
  } else {
    targetIds.add(activeId);
    const sources = getAlignedSources(index, activeId);
    for (const sid of sources) {
      sourceIds.add(sid);
    }
  }

  return Object.freeze({
    activeId,
    activeKind: kind,
    highlightedSourceIds: Object.freeze(sourceIds),
    highlightedTargetIds: Object.freeze(targetIds),
  });
}

/**
 * Gets the next sentence ID in document order for keyboard sentence-mode navigation.
 */
export function nextSentenceId(
  index: AlignmentIndex,
  currentSentenceId?: string | null | undefined,
): string | undefined {
  if (index.orderedSentenceIds.length === 0) return undefined;
  if (!currentSentenceId) return index.orderedSentenceIds[0];
  const idx = getSentenceIndex(index, currentSentenceId);
  if (idx < 0) return index.orderedSentenceIds[0];
  const nextIdx = Math.min(idx + 1, index.orderedSentenceIds.length - 1);
  return index.orderedSentenceIds[nextIdx];
}

/**
 * Gets the previous sentence ID in document order for keyboard sentence-mode navigation.
 */
export function prevSentenceId(
  index: AlignmentIndex,
  currentSentenceId?: string | null | undefined,
): string | undefined {
  if (index.orderedSentenceIds.length === 0) return undefined;
  if (!currentSentenceId) return index.orderedSentenceIds[0];
  const idx = getSentenceIndex(index, currentSentenceId);
  if (idx <= 0) return index.orderedSentenceIds[0];
  const prevIdx = idx - 1;
  return index.orderedSentenceIds[prevIdx];
}
