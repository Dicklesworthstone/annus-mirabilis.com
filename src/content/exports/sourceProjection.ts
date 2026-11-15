/** Lossless, paper-scoped source projection for the published static exports. */
import { createHash } from "node:crypto";
import type { BilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { canonicalJsonStringify } from "../compiler/emitter.ts";
import { codePointSlice, plainText } from "../schemas/inlines.ts";
import {
  type AlignmentEdge,
  type SourceBlock,
  validateAlignment,
  validateSourceBlock,
  validateTranslationUnit,
} from "../schemas/source.ts";
import { validateSpanAnchor } from "../schemas/spans.ts";
import type { SectionBlockExport, SectionExport, SectionSentenceExport } from "./types.ts";

export class LiveExportError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${message} (${code})`);
    this.name = "LiveExportError";
  }
}

export function exportDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(value)).digest("hex");
}

export type SourceProjection = Pick<
  SectionExport,
  "blocks" | "sentences" | "translationUnits" | "alignments" | "sourceRevision" | "translationDigest"
>;

/** No source ids are synthesized; spans are code-point slices of the validated inline text. */
export function projectEditionSources(
  paper: string,
  sectionIds: readonly string[],
  edition: BilingualEdition,
): ReadonlyMap<string, SourceProjection> {
  if (edition.paper.slug !== paper || sectionIds.length === 0) {
    throw new LiveExportError(
      "export-edition-identity",
      `Edition or section identity differs for ${paper}.`,
    );
  }
  const blocks = edition.blocks.map((block) => validateSourceBlock(block));
  const units = edition.units.map((unit) => validateTranslationUnit(unit));
  const byBlock = new Map(blocks.map((block) => [block.id, block]));
  const byUnit = new Map(units.map((unit) => [unit.id, unit]));
  if (
    byBlock.size !== blocks.length ||
    byUnit.size !== units.length ||
    blocks.some((block) => block.paper !== paper) ||
    units.some((unit) => unit.sourceRefs.some((ref) => ref.paper !== paper))
  ) {
    throw new LiveExportError(
      "export-source-identity",
      `Duplicate or cross-paper source identity in ${paper}.`,
    );
  }
  if (!edition.alignment) {
    throw new LiveExportError("export-alignment-missing", `No alignment is declared for ${paper}.`);
  }
  const alignment = validateAlignment(edition.alignment);
  if (alignment.paper !== paper) {
    throw new LiveExportError("export-alignment-paper", `Alignment names another paper than ${paper}.`);
  }
  const edgesBySource = new Map<string, AlignmentEdge[]>();
  for (const edge of alignment.edges) {
    const block = byBlock.get(edge.source.blockId);
    const unit = byUnit.get(edge.target.translationUnitId);
    if (
      edge.source.paper !== paper ||
      !block ||
      !unit ||
      (edge.source.sentenceId !== undefined &&
        !block.sentenceSpans.some((span) => span.id === edge.source.sentenceId))
    ) {
      throw new LiveExportError(
        "export-alignment-unresolved",
        `An alignment in ${paper} has an unresolved source or translation.`,
      );
    }
    if (edge.source.range) {
      validateSpanAnchor(edge.source.range, plainText(block.inlines), block.revision);
    }
    if (edge.target.range) {
      validateSpanAnchor(edge.target.range, plainText(unit.inlines), unit.revision);
    }
    const key = edge.source.sentenceId ?? edge.source.blockId;
    edgesBySource.set(key, [...(edgesBySource.get(key) ?? []), edge]);
  }

  const first = sectionIds[0] as string;
  const last = sectionIds[sectionIds.length - 1] as string;
  const sectionOf = (block: SourceBlock): string => {
    const declared =
      block.section ?? (block.containedIn ? byBlock.get(block.containedIn)?.section : undefined);
    if (declared !== undefined) {
      if (!sectionIds.includes(declared)) {
        throw new LiveExportError(
          "export-source-section",
          `Source ${paper}/${block.id} names an absent section ${declared}.`,
        );
      }
      return declared;
    }
    // Unsectioned masthead and closing records remain addressable exactly once.
    return /(?:date|received|closing)/u.test(block.kind) || /^(?:dateline|received)/u.test(block.id)
      ? last
      : first;
  };
  const result = new Map<string, SourceProjection>();
  for (const section of sectionIds) {
    const selected = blocks.filter((block) => sectionOf(block) === section);
    const selectedIds = new Set(selected.map((block) => block.id));
    const edges = alignment.edges.filter((edge) => selectedIds.has(edge.source.blockId));
    const unitIds = new Set(edges.map((edge) => edge.target.translationUnitId));
    const selectedSourceIds = new Set(
      selected.flatMap((block) => [block.id, ...block.sentenceSpans.map((span) => span.id)]),
    );
    // Keep source-referenced units even when the author has not supplied an alignment edge.
    // Their attribution survives; no sentence pairing is invented for them.
    const selectedUnits = units.filter(
      (unit) => unitIds.has(unit.id) || unit.sourceRefs.some((ref) => selectedSourceIds.has(ref.id)),
    );
    const sentences: SectionSentenceExport[] = [];
    const blockExports: SectionBlockExport[] = [];
    const englishFor = (sourceId: string) => {
      const sourceEdges = edgesBySource.get(sourceId) ?? [];
      const ids = new Set(sourceEdges.map((edge) => edge.target.translationUnitId));
      // Unit order is the authored translation order, not whichever edge happened to come first.
      const aligned = units.filter((unit) => ids.has(unit.id));
      const english = aligned.map((unit) => {
        const ownEdges = sourceEdges.filter((edge) => edge.target.translationUnitId === unit.id);
        const text = plainText(unit.inlines);
        if (ownEdges.some((edge) => edge.target.range === undefined)) return text;
        return ownEdges
          .flatMap((edge) => edge.target.range ? [edge.target.range] : [])
          .sort((a, b) => a.start - b.start)
          .map((range) => codePointSlice(text, range.start, range.end))
          .join(" ");
      }).join(" ");
      return {
        ...(aligned.length ? {
          english,
          reviewState: new Set(aligned.map((unit) => unit.reviewState)).size === 1
            ? aligned[0]?.reviewState
            : "mixed",
          draft: aligned.some((unit) =>
            unit.reviewState !== "reviewed" && unit.reviewState !== "corrected",
          ),
        } : {}),
        ...(aligned.length === 1 ? { translationUnitId: aligned[0]?.id } : {}),
        translationUnitIds: aligned.map((unit) => unit.id),
      };
    };
    for (const block of selected) {
      const text = plainText(block.inlines);
      const blockEnglish = englishFor(block.id).english;
      blockExports.push({
        id: block.id,
        kind: block.kind,
        order: block.order,
        diplomaticText: block.diplomaticText,
        locators: block.locators.map(({ pdfPageIndex, printedPage }) => ({ pdfPageIndex, printedPage })),
        revision: block.revision,
        status: block.status,
        inlines: block.inlines,
        ...(blockEnglish ? { translation: blockEnglish } : {}),
      });
      for (const { id, span } of block.sentenceSpans) {
        const translation = edgesBySource.has(id) || block.sentenceSpans.length !== 1
          ? englishFor(id)
          : englishFor(block.id);
        sentences.push({
          id,
          sourceBlockId: block.id,
          sourceSpan: span,
          german: codePointSlice(text, span.start, span.end),
          ...translation,
          draft: translation.draft === true ||
            (block.status.review !== "reviewed" && block.status.review !== "accepted"),
        });
      }
    }
    result.set(section, {
      blocks: blockExports,
      sentences,
      translationUnits: selectedUnits,
      alignments: edges,
      sourceRevision: exportDigest(selected),
      translationDigest: exportDigest({ units: selectedUnits, edges }),
    });
  }
  return result;
}
