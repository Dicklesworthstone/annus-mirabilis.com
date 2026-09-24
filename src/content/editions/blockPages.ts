/**
 * The printed page each German block starts on, read from the ledger's own page anchors.
 *
 * The segmenter strips the anchors ([[ANNALEN-PAGE n]]) before it segments, so a block carries no
 * page, and the German face could only show the paper's first printed page beside its opening.
 * This recovers the page without touching the segmenter: the ledger is split at its anchors, and
 * each block's opening words are found in order in that text.
 *
 * - Paragraphs, headings and the masthead advance a cursor, so a phrase that recurs later in the
 *   paper cannot pull a block forward. Measured on 2026-09-22: 78 of 78 such blocks in ap-17-132,
 *   59 of 59 in ap-17-549 and 17 of 17 in ap-18-639 resolve, and their pages never go backwards.
 * - Display equations take the page of the paragraph before them. Their text recurs (a relation
 *   is often restated), which is what threw a plain in-order search off.
 * - Footnotes are looked up on their own, without moving the cursor: the ledger sets them at the
 *   foot of their page, after text the reader meets later.
 * - A block whose words are not found takes the page of the block before it: the reader has
 *   reached at least that page. It is reported, not guessed forward.
 *
 * The page answers "which printed page has the reader reached", for the plate beside the text. It
 * is not a locator for citing the block, and nothing here claims it is.
 */
import { JOINED, type JoinedBlock } from "./joinContinuations.ts";
import type { ProposedBlock } from "./segmentLedger.ts";

const ANCHOR = /\[\[ANNALEN-PAGE\s+(\d+)\]\]/;

/** Markup the ledger and the blocks share out of step: tags and TeX delimiters. Words stay. */
function normalise(text: string): string {
  return text
    .replace(/\[\[\/?[A-Z][A-Z-]*(?:\s+[^\]]*)?\]\]/g, " ")
    .replace(/\$+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type BlockPages = Readonly<{
  /** Block id to the printed page it starts on. Every block that can be placed is here. */
  pages: Readonly<Record<string, number>>;
  /** The printed pages the ledger anchors, in order. */
  printed: readonly number[];
  /** Blocks whose opening words were not found; they carry the page of the block before. */
  unresolved: readonly string[];
}>;

export function blockStartPages(ledgerText: string, blocks: readonly ProposedBlock[]): BlockPages {
  const parts = ledgerText.split(new RegExp(ANCHOR.source));
  const starts: { at: number; page: number }[] = [];
  let text = "";
  for (let i = 1; i < parts.length; i += 2) {
    starts.push({ at: text.length, page: Number(parts[i]) });
    text += ` ${normalise(parts[i + 1] ?? "")}`;
  }
  const pageAt = (at: number) => {
    let page: number | undefined;
    for (const s of starts) if (s.at <= at) page = s.page;
    return page;
  };
  const pages: Record<string, number> = {};
  const unresolved: string[] = [];
  let cursor = 0;
  let last = starts[0]?.page;
  for (const block of blocks) {
    const probe = normalise(block.text).slice(0, 40);
    if (block.kind === "footnote") {
      const at = probe.length >= 12 ? text.indexOf(probe) : -1;
      const page = at >= 0 ? pageAt(at) : undefined;
      if (page !== undefined) pages[block.id] = page;
      else unresolved.push(block.id);
      continue;
    }
    if (block.kind !== "equation") {
      const at = probe.length >= 6 ? text.indexOf(probe, cursor) : -1;
      if (at >= 0) {
        cursor = at;
        last = pageAt(at) ?? last;
      } else unresolved.push(block.id);
    }
    if (last !== undefined) pages[block.id] = last;
    // A paragraph joined across a page (joinContinuations.ts): each retired id takes the page its
    // words start on, found the same way, and the blocks after it follow from where it ends.
    const joined = (block as JoinedBlock).joinedIds ?? [];
    const parts = joined.length > 0 ? block.text.split(JOINED) : [];
    joined.forEach((id, i) => {
      const words = normalise(parts[i + 1] ?? "").slice(0, 40);
      const at = words.length >= 6 ? text.indexOf(words, cursor) : -1;
      if (at >= 0) {
        cursor = at;
        last = pageAt(at) ?? last;
      } else unresolved.push(id);
      if (last !== undefined) pages[id] = last;
    });
  }
  return { pages, printed: starts.map((s) => s.page), unresolved };
}
