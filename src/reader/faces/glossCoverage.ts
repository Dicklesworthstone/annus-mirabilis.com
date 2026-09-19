import { isModalityClass } from "../../content/schemas/glossConventions.pure.ts";
import type { GlossUnit, SourceBlock } from "../../content/schemas/source.ts";

export interface ModalityClassCount {
  readonly [className: string]: number;
}

export interface GlossCoverageReport {
  readonly paperSlug: string;
  readonly totalSentences: number;
  readonly glossedSentences: number;
  readonly unglossedSentences: number;
  readonly totalTokens: number;
  readonly markedTokens: number;
  readonly modalityCounts: ModalityClassCount;
}

/**
 * Computes the coverage report of marked reasoning words for a given paper.
 * Strict doctrine: per-class counts only, NO percentages, and never fails on zero marked tokens.
 */
export function computeGlossCoverageReport(
  paperSlug: string,
  blocks: readonly SourceBlock[],
  glossUnits: readonly GlossUnit[],
  modalityClasses: readonly string[],
): GlossCoverageReport {
  let totalSentences = 0;
  for (const b of blocks) {
    if (b.sentenceSpans && b.sentenceSpans.length > 0) {
      totalSentences += b.sentenceSpans.length;
    }
  }

  let glossedSentences = 0;
  let totalTokens = 0;
  let markedTokens = 0;
  const modalityCounts: Record<string, number> = {};

  const glossMap = new Map<string, GlossUnit>(glossUnits.map((g) => [g.sentenceId, g]));

  for (const b of blocks) {
    if (b.sentenceSpans) {
      for (const sp of b.sentenceSpans) {
        const unit = glossMap.get(sp.id);
        if (unit) {
          glossedSentences++;
          totalTokens += unit.tokens.length;

          // Track multiword unit index coverage to avoid double counting
          const processedMultiwordIndices = new Set<number>();

          for (let i = 0; i < unit.tokens.length; i++) {
            const token = unit.tokens[i];
            if (!token) continue;
            const mw = unit.multiwordUnits?.find((m) => m.tokenIndices.includes(i));

            if (mw) {
              const firstIdx = mw.tokenIndices[0];
              if (firstIdx !== undefined && isModalityClass(mw.noteClass, modalityClasses)) {
                if (!processedMultiwordIndices.has(firstIdx)) {
                  processedMultiwordIndices.add(firstIdx);
                  markedTokens++;
                  const cls = mw.noteClass || "modality";
                  modalityCounts[cls] = (modalityCounts[cls] || 0) + 1;
                }
              }
            } else if (isModalityClass(token.noteClass, modalityClasses)) {
              markedTokens++;
              const cls = token.noteClass || "modality";
              modalityCounts[cls] = (modalityCounts[cls] || 0) + 1;
            }
          }
        }
      }
    }
  }

  return {
    paperSlug,
    totalSentences,
    glossedSentences,
    unglossedSentences: totalSentences - glossedSentences,
    totalTokens,
    markedTokens,
    modalityCounts: Object.freeze(modalityCounts),
  };
}
