import type { Alignment, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";

export interface AlignmentIndex {
  readonly sourceToTarget: ReadonlyMap<string, readonly string[]>;
  readonly targetToSource: ReadonlyMap<string, readonly string[]>;
  readonly orderedSentenceIds: readonly string[];
  readonly orderedUnitIds: readonly string[];
}

/**
 * Builds bidirectional lookup indexes for many-to-many alignment between source sentences and translation units.
 */
export function buildAlignmentIndex(
  alignment?: Alignment | null | undefined,
  sourceBlocks?: readonly SourceBlock[] | undefined,
  translationUnits?: readonly TranslationUnit[] | undefined,
): AlignmentIndex {
  const sourceToTarget = new Map<string, Set<string>>();
  const targetToSource = new Map<string, Set<string>>();

  if (alignment?.edges) {
    for (const edge of alignment.edges) {
      const srcId = edge.source.sentenceId || edge.source.blockId;
      const tgtId = edge.target.translationUnitId;

      if (srcId && tgtId) {
        let targets = sourceToTarget.get(srcId);
        if (!targets) {
          targets = new Set();
          sourceToTarget.set(srcId, targets);
        }
        targets.add(tgtId);

        // Also index by blockId if sentenceId was used
        if (edge.source.sentenceId && edge.source.blockId) {
          let blockTargets = sourceToTarget.get(edge.source.blockId);
          if (!blockTargets) {
            blockTargets = new Set();
            sourceToTarget.set(edge.source.blockId, blockTargets);
          }
          blockTargets.add(tgtId);
        }

        let sources = targetToSource.get(tgtId);
        if (!sources) {
          sources = new Set();
          targetToSource.set(tgtId, sources);
        }
        sources.add(srcId);
        if (edge.source.sentenceId && edge.source.blockId) {
          sources.add(edge.source.blockId);
        }
      }
    }
  }

  // Collect ordered sentence IDs from sourceBlocks
  const orderedSentenceIds: string[] = [];
  if (sourceBlocks) {
    for (const block of sourceBlocks) {
      if (block.sentenceSpans && block.sentenceSpans.length > 0) {
        for (const span of block.sentenceSpans) {
          if (span.id && !orderedSentenceIds.includes(span.id)) {
            orderedSentenceIds.push(span.id);
          }
        }
      } else if (block.id && !orderedSentenceIds.includes(block.id)) {
        orderedSentenceIds.push(block.id);
      }
    }
  }

  // Collect ordered unit IDs from translationUnits
  const orderedUnitIds: string[] = [];
  if (translationUnits) {
    for (const unit of translationUnits) {
      if (unit.id && !orderedUnitIds.includes(unit.id)) {
        orderedUnitIds.push(unit.id);
      }
    }
  }

  // Freeze maps to read-only
  const frozenSourceToTarget = new Map<string, readonly string[]>();
  for (const [k, v] of sourceToTarget.entries()) {
    frozenSourceToTarget.set(k, Object.freeze(Array.from(v)));
  }

  const frozenTargetToSource = new Map<string, readonly string[]>();
  for (const [k, v] of targetToSource.entries()) {
    frozenTargetToSource.set(k, Object.freeze(Array.from(v)));
  }

  return Object.freeze({
    sourceToTarget: frozenSourceToTarget,
    targetToSource: frozenTargetToSource,
    orderedSentenceIds: Object.freeze(orderedSentenceIds),
    orderedUnitIds: Object.freeze(orderedUnitIds),
  });
}

/**
 * Returns all aligned translation unit IDs for a given source sentence or block ID.
 */
export function getAlignedTargets(index: AlignmentIndex, sourceId: string): readonly string[] {
  return index.sourceToTarget.get(sourceId) || Object.freeze([]);
}

/**
 * Returns all aligned source sentence/block IDs for a given translation unit ID.
 */
export function getAlignedSources(index: AlignmentIndex, targetId: string): readonly string[] {
  return index.targetToSource.get(targetId) || Object.freeze([]);
}

/**
 * Checks whether a source ID is aligned to a target ID.
 */
export function isSourceAlignedToTarget(
  index: AlignmentIndex,
  sourceId: string,
  targetId: string,
): boolean {
  const targets = index.sourceToTarget.get(sourceId);
  return targets?.includes(targetId) ?? false;
}

export function getSentenceIndex(index: AlignmentIndex, sentenceId: string): number {
  return index.orderedSentenceIds.indexOf(sentenceId);
}

export function getSentenceByIndex(index: AlignmentIndex, idx: number): string | undefined {
  if (idx < 0 || idx >= index.orderedSentenceIds.length) return undefined;
  return index.orderedSentenceIds[idx];
}

export function getUnitIndex(index: AlignmentIndex, unitId: string): number {
  return index.orderedUnitIds.indexOf(unitId);
}

export function getUnitByIndex(index: AlignmentIndex, idx: number): string | undefined {
  if (idx < 0 || idx >= index.orderedUnitIds.length) return undefined;
  return index.orderedUnitIds[idx];
}
