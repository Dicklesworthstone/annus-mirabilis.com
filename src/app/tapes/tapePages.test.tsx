/**
 * The teaching-tape pages render what the records hold (am-2rl9).
 *
 * The point of these pages is that a reader can reach a tape at all: measured 2026-09-27, all 21
 * authored tapes reached no reader by any route. So the assertions here are about reachability and
 * about honesty, not about layout.
 *
 * WHAT IT DOES NOT CLAIM. Rendering here is not the built page. An island's placement and what a
 * reader without JavaScript sees are answered by a built page and a browser; these pages carry no
 * island and no script, which is why a server render is close to the whole story for them, but it is
 * not the whole story.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTeachingTapes } from "../../content/teachingTapes.ts";
import TapePage from "./[tape]/page.tsx";
import TapesIndex from "./page.tsx";

const { tapes } = loadTeachingTapes();

function dom(html: string) {
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("the teaching-tape pages", () => {
  test("the index lists every tape, and links each to its instrument", () => {
    const document = dom(renderToStaticMarkup(TapesIndex()));
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(tapes.length).toBeGreaterThan(15);
    const missing = tapes
      .filter((t) => !hrefs.includes(`/tapes/${t.tapeId}/`))
      .map((t) => t.tapeId);
    expect(missing).toEqual([]);
    for (const experimentId of new Set(tapes.map((t) => t.experimentId)))
      expect(hrefs, `no link to ${experimentId}`).toContain(`/lab/${experimentId}/`);
  });

  test("every tape's own page renders its title, its steps and its recorded numbers", async () => {
    let stepsSeen = 0;
    let numbersSeen = 0;
    for (const tape of tapes) {
      const html = renderToStaticMarkup(
        await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) }),
      );
      const document = dom(html);
      expect(document.querySelector("h1")?.textContent, tape.tapeId).toBe(tape.title);
      const items = document.querySelectorAll(".tape-steps > li");
      expect(items.length, `${tape.tapeId} rendered no step`).toBe(tape.steps.length);
      stepsSeen += items.length;
      const text = document.body.textContent ?? "";
      expect(text, `${tape.tapeId} does not link its instrument`).toContain(tape.experimentId);
      for (const step of tape.steps)
        for (const value of step.expected) {
          numbersSeen += 1;
          expect(text, `${tape.tapeId} drops ${value.label}`).toContain(value.label);
          expect(text, `${tape.tapeId} drops the value of ${value.label}`).toContain(
            String(value.value),
          );
        }
    }
    // Both loops must have run: 34 steps and 16 carrying numbers on 2026-09-27.
    expect(stepsSeen).toBeGreaterThan(20);
    expect(numbersSeen).toBeGreaterThan(0);
  });

  test("a tape page says the numbers are recorded, not computed", async () => {
    const first = tapes[0];
    expect(first).toBeDefined();
    if (!first) return;
    const html = renderToStaticMarkup(
      await TapePage({ params: Promise.resolve({ tape: first.tapeId }) }),
    );
    const text = dom(html).body.textContent ?? "";
    // The honesty line is the reason this page may show numbers at all: without it the page would
    // read as an instrument's output, which it is not.
    expect(text).toContain("not a result this page computed");
    expect(text).toContain("Nothing here runs the instrument");
  });

  test("every page is reachable with no script: no button, and every control is an anchor", async () => {
    const pages = [renderToStaticMarkup(TapesIndex())];
    for (const tape of tapes.slice(0, 4))
      pages.push(
        renderToStaticMarkup(await TapePage({ params: Promise.resolve({ tape: tape.tapeId }) })),
      );
    for (const html of pages) {
      const document = dom(html);
      // noScriptControls.ts hides every enabled button when scripts do not run, so a page whose way
      // onward is a button has no way onward. These pages have none by construction; this keeps it so.
      expect(document.querySelectorAll("button").length).toBe(0);
      expect(document.querySelectorAll("a").length).toBeGreaterThan(0);
    }
  });
});
