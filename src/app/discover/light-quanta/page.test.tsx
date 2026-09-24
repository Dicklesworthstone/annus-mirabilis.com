import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import LightQuantaEncounter from "./page";

/** /discover/light-quanta/: the numeric exercise in step 07 (am-disc-exercise-checker-i4h2). */
const html = renderToStaticMarkup(<LightQuantaEncounter />);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();

function stepSeven(): string {
  const start = html.indexOf('<section id="step-07"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("step 07 tries the electron rule on numbers", () => {
  test("after the disclosure that says what the three predictions are worth", () => {
    const step = stepSeven();
    const start = step.indexOf('data-exercise-part="lq-greatest-electron-energy"');
    expect(start).toBeGreaterThan(step.indexOf("How much these three are worth"));
    expect(step.slice(start)).toContain('<option value="eV" selected="">eV</option>');
  });

  test("it says the surface is made up and the constant is today's, and passes the voice lint", () => {
    const step = stepSeven();
    const part = text(step.slice(step.indexOf('data-exercise-part="lq-greatest-electron-energy"')));
    expect(part).toContain("the surface is made up, not a named metal");
    expect(part).toContain("with today’s value of the constant in it");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
