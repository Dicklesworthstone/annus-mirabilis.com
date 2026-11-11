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

  test("unavailable dissertation evidence is named, and absent lab capabilities leave no link", () => {
    const unavailable = renderToStaticMarkup(
      <ConnectionExercises
        exercises={buildConnectionExercises({ companionPresent: false, avogadroLabPresent: false })}
      />,
    );
    expect(unavailable).toContain("Route 3: the dissertation, in preparation");
    expect(unavailable).not.toContain('href="/lab/avogadro-lab/"');
    expect(unavailable).not.toContain('href="/papers/molecular-dimensions/"');
    expect(html).toContain('href="/lab/avogadro-lab/"');
    expect(html).toContain('data-historical-status="later-development"');
    expect(html.match(/>Modern lens<\/p>/g)).toHaveLength(2);
  });

  test("additional renderer copy passes the shared voice check", () => {
    const errors = checkVoice(html.replace(/<[^>]+>/g, " "), { context: "task-feedback" }).filter(
      (finding) => finding.severity === "error",
    );
    expect(errors.map((finding) => `${finding.rule}: ${finding.matchedText}`)).toEqual([]);
  });
});
