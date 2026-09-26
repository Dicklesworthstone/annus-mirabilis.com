/**
 * "Where this is used later" on the results faces (dispatch 253), from the one record the
 * Connections map draws too (content/connections/connections.yaml): relativity § 8's light-energy
 * card links to the mass-energy card that uses it, a card with no recorded use shows no such line,
 * and the map and the cards show the same edges in both directions.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionMap } from "../../../app/connections/ConnectionMap.tsx";
import { loadConnections } from "../../../content/connections/connections.ts";
import { loadResultCards } from "../../../content/results/resultCards.ts";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
import { PaperPage } from "../../PaperPage.tsx";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;
const connections = loadConnections(ROOT);
const cards = new Map(PAPERS.map((p) => [p, loadResultCards(ROOT, p)?.cards ?? []]));
const faces = new Map<string, string>();
for (const paper of PAPERS)
  faces.set(
    paper,
    await exportMarkup(await PaperPage({ paperId: paper, face: "results" } as never)),
  );
const map = renderToStaticMarkup(<ConnectionMap />);

/** The markup of one card, from its opening tag to the next card or the end of the cards. */
function cardHtml(paper: string, id: string): string {
  const html = faces.get(paper) ?? "";
  const start = html.indexOf(`id="result-${id}"`);
  if (start === -1) return "";
  const next = html.indexOf('<article class="result-card"', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}
const usedLaterSection = (html: string) =>
  html.match(/<section class="result-used-by"[\s\S]*?<\/section>/)?.[0];

describe("where a result is used later", () => {
  test("relativity § 8's light-energy card links to the September paper's use of it", () => {
    const section = usedLaterSection(cardHtml("special-relativity", "sr-light-complex-energy"));
    expect(section).toContain("Where this is used later");
    expect(section).toContain(
      'href="/papers/mass-energy/view/results/#result-me-light-energy-transformation"',
    );
    expect(section).toContain(
      "The mass-energy paper of September 1905 starts from this transformation",
    );
    // The link lands: the mass-energy results face carries that card, quoting s0-p4's "l. c. § 8".
    const target = cardHtml("mass-energy", "me-light-energy-transformation");
    expect(target).not.toBe("");
    expect(target).toContain("/papers/mass-energy/view/german/#s0-p4");
  });

  test("a card with no recorded use shows no used-later line, on any of the four faces", () => {
    let withNone = 0;
    const wrong: string[] = [];
    for (const [paper, list] of cards)
      for (const c of list) {
        const section = usedLaterSection(cardHtml(paper, c.id));
        if (c.usedLater.length === 0) {
          withNone++;
          if (section) wrong.push(`${paper} ${c.id}: shows a used-later line with none recorded`);
        } else if (!section) wrong.push(`${paper} ${c.id}: lists a use and shows none`);
      }
    expect(withNone).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
    expect(usedLaterSection(cardHtml("special-relativity", "sr-moving-mirror"))).toBeUndefined();
  });

  test("the map and the cards show the same edges, each way", () => {
    const recorded = connections.filter((k) => k.uses);
    expect(recorded.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    // Every recorded use: on the map, listed and linked by its source card, landing on a real card.
    for (const k of recorded) {
      const use = k.uses;
      if (!use) continue;
      if (!map.includes(`href="#${k.id}"`)) wrong.push(`${k.id}: not on the map`);
      const from = cards
        .get(use.from.paper as (typeof PAPERS)[number])
        ?.find((c) => c.id === use.from.result);
      if (!from?.usedLater.includes(k.id))
        wrong.push(`${k.id}: its source card ${use.from.result} does not list it`);
      const href = `/papers/${use.to.paper}/view/results/#result-${use.to.result}`;
      if (!usedLaterSection(cardHtml(use.from.paper, use.from.result))?.includes(`href="${href}"`))
        wrong.push(`${k.id}: ${use.from.result} does not link to ${href}`);
      if (!cardHtml(use.to.paper, use.to.result))
        wrong.push(`${k.id}: ${use.to.result} is no card`);
    }
    // Every card's claimed use: a connection on the map that records it.
    for (const [paper, list] of cards)
      for (const c of list)
        for (const id of c.usedLater) {
          const k = connections.find((x) => x.id === id);
          if (!k?.uses || !map.includes(`href="#${id}"`))
            wrong.push(`${paper} ${c.id}: claims ${id}, which the map does not show as a use`);
        }
    expect(wrong).toEqual([]);
  });
});
