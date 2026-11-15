/** Source spans index canonical inline text; legacy projections carry no guessed offsets. */
import { codePointSlice, plainText } from "../schemas/inlines.ts";
import { validateSpanAnchor } from "../schemas/spans.ts";
import type { SectionBlockExport, SectionSentenceExport } from "./types.ts";

export interface SourceTextPart {
  readonly text: string;
  readonly sentence?: SectionSentenceExport | undefined;
}

export interface BlockTextProjection {
  readonly text: string;
  readonly parts: readonly SourceTextPart[];
  /** Only anchored input can identify uncovered text. Legacy behavior remains explicit. */
  readonly anchored: boolean;
  readonly hasUncoveredText: boolean;
}

export class SourceTextExportError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${message} (${code})`);
    this.name = "SourceTextExportError";
  }
}

export function projectBlockText(
  block: SectionBlockExport,
  sentences: readonly SectionSentenceExport[],
): BlockTextProjection {
  const own = sentences.filter((sentence) => sentence.sourceBlockId === block.id);
  if (own.length === 0) {
    return {
      text: block.diplomaticText,
      parts: [{ text: block.diplomaticText }],
      anchored: false,
      hasUncoveredText: false,
    };
  }
  if (own.some((sentence) => sentence.sourceSpan === undefined)) {
    // Existing emitter callers supplied only sentence text. Preserve those ids and translations;
    // a serializer cannot reconstruct trustworthy offsets from repeated or normalized text.
    return {
      text: block.diplomaticText,
      parts: own.map((sentence) => ({ sentence, text: sentence.german })),
      anchored: false,
      hasUncoveredText: false,
    };
  }
  const text = block.inlines === undefined ? block.diplomaticText : plainText(block.inlines);
  const anchored = own.map((sentence) => ({
    sentence,
    span: validateSpanAnchor(
      sentence.sourceSpan,
      text,
      block.revision ?? sentence.sourceSpan?.blockRevision ?? 0,
    ),
  })).sort((a, b) => a.span.start - b.span.start);
  const parts: SourceTextPart[] = [];
  let cursor = 0;
  for (const { sentence, span } of anchored) {
    if (span.start < cursor) {
      throw new SourceTextExportError(
        "export-source-spans-overlap",
        `Source sentence spans overlap in ${block.id}.`,
      );
    }
    const slice = codePointSlice(text, span.start, span.end);
    if (slice !== sentence.german) {
      throw new SourceTextExportError(
        "export-source-span-text",
        `Sentence ${sentence.id} differs from its anchored source text.`,
      );
    }
    if (span.start > cursor) parts.push({ text: codePointSlice(text, cursor, span.start) });
    parts.push({ sentence, text: slice });
    cursor = span.end;
  }
  const tail = codePointSlice(text, cursor);
  if (tail) parts.push({ text: tail });
  return {
    text,
    parts,
    anchored: true,
    hasUncoveredText: parts.some((part) => part.sentence === undefined && /\S/u.test(part.text)),
  };
}
