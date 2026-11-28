import { spanPages } from "../../content/schemas/pageTurns.ts";
import { buildAlignmentIndex } from "../faces/alignment.ts";
import type { BilingualEdition } from "../faces/bilingualLoader.ts";
import { blockTurns } from "../faces/pageTurnPlaces.ts";
import type { FacsimileDocument, FacsimilePage } from "./document.ts";

/** Put the pinned scan in correspondence with the source and translation the reader actually sees. */
export function withEditionPages(
  scan: FacsimileDocument,
  edition: BilingualEdition,
): FacsimileDocument {
  if (scan.paperId !== edition.paper.slug) return scan;
  const pdfPage = new Map(scan.pages.map((page) => [page.printedPage, page.pdfPage]));
  const unitIds = new Set(scan.units.map((unit) => unit.id));
  const ranges = new Map<string, number[]>();
  const starts = new Map<number, string>();
  const footnotes = new Map<number, string>();
  const english = new Map<string, string>();
  const aliases = new Map<string, Set<string>>();
  const { targetToSource } = buildAlignmentIndex(edition.alignment);
  for (const unit of edition.units) {
    const refs = targetToSource.get(unit.id) ?? unit.sourceRefs.map((ref) => ref.id);
    for (const ref of refs) {
      if (!english.has(ref)) english.set(ref, unit.id);
    }
    // Split English units have permanent addresses of their own. A word-level position in
    // the translation is unavailable, so they open the first page of the aligned source.
    if (!unitIds.has(unit.id)) {
      const source = refs.find((id) => unitIds.has(id));
      if (!source) continue;
      const group = aliases.get(source) ?? new Set<string>();
      group.add(unit.id);
      aliases.set(source, group);
    }
  }

  for (const block of edition.blocks) {
    const first = block.locators[0]?.printedPage;
    const firstAnchor = block.sentenceSpans[0]?.id ?? block.id;
    const openings = block.kind === "footnote" ? footnotes : starts;
    if (first !== undefined && !openings.has(first)) openings.set(first, firstAnchor);
    const turns = blockTurns(block);
    if (!turns.length) continue;
    for (const sentence of block.sentenceSpans) {
      const pages = spanPages(block.locators, turns, sentence.span);
      if (!pages) continue;
      const firstPdf = pdfPage.get(pages.first);
      const lastPdf = pdfPage.get(pages.last);
      if (firstPdf && lastPdf)
        ranges.set(
          sentence.id,
          Array.from({ length: lastPdf - firstPdf + 1 }, (_, i) => firstPdf + i),
        );
    }
    for (const turn of turns) {
      if (openings.has(turn.printedPage)) continue;
      const passage = turn.displaysOnly
        ? edition.blocks.find(
            (other) =>
              other.kind === "equation" &&
              other.containedIn === block.id &&
              other.locators[0]?.printedPage === turn.printedPage,
          )
        : block.sentenceSpans.find((sentence) => sentence.span.end > turn.at);
      if (passage) openings.set(turn.printedPage, passage.id);
    }
  }
  return {
    ...scan,
    pages: scan.pages.map((page): FacsimilePage => {
      const german = starts.get(page.printedPage) ?? footnotes.get(page.printedPage);
      return german ? { ...page, reading: { german, english: english.get(german) } } : page;
    }),
    units: scan.units.map((unit) => ({
      ...unit,
      pdfPages: ranges.get(unit.id) ?? unit.pdfPages,
      aliases: [...new Set([...unit.aliases, ...(aliases.get(unit.id) ?? [])])],
    })),
  };
}
