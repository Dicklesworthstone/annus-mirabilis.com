/**
 * THE PARALLEL FACE SETS EACH GERMAN BLOCK BESIDE ITS OWN ENGLISH (dispatch 149).
 *
 * It was two whole columns, German then English. A phone stacks columns, so on one the English
 * began after the last German footnote: measured on live d5ff5c76 at 390 px, the German column ran
 * from 910 px down the page and the English from 7,099 px, and a reader comparing a sentence had to
 * scroll six screens between them. Now each German block is a row with its English: two columns on
 * a wide screen as before, German then English on a phone.
 *
 * A row's English is exactly the groups (groupTranslationUnits) whose source block is that block,
 * or a display that block prints in place (displayClaims.ts), so nothing is paired by position. An
 * English group whose block the German side does not print gets a row of its own with no German,
 * where it falls in reading order, rather than being attached to a neighbour it does not translate.
 * Footnotes pair the same way, in their own rows after the text.
 */
import type { SourceBlock } from "../../content/schemas/source.ts";
import type { Group } from "./TranslationParagraphs.tsx";

export interface ParallelRow {
  /** The German block's id; for English with no German block of its own, the block its units name. */
  readonly key: string;
  readonly block: SourceBlock | null;
  readonly english: Group[];
}

export interface ParallelRows {
  readonly rows: ParallelRow[];
  readonly footnoteRows: ParallelRow[];
}

export function parallelRows(
  mainBlocks: readonly SourceBlock[],
  footnoteBlocks: readonly SourceBlock[],
  groups: readonly Group[],
  allBlocks: readonly SourceBlock[],
): ParallelRows {
  const byId = new Map(allBlocks.map((block) => [block.id, block]));
  const rows: ParallelRow[] = mainBlocks.map((block) => ({ key: block.id, block, english: [] }));
  const footnoteRows: ParallelRow[] = footnoteBlocks.map((block) => ({
    key: block.id,
    block,
    english: [],
  }));
  const rowFor = new Map(rows.map((row) => [row.key, row]));
  const footnoteRowFor = new Map(footnoteRows.map((row) => [row.key, row]));
  let last: ParallelRow | null = null;

  for (const group of groups) {
    if (group.kind === "footnote") {
      let row = footnoteRowFor.get(group.key);
      if (row === undefined) {
        row = { key: group.key, block: null, english: [] };
        footnoteRows.push(row);
        footnoteRowFor.set(group.key, row);
      }
      row.english.push(group);
      continue;
    }
    const host = byId.get(group.key)?.containedIn;
    // A display a footnote prints goes with that footnote's English, in the footnote's row.
    const footnoteHost = host === undefined ? undefined : footnoteRowFor.get(host);
    if (footnoteHost !== undefined && rowFor.get(group.key) === undefined) {
      footnoteHost.english.push(group);
      continue;
    }
    let row = rowFor.get(group.key) ?? (host === undefined ? undefined : rowFor.get(host));
    if (row === undefined) {
      row = { key: group.key, block: null, english: [] };
      rows.splice(last === null ? 0 : rows.indexOf(last) + 1, 0, row);
      rowFor.set(group.key, row);
    }
    row.english.push(group);
    last = row;
  }
  return { rows, footnoteRows };
}
