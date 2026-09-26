/**
 * A RESULT CARD'S QUOTATION LANDS ON WHAT IT QUOTES (dispatch 255, step 6).
 *
 * The card's German quotation links to the German face. Until dispatch 255 the link named the
 * paragraph (`#s5-p2`) even where the card quotes one sentence of it, so a reader who followed it
 * had to find the sentence in a paragraph of ten. Every German face now anchors its sentences, so a
 * quotation of exactly one sentence names that sentence (`#s5-p2-s8`); a quotation of several, or
 * of a display, names its paragraph or display as before.
 *
 * Three papers' cards quote the ledger draft, which splits some paragraphs into sentences
 * differently from the source blocks the German face renders. A quoted sentence the face does not
 * print as one sentence has no sentence to land on, and is linked by its paragraph; the test lists
 * those, and requires that no sentence of the paragraph carries the quoted words.
 *
 * What each quotation holds is read from the records (content/results/<paper>.yaml, through
 * loadResultCards), and the words of each sentence from the rendered German face, so the test does
 * not take the card's word for either.
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

/** Letters and digits a rendered sentence shows as text, outside its formulas, marks and labels. */
function renderedWords(el: Element): string {
  const skip =
    ".katex, .inline-display, .equation-container, .printed-display-terms, .page-turn, sup, button, [aria-hidden='true'], .visually-hidden, .visually-hidden-focusable, .sr-only";
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === 3) out += node.textContent ?? "";
    else if (node.nodeType === 1 && !(node as Element).matches(skip)) node.childNodes.forEach(walk);
  };
  walk(el);
  return out.replace(/[^\p{L}\p{N}]/gu, "");
}

async function germanFace(paper: string) {
  const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document as unknown as Document;
}

describe("a result card's quotation links to what it quotes (dispatch 255, step 6)", () => {
  let linked = 0;
  let byParagraph = 0;
  let quotations = 0;
  for (const paper of PAPERS) {
    test(`${paper}: a one-sentence quotation links to its sentence, any other to its paragraph or display`, async () => {
      const records = loadResultCards(ROOT, paper)?.cards ?? [];
      const cards = (await resultCardsFor(paper, ROOT)) ?? [];
      const document = await germanFace(paper);
      const problems: string[] = [];
      const unsplit: string[] = [];
      let paperLinked = 0;
      records.forEach((record, i) => {
        const card = cards[i];
        if (card?.resultId !== record.id) {
          problems.push(`card ${i} is ${card?.resultId}, not ${record.id}`);
          return;
        }
        record.printed.forEach((p, j) => {
          quotations++;
          const href = card.printed?.[j]?.germanHref ?? "";
          const fragment = href.split("#")[1] ?? "";
          const where = `${record.id} quotation ${j + 1} (${p.anchor}, sentences [${p.ordinals.join(", ")}])`;
          if (href !== `/papers/${paper}/view/german/#${fragment}`)
            problems.push(`${where}: links to ${href}, not the German face`);
          const target = document.getElementById(fragment);
          if (!target || target.hasAttribute("data-alias-of")) {
            problems.push(`${where}: #${fragment} is no anchor on the German face`);
            return;
          }
          if (p.kind === "sentences" && p.ordinals.length === 1) {
            // The paragraph's sentences as the face renders them, and those with the quoted words.
            const own = new RegExp(`^${p.anchor}-s\\d+[a-z]?$`);
            const sentences = [
              ...(document.getElementById(p.anchor)?.querySelectorAll("[id]") ?? []),
            ].filter((el) => own.test(el.id) && !el.hasAttribute("data-alias-of"));
            const quoted = quotedWords(p.text);
            const same = sentences.filter((el) => quoted !== "" && renderedWords(el) === quoted);
            if (same.length === 1) {
              linked++;
              paperLinked++;
              if (fragment !== same[0]?.id)
                problems.push(
                  `${where}: links to #${fragment}, not to its sentence #${same[0]?.id}`,
                );
            } else {
              byParagraph++;
              unsplit.push(`${where}: ${same.length} of ${sentences.length} sentences match`);
              if (fragment !== p.anchor)
                problems.push(
                  `${where}: no rendered sentence has its words, yet it links to #${fragment}`,
                );
            }
          } else if (fragment !== p.anchor)
            problems.push(`${where}: quotes more than one sentence but links to #${fragment}`);
        });
      });
      console.log(
        `[quotation anchors] ${paper}: ${paperLinked} linked to their sentence, ${unsplit.length} to their paragraph, of ${records.reduce((n, r) => n + r.printed.length, 0)} quotations; ${problems.length} problems`,
      );
      for (const u of unsplit) console.log(`[quotation anchors]   by paragraph: ${u}`);
      expect(problems).toEqual([]);
    });
  }

  // Without a quotation linked to its sentence, the rule above would pass having examined nothing.
  test("the corpus holds quotations linked to a sentence and longer ones, so both branches run", () => {
    console.log(
      `[quotation anchors] all papers: ${linked} linked to a sentence, ${byParagraph} one-sentence by paragraph, of ${quotations} quotations`,
    );
    expect(linked).toBeGreaterThan(0);
    expect(quotations).toBeGreaterThan(linked + byParagraph);
  });
});
