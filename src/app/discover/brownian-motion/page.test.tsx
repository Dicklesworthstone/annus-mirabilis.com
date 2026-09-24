import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import BrownianEncounter from "./page";

/**
 * /discover/brownian-motion/: the explanation part in step 02 (am-disc-exercise-checker-i4h2).
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
  const markup = section("step-02");
  const start = markup.indexOf('data-exercise-part="bm-square-root-in-words"');
  expect(start).toBeGreaterThan(-1);
  return markup.slice(start, markup.indexOf("</details>", start));
}

describe("step 02 asks the reader to put the square-root argument in words", () => {
  test("after the prediction's argument, with a text box and four criteria behind a disclosure", () => {
    const step = section("step-02");
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

  test("the expression exercise in step 05 is still there", () => {
    expect(section("step-05")).toContain('data-exercise-part="bm-displacement-scale-rewrite"');
  });

  test("every sentence of the part passes the voice lint as prose", () => {
    const words = text(explanationPart());
    expect(words.length).toBeGreaterThan(400);
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
