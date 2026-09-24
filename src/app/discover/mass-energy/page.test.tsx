import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import MassEnergyEncounter from "./page";

/**
 * /discover/mass-energy/: the numeric exercise in step 05 (am-disc-exercise-checker-i4h2). The
 * page's lead says the paper "answers with a number", and this is where a reader computes one.
 */
const html = renderToStaticMarkup(<MassEnergyEncounter />);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();

function stepFive(): string {
  const start = html.indexOf('<section id="step-05"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("step 05 puts the coefficient to a number", () => {
  test("after the slow-speed disclosure, the sealed-lamp exercise with kilograms and grams", () => {
    const step = stepFive();
    const start = step.indexOf('data-exercise-part="me-sealed-lamp-year"');
    expect(start).toBeGreaterThan(
      step.indexOf("Why the slow-speed limit and not the exact factor"),
    );
    const part = step.slice(start);
    expect(part).toContain('<option value="kg" selected="">kg</option>');
    expect(part).toContain('<option value="g">g</option>');
    expect(text(part)).toContain("A sealed box holds a lamp and the battery that powers it.");
  });

  test("the part's words pass the voice lint as prose", () => {
    const part = text(
      stepFive().slice(stepFive().indexOf('data-exercise-part="me-sealed-lamp-year"')),
    );
    expect(part).toContain("some 35 micrograms");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
