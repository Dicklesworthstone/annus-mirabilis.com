import { describe, expect, it } from "bun:test";
import { FIXTURE_BROWNIAN_PAPER } from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { spanTextDigest } from "../schemas/spans.ts";
import { generateSectionMarkdown } from "./markdown.ts";
import { generateParallelCorpusTsv } from "./parallelCorpus.ts";
import { projectBlockText } from "./sourceText.ts";
import { generateTeiXml } from "./tei.ts";
import type { PaperExport, SectionExport } from "./types.ts";

const source = "First. Gap.";
const anchor = (start: number, end: number) => ({
  start, end, blockRevision: 1, textDigest: spanTextDigest(source),
});
const section: SectionExport = {
  schemaVersion: 1, paperSlug: "brownian-motion", sectionId: "s4", title: "Partial segmentation",
  contentRevision: "partial-source-fixture", rights: {},
  blocks: [{
    id: "p1", kind: "paragraph", order: 1, diplomaticText: source,
    inlines: [{ kind: "text", text: source }], revision: 1,
    locators: [{ pdfPageIndex: 1, printedPage: 1 }],
  }],
  sentences: [{
    id: "p1-s1", sourceBlockId: "p1", sourceSpan: anchor(0, 6),
    german: "First.", english: "First in English.",
  }],
};
const paper: PaperExport = {
  ...FIXTURE_BROWNIAN_PAPER,
  schemaVersion: 1, sections: [], rights: {}, contentRevision: "partial-source-fixture",
  links: { self: "", tei: "", jsonld: "", parallelCorpus: "" },
};
function rows(tsv: string): string[][] {
  return tsv.split("\n").filter((line) => line !== "" && !line.startsWith("#"))
    .slice(1).map((line) => line.split("\t"));
}

describe("source text outside declared sentence spans", () => {
  it("preserves the complete source and real sentence id in TEI without duplicating prose", () => {
    const block = section.blocks[0];
    if (!block) throw new Error("Missing source fixture.");
    const projection = projectBlockText(block, section.sentences);
    expect(projection.parts.map((part) => part.text).join("")).toBe(source);
    expect(projection.hasUncoveredText).toBe(true);
    const xml = generateTeiXml(paper, [section]);
    expect(xml).toContain('<ab type="paragraph" xml:id="p1"><s xml:id="p1-s1">First.</s> Gap.</ab>');
    expect(xml).toContain('corresp="#p1-s1"');
    expect([...xml.matchAll(/xml:id="p1-s1"/g)]).toHaveLength(1);
  });

  it("uses one complete TSV block row and labels uncovered Markdown context without synthetic ids", () => {
    expect(rows(generateParallelCorpusTsv(paper, [section]))).toEqual([
      ["p1", source, "First in English."],
    ]);
    const markdown = generateSectionMarkdown(section);
    expect(markdown).toContain("### [p1-s1]");
    expect(markdown).toContain("Source Context Outside Sentence Spans");
    expect(markdown).toContain("Gap.");
    expect(markdown).not.toContain("p1-s2");
  });

  it("retains sentence rows when the only uncovered characters are whitespace", () => {
    const complete: SectionExport = {
      ...section,
      sentences: [
        ...section.sentences,
        { id: "p1-s2", sourceBlockId: "p1", sourceSpan: anchor(7, 11), german: "Gap.", english: "Gap in English." },
      ],
    };
    expect(rows(generateParallelCorpusTsv(paper, [complete]))).toEqual([
      ["p1-s1", "First.", "First in English."],
      ["p1-s2", "Gap.", "Gap in English."],
    ]);
    expect(generateTeiXml(paper, [complete])).toContain(
      '<s xml:id="p1-s1">First.</s> <s xml:id="p1-s2">Gap.</s>',
    );
  });

  it("preserves legacy supplied sentence ids without guessing their missing offsets", () => {
    const legacy: SectionExport = {
      ...section,
      sentences: [{ id: "p1-s1", sourceBlockId: "p1", german: source, english: "Legacy English." }],
    };
    expect(rows(generateParallelCorpusTsv(paper, [legacy]))).toEqual([
      ["p1-s1", source, "Legacy English."],
    ]);
    expect(generateTeiXml(paper, [legacy])).toContain('<s xml:id="p1-s1">First. Gap.</s>');
  });

  it("refuses overlapping anchors and text that differs from its source anchor", () => {
    const block = section.blocks[0];
    const sentence = section.sentences[0];
    if (!block || !sentence) throw new Error("Missing source fixture.");
    expect(() => projectBlockText(block, [
      sentence, { ...sentence, id: "p1-s2" },
    ])).toThrow("export-source-spans-overlap");
    expect(() => projectBlockText(block, [
      { ...sentence, german: "Changed." },
    ])).toThrow("export-source-span-text");
  });
});
