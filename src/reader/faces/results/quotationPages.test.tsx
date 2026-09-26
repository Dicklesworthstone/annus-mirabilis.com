/**
 * A RESULT CARD'S QUOTATION NAMES THE PAGES ITS WORDS ARE PRINTED ON (dispatch 255).
 *
 * A card cites its German quotation by page, "p. 550" or "pp. 550–551". The cards of light
 * quanta, Brownian and mass-energy quote the ledger draft, whose sentence ids are its own: its
 * s1-p4-s2 is a sentence of the block published as s1-p3. The card looked each quoted sentence's
 * pages up by that id, so it read another sentence's pages, and four cards whose words run onto
 * the next page named one page only.
 *
 * This reads the pages from the German face as it renders, with no sentence ids and no sentence
 * splits: a block starts on the page its wrapper names, and each page-turn mark (dispatch 255)
 * moves the words after it to the mark's page. The quotation's words are found as one run of the
 * paragraph's words, and its pages are those of its first and last letter. Words are letters and
 * digits outside formulas, marks and labels, on both sides.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";
import { resultCardsFor } from "./fromRecords.ts";

const ROOT = process.cwd();
const PAPERS = ["special-relativity", "light-quanta", "brownian-motion", "mass-energy"] as const;

/** Letters and digits of the ledger markup a card quotes, outside its formulas and tokens. */
const quotedWords = (markup: string) =>
  markup
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

const SKIP =
  ".katex, .inline-display, .equation-container, .printed-display-terms, .equation-legend, button, .block-locator, sup, [aria-hidden='true'], .visually-hidden, .visually-hidden-focusable, .sr-only";

/** A rendered block's letters, each with the printed page it stands on. */
function printedLetters(block: Element): { letters: string; pages: number[] } | null {
  const start = Number(
    block.closest("[data-block-wrapper]")?.getAttribute("data-printed-page") ?? Number.NaN,
  );
  if (!Number.isInteger(start)) return null;
  let page = start;
  let letters = "";
  const pages: number[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.hasAttribute("data-page-turn")) {
        page = Number(el.getAttribute("data-page-turn"));
        return;
      }
      if (el.matches(SKIP)) return;
      el.childNodes.forEach(walk);
    } else if (node.nodeType === 3) {
      for (const ch of (node.textContent ?? "").replace(/[^\p{L}\p{N}]/gu, "")) {
        letters += ch;
        pages.push(page);
      }
    }
  };
  walk(block);
  return { letters, pages };
}

async function germanFace(paper: string) {
  const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document as unknown as Document;
}

describe("a result card's quotation names the pages its words are printed on (dispatch 255)", () => {
  let checked = 0;
  let crossing = 0;
  for (const paper of PAPERS) {
    test(`${paper}: each quotation of sentences cites the pages its words stand on`, async () => {
      const records = loadResultCards(ROOT, paper)?.cards ?? [];
      const cards = (await resultCardsFor(paper, ROOT)) ?? [];
      const document = await germanFace(paper);
      const problems: string[] = [];
      let paperChecked = 0;
      records.forEach((record, i) => {
        const card = cards[i];
        if (card?.resultId !== record.id) {
          problems.push(`card ${i} is ${card?.resultId}, not ${record.id}`);
          return;
        }
        record.printed.forEach((p, j) => {
          if (p.kind !== "sentences") return;
          const where = `${record.id} quotation ${j + 1} (${p.anchor}, sentences [${p.ordinals.join(", ")}])`;
          const block = document.getElementById(p.anchor);
          const printed = block ? printedLetters(block) : null;
          if (!printed) {
            problems.push(`${where}: the German face has no block with a page`);
            return;
          }
          const words = quotedWords(p.text);
          const at = words === "" ? -1 : printed.letters.indexOf(words);
          if (at < 0) {
            problems.push(`${where}: its words are not one run of the paragraph's words`);
            return;
          }
          checked++;
          paperChecked++;
          const first = printed.pages[at] as number;
          const last = printed.pages[at + words.length - 1] as number;
          if (last > first) crossing++;
          const want = last > first ? `pp. ${first}–${last}` : `p. ${first}`;
          const entry = card.printed?.[j];
          const shown =
            entry?.lastPage !== undefined && entry.page !== undefined && entry.lastPage > entry.page
              ? `pp. ${entry.page}–${entry.lastPage}`
              : `p. ${entry?.page}`;
          if (shown !== want) problems.push(`${where}: the card cites ${shown}, its words ${want}`);
        });
      });
      console.log(
        `[quotation pages] ${paper}: ${paperChecked} quotations of sentences; ${problems.length} problems`,
      );
      expect(problems).toEqual([]);
    });
  }

  // Without a quotation that runs onto a second page, a card citing one page everywhere would pass.
  test("some quotations run onto a second page, so the range is examined", () => {
    console.log(`[quotation pages] all papers: ${crossing} of ${checked} run onto a second page`);
    expect(checked).toBeGreaterThan(0);
    expect(crossing).toBeGreaterThan(0);
  });
});
