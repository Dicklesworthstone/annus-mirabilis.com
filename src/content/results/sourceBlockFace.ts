/**
 * A German face read from a paper's source blocks, for the as-printed layer of its result cards
 * (dispatch 241).
 *
 * resultCards.ts read the as-printed layer from loadGermanSourceFace, the face built from a ledger
 * draft. Relativity has no ledger draft (its receipt's ledgerStatus is not-started), so that face
 * is null, and every card would have been refused with "has result cards but no German face".
 * Its German face is rendered from the source blocks instead (PaperPage.tsx falls back to them in
 * the same way), and this reads the same blocks, so a card shows the words the German face shows.
 *
 * Each block keeps its id, which is the anchor the German face publishes it under. A display's text
 * is its diplomatic LaTeX. A sentence's text is its span of the block's inlines, written in the
 * ledger markup the card renderer reads (sourceMarkup.tsx): inline mathematics as `$…$`, a footnote
 * mark as `[[FN-MARK x]]`, emphasis as `[[SPERR]]…[[/SPERR]]` (letter-spaced in the print). A display
 * the sentence refers to adds no characters to the span, and the card names that display on its
 * own. Nothing is retyped: the markup's plain text is the block's diplomatic text over the span,
 * character for character, and sourceBlockFace.test.ts checks that for every sentence of the paper.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { type Inline, plainText } from "../schemas/inlines.ts";
import { spanPages, validatePageTurns } from "../schemas/pageTurns.ts";

type Span = Readonly<{ start: number; end: number }>;

type SourceBlockRecord = Readonly<{
  id: string;
  kind: string;
  diplomaticText?: string;
  inlines?: readonly Inline[];
  sentenceSpans?: readonly Readonly<{ id: string; span: Span }>[];
  locators?: readonly Readonly<{ printedPage?: number }>[];
  pageTurns?: unknown;
}>;

/** A face block as resultCards.ts reads it: its id, kind and text, and its sentences in order. */
export type FaceBlock = Readonly<{
  id: string;
  kind: string;
  text: string;
  sentences?: readonly Readonly<{ id: string; text: string }>[] | undefined;
}>;

export type SourceBlockFace = Readonly<{
  blocks: readonly FaceBlock[];
  printedPages: Readonly<{ pages: Readonly<Record<string, number>> }>;
  anchors: Readonly<{ anchorOf: Readonly<Record<string, string>> }>;
}>;

/**
 * The inlines over [span.start, span.end) of their plain text, in ledger markup. Offsets are those
 * of plainText(inlines), which is the block's diplomatic text and what a sentence span indexes. A
 * text node is cut at the span's edges; a formula or a footnote mark is taken whole when it lies
 * inside the span.
 */
export function inlinesMarkup(inlines: readonly Inline[], span?: Span): string {
  let offset = 0;
  const inside = (start: number, end: number) =>
    !span || (start >= span.start && end <= span.end && end > start);
  const walk = (nodes: readonly Inline[]): string => {
    let out = "";
    for (const node of nodes) {
      if (node.kind === "emphasis") {
        const content = walk(node.inlines);
        out += content ? `[[SPERR]]${content}[[/SPERR]]` : "";
        continue;
      }
      const length = plainText([node]).length;
      const start = offset;
      const end = offset + length;
      offset = end;
      if (length === 0) continue;
      if (node.kind === "math" || (node.kind === "misprint" && "math" in node)) {
        // A misprint inside a formula is its formula, as printed (dispatch 270).
        const latex = node.kind === "math" ? node.latex : node.math.latex;
        if (inside(start, end)) out += `$${latex}$`;
      } else if (node.kind === "footnote-mark") {
        if (inside(start, end)) out += `[[FN-MARK ${node.mark}]]`;
      } else {
        // text, term, reference, space, line-break, citation-ref: their plain text, cut to the span.
        const text = plainText([node]);
        const from = span ? Math.max(span.start, start) - start : 0;
        const to = span ? Math.min(span.end, end) - start : length;
        if (to > from) out += text.slice(from, to);
      }
    }
    return out;
  };
  return walk(inlines);
}

/** The ledger markup with its tokens and formula delimiters taken out: the plain text it stands for. */
export function markupPlainText(markup: string): string {
  return markup
    .replace(/\[\[FN-MARK ([^\]]*)\]\]/g, "$1")
    .replace(/\[\[\/?SPERR\]\]/g, "")
    .replace(/\$/g, "");
}

/** The paper's source-block records, in file-name order; the files beside them are skipped. */
function sourceBlockRecords(root: string, paper: string): SourceBlockRecord[] {
  const dir = join(root, "content", "source-blocks", paper);
  if (!existsSync(dir)) return [];
  const records: SourceBlockRecord[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/\.(ya?ml|json)$/.test(name) || name.startsWith("manifest")) continue;
    const text = readFileSync(join(dir, name), "utf8");
    const data = (name.endsWith(".json") ? JSON.parse(text) : parseYaml(text)) as unknown;
    // A source block is a plain object carrying a string id (bilingualLoader.ts); the directory
    // also holds the ledger allowlist and the manifest's snapshot, which are not.
    if (
      typeof data !== "object" ||
      data === null ||
      Array.isArray(data) ||
      typeof (data as { id?: unknown }).id !== "string" ||
      typeof (data as { kind?: unknown }).kind !== "string"
    )
      continue;
    records.push(data as SourceBlockRecord);
  }
  return records;
}

/**
 * The printed pages of each sentence in a block that records where its text turns the page
 * (schemas/pageTurns.ts, dispatch 247): its first page, and its last when it runs across a turn.
 * Blocks without turns are left out, so a reader falls back to the page the block starts on, as
 * before; a paper's cards change only when its data says where its pages turn. A turn that does
 * not validate throws here, as it fails the corpus test: a wrong page must not reach a card.
 */
export function sentencePages(
  root: string,
  paper: string,
): ReadonlyMap<string, Readonly<{ first: number; last: number }>> {
  const out = new Map<string, Readonly<{ first: number; last: number }>>();
  for (const r of sourceBlockRecords(root, paper)) {
    if (r.pageTurns === undefined) continue;
    const locators = (r.locators ?? []).flatMap((l) =>
      typeof l.printedPage === "number" ? [{ printedPage: l.printedPage }] : [],
    );
    const turns = validatePageTurns(
      r.pageTurns,
      locators,
      plainText(r.inlines ?? []),
      `${paper}/${r.id}.pageTurns`,
    );
    for (const s of r.sentenceSpans ?? []) {
      const pages = spanPages(locators, turns, s.span);
      if (pages) out.set(s.id, pages);
    }
  }
  return out;
}

/** The paper's source blocks as a face, or null when it has none. */
export function sourceBlockFace(root: string, paper: string): SourceBlockFace | null {
  const records = sourceBlockRecords(root, paper);
  if (records.length === 0) return null;
  const pages: Record<string, number> = {};
  const anchorOf: Record<string, string> = {};
  const blocks = records.map((r): FaceBlock => {
    const page = r.locators?.[0]?.printedPage;
    if (typeof page === "number") pages[r.id] = page;
    anchorOf[r.id] = r.id;
    const inlines = r.inlines ?? [];
    if (r.kind === "equation") return { id: r.id, kind: r.kind, text: r.diplomaticText ?? "" };
    return {
      id: r.id,
      kind: r.kind,
      text: inlinesMarkup(inlines),
      sentences: (r.sentenceSpans ?? []).map((s) => ({
        id: s.id,
        text: inlinesMarkup(inlines, s.span),
      })),
    };
  });
  return { blocks, printedPages: { pages }, anchors: { anchorOf } };
}
