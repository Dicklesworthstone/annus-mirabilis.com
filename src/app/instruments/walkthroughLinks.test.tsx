/**
 * THE CATALOGUE SAYS WHICH INSTRUMENTS HAVE A WALKTHROUGH, NOT JUST HOW MANY (am-2rl9).
 *
 * The page's lead already counted them and linked the index. A reader scanning 37 cards still could
 * not see which card the count meant, so the walkthrough layer was one hop away from the page most
 * likely to send someone to it.
 *
 * Both populations are required non-empty: instruments with a walkthrough and instruments without.
 * Without the second, "renders nothing when there is none" is never executed and a line printed on
 * every card would pass.
 */
import { describe, expect, test } from "bun:test";
import { tapesForExperiment } from "../../content/teachingTapes.ts";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../../experiments/catalogue.ts";
import { tapePath } from "../../reader/sitePaths.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import InstrumentsIndex from "./page.tsx";

const html = await exportMarkup(InstrumentsIndex() as never);
const registered = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered");
const withTape = registered.filter((id) => tapesForExperiment(id).length > 0);
const withoutTape = registered.filter((id) => tapesForExperiment(id).length === 0);

/** A title as React writes it: six of the tape titles carry an apostrophe, emitted as &#x27;. */
function escapeForHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

describe("the instruments catalogue names each instrument's walkthroughs", () => {
  test("both populations exist, so neither branch below is vacuous", () => {
    console.log(
      `[catalogue walkthroughs] ${withTape.length} of ${registered.length} registered instruments ` +
        `have one; ${withoutTape.length} have none`,
    );
    expect(withTape.length).toBeGreaterThan(5);
    expect(withoutTape.length).toBeGreaterThan(5);
  });

  test("every walkthrough of a registered instrument is linked, by href and by title", () => {
    const missing: string[] = [];
    for (const id of withTape)
      for (const tape of tapesForExperiment(id)) {
        if (!html.includes(`href="${tapePath(tape.tapeId)}"`))
          missing.push(`${id}: href ${tape.tapeId}`);
        if (!html.includes(escapeForHtml(tape.title))) missing.push(`${id}: title "${tape.title}"`);
      }
    expect(missing).toEqual([]);
  });

  test("the walkthrough line appears exactly as often as instruments that have one", () => {
    const lines = [...html.matchAll(/class="instrument-walkthroughs"/g)];
    expect(lines.length).toBe(withTape.length);
  });

  test("no walkthrough link is nested inside a card link, which would be invalid markup", () => {
    // The card is one <a> wrapping the plate and the question. An <a> inside an <a> is not valid
    // and browsers recover from it by closing the outer one, which silently breaks the card.
    // Scan for an <a ...> that opens before the previous one has closed.
    let depth = 0;
    let nested = 0;
    for (const m of html.matchAll(/<a\b[^>]*>|<\/a>/g)) {
      if (m[0] === "</a>") depth = Math.max(0, depth - 1);
      else {
        depth += 1;
        if (depth > 1) nested += 1;
      }
    }
    expect(nested).toBe(0);
  });
});
