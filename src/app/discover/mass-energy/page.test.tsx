import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import {
  BOX_1906_HREF,
  DOORS,
  FIRST_HONEST_QUESTION,
  FORK_POINCARE,
  MOVE,
  NAGGING_FACT,
  PPE_TASK,
  SOURCE_JUMPS,
  WORLD_CHECK,
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
 * first honest question, the chain with its move marked, Poincaré's fork worked honestly, the check
 * against the world, a predict-perturb-explain task, and the doors.
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
      'id="step-06"',
      "data-world-check-live",
      'data-ppe-task-id="me-predict-perturb-explain-joule"',
      'id="in-the-paper"',
      "data-journey-doors",
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

  test("the check against the world reads the embedded ledger, beside the printed rule", () => {
    const start = at('id="step-06"');
    const step = html.slice(start, html.indexOf('<section id="in-the-paper"'));
    expect(step).toContain('data-world-check-quantity="massChange"');
    expect(step).toContain("The boundary ledger, for the check");
    expect(text(step)).toContain("L/9·10^20, with the energy in erg and the mass in grams");
    expect(step).toContain('id="card-cockcroft-walton-1932-lithium"');
    // A later card is never on the 1904 shelf.
    const shelf = html.slice(at('id="shelf"'), at('id="nagging-fact"'));
    expect(shelf).not.toContain("cockcroft-walton-1932-lithium");
  });

  test("three doors arrive at the same result and open where they say", () => {
    const start = at("data-journey-doors");
    const doors = html.slice(start, html.indexOf("</section>", start));
    expect(text(doors)).toContain("All doors arrive at the same result: the mass falls by L/V²");
    expect(doors).toContain('href="/papers/mass-energy/#arg-me-two-ledgers"');
    expect(BOX_1906_HREF).toBe("/lab/me-03/?mode=box-1906");
    expect(doors).toContain(`href="${BOX_1906_HREF}"`);
    expect(doors).toContain('href="/papers/mass-energy/#entry-mass-energy"');
    expect(text(doors)).toContain("crediting Poincaré’s fluid of 1900");
    // The ids are the build's; a door with a link shows the reader its title and summary instead.
    expect(text(doors)).not.toContain("#door-me");
    expect(text(doors)).not.toContain("eq-model-me-mass-decrease");
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
      WORLD_CHECK.claim,
      ...[DOORS.frontDoor, ...DOORS.sideDoors].flatMap((d) => [d.title, d.summary ?? ""]),
    ].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
