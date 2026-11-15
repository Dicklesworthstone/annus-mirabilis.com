/**
 * Safe Markdown exporter for paper and section exports.
 *
 * Implements strict escaping of source text so transcriptions and translations
 * cannot be interpreted as HTML or Markdown structural markup by downstream renderers.
 * Mathematics appears as raw LaTeX with authored spoken form beneath, never HTML.
 *
 * Spec: am-cm-machine-readable-exports-xgy (Criteria 5 & 9).
 */

import type { SectionExport } from "./types.ts";
import { projectBlockText } from "./sourceText.ts";

/**
 * Escapes characters that could be interpreted as HTML markup or Markdown formatting.
 * Specifically escapes: <, >, *, _, [, ], `, \, and # at line starts.
 * Contains NO rendered HTML tags.
 */
export function escapeMarkdownSourceText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/`/g, "\\`")
    .replace(/^#/gm, "\\#");
}

/**
 * Formats a mathematical formula as raw LaTeX display with authored spoken form beneath.
 */
export function formatFormulaMarkdown(latex: string, spoken?: string): string {
  const parts = [`$$\n${latex.trim()}\n$$`];
  if (spoken?.trim()) {
    parts.push(escapeMarkdownSourceText(spoken.trim()));
  }
  return parts.join("\n\n");
}

/**
 * Generates a clean, safe Markdown export for a section.
 */
export function generateSectionMarkdown(section: SectionExport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${escapeMarkdownSourceText(section.title)}`);
  lines.push("");
  lines.push(`**Paper:** \`${section.paperSlug}\` | **Section:** \`${section.sectionId}\``);
  lines.push(
    `**Revision:** \`${section.contentRevision}\`${section.translationRevision ? ` | **Translation Revision:** \`${section.translationRevision}\`` : ""}`,
  );
  if (section.draft || section.reviewState) {
    lines.push(
      `**Status:** \`${section.reviewState ?? "draft"}\` (Draft: ${section.draft ? "true" : "false"})`,
    );
  }
  lines.push("");

  // Rights notice
  lines.push("---");
  lines.push("### Rights & Attribution");
  if (section.rights.germanText) {
    lines.push(`- **Historical German:** ${section.rights.germanText.statement}`);
  }
  if (section.rights.translation) {
    const dec = section.rights.translation.decisionRef
      ? ` [Decision: ${section.rights.translation.decisionRef}, Ratification: ${section.rights.translation.ratificationStatus}]`
      : "";
    lines.push(
      `- **English Translation:** ${section.rights.translation.statement} (${section.rights.translation.license})${dec}`,
    );
  }
  if (section.rights.explanatoryProse) {
    const dec = section.rights.explanatoryProse.decisionRef
      ? ` [Decision: ${section.rights.explanatoryProse.decisionRef}, Ratification: ${section.rights.explanatoryProse.ratificationStatus}]`
      : "";
    lines.push(`- **Explanations:** ${section.rights.explanatoryProse.statement}${dec}`);
  }
  lines.push("---");
  lines.push("");

  // Source and translation retain actual source ids and their separate review provenance.
  if (section.sentences.length > 0) {
    lines.push("## Parallel Text", "");
    for (const sent of section.sentences) {
      lines.push(`### [${sent.id}]`);
      lines.push(`**DE:** ${escapeMarkdownSourceText(sent.german)}`);
      if (sent.english) lines.push(`**EN:** ${escapeMarkdownSourceText(sent.english)}`);
      const sourceStatus = section.blocks.find((block) => block.id === sent.sourceBlockId)?.status;
      if (sourceStatus) lines.push(`*Source review:* \`${sourceStatus.review}\``);
      if (sent.reviewState) lines.push(`*Translation review:* \`${sent.reviewState}\``);
      if (sent.draft) lines.push("*Draft source or translation; see the separate review records.*");
      lines.push("");
    }
  }
  const sourceContexts = section.blocks
    .map((block) => ({ block, projection: projectBlockText(block, section.sentences) }))
    .filter(({ projection }) => projection.anchored && projection.hasUncoveredText);
  if (sourceContexts.length > 0) {
    lines.push("## Source Context Outside Sentence Spans", "");
    for (const { block, projection } of sourceContexts) {
      lines.push(`### Source block \`${block.id}\``, "");
      for (const part of projection.parts) {
        if (!part.sentence && /\S/u.test(part.text)) {
          lines.push(`**DE (unsegmented context):** ${escapeMarkdownSourceText(part.text)}`, "");
        }
      }
    }
  }
  const sentenceBlocks = new Set(section.sentences.map((sentence) => sentence.sourceBlockId));
  const otherBlocks = section.blocks.filter((block) => !sentenceBlocks.has(block.id));
  if (otherBlocks.length > 0) {
    lines.push("## Source Blocks", "");
    for (const block of otherBlocks) {
      lines.push(`### [${block.id}] (${block.kind})`);
      lines.push(`**DE:** ${escapeMarkdownSourceText(block.diplomaticText)}`);
      if (block.translation) lines.push(`**EN:** ${escapeMarkdownSourceText(block.translation)}`);
      if (block.status) lines.push(`*Source review:* \`${block.status.review}\``);
      lines.push("");
    }
  }

  // Every reading and argument, including R2 steps and R3 historical qualification.
  for (const [level, title] of [
    ["overview", "Overview Reading (R0)"],
    ["full", "Full Reading (R1)"],
    ["steps", "Step-by-step Reading (R2)"],
    ["margin", "Historical and Technical Reading (R3)"],
  ] as const) {
    const readings = section.arguments?.length
      ? section.arguments.map((argument) => ({
          title: argument.title,
          blocks: argument.readings[level],
        }))
      : [{ title: "", blocks: section.readings?.[level] ?? [] }];
    if (!readings.some((reading) => reading.blocks.length > 0)) continue;
    lines.push(`## ${title}`, "");
    for (const reading of readings) {
      if (reading.title) lines.push(`### ${escapeMarkdownSourceText(reading.title)}`, "");
      for (const b of reading.blocks) {
        if (b.kind === "paragraph" && b.text) {
          lines.push(escapeMarkdownSourceText(b.text), "");
        } else if (b.kind === "formula" && b.latex) {
          lines.push(formatFormulaMarkdown(b.latex, b.spoken), "");
        } else if (b.kind === "steps" && b.items) {
          lines.push(
            b.items.map((item, i) => `${i + 1}. ${escapeMarkdownSourceText(item)}`).join("\n"),
            "",
          );
        } else if (b.kind === "foundation" && b.id) {
          lines.push(
            `Foundation: \`${b.id}\`. ${escapeMarkdownSourceText(b.returnCaption ?? "")}`,
            "",
          );
        }
      }
    }
  }

  // Editorial Notes
  if (section.editorialNotes && section.editorialNotes.length > 0) {
    lines.push("## Editorial Notes");
    lines.push("");
    for (const note of section.editorialNotes) {
      lines.push(
        `- **${escapeMarkdownSourceText(note.title)}:** ${escapeMarkdownSourceText(note.text)}`,
      );
    }
    lines.push("");
  }

  // Footnotes
  if (section.footnotes && section.footnotes.length > 0) {
    lines.push("## Footnotes");
    lines.push("");
    for (const fn of section.footnotes) {
      lines.push(`- **[${fn.id}]:** ${escapeMarkdownSourceText(fn.text)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
