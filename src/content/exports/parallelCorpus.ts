/**
 * Plain-text aligned parallel corpus. Real sentence ids remain sentence ids; unspanned
 * headings, equations, footnotes and closing records retain their source block ids.
 */
import type { PaperExport, SectionExport } from "./types.ts";
import { projectBlockText } from "./sourceText.ts";

function cleanCorpusText(text: string): string {
  return text.replace(/[\r\n\t]+/g, " ").trim();
}

export function generateParallelCorpusTsv(
  paper: PaperExport,
  sections: readonly SectionExport[],
): string {
  const lines = [
    "# corpus: Annus Mirabilis Bilingual Parallel Corpus",
    `# paper: ${paper.slug} (${paper.titleGerman})`,
    "# license: German text Public Domain; English translation MIT + Rider (see NOTICE.md)",
    "# alignment: exact many-to-many edges and review provenance are in the section JSON exports",
    "id\tgerman\tenglish",
  ];
  for (const section of sections) {
    for (const block of section.blocks) {
      const sentences = section.sentences.filter((sentence) => sentence.sourceBlockId === block.id);
      const projection = projectBlockText(block, section.sentences);
      if (projection.anchored && projection.hasUncoveredText) {
        // A three-column row cannot represent an unassigned gap as a new sentence.
        // Keep the complete source under its real block id, with the known English.
        const english = block.translation ??
          sentences.map((sentence) => sentence.english ?? "").filter(Boolean).join(" ");
        lines.push(
          `${block.id}\t${cleanCorpusText(projection.text)}\t${cleanCorpusText(english)}`,
        );
      } else if (sentences.length > 0) {
        for (const sentence of sentences) {
          lines.push(
            `${sentence.id}\t${cleanCorpusText(sentence.german)}\t${cleanCorpusText(sentence.english ?? "")}`,
          );
        }
      } else {
        lines.push(
          `${block.id}\t${cleanCorpusText(block.diplomaticText)}\t${cleanCorpusText(block.translation ?? "")}`,
        );
      }
    }
    // Preserve sentence-only projections supplied by existing callers.
    for (const sentence of section.sentences.filter(
      (sentence) => !section.blocks.some((block) => block.id === sentence.sourceBlockId),
    )) {
      lines.push(
        `${sentence.id}\t${cleanCorpusText(sentence.german)}\t${cleanCorpusText(sentence.english ?? "")}`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
