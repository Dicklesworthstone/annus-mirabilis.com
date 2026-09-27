/**
 * THE PAGE THAT HOLDS EVERY LEVEL (/equations/<paper>/<id>/, dispatch 292), read as a reader without
 * JavaScript receives it. It is the destination of every panel's control link and of a fetch that
 * fails, so what is missing here is missing from the only route that reader has.
 *
 * Measured on a build of adbc5095, which is why this file exists (dispatch 303): the page said the
 * equation in words TWICE, because it rendered its own copy of the words above ExplainerBody, which
 * renders them itself, and none of its 243 pages drew the equation being explained or offered any
 * link to where it is printed. A reader who lands here cold reads an explanation of a formula that is
 * not on the screen, so the equation and the way back are asserted here for every route the build
 * generates, not for a sample: a page that explains nothing visible is the defect this file exists to
 * refuse.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { everyExplanationRoute, fullExplanation } from "../equations/printed/fullExplanations.ts";
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
  test("draws the equation it explains, and says where it is printed", async () => {
    const routes = everyExplanationRoute();
    // Every route, not a sample: the equation was missing from all of them, and the three kinds take
    // their formula and their link from three different places in the build.
    const drawn = { display: 0, model: 0, lab: 0 } as Record<string, number>;
    const bare: string[] = [];
    const named: string[] = [];
    const nowhere: string[] = [];
    for (const { paper, display } of routes) {
      const explanation = fullExplanation(paper, display);
      if (!explanation) throw new Error(`${paper} ${display}: the route has no explanation`);
      const kind = display.startsWith("eq-model-")
        ? "model"
        : display.startsWith("lab-")
          ? "lab"
          : "display";
      const formula = explanation.printed?.html ?? "";
      // The formula is drawn as a display, by the same renderer the faces use.
      if (!formula.includes("katex")) bare.push(display);
      else drawn[kind] = (drawn[kind] ?? 0) + 1;
      // Its accessible name is the authored spoken form, as a face gives a printed display. A
      // laboratory's formula is named by the latex its page writes and has no authored spoken form,
      // so KaTeX's own MathML is all there is; that is recorded rather than asserted away.
      if (kind !== "lab" && !explanation.printed?.spoken) named.push(display);
      const source = explanation.source;
      if (!source?.href || !source.label) nowhere.push(display);
      else if (kind === "display")
        expect([display, source.href]).toEqual([
          display,
          `/papers/${paper}/view/german/#${display}`,
        ]);
      else if (kind === "lab")
        expect([display, /^\/lab\/[a-z0-9-]+\/$/.test(source.href)]).toEqual([display, true]);
      else
        expect([display, /^\/papers\/[a-z-]+\/#arg-[a-z0-9-]+$/.test(source.href)]).toEqual([
          display,
          true,
        ]);
    }
    console.log(
      `equation explanation pages: ${routes.length} routes, ${drawn.display} printed displays, ${drawn.model} model equations and ${drawn.lab} laboratory formulas drawn, each with a link back`,
    );
    expect(bare).toEqual([]);
    expect(named).toEqual([]);
    expect(nowhere).toEqual([]);
    expect(drawn.display).toBeGreaterThan(0);
    expect(drawn.model).toBeGreaterThan(0);
    expect(drawn.lab).toBeGreaterThan(0);
  });

  test("puts the equation above its explanation, with its spoken name and its link", async () => {
    for (const { kind, match } of KINDS) {
      const route = everyExplanationRoute().find((r) => match(r.display));
      if (!route) throw new Error(`no route for ${kind}`);
      const document = await pageDocument(route.paper, route.display);
      const formula = document.querySelector(".equation-explanation-formula");
      const levels = document.querySelector(".equation-explanation-levels");
      const back = document.querySelector(".equation-explanation-source a[href]");
      if (!formula || !levels || !back)
        throw new Error(
          `${route.display}: ${!formula ? "no formula" : !levels ? "no levels" : "no link back"}`,
        );
      // The formula is a drawn display, and it comes before the words that explain it.
      expect([route.display, !!formula.querySelector(".katex-display, .katex")]).toEqual([
        route.display,
        true,
      ]);
      expect([
        route.display,
        formula.compareDocumentPosition(levels) & 4 ? "formula first" : "levels first",
      ]).toEqual([route.display, "formula first"]);
      const explanation = fullExplanation(route.paper, route.display);
      expect([route.display, back.getAttribute("href")]).toEqual([
        route.display,
        explanation?.source?.href ?? null,
      ]);
      if (explanation?.printed?.spoken)
        expect([route.display, formula.getAttribute("aria-label")]).toEqual([
          route.display,
          explanation.printed.spoken,
        ]);
      console.log(
        `${kind} (${route.paper} ${route.display}): the equation is drawn above its explanation, and "${back.textContent?.trim()}" leads to ${back.getAttribute("href")}`,
      );
    }
  });

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
