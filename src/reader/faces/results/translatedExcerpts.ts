import type { PrintedExcerpt } from "../../../content/results/resultCards.ts";
import type { TranslationUnit } from "../../../content/schemas/source.ts";
import { buildAlignmentIndex } from "../alignment.ts";
import type { BilingualEdition } from "../bilingualLoader.ts";
import { glossDisplaysIn } from "../displayClaims.ts";
import type { ExcerptTranslation } from "./types.ts";

/** Resolve the words and equations a card quotes in the same edition the English reader serves. */
export function excerptTranslator(edition: BilingualEdition) {
  const { blocks, units } = edition;
  const byBlock = new Map(blocks.map((block) => [block.id, block]));
  const byUnit = new Map(units.map((unit) => [unit.id, unit]));
  const sourceSentences = new Set(
    blocks.flatMap((block) => (block.sentenceSpans ?? []).map((span) => span.id)),
  );
  const { sourceToTarget, targetToSource } = buildAlignmentIndex(edition.alignment);
  const declared = new Map<string, string[]>();
  for (const unit of units) {
    for (const ref of unit.sourceRefs) {
      if (ref.paper !== edition.paper.slug) continue;
      const list = declared.get(ref.id) ?? [];
      list.push(unit.id);
      declared.set(ref.id, list);
    }
  }
  const targets = (id: string) => sourceToTarget.get(id) ?? declared.get(id) ?? [];

  return (excerpt: PrintedExcerpt): ExcerptTranslation | undefined => {
    const block = byBlock.get(excerpt.anchor);
    if (!block) return undefined;
    const spans = block.sentenceSpans ?? [];
    const quoted = excerpt.kind === "display" ? [block.id] : excerpt.publishedSentenceIds;
    // A draft and the published German sometimes divide a quotation differently. If its precise
    // extent or alignment is unknown, show the translated paragraph explicitly as context.
    const withDisplays = (sentenceIds: readonly string[]) => {
      const sources = new Set(sentenceIds);
      const displays = new Set<string>();
      for (const sentence of spans) {
        if (!sources.has(sentence.id)) continue;
        for (const display of glossDisplaysIn(block, sentence.span, byBlock, displays))
          sources.add(display.id);
      }
      return sources;
    };
    const cited = withDisplays(quoted ?? []);
    const exact =
      cited.size > 0 &&
      [...cited].every((id) => {
        const aligned = targets(id);
        return (
          aligned.length > 0 &&
          aligned.every((target) => {
            const unit = byUnit.get(target);
            if (!unit) return false;
            // One English unit can translate two German sentences. Quoting the translation of just
            // one of them as exact would silently include the other's words.
            const refs = targetToSource.get(target) ?? unit.sourceRefs.map((ref) => ref.id);
            return refs.every((source) => !sourceSentences.has(source) || cited.has(source));
          })
        );
      });
    if (!exact && excerpt.kind === "display") return undefined;
    const sources = exact ? cited : withDisplays(spans.map((span) => span.id));
    const selected = new Set([...sources].flatMap(targets));
    if (!exact) for (const target of targets(block.id)) selected.add(target);
    const runs: TranslationUnit[][] = [];
    let previous = -2;
    for (const [index, unit] of units.entries()) {
      if (!selected.has(unit.id)) continue;
      if (index !== previous + 1) runs.push([]);
      runs[runs.length - 1]?.push(unit);
      previous = index;
    }
    const firstUnit = runs[0]?.[0]?.id;
    return firstUnit
      ? {
          scope: exact ? "quotation" : "paragraph",
          firstUnit,
          runs: runs.map((run) => run.map(({ id, lang, inlines }) => ({ id, lang, inlines }))),
        }
      : undefined;
  };
}
