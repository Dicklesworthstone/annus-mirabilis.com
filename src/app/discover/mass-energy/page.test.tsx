import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import {
  FIRST_HONEST_QUESTION,
  FORK_POINCARE,
  MOVE,
  NAGGING_FACT,
  PPE_TASK,
  SOURCE_JUMPS,
} from "../../../discovery/massEnergy/journeyIV.ts";
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

  test("the formula comes first, in the paper's letters L and V, before the lamp", () => {
    const step = stepFive();
    const formula = step.indexOf('data-exercise-part="me-mass-given-up-formula"');
    expect(formula).toBeGreaterThan(
      step.indexOf("Why the slow-speed limit and not the exact factor"),
    );
    expect(formula).toBeLessThan(step.indexOf('data-exercise-part="me-sealed-lamp-year"'));
    const part = text(
      step.slice(formula, step.indexOf('data-exercise-part="me-sealed-lamp-year"')),
    );
    expect(part).toContain("Write it using L and V");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
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

/**
 * Journey IV's skeleton (plan §9.1, §9.5; dispatch 139): the shelf first, the nagging fact and the
 * first honest question, the chain with its move marked, Poincaré's fork worked honestly, and a
 * predict-perturb-explain task.
 */
describe("the route carries the discovery skeleton", () => {
  const at = (marker: string) => {
    const i = html.indexOf(marker);
    expect(i, marker).toBeGreaterThan(-1);
    return i;
  };

  test("its parts come in the plan's order", () => {
    const order = [
      'id="shelf"',
      'id="nagging-fact"',
      'id="first-question"',
      'id="step-01"',
      'id="step-03"',
      "data-move-marker",
      'id="step-04"',
      'id="step-05"',
      'id="arg-fork-poincare-fluid"',
      'data-ppe-task-id="me-predict-perturb-explain-joule"',
      'id="in-the-paper"',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the move is marked at the two accounts and opens that argument", () => {
    const start = at("data-move-marker");
    const marker = html.slice(start, html.indexOf("</aside>", start));
    expect(text(marker)).toContain("The move");
    expect(marker).toContain('href="/papers/mass-energy/#arg-me-two-ledgers"');
    expect(start).toBeGreaterThan(at('id="step-03"'));
    expect(start).toBeLessThan(at('id="step-04"'));
  });

  test("Poincaré's fluid is worked as equivalent within its scope, not refuted", () => {
    const start = at('id="arg-fork-poincare-fluid"');
    const fork = html.slice(start, html.indexOf("</section>", start));
    expect(text(fork)).toContain("Henri Poincaré, 1900");
    expect(fork).toContain('data-outcome-type="empirically-equivalent-not-refuted"');
    expect(fork).toContain('data-outcome-type="papers-route"');
    expect(fork).not.toContain('data-outcome-type="dead-end-on-constraint"');
    expect(html).toContain('href="#card-poincare-1900-fictitious-fluid"');
  });

  test("the shelf carries electromagnetic mass, Poincaré's fluid and Hasenöhrl's cavity", () => {
    for (const id of [
      "thomson-1881-electromagnetic-mass",
      "poincare-1900-fictitious-fluid",
      "hasenoehrl-1904-cavity-radiation",
    ])
      expect(html).toContain(`id="card-${id}"`);
  });

  test("every in-page link lands on an element of the page", () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(targets.length).toBeGreaterThan(3);
    expect(targets.filter((target) => !ids.has(target))).toEqual([]);
  });

  test("the new prose passes the voice lint", () => {
    const words = [
      NAGGING_FACT,
      FIRST_HONEST_QUESTION,
      MOVE.label,
      MOVE.r0Summary.text,
      PPE_TASK.task,
      PPE_TASK.perturbPrompt,
      PPE_TASK.explainPrompt,
      FORK_POINCARE.question,
      ...FORK_POINCARE.branches.flatMap((b) => [
        b.label,
        b.hypothesis,
        b.worksWhen,
        b.outcome.plainLanguage,
        ...b.steps.map((s) => s.text),
      ]),
      ...SOURCE_JUMPS.flatMap((j) => [j.label, j.pointer]),
    ].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
