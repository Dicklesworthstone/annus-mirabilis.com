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
    lines.push(
      `- **English Translation:** ${section.rights.translation.statement} (${section.rights.translation.license})`,
    );
  }
  if (section.rights.explanatoryProse) {
    lines.push(`- **Explanations:** ${section.rights.explanatoryProse.statement}`);
  }
  lines.push("---");
  lines.push("");

  // Parallel text: sentences or blocks
  if (section.sentences.length > 0) {
    lines.push("## Parallel Text");
    lines.push("");
    for (const sent of section.sentences) {
      lines.push(`### [${sent.id}]`);
      lines.push(`**DE:** ${escapeMarkdownSourceText(sent.german)}`);
      if (sent.english) {
        lines.push(`**EN:** ${escapeMarkdownSourceText(sent.english)}`);
      }
      if (sent.draft || sent.reviewState) {
        lines.push(`*Status:* \`${sent.reviewState ?? "draft"}\``);
      }
      lines.push("");
    }
  } else if (section.blocks.length > 0) {
    lines.push("## Source Blocks");
    lines.push("");
    for (const block of section.blocks) {
      lines.push(`### [${block.id}] (${block.kind})`);
      lines.push(`**DE:** ${escapeMarkdownSourceText(block.diplomaticText)}`);
      if (block.translation) {
        lines.push(`**EN:** ${escapeMarkdownSourceText(block.translation)}`);
      }
      lines.push("");
    }
  }

  // Readings (if present)
  if (section.readings) {
    if (section.readings.overview && section.readings.overview.length > 0) {
      lines.push("## Overview Reading");
      lines.push("");
      for (const b of section.readings.overview) {
        if (b.kind === "paragraph" && b.text) {
          lines.push(escapeMarkdownSourceText(b.text));
          lines.push("");
        } else if (b.kind === "formula" && b.latex) {
          lines.push(formatFormulaMarkdown(b.latex, b.spoken));
          lines.push("");
        }
      }
    }

    if (section.readings.full && section.readings.full.length > 0) {
      lines.push("## Full Reading");
      lines.push("");
      for (const b of section.readings.full) {
        if (b.kind === "paragraph" && b.text) {
          lines.push(escapeMarkdownSourceText(b.text));
          lines.push("");
        } else if (b.kind === "formula" && b.latex) {
          lines.push(formatFormulaMarkdown(b.latex, b.spoken));
          lines.push("");
        } else if (b.kind === "steps" && b.items) {
          lines.push(
            b.items.map((item, i) => `${i + 1}. ${escapeMarkdownSourceText(item)}`).join("\n"),
          );
          lines.push("");
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
