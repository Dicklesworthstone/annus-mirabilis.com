import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import { FORK_EXNER, FORK_NAEGELI } from "../../../discovery/brownian/journeyII.ts";
import { decodeBm04Settings } from "../../../experiments/bm04/permalink.ts";
import BrownianEncounter from "./page";

/**
 * /discover/brownian-motion/: the explanation part in step 04 (am-disc-exercise-checker-i4h2).
 * The page is rendered whole, as the static export renders it, so the test reads what a reader
 * without JavaScript receives.
 */
const html = renderToStaticMarkup(<BrownianEncounter />);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function section(id: string): string {
  const start = html.indexOf(`<section id="${id}"`);
  const end = html.indexOf("</section>", start);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, end);
}

function explanationPart(): string {
  const markup = section("step-04");
  const start = markup.indexOf('data-exercise-part="bm-square-root-in-words"');
  expect(start).toBeGreaterThan(-1);
  return markup.slice(start, markup.indexOf("</details>", start));
}

describe("step 04 asks the reader to put the square-root argument in words", () => {
  test("after the prediction's argument, with a text box and four criteria behind a disclosure", () => {
    const step = section("step-04");
    expect(step.indexOf("bm-square-root-in-words")).toBeGreaterThan(
      step.indexOf("Why a randomly kicked particle goes only twice as far"),
    );
    const part = explanationPart();
    expect(part).toContain('data-outcome="needs-human-reading"');
    expect(part).toContain("<textarea");
    expect(part.match(/<li>/g)?.length).toBe(4);
  });

  test("the criteria name the three ideas and the contrast the prompt asks about", () => {
    const words = text(explanationPart());
    for (const idea of [
      "independent of the last",
      "mean squares of independent steps add",
      "square root of the mean square",
      "all point the same way",
    ])
      expect(words).toContain(idea);
  });

  test("the expression exercise in step 07 is still there", () => {
    expect(section("step-07")).toContain('data-exercise-part="bm-displacement-scale-rewrite"');
  });

  test("step 07 lets the reader arrive at Einstein's number, as the page's lead promises", () => {
    const step = section("step-07");
    expect(text(html)).toContain("You can arrive at the same number here");
    const start = step.indexOf('data-exercise-part="bm-einstein-one-second"');
    expect(start).toBeGreaterThan(step.indexOf("bm-displacement-scale-rewrite"));
    const part = text(step.slice(start));
    expect(part).toContain("particles 0.001 mm across");
    expect(part).toContain("Einstein printed it as 0.8 micron.");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });

  test("every sentence of the part passes the voice lint as prose", () => {
    const words = text(explanationPart());
    expect(words.length).toBeGreaterThan(400);
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

/**
 * Journey II's skeleton on the live route (plan §9.1, §9.3; dispatch 136). Until 2026-09-24 the
 * skeleton components rendered on no served page: their only importer was a retired route.
 */
describe("the route carries the discovery skeleton, in the plan's order", () => {
  const at = (marker: string) => {
    const i = html.indexOf(marker);
    expect(i, marker).toBeGreaterThan(-1);
    return i;
  };

  test("shelf, nagging fact and first question come before the chain", () => {
    const order = [
      'id="shelf"',
      'id="nagging-fact"',
      'id="first-question"',
      'id="step-01"',
      'id="step-02"',
      'id="step-03"',
      'id="step-04"',
      "data-move-marker",
      'id="step-05"',
      'id="step-06"',
      'id="step-07"',
      'id="in-the-paper"',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(section("nagging-fact"))).toContain("what is known about molecules in solution");
    expect(text(section("first-question"))).toContain("press on a membrane");
  });

  test("Route A asks the osmotic question and meets drag, with its instruments", () => {
    const osmotic = section("step-02");
    expect(osmotic).toContain('href="/lab/bm-02/"');
    expect(osmotic).toContain('href="/lab/bm-03/"');
    expect(text(osmotic)).toContain("van ’t Hoff");
    const drag = section("step-03");
    expect(drag).toContain('href="/lab/bm-04/"');
    expect(text(drag)).toContain("the force cancels");
    expect(text(drag)).toContain("side door");
  });

  test("the move is marked and opens the chain step the derivation marks", () => {
    const start = at("data-move-marker");
    const marker = html.slice(start, html.indexOf("</aside>", start));
    expect(text(marker)).toContain("The move");
    expect(marker).toContain(
      'href="/papers/brownian-motion/s4/?open=derivation-step:bm-variance-cross#arg-bm-independent-steps"',
    );
    // The chain and step ids are for the build; the marker says where to go in words.
    expect(text(marker)).not.toContain("bm-variance · bm-variance-cross");
  });

  test("the shelf holds Nägeli and van ’t Hoff, and nothing later than 1904 unmarked", () => {
    const shelf = section("shelf");
    expect(shelf).toContain('data-card-id="naegeli-1879-single-impacts"');
    expect(shelf).toContain('data-card-id="vant-hoff-1887-osmotic-gas-law"');
    expect(shelf).not.toContain("perrin-1909");
  });

  test("the new prose passes the voice lint", () => {
    for (const id of ["nagging-fact", "first-question", "step-02", "step-03"]) {
      const errors = checkVoice(text(section(id)), { context: "prose" }).filter(
        (f) => f.severity === "error",
      );
      expect(errors.map((f) => `${id} ${f.rule}: ${f.matchedText}`)).toEqual([]);
    }
  });
});

/**
 * The forks (dispatch 136, unit 2): Nägeli and Exner, each worked until one branch fails on a
 * stated constraint beside the branch the paper takes. Named people are named; nobody is mocked.
 */
describe("the route's forks name their people and work each branch to an outcome", () => {
  const fork = (id: string) => {
    const start = html.indexOf(`<section id="${id}"`);
    expect(start, id).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf("</section>", start));
  };

  test("Nägeli's fork follows the osmotic question and precedes the force balance", () => {
    const at = html.indexOf('id="arg-fork-naegeli"');
    expect(at).toBeGreaterThan(html.indexOf('id="step-02"'));
    expect(at).toBeLessThan(html.indexOf('id="step-03"'));
    const markup = fork("arg-fork-naegeli");
    expect(text(markup)).toContain("Carl Nägeli, 1879");
    expect(markup).toContain('data-outcome-type="dead-end-on-constraint"');
    expect(markup).toContain('data-outcome-type="papers-route"');
  });

  test("the kicks-off world opens in BM-04 as valid settings: no kicks, no force, a step", () => {
    const link = /href="(\/lab\/bm-04\/\?[^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, "&");
    expect(link).toBeDefined();
    const decoded = decodeBm04Settings(link?.slice("/lab/bm-04/".length) ?? "");
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.m).toBe(0);
      expect(decoded.parameters.F).toBe(0);
      expect(decoded.parameters.profile).toBe("step");
    }
  });

  test("Exner's fork follows the square-root step and the move", () => {
    const at = html.indexOf('id="arg-fork-exner"');
    expect(at).toBeGreaterThan(html.indexOf("data-move-marker"));
    expect(at).toBeLessThan(html.indexOf('id="step-05"'));
    const markup = fork("arg-fork-exner");
    expect(text(markup)).toContain("Felix Exner, 1900");
    expect(text(markup)).toContain("a quarter of the interval, twice the speed");
    expect(markup).toContain('data-outcome-type="dead-end-on-constraint"');
    expect(markup).toContain('data-outcome-type="papers-route"');
  });

  test("a proponent links to its card on the shelf", () => {
    for (const card of ["naegeli-1879-single-impacts", "exner-1900-particle-speeds"]) {
      expect(html).toContain(`href="#card-${card}"`);
      expect(html).toContain(`id="card-${card}"`);
    }
  });

  test("every in-page link on the route lands on an element of the page", () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(targets.length).toBeGreaterThan(5);
    expect(targets.filter((t) => !ids.has(t))).toEqual([]);
  });

  test("the forks' prose passes the voice lint, and no raw schema kind reaches the reader", () => {
    for (const f of [FORK_NAEGELI, FORK_EXNER]) {
      const words = [
        f.question,
        ...f.branches.flatMap((b) => [
          b.label,
          b.hypothesis,
          b.worksWhen,
          b.outcome.plainLanguage,
          ...b.steps.map((s) => s.text),
        ]),
      ].join(" ");
      const errors = checkVoice(words, { context: "prose" }).filter((x) => x.severity === "error");
      expect(errors.map((x) => `${f.id} ${x.rule}: ${x.matchedText}`)).toEqual([]);
      expect(text(fork(f.id))).not.toContain(f.varies);
    }
  });
});
