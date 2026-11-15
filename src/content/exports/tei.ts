/**
 * TEI P5 XML Exporter for bilingual parallel text representations.
 *
 * Implements standard TEI P5 XML structure for critical editions with sentence-level
 * correspondence linking.
 */

import { plainText } from "../schemas/inlines.ts";
import type { PaperExport, SectionExport } from "./types.ts";
import { projectBlockText } from "./sourceText.ts";

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateTeiXml(paper: PaperExport, sections: readonly SectionExport[]): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<TEI xmlns="http://www.tei-c.org/ns/1.0">');

  // Header
  lines.push("  <teiHeader>");
  lines.push("    <fileDesc>");
  lines.push("      <titleStmt>");
  lines.push(`        <title xml:lang="de">${escapeXml(paper.titleGerman)}</title>`);
  lines.push(`        <title xml:lang="en">${escapeXml(paper.titleEnglishWorking)}</title>`);
  lines.push(`        <author>${escapeXml(paper.authorLine)}</author>`);
  lines.push("        <editor>Jeffrey Emanuel and contributors</editor>");
  lines.push("      </titleStmt>");
  lines.push("      <publicationStmt>");
  lines.push("        <publisher>Annus Mirabilis (annus-mirabilis.com)</publisher>");
  lines.push("        <availability status=" + '"restricted">');
  lines.push('          <licence target="https://annus-mirabilis.com/NOTICE">');
  lines.push(`            ${escapeXml(paper.rights.germanText?.statement ?? "")} `);
  lines.push(`            ${escapeXml(paper.rights.translation?.statement ?? "")}`);
  lines.push("          </licence>");
  lines.push("        </availability>");
  lines.push("      </publicationStmt>");
  if (paper.sourceNotice) {
    lines.push(
      `      <notesStmt><note type="edition-status">${escapeXml(paper.sourceNotice)}</note></notesStmt>`,
    );
  }
  lines.push("      <sourceDesc>");
  lines.push("        <biblStruct>");
  lines.push("          <analytic>");
  lines.push(`            <title level="a" xml:lang="de">${escapeXml(paper.titleGerman)}</title>`);
  lines.push(`            <author>${escapeXml(paper.authorLine)}</author>`);
  lines.push("          </analytic>");
  lines.push("          <monogr>");
  lines.push(`            <title level="j">${escapeXml(paper.journal.name)}</title>`);
  lines.push(`            <biblScope unit="series">${paper.journal.series}</biblScope>`);
  lines.push(`            <biblScope unit="volume">${paper.journal.volume}</biblScope>`);
  lines.push(
    `            <biblScope unit="issue">${escapeXml(String(paper.journal.issue))}</biblScope>`,
  );
  lines.push(
    `            <biblScope unit="page" from="${paper.journal.pages.first}" to="${paper.journal.pages.last}">${paper.journal.pages.first}–${paper.journal.pages.last}</biblScope>`,
  );
  lines.push("            <imprint>");
  for (const date of paper.dates) {
    lines.push(
      `              <date type="${escapeXml(date.type)}"${date.earliest ? ` notBefore="${escapeXml(date.earliest)}"` : ""}${date.latest ? ` notAfter="${escapeXml(date.latest)}"` : ""}>${escapeXml(date.text ?? date.earliest ?? date.type)}</date>`,
    );
  }
  lines.push("            </imprint>");
  lines.push("          </monogr>");
  if (paper.journal.doi) {
    lines.push(`          <idno type="DOI">${escapeXml(paper.journal.doi)}</idno>`);
  }
  lines.push("        </biblStruct>");
  lines.push("      </sourceDesc>");
  lines.push("    </fileDesc>");
  lines.push("    <profileDesc>");
  lines.push("      <langUsage>");
  lines.push('        <language ident="de">German (1905)</language>');
  lines.push('        <language ident="en">English (2026 translation)</language>');
  lines.push("      </langUsage>");
  lines.push("    </profileDesc>");
  lines.push("  </teiHeader>");

  // Bilingual Body
  lines.push("  <text>");
  lines.push("    <group>");

  // German Text
  lines.push('      <text xml:lang="de">');
  lines.push("        <body>");
  for (const sec of sections) {
    lines.push(
      `          <div type="section" xml:id="de-section-${sec.sectionId}" n="${escapeXml(sec.title)}">`,
    );
    lines.push(`            <head>${escapeXml(sec.title)}</head>`);
    for (const block of sec.blocks) {
      const projection = projectBlockText(block, sec.sentences);
      const identifier = projection.parts.some((part) => part.sentence?.id === block.id)
        ? ""
        : ` xml:id="${escapeXml(block.id)}"`;
      const content = projection.parts.map((part) => part.sentence
        ? `<s xml:id="${escapeXml(part.sentence.id)}">${escapeXml(part.text)}</s>`
        : escapeXml(part.text)).join("");
      lines.push(`            <ab type="${escapeXml(block.kind)}"${identifier}>${content}</ab>`);
    }
    for (const sentence of sec.sentences.filter(
      (sentence) => !sec.blocks.some((block) => block.id === sentence.sourceBlockId),
    )) {
      lines.push(
        `            <ab><s xml:id="${escapeXml(sentence.id)}">${escapeXml(sentence.german)}</s></ab>`,
      );
    }
    lines.push("          </div>");
  }
  lines.push("        </body>");
  lines.push("      </text>");

  // English Text
  lines.push('      <text xml:lang="en">');
  lines.push("        <body>");
  const emittedUnits = new Set<string>();
  const allEdges = sections.flatMap((section) => section.alignments ?? []);
  const sourceAddresses = new Set(sections.flatMap((section) => [
    ...section.blocks.map((block) => block.id),
    ...section.sentences.map((sentence) => sentence.id),
  ]));
  for (const sec of sections) {
    lines.push(
      `          <div type="section" xml:id="en-section-${sec.sectionId}" n="${escapeXml(sec.title)}">`,
    );
    lines.push(`            <head>${escapeXml(sec.title)}</head>`);
    lines.push("            <p>");
    if (sec.translationUnits !== undefined) {
      for (const unit of sec.translationUnits) {
        if (emittedUnits.has(unit.id)) continue;
        emittedUnits.add(unit.id);
        const aligned = allEdges
          .filter((edge) => edge.target.translationUnitId === unit.id)
          .map((edge) => edge.source.sentenceId ?? edge.source.blockId);
        const addresses = aligned.length > 0
          ? aligned
          : unit.sourceRefs.map((ref) => ref.id).filter((id) => sourceAddresses.has(id));
        const references = [...new Set(addresses)].map((id) => `#${id}`);
        const correspondence = references.length > 0
          ? ` corresp="${escapeXml(references.join(" "))}"`
          : "";
        lines.push(
          `              <seg xml:id="en-${escapeXml(unit.id)}"${correspondence}>${escapeXml(plainText(unit.inlines))}</seg>`,
        );
      }
    } else {
      for (const sent of sec.sentences) {
        if (sent.english) {
          lines.push(
            `              <s xml:id="en-${escapeXml(sent.id)}" corresp="#${escapeXml(sent.id)}">${escapeXml(sent.english)}</s>`,
          );
        }
      }
      const sentenceBlocks = new Set(sec.sentences.map((sentence) => sentence.sourceBlockId));
      for (const block of sec.blocks.filter((block) => !sentenceBlocks.has(block.id))) {
        if (block.translation) {
          lines.push(
            `              <s xml:id="en-${escapeXml(block.id)}" corresp="#${escapeXml(block.id)}">${escapeXml(block.translation)}</s>`,
          );
        }
      }
    }
    lines.push("            </p>");
    lines.push("          </div>");
  }
  lines.push("        </body>");
  lines.push("      </text>");

  lines.push("    </group>");
  lines.push("  </text>");
  lines.push("</TEI>");

  return lines.join("\n") + "\n";
}
