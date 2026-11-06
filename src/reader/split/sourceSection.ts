import type { SourceBlock } from "../../content/schemas/source.ts";
import type { BilingualEdition } from "../faces/bilingualLoader.ts";
import { withoutClaimedDisplays } from "../faces/displayClaims.ts";
import { blocksBySection } from "../faces/glossSections.ts";
import { parallelRows } from "../faces/parallelRows.ts";
import { groupTranslationUnits } from "../faces/TranslationParagraphs.tsx";
import { unitsInSection } from "../faces/unitSections.ts";

/** Both languages follow the same section boundary, including the masthead and closing lines. */
export function splitSourceSection(edition: BilingualEdition, section: string) {
  const sections = blocksBySection(edition.blocks);
  const sectionOf = new Map<string, string>();
  for (const [id, blocks] of sections) {
    for (const block of blocks) {
      sectionOf.set(block.id, id);
      for (const span of block.sentenceSpans ?? []) sectionOf.set(span.id, id);
    }
  }
  const blocks: readonly SourceBlock[] = sections.get(section) ?? [];
  const units = unitsInSection(edition.units, sectionOf, section);
  const footnotes = blocks.filter((block) => block.kind === "footnote");
  const main = withoutClaimedDisplays(blocks).filter((block) => block.kind !== "footnote");
  const standaloneDisplays = new Set(main.filter((b) => b.kind === "equation").map((b) => b.id));
  const blockIds = new Set(blocks.map((block) => block.id));
  const unitIds = new Set(units.map((unit) => unit.id));
  const alignment = edition.alignment
    ? {
        ...edition.alignment,
        edges: edition.alignment.edges.filter(
          (edge) => blockIds.has(edge.source.blockId) && unitIds.has(edge.target.translationUnitId),
        ),
      }
    : undefined;
  return {
    alignment,
    blocks,
    units,
    sectionOf,
    ...parallelRows(
      main,
      footnotes,
      groupTranslationUnits(units, edition.alignment, edition.blocks, standaloneDisplays),
      edition.blocks,
    ),
  };
}
