/**
 * Mass-energy's wrong turns reach the result cards they concern (dispatch 206).
 *
 * A card's "Common wrong turns" are not written on the card: each misconception record names the
 * results it concerns in `resultIds`, and the card reads its list from the ledger
 * (resultCards.ts). So a card-side check alone cannot notice a binding that was never written or
 * was dropped: the card simply lists one fewer, and every card-side assertion still holds. These
 * tests state the binding from the ledger's side instead.
 *
 * The rule the records follow, and the first test holds: a misconception's `anchors` name the
 * paragraphs it is about, and a card's printed layer names the paragraphs it quotes. Every cited
 * paragraph that some card quotes must be quoted by a card the misconception is bound to, and no
 * binding may point at a card that quotes none of the misconception's paragraphs. A paragraph no
 * card quotes asks for nothing, which is how a record that concerns no result stays unbound.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";

const PAPER = "mass-energy";
const ROOT = process.cwd();

type Ledger = { id: string; anchors: string[]; resultIds: string[] };
const dir = join(ROOT, "content", "misconceptions", PAPER);
const ledger: Ledger[] = readdirSync(dir)
  .filter((n) => n.endsWith(".json"))
  .sort()
  .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")) as Ledger);
const cards = loadResultCards(ROOT, PAPER)?.cards ?? [];
const quotes = new Map(cards.map((c) => [c.id, new Set(c.printed.map((p) => p.anchor))]));
const bindings = ledger.flatMap((m) => m.resultIds.map((r) => ({ m: m.id, r })));
// The results face as its route renders it (src/app/papers/[paper]/view/[face]/page.tsx).
const html = await exportMarkup(await PaperPage({ paperId: PAPER, face: "results" } as never));
const explanation = await exportMarkup(await PaperPage({ paperId: PAPER } as never));

/** The markup of one card, from its opening tag to the next card or the end of the cards. */
function cardHtml(id: string): string {
  const start = html.indexOf(`id="result-${id}"`);
  if (start === -1) return "";
  const next = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("mass-energy's misconceptions are bound to the results they concern", () => {
  test("the ledger and the cards are both there, so the checks below examine something", () => {
    expect(ledger.length).toBeGreaterThan(0);
    expect(cards.length).toBeGreaterThan(0);
    // At least one record cites a paragraph some card quotes; otherwise the rule asks nothing.
    const quoted = new Set([...quotes.values()].flatMap((s) => [...s]));
    expect(ledger.some((m) => m.anchors.some((a) => quoted.has(a)))).toBe(true);
  });

  test("every cited paragraph a card quotes is quoted by a card the misconception names, and no binding points elsewhere", () => {
    const wrong: string[] = [];
    for (const m of ledger) {
      for (const anchor of m.anchors) {
        const quotedBy = cards.filter((c) => quotes.get(c.id)?.has(anchor)).map((c) => c.id);
        if (quotedBy.length === 0) continue;
        if (!m.resultIds.some((r) => quotedBy.includes(r)))
          wrong.push(
            `${m.id} cites ${anchor}, quoted by ${quotedBy.join(", ")}, and names none of them`,
          );
      }
      for (const r of m.resultIds) {
        const q = quotes.get(r);
        if (!q) wrong.push(`${m.id} names ${r}, which is no card`);
        else if (!m.anchors.some((a) => q.has(a)))
          wrong.push(`${m.id} names ${r}, which quotes none of ${m.anchors.join(", ")}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("each binding is on the card a reader sees, and its link lands", () => {
  test("every binding in the ledger is a wrong turn on its card, linked to the callout on the explanation page", () => {
    expect(bindings.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const { m, r } of bindings) {
      const card = cardHtml(r);
      const turns = card.match(
        /<section[^>]*data-result-layer="wrong-turns"[\s\S]*?<\/section>/,
      )?.[0];
      if (!turns) wrong.push(`${r}: no wrong-turns section, though ${m} names it`);
      else {
        if (!turns.includes(`data-misconception-id="${m}"`)) wrong.push(`${r}: ${m} is not listed`);
        if (!turns.includes(`href="/papers/${PAPER}/#misconception-${m}"`))
          wrong.push(`${r}: no link to ${m}`);
      }
      if (!explanation.includes(`id="misconception-${m}"`))
        wrong.push(`the explanation page has no misconception-${m}`);
    }
    expect(wrong).toEqual([]);
  });

  test("a card lists no wrong turn the ledger does not bind to it", () => {
    const wrong: string[] = [];
    for (const c of cards) {
      const listed = [...cardHtml(c.id).matchAll(/data-misconception-id="([^"]+)"/g)].map(
        (x) => x[1],
      );
      const bound = bindings.filter((b) => b.r === c.id).map((b) => b.m);
      for (const m of listed) if (!bound.includes(m ?? "")) wrong.push(`${c.id} lists ${m}`);
      if (listed.length !== bound.length)
        wrong.push(`${c.id}: ${listed.length} listed, ${bound.length} bound`);
    }
    expect(wrong).toEqual([]);
  });
});
