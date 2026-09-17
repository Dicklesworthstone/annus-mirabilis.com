/**
 * Plain-text sentence-aligned parallel corpus generator.
 *
 * Emits clean tab-separated values (TSV) where each line represents one aligned sentence pair:
 * sentence_id <tab> german_text <tab> english_text
 */

import type { PaperExport, SectionExport } from "./types.ts";

function cleanCorpusText(text: string): string {
  if (!text) return "";
  return text.replace(/[\r\n\t]+/g, " ").trim();
}

export function generateParallelCorpusTsv(
  paper: PaperExport,
  sections: readonly SectionExport[],
): string {
  const lines: string[] = [];

  lines.push(`# corpus: Annus Mirabilis Bilingual Parallel Corpus (1905–2026)`);
  lines.push(`# paper: ${paper.slug} (${paper.titleGerman})`);
  lines.push(
    `# license: German text Public Domain; English translation MIT + Rider (see NOTICE.md)`,
  );
  lines.push(`id\tgerman\tenglish`);

  for (const sec of sections) {
    if (sec.sentences.length > 0) {
      for (const sent of sec.sentences) {
        const de = cleanCorpusText(sent.german);
        const en = cleanCorpusText(sent.english ?? "");
        lines.push(`${sent.id}\t${de}\t${en}`);
      }
    } else {
      for (const block of sec.blocks) {
        const de = cleanCorpusText(block.diplomaticText);
        const en = cleanCorpusText(block.translation ?? "");
        lines.push(`${block.id}\t${de}\t${en}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}
