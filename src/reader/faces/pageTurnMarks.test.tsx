/**
 * THE PRINTED PAGE TURNS ARE MARKED IN THE TEXT, AS A CRITICAL EDITION MARKS THEM (dispatch 255).
 *
 * Every source block that runs onto another printed page records where (pageTurns.ts): the page,
 * and the first words printed on it. Until dispatch 255 only the result cards read that; the German,
 * English and parallel faces showed a block's pages as a set ("[pp. 891–892]"), so a reader could
 * not tell where p. 892 began. Now:
 * - the German text (the German face, and the parallel face's German column) carries a mark at the
 *   word where each page begins: a page break for a screen reader ("Page 892"), and the page number
 *   linked to the facsimile face at that page;
 * - English word order is not German's, so the English text (the English face, and the parallel
 *   face's English column) carries the mark at the start of the English sentence whose German holds
 *   the turn ("Page 892 begins in this sentence"), not at a guessed English word;
 * - the number is the mark's generated content, so it is not in the text a reader copies or finds.
 *
 * For every recorded turn of all four papers, on the German, parallel and English faces, this
 * asserts:
 * - exactly one mark for that page in that block (German) or unit (English), and no mark that is no
 *   turn;
 * - the page number, the facsimile link, and the page-break label;
 * - German: the first word after the mark is the first word the source block prints on that page,
 *   the text before it ends between words, and a turn that reaches a page with displays alone is
 *   marked after the block's last word;
 * - English: the mark opens the first English unit that translates the German sentence the turn
 *   falls in;
 * - the marks add nothing to the paragraph's text (a copy or a find-in-page reads the words alone).
 * The expected places are computed here from the source blocks and the alignment, not read from
 * what the faces render.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { type Inline, plainText } from "../../content/schemas/inlines.ts";
import { validatePageTurns } from "../../content/schemas/pageTurns.ts";
import type { SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { facsimilePageHref } from "../facsimile/pageHref.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";

const PAPERS = ["special-relativity", "light-quanta", "brownian-motion", "mass-energy"] as const;

type ExpectedTurn = Readonly<{
  paper: string;
  blockId: string;
  page: number;
  displaysOnly: boolean;
  /** The first word the block prints on the page, math and footnote marks skipped. */
  firstWord: string | null;
  /** The English unit whose German sentence holds the turn. */
  unitId: string;
}>;

/** The first plain word at or after a code-point offset of the block's text, skipping mathematics. */
function firstWordFrom(inlines: readonly Inline[], at: number): string | null {
  let offset = 0;
  let words = "";
  const walk = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node.kind === "emphasis") {
        walk(node.inlines);
        continue;
      }
      // A misprint marker prints its word, as plainText counts it (inlines.ts); leaving it out put
      // the expected word the marker's length too far on (s1-p1, s10-p4; dispatch 264).
      // A misprint inside a formula (dispatch 270) is mathematics, measured as its formula.
      const formula = node.kind === "misprint" && "math" in node ? node.math : null;
      const text =
        node.kind === "text" ||
        node.kind === "term" ||
        node.kind === "reference" ||
        (node.kind === "misprint" && !("math" in node))
          ? node.text
          : node.kind === "space"
            ? " ".repeat(node.count ?? 1)
            : node.kind === "line-break"
              ? "\n"
              : null;
      const width =
        text !== null
          ? Array.from(text).length
          : formula
            ? Array.from(formula.latex).length
            : node.kind === "math"
              ? node.display
                ? 0
                : Array.from(node.latex).length
              : node.kind === "footnote-mark"
                ? Array.from(node.mark).length
                : node.kind === "citation-ref"
                  ? node.locator
                    ? Array.from(` (${node.locator})`).length
                    : 0
                  : 0;
      const end = offset + width;
      if (text !== null && end > at)
        words += Array.from(text)
          .slice(Math.max(0, at - offset))
          .join("");
      else if (end > at) words += " ";
      offset = end;
    }
  };
  walk(inlines);
  return words.trim().split(/\s+/)[0] || null;
}

