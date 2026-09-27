/**
 * THE PAGE THAT HOLDS EVERY LEVEL (/equations/<paper>/<id>/, dispatch 292), read as a reader without
 * JavaScript receives it. It is the destination of every panel's control link and of a fetch that
 * fails, so what is missing here is missing from the only route that reader has.
 *
 * Measured on a build of adbc5095, which is why this file exists (dispatch 303): the page said the
 * equation in words TWICE, because it rendered its own copy of the words above ExplainerBody, which
 * renders them itself.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { everyExplanationRoute } from "../equations/printed/fullExplanations.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import Page from "./equations/[paper]/[display]/page.tsx";

/** One page of each kind the route serves: a printed display, a model equation, a lab's formula. */
const KINDS = [
  { kind: "a printed display", match: (id: string) => /^eq-s\d/.test(id) },
  { kind: "a model equation", match: (id: string) => id.startsWith("eq-model-") },
  { kind: "a laboratory's formula", match: (id: string) => id.startsWith("lab-") },
] as const;

async function pageDocument(paper: string, display: string) {
  const rendered = await Page({ params: Promise.resolve({ paper, display }) });
  const html = await exportMarkup(rendered);
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

describe("the equation explanation page", () => {
  test("says the equation in words once, not twice", async () => {
    const routes = everyExplanationRoute();
    expect(routes.length).toBeGreaterThan(0);
    let checked = 0;
    for (const { kind, match } of KINDS) {
      const route = routes.find((r) => match(r.display));
      if (!route) throw new Error(`no route for ${kind}`);
      const document = await pageDocument(route.paper, route.display);
      const named = [...document.querySelectorAll(".eq-level-name")].filter(
        (el) => el.textContent?.trim() === "In words",
      );
      const words = document.querySelectorAll(".eq-explain-words");
      expect([route.display, named.length, words.length]).toEqual([route.display, 1, 1]);
      checked++;
      console.log(`${kind} (${route.paper} ${route.display}): the words appear once`);
    }
    expect(checked).toBe(KINDS.length);
  });
});
