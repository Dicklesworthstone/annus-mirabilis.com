/**
 * Where a source block's recorded page turns fall in the text the faces render (dispatch 255).
 *
 * The edition's blocks carry their turns as recorded (a page and its first words); the schema's
 * validatePageTurns resolves each to its offset in the block's plain text, the coordinate its
 * sentence spans use (pageTurns.ts). The German faces cut a sentence's inlines at that offset and
 * set a mark there; the English faces mark the first English unit that translates the German
 * sentence the turn falls in.
 */
import { type Inline, plainText } from "../../content/schemas/inlines.ts";
import { type PageTurn, validatePageTurns } from "../../content/schemas/pageTurns.ts";
import type { SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";

/** A block's page turns, resolved to offsets of its plain text. */
export function blockTurns(block: SourceBlock): readonly PageTurn[] {
  if (!block.pageTurns || block.pageTurns.length === 0) return [];
  return validatePageTurns(
    block.pageTurns,
    block.locators,
    plainText(block.inlines),
    `${block.paper}/${block.id}.pageTurns`,
  );
}

const width = (node: Inline) => Array.from(plainText([node])).length;

/**
 * The inlines covering [from, to) of the block's plain text, a text cut where the range cuts it. A
 * node of no width (a display the paragraph prints in place) belongs to the range it stands at the
 * start of, or, with `endInclusive`, to the range it stands at the end of.
 */
export function sliceInlines(
  inlines: readonly Inline[],
  from: number,
  to: number,
  endInclusive = false,
): Inline[] {
  const out: Inline[] = [];
  let offset = 0;
  for (const node of inlines) {
    const w = width(node);
    const start = offset;
    const end = offset + w;
    offset = end;
    if (w === 0) {
      if (start >= from && (start < to || (endInclusive && start === to))) out.push(node);
      continue;
    }
    if (end <= from || start >= to) continue;
    if (start >= from && end <= to) {
      out.push(node);
      continue;
    }
    if (node.kind === "text" || node.kind === "term" || node.kind === "reference") {
      const text = Array.from(node.text)
        .slice(Math.max(0, from - start), Math.min(w, to - start))
        .join("");
      out.push({ ...node, text });
    } else if (node.kind === "emphasis") {
      out.push({ ...node, inlines: sliceInlines(node.inlines, from - start, to - start) });
    } else if (node.kind === "space") {
      out.push({ ...node, count: Math.min(end, to) - Math.max(start, from) });
    } else if (start >= from) {
      // A formula or a footnote mark is not cut: it goes whole with the range it begins in.
      out.push(node);
    }
  }
  return out;
}

/**
 * [from, to) cut at the turns inside it, as pieces to render in order: the text between turns, and
 * each turn. A turn at `to` (a page the block reaches with its displays alone) comes after the text
 * and before the displays that stand at its end, since they are on the new page.
 */
export type TurnPiece =
  | Readonly<{ kind: "text"; from: number; inlines: Inline[] }>
  | Readonly<{ kind: "turn"; page: number }>;

export function piecesWithTurns(
  inlines: readonly Inline[],
  from: number,
  to: number,
  turns: readonly PageTurn[],
  isLast: boolean,
): TurnPiece[] {
  const inside = turns.filter((t) => t.at >= from && (t.at < to || (isLast && t.at === to)));
  const pieces: TurnPiece[] = [];
  let cursor = from;
  for (const turn of inside) {
    if (turn.at > cursor)
      pieces.push({ kind: "text", from: cursor, inlines: sliceInlines(inlines, cursor, turn.at) });
    pieces.push({ kind: "turn", page: turn.printedPage });
    cursor = turn.at;
  }
  // A display standing at the sentence's end belongs to it, as getInlinesForSpan has it; after a
  // displays-only turn at `to`, that is after the mark, on the new page.
  pieces.push({ kind: "text", from: cursor, inlines: sliceInlines(inlines, cursor, to, true) });
  return pieces.filter((p) => p.kind === "turn" || p.inlines.length > 0);
}

/**
 * The English units that open with a page mark: for every turn, the first unit (in reading order)
 * that translates the German sentence the turn falls in, and the pages. A turn in the space between
 * two sentences belongs to the one after it; a displays-only turn, to the block's last sentence.
 */
export function unitsWithTurns(
  blocks: readonly SourceBlock[],
  units: readonly TranslationUnit[],
): ReadonlyMap<string, readonly number[]> {
  const out = new Map<string, number[]>();
  for (const block of blocks) {
    const spans = block.sentenceSpans;
    for (const turn of blockTurns(block)) {
      const span = turn.displaysOnly
        ? spans[spans.length - 1]
        : (spans.find((s) => s.span.start <= turn.at && turn.at < s.span.end) ??
          spans.find((s) => s.span.start >= turn.at));
      if (!span) continue;
      const unit = units.find((u) => u.sourceRefs.some((r) => r.id === span.id));
      if (!unit) continue;
      out.set(unit.id, [...(out.get(unit.id) ?? []), turn.printedPage]);
    }
  }
  return out;
}