async function expectedTurns(paper: string) {
  const edition = await loadBilingualEdition(paper);
  if (!edition) throw new Error(`${paper}: no edition`);
  const turns: ExpectedTurn[] = [];
  for (const block of edition.blocks as readonly SourceBlock[]) {
    // The edition's blocks carry their turns as recorded; the schema resolves each to its offset.
    const resolved = validatePageTurns(
      block.pageTurns,
      block.locators,
      plainText(block.inlines),
      `${paper}/${block.id}.pageTurns`,
    );
    for (const turn of resolved) {
      const spans = block.sentenceSpans;
      const span = turn.displaysOnly
        ? spans[spans.length - 1]
        : (spans.find((s) => s.span.start <= turn.at && turn.at < s.span.end) ??
          spans.find((s) => s.span.start >= turn.at));
      const unit = (edition.units as readonly TranslationUnit[]).find((u) =>
        u.sourceRefs.some((r) => r.id === span?.id),
      );
      turns.push({
        paper,
        blockId: block.id,
        page: turn.printedPage,
        displaysOnly: turn.displaysOnly === true,
        firstWord: turn.displaysOnly ? null : firstWordFrom(block.inlines, turn.at),
        unitId: unit?.id ?? `(no unit translates ${span?.id ?? block.id})`,
      });
    }
  }
  return turns;
}

