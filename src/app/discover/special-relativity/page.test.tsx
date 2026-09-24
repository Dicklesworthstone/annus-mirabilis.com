import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import RelativityEncounter from "./page";

/** /discover/special-relativity/: the numeric exercise in step 06 (am-disc-exercise-checker-i4h2). */
const html = renderToStaticMarkup(<RelativityEncounter />);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();

function stepSix(): string {
  const start = html.indexOf('<section id="step-06"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("step 06 tries the moving rod on numbers", () => {
  test("after the clock disclosure, with metres and centimetres", () => {
    const step = stepSix();
    const start = step.indexOf('data-exercise-part="sr-moving-rod-length"');
    expect(start).toBeGreaterThan(step.indexOf("What the moving clock reading means"));
    expect(step.slice(start)).toContain('<option value="cm">cm</option>');
  });

  test("it states the factor it asks the reader to use, names the paper's V, and passes the voice lint", () => {
    const step = stepSix();
    const part = text(step.slice(step.indexOf('data-exercise-part="sr-moving-rod-length"')));
    expect(part).toContain("by the factor √(1 − v²/c²)");
    expect(part).toContain("which the paper writes V");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
