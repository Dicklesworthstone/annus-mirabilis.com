import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MOVE as BM_MOVE } from "../../discovery/brownian/journeyII.ts";
import { MOVE as LQ_MOVE } from "../../discovery/lightQuanta/journeyI.ts";
import { MOVE as ME_MOVE } from "../../discovery/massEnergy/journeyIV.ts";
import { MOVE as SR_MOVE } from "../../discovery/relativity/journeyIII.ts";
import { JOURNEY_FACTS } from "./journeyFacts.ts";
import Page from "./page";

/**
 * THE INDEX SAYS A JOURNEY HAS A MARKED MOVE AND NEVER WHICH STEP IT IS (dispatch 395).
 *
 * Every journey names "the one non-obvious step", and printing it on the page a reader chooses
 * from would spoil the thing the journey exists to walk them up to. This holds that line. The
 * positive control below matters as much as the assertion: a `text.includes` that could not find
 * anything would report every move absent and read exactly like a page that reveals none.
 */
test("the index names no journey's move", () => {
  const html = renderToStaticMarkup(<Page />);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // POSITIVE CONTROL: the same extraction and the same includes() find what the page DOES carry.
  for (const journey of JOURNEY_FACTS)
    expect([journey.slug, text.includes(journey.naggingFact)]).toEqual([journey.slug, true]);

  for (const [name, move] of [
    ["lq", LQ_MOVE],
    ["bm", BM_MOVE],
    ["sr", SR_MOVE],
    ["me", ME_MOVE],
  ] as const) {
    // The move's own label, which is the sentence the journey builds up to naming.
    const label = String((move as Record<string, unknown>).label ?? "");
    // Non-vacuity first: an empty label would make every assertion below trivially true, which is
    // how a leak check passes while checking nothing.
    expect([name, label.length > 20]).toEqual([name, true]);
    console.log(`  ${name} move label: ${label}`);
    expect([name, text.includes(label)]).toEqual([name, false]);
    // And the distinctive half of it, so a reworded copy would still be caught.
    expect([name, text.includes(label.slice(0, 28))]).toEqual([name, false]);
  }
});