async function face(paper: string, name: "german" | "english" | "parallel") {
  const html = await exportMarkup(await PaperPage({ paperId: paper, face: name } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document as unknown as Document;
}

/**
 * The prose after (or before) a mark inside a container: text only, and a printed line break as
 * white space. Skipped: mathematics, a printed display with its legend and chips (it is no word of
 * the sentence), controls and visually hidden labels, and the marks themselves.
 */
function textBeside(container: Element, mark: Element, direction: "after" | "before"): string {
  // The edition's own lines beside a display are not the printed words a turn falls between: the
  // legend, and a recorded misprint's note under its display (DisplayMisprintNote, dispatch 266).
  const skip = (el: Element) =>
    el.closest(
      ".katex, .inline-display, .equation-container, .printed-display-terms, .equation-legend, .display-misprint-note, button, .block-locator, .page-turn, sup, [aria-hidden='true'], .visually-hidden, .visually-hidden-focusable, .sr-only",
    );
  const texts: string[] = [];
  const walker = container.ownerDocument.createTreeWalker(container, 1 | 4 /* ELEMENT | TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const isBreak = n.nodeType === 1 && (n as Element).tagName === "BR";
    if (n.nodeType === 1 && !isBreak) continue;
    const parent = isBreak ? (n as Element) : n.parentElement;
    if (!parent || skip(parent)) continue;
    const position = mark.compareDocumentPosition(n);
    const isAfter = (position & 4) !== 0; // DOCUMENT_POSITION_FOLLOWING
    if ((direction === "after") === isAfter) texts.push(isBreak ? "\n" : (n.textContent ?? ""));
  }
  return texts.join("");
}

/** The German checks, for one face's German text. */
function germanProblems(root: Document | Element, turns: readonly ExpectedTurn[], where: string) {
  const problems: string[] = [];
  const all = [...root.querySelectorAll("[data-page-turn]")];
  if (all.length !== turns.length)
    problems.push(`${where}: ${all.length} marks for ${turns.length} turns`);
  for (const t of turns) {
    const block = root.querySelector(`[id="${t.blockId}"]`);
    if (!block) {
      problems.push(`${where} ${t.blockId}: no block`);
      continue;
    }
    const marks = [...block.querySelectorAll(`[data-page-turn="${t.page}"]`)];
    if (marks.length !== 1) {
      problems.push(`${where} ${t.blockId}: ${marks.length} marks for p. ${t.page}`);
      continue;
    }
    const mark = marks[0] as Element;
    const link = mark.querySelector("a");
    if (link?.getAttribute("href") !== facsimilePageHref(t.paper, t.page))
      problems.push(`${where} ${t.blockId}: p. ${t.page} links to ${link?.getAttribute("href")}`);
    const pagebreak = mark.querySelector('[role="doc-pagebreak"]');
    if (pagebreak?.getAttribute("aria-label") !== `Page ${t.page}`)
      problems.push(
        `${where} ${t.blockId}: p. ${t.page} reads "${pagebreak?.getAttribute("aria-label")}"`,
      );
    const after = textBeside(block, mark, "after").trim().split(/\s+/)[0] || null;
    const before = textBeside(block, mark, "before");
    if (t.displaysOnly) {
      if (after !== null)
        problems.push(`${where} ${t.blockId}: words after the displays-only turn: "${after}"`);
    } else {
      if (after !== t.firstWord)
        problems.push(
          `${where} ${t.blockId}: p. ${t.page} begins at "${after}", not "${t.firstWord}"`,
        );
      if (before && !/\s$/.test(before))
        problems.push(
          `${where} ${t.blockId}: p. ${t.page} splits a word ("…${before.slice(-12)}")`,
        );
    }
    const bare = block.cloneNode(true) as Element;
    for (const m of bare.querySelectorAll("[data-page-turn]")) m.remove();
    if (bare.textContent !== block.textContent)
      problems.push(`${where} ${t.blockId}: the mark for p. ${t.page} adds text`);
  }
  return problems;
}

/** The English checks, for one face's English text. */
function englishProblems(root: Document | Element, turns: readonly ExpectedTurn[], where: string) {
  const problems: string[] = [];
  const all = [...root.querySelectorAll("[data-page-turn]")];
  if (all.length !== turns.length)
    problems.push(`${where}: ${all.length} marks for ${turns.length} turns`);
  for (const t of turns) {
    const unit = root.querySelector(`[data-translation-unit-id="${t.unitId}"]`);
    if (!unit) {
      problems.push(`${where} ${t.blockId}: no English unit ${t.unitId}`);
      continue;
    }
    const marks = [...unit.querySelectorAll(`[data-page-turn="${t.page}"]`)];
    if (marks.length !== 1) {
      problems.push(`${where} ${t.unitId}: ${marks.length} marks for p. ${t.page}`);
      continue;
    }
    const mark = marks[0] as Element;
    if (textBeside(unit, mark, "before").trim() !== "")
      problems.push(`${where} ${t.unitId}: the mark for p. ${t.page} does not open the sentence`);
    const link = mark.querySelector("a");
    if (link?.getAttribute("href") !== facsimilePageHref(t.paper, t.page))
      problems.push(`${where} ${t.unitId}: p. ${t.page} links to ${link?.getAttribute("href")}`);
    const pagebreak = mark.querySelector('[role="doc-pagebreak"]');
    if (pagebreak?.getAttribute("aria-label") !== `Page ${t.page} begins in this sentence`)
      problems.push(
        `${where} ${t.unitId}: p. ${t.page} reads "${pagebreak?.getAttribute("aria-label")}"`,
      );
    const bare = unit.cloneNode(true) as Element;
    for (const m of bare.querySelectorAll("[data-page-turn]")) m.remove();
    if (bare.textContent !== unit.textContent)
      problems.push(`${where} ${t.unitId}: the mark for p. ${t.page} adds text`);
  }
  return problems;
}

describe("printed page turns are marked in the text (dispatch 255)", () => {
  let turnCount = 0;
  const blocks = new Set<string>();

  for (const paper of PAPERS) {
    test(`${paper}: every recorded turn has one mark, at its word, on the German, parallel and English faces`, async () => {
      const turns = await expectedTurns(paper);
      turnCount += turns.length;
      for (const t of turns) blocks.add(`${paper}/${t.blockId}`);
      // A paper with no turns proves nothing about them.
      expect(turns.length).toBeGreaterThan(0);

      const german = await face(paper, "german");
      const parallel = await face(paper, "parallel");
      const english = await face(paper, "english");
      const problems = [
        ...germanProblems(german, turns, "german"),
        ...germanProblems(
          // The parallel face's German column: every German half, as one container.
          wrap(parallel, ".parallel-half-german"),
          turns,
          "parallel German",
        ),
        ...englishProblems(wrap(parallel, ".parallel-half-english"), turns, "parallel English"),
        ...englishProblems(english, turns, "english"),
      ];
      console.log(
        `[page turns] ${paper}: ${turns.length} turns / ${new Set(turns.map((t) => t.blockId)).size} blocks; ${problems.length} problems`,
      );
      expect(problems).toEqual([]);
    });
  }

  test("the count, over all four papers", () => {
    console.log(`[page turns] ${turnCount} turns / ${blocks.size} blocks`);
    expect(turnCount).toBeGreaterThan(0);
  });
});

/** A container holding only the elements of one column, so a check sees that column alone. */
function wrap(document: Document, selector: string): Element {
  const holder = document.createElement("div");
  for (const half of document.querySelectorAll(selector)) holder.append(half.cloneNode(true));
  return holder;
}
