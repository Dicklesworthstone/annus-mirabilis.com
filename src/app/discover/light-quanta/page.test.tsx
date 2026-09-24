import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import { LIGHT_QUANTA_SHELF_CARDS } from "../../../content/lightQuantaShelf.ts";
import { FIRST_HONEST_QUESTION, NAGGING_FACT } from "../../../discovery/lightQuanta/journeyI.ts";
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

  test("the formula comes first, in the paper's own letter P, before the numbers", () => {
    const step = stepSeven();
    const formula = step.indexOf('data-exercise-part="lq-greatest-energy-formula"');
    expect(formula).toBeGreaterThan(step.indexOf("How much these three are worth"));
    expect(formula).toBeLessThan(step.indexOf('data-exercise-part="lq-greatest-electron-energy"'));
    const part = text(
      step.slice(formula, step.indexOf('data-exercise-part="lq-greatest-electron-energy"')),
    );
    expect(part).toContain("P is the paper’s own letter");
    expect(part).toContain("typing ν as nu");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
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

/**
 * Journey I's skeleton (plan §9.1, §9.2; dispatch 142; am-disc-journey-i-chain-n1lh): the shelf
 * first, then the nagging fact and the first honest question, with the anachronism controls
 * AGENTS.md sets for this paper.
 */
describe("the route carries the discovery skeleton", () => {
  const at = (marker: string) => {
    const i = html.indexOf(marker);
    expect(i, marker).toBeGreaterThan(-1);
    return i;
  };

  test("its opening parts come in the plan's order", () => {
    const order = ['id="shelf"', 'id="nagging-fact"', 'id="first-question"', 'id="step-01"'].map(
      at,
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(html)).toContain(NAGGING_FACT.replace(/'/g, "’"));
    expect(text(html)).toContain(FIRST_HONEST_QUESTION);
  });

  test("the shelf holds Rayleigh's June 1900 law and the long-wave measurements, and no Jeans", () => {
    const shelf = html.slice(at('id="shelf"'), at('id="nagging-fact"'));
    for (const id of [
      "rayleigh-1900-radiation-law",
      "rubens-1901-long-wave-radiation",
      "boltzmann-1896-gas-volume-entropy",
      "planck-1901-energy-elements",
      "wien-1896-radiation-law",
      "lenard-1902-photoelectric",
    ])
      expect(shelf).toContain(`id="card-${id}"`);
    expect(shelf).not.toMatch(/id="card-jeans/);
    // Each card is awaiting verification: none carries a verification record.
    expect(LIGHT_QUANTA_SHELF_CARDS.every((c) => c.verification === undefined)).toBe(true);
    expect(LIGHT_QUANTA_SHELF_CARDS.every((c) => c.date.latestYear <= 1904)).toBe(true);
  });

  test("the later name for the divergence is always attributed to Ehrenfest and 1911", () => {
    const words = text(html);
    const uses = [...words.matchAll(/ultraviolet catastrophe/gi)].map((m) => m.index ?? 0);
    expect(uses.length).toBeGreaterThan(0);
    for (const i of uses) {
      const near = words.slice(Math.max(0, i - 200), i + 200);
      expect(near).toContain("Ehrenfest");
      expect(near).toContain("1911");
    }
    expect(words).not.toMatch(/\bphotons?\b/i);
  });

  test("the new prose passes the voice lint", () => {
    const words = [NAGGING_FACT, FIRST_HONEST_QUESTION].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
