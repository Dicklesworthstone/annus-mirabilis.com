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
 * - Display equations take the page the manifest stores for them (storedDisplayPages), read from
 *   the plates. Where it stores none, a display's own TeX is found in the ledger, searching from
 *   where the block that holds it starts: its text recurs (a relation is often restated), so a
 *   search from the top of the paper would find an earlier copy.
 *   Until 2026-09-24 a display took the page of the block before it. Read against the plates,
 *   that was wrong for 12 of 102: too early after a page turn inside a paragraph, too late where a
 *   joined paragraph had already reached its last part's page, and a footnote's displays took the
 *   body's page.
 * - Footnotes are looked up on their own, without moving the cursor: the ledger sets them at the
 *   foot of their page, after text the reader meets later.
 * - A block whose words are not found takes the page of the block before it: the reader has
 *   reached at least that page. It is reported, not guessed forward.
 *
 * The page answers "which printed page has the reader reached", for the plate beside the text. It
 * is not a locator for citing the block, and nothing here claims it is.
 */
import { JOINED, type JoinedBlock, type ManifestUnit } from "./joinContinuations.ts";
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

/**
 * `stored` is a display id's page from the manifest (storedDisplayPages). A display it names takes
 * that page; the ledger is searched only for displays it does not name.
 */
export function blockStartPages(
  ledgerText: string,
  blocks: readonly ProposedBlock[],
  stored: Readonly<Record<string, number>> = {},
): BlockPages {
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
  const tex = new Map(blocks.filter((b) => b.kind === "equation").map((b) => [b.id, b.text]));
  const placed = new Set<string>();
  /** A block's displays, in order: the stored page, else where each one's TeX is printed. */
  const placeDisplays = (ids: readonly string[], from: number) => {
    let within = from;
    for (const id of ids) {
      if (placed.has(id)) continue;
      const probe = normalise(tex.get(id) ?? "").slice(0, 40);
      const at = within >= 0 && probe.length >= 3 ? text.indexOf(probe, within) : -1;
      if (at >= 0) within = at + probe.length;
      const page = stored[id] ?? (at >= 0 ? pageAt(at) : undefined);
      if (page === undefined) continue;
      pages[id] = page;
      placed.add(id);
    }
  };
  let cursor = 0;
  let last = starts[0]?.page;
  for (const block of blocks) {
    const probe = normalise(block.text).slice(0, 40);
    if (block.kind === "footnote") {
      const at = probe.length >= 12 ? text.indexOf(probe) : -1;
      const page = at >= 0 ? pageAt(at) : undefined;
      if (page !== undefined) pages[block.id] = page;
      else unresolved.push(block.id);
      placeDisplays(block.displayEquationIds ?? [], at);
      continue;
    }
    if (block.kind === "equation") {
      placeDisplays([block.id], cursor);
      // Neither stored nor found: the page the reader has at least reached, as for any block.
      if (!placed.has(block.id) && last !== undefined) pages[block.id] = last;
      continue;
    }
    const at = probe.length >= 6 ? text.indexOf(probe, cursor) : -1;
    if (at >= 0) {
      cursor = at;
      last = pageAt(at) ?? last;
    } else unresolved.push(block.id);
    if (last !== undefined) pages[block.id] = last;
    placeDisplays(block.displayEquationIds ?? [], at >= 0 ? at : cursor);
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

/**
 * THE PAGE THE MANIFEST STORES FOR EACH DISPLAY EQUATION, keyed by the face's id (TanElk,
 * 2026-09-24: "take a block's page from the stored manifest field wherever it exists"). The
 * manifest's locators were read from the plates and boundary-audited; a second inference of the
 * same fact is how 12 of 102 drifted.
 *
 * The two number displays differently, so they are aligned by order, as joinAfterDisplays aligns
 * them: the body's displays in reading order, and apart from them the footnotes' displays in
 * reading order. Face s4-eq6 is eq-s4-d6, but face s6-eq3 is eq-s5-d9: the manifest files a
 * footnote's displays under the section whose text carries the mark (s5-fn1 on p. 142), the face
 * under the section it sets the footnote in.
 *
 * Paragraphs are not aligned by id, and take no page from here: the two segment paragraphs
 * differently, so one id can name two paragraphs. Face s4-p9 is the run-on after s4-eq6 on p. 557;
 * the manifest's s4-p9 starts on p. 558, its s4-p7 and s4-p8 having been absorbed into s4-p6.
 *
 * Nothing is taken from a list whose length differs from the face's, or whose body displays
 * disagree with the face on a section, since the order would then pair the wrong displays.
 */
export function storedDisplayPages(
  blocks: readonly ProposedBlock[],
  units: readonly ManifestUnit[],
): Record<string, number> {
  const footnotes = new Set(units.filter((u) => u.kind === "footnote").map((u) => u.id));
  const displays = units.filter((u) => u.kind === "display-equation");
  const inFootnote = (u: ManifestUnit) =>
    u.containedIn !== undefined && footnotes.has(u.containedIn);
  const faceBody: string[] = [];
  const faceNotes: string[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const ids = block.kind === "equation" ? [block.id] : (block.displayEquationIds ?? []);
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      (block.kind === "footnote" ? faceNotes : faceBody).push(id);
    }
  }
  const out: Record<string, number> = {};
  const pair = (face: readonly string[], manifest: readonly ManifestUnit[], sections: boolean) => {
    if (face.length !== manifest.length) return;
    // A face id's section is its prefix (s4-eq6); a manifest display without one is not checked.
    const section = (id: string) => id.split("-")[0];
    if (sections && face.some((id, i) => (manifest[i]?.section ?? section(id)) !== section(id)))
      return;
    face.forEach((id, i) => {
      const page = manifest[i]?.page;
      if (page !== undefined) out[id] = page;
    });
  };
  pair(
    faceBody,
    displays.filter((u) => !inFootnote(u)),
    true,
  );
  pair(faceNotes, displays.filter(inFootnote), false);
  return out;
}
