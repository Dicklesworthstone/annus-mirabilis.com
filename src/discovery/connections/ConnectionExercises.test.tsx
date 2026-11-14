import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { AVOGADRO_RADIUS_COMPARISON } from "./avogadro.ts";
import { ConnectionExercises } from "./ConnectionExercises.tsx";
import { buildConnectionExercises, CROSS_JOURNEY_EXERCISES } from "./records.ts";

const html = renderToStaticMarkup(<ConnectionExercises exercises={CROSS_JOURNEY_EXERCISES} />);
const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#x27;")
    .replace(/"/g, "&quot;");

describe("cross-paper exercises before JavaScript runs", () => {
  test("all stable anchors, prompts, criteria and worked answers are in the server response", () => {
    for (const exercise of CROSS_JOURNEY_EXERCISES) {
      expect(html).toContain(`id="${exercise.id}"`);
      expect(html).toContain(`href="#${exercise.id}"`);
      for (const section of exercise.sections)
        for (const entry of section.parts) {
          expect(html).toContain(escaped(entry.part.prompt));
          expect(html).toContain(escaped(entry.part.workedExplanation));
          if (entry.kind === "explanation")
            for (const criterion of entry.part.criteria) expect(html).toContain(escaped(criterion));
        }
    }
    expect(html).toContain("<summary>Compare with a worked explanation</summary>");
    expect(html).toContain("<noscript>");
    expect(html).not.toContain("exercise is unavailable");
  });

  test("every DOM id is unique and checking controls remain disabled before hydration", () => {
    const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const inputs = Array.from(html.matchAll(/<input\b[^>]*>/g), (match) => match[0]);
    expect(inputs.length).toBeGreaterThan(4);
    for (const input of inputs) expect(input).toContain('disabled=""');
    expect(html).toContain('<fieldset class="connection-exercise" aria-label=');
    expect(html).toContain('data-outcome="needs-human-reading"');
  });

  test("removing the radius reveals the same-sample family through a native disclosure", () => {
    const disclosure = html.slice(
      html.indexOf('<details data-radius-comparison="same-synthetic-sample"'),
    );
    expect(disclosure).toStartWith("<details");
    const family = disclosure.slice(0, disclosure.indexOf("</details>"));
    expect(family).toContain("<summary>Remove the independently supplied radius</summary>");
    expect(family).toContain('data-result-status="underdetermined"');
    expect(family).toContain("They do not identify one N or a single interval for N");
    expect(family).toContain("There is no single estimate or interval for N");
    expect(family).toContain(
      "<caption>Compatible radii and molecular numbers for this synthetic sample</caption>",
    );
    for (const point of AVOGADRO_RADIUS_COMPARISON.unknown.family) {
      expect(family).toContain(point.radius.toExponential(5));
      expect(family).toContain(point.molecularNumber.toExponential(5));
    }
    expect(family).not.toContain("<input");
  });

  test("the historical route remains usable without the full companion or lab", () => {
    const unavailable = renderToStaticMarkup(
      <ConnectionExercises
        exercises={buildConnectionExercises({ companionPresent: false, avogadroLabPresent: false })}
      />,
    );
    expect(unavailable).toContain("Route 3: the dissertation and its correction");
    expect(unavailable).toContain('id="avogadro-dissertation"');
    expect(unavailable).toContain(
      'data-dissertation-comparison="printed-products-and-coefficient-correction"',
    );
    expect(unavailable).toContain('href="/papers/pdfs/ap-19-289.pdf#page=17"');
    expect(unavailable).toContain('href="/papers/pdfs/ap-19-289.pdf#page=18"');
    expect(unavailable).toContain('href="/papers/pdfs/ap-34-591.pdf#page=2"');
    expect(unavailable).not.toContain('href="/lab/avogadro-lab/"');
    expect(unavailable).not.toContain('href="/papers/molecular-dimensions/"');
    expect(html).toContain('href="/lab/avogadro-lab/"');
    expect(html).toContain('data-historical-status="later-development"');
    expect(html.match(/>Modern lens<\/p>/g)).toHaveLength(2);
  });

  test("the source comparison separates changed observations from the coefficient correction", () => {
    expect(html).toContain(
      "<caption>Three stages, with the observations and the coefficient kept distinct</caption>",
    );
    for (const value of ["2.1", "2.1212", "4.15", "6.56", "6.5617", "3.3539"])
      expect(html).toContain(`${value} × 10²³`);
    for (const value of ["0.99", "0.98058", "0.78", "0.49332"])
      expect(html).toContain(`${value} nm`);
    expect(html).toContain("the correction note does not print it");
    expect(html).toContain("rounded historical values supplies a confidence interval");
    for (const suffix of ["radius", "number", "correction"])
      expect(html).toContain(`id="exercise-cross-journey-avogadro-dissertation-${suffix}"`);
  });

  test("additional renderer copy passes the shared voice check", () => {
    const errors = checkVoice(html.replace(/<[^>]+>/g, " "), { context: "task-feedback" }).filter(
      (finding) => finding.severity === "error",
    );
    expect(errors.map((finding) => `${finding.rule}: ${finding.matchedText}`)).toEqual([]);
  });
});
