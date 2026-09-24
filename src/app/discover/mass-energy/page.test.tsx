import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import { MASS_ENERGY_LATER_EVIDENCE } from "../../../content/massEnergyShelf.ts";
import { checkMoveSummary } from "../../../discovery/checks/moveSummaryGuard.ts";
import {
  BOX_1906_HREF,
  DOORS,
  FIRST_HONEST_QUESTION,
  FORK_FIELD_MASS,
  FORK_POINCARE,
  MOVE,
  MOVE_HREF,
  NAGGING_FACT,
  PPE_TASK,
  SOURCE_JUMPS,
  WORLD_CHECK,
} from "../../../discovery/massEnergy/journeyIV.ts";
import type { LowSpeedProofView } from "../../../equations/derivations/lowSpeedView.ts";
import { ELIMINATION_STEPS } from "../../../equations/derivations/massEnergyElimination.ts";
import lowSpeed from "../../../generated/mass-energy-low-speed.json";
import { MassEnergyLowSpeed } from "../../../reader/MassEnergyLowSpeed.tsx";
import { exportMarkup } from "../../../testing/exportMarkup.ts";
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
 * Journey IV's skeleton (plan §9.1, §9.5; dispatch 139; am-disc-journey-iv-chain-wwrz): the shelf
 * first, the nagging fact and the first honest question, the chain with its move marked at the
 * identification, Poincaré's fork and the field-or-energy fork worked honestly, the check against the
 * world, a predict-perturb-explain task, and the doors.
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
      'id="step-04"',
      'id="step-05"',
      "data-move-marker",
      'id="arg-fork-poincare-fluid"',
      'id="arg-fork-field-or-energy"',
      'id="step-06"',
      "data-world-check-live",
      'data-ppe-task-id="me-predict-perturb-explain-joule"',
      'id="in-the-paper"',
      "data-journey-doors",
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the move is marked at the identification, after the coefficient, and opens that argument", () => {
    const start = at("data-move-marker");
    const marker = html.slice(start, html.indexOf("</aside>", start));
    expect(text(marker)).toContain("The move");
    expect(text(marker)).toContain("Read the coefficient as a lost mass");
    expect(marker).toContain('href="/papers/mass-energy/#me-the-move"');
    expect(start).toBeGreaterThan(at('id="step-05"'));
    // Step 03 is bookkeeping any reader can check, and no longer calls itself the move.
    const three = html.slice(at('id="step-03"'), at('id="step-04"'));
    expect(text(three)).not.toContain("This is the move");
  });

  test("the move's ids name the paper's checked chain, and the chain names that step the move", async () => {
    // Nothing in the framework resolves a move's ids (checkJourney declares knownChains and never
    // reads it), so this does: the chain is the low-speed certificate the paper page renders.
    const proof = lowSpeed as LowSpeedProofView;
    expect(MOVE.chainId).toBe(proof.certificate.id);
    expect(proof.certificate.requirements.map((r) => r.step)).toContain(MOVE.stepId);
    // The paper page's own instance, rendered as the export renders its lazy island.
    const chain = await exportMarkup(<MassEnergyLowSpeed />);
    const start = chain.indexOf('id="me-the-move"');
    expect(start).toBeGreaterThan(-1);
    const step = chain.slice(start, chain.indexOf("</li>", start));
    expect(text(step)).toContain("The move: read the coefficient as a lost mass");
    expect(step).toContain(`data-low-speed-step="${MOVE.stepId}"`);
    expect(MOVE_HREF).toBe("/papers/mass-energy/#me-the-move");
    // One move in the chain: no other step of it is called one, and the ledger elimination before
    // it calls its offset step a premise (it said "the consequential move" until this change).
    expect((text(chain).match(/The move/g) ?? []).length).toBe(1);
    const words = (s: (typeof ELIMINATION_STEPS)[number]) => `${s.title} ${s.reason} ${s.detail}`;
    expect(ELIMINATION_STEPS.filter((s) => /\bmove\b/i.test(words(s))).map((s) => s.id)).toEqual(
      [],
    );
  });

  test("the move's summary passes the framework's guard and stays a draft", () => {
    const result = checkMoveSummary(MOVE.r0Summary.text);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(MOVE.r0Summary.reviewState).toBe("draft");
    // The identification is limited to slow motion and to the paper's premises.
    expect(MOVE.r0Summary.text).toContain("when the motion is slow");
    expect(MOVE.r0Summary.text).toContain("within the paper's stated premises");
  });

  test("electromagnetic mass is undecided on 1904 evidence, and names the later measurement", () => {
    const start = at('id="arg-fork-field-or-energy"');
    const fork = html.slice(start, html.indexOf("</section>", start));
    expect(fork).toContain('data-outcome-type="undecided-on-available-evidence"');
    expect(fork).toContain('data-outcome-type="papers-route"');
    expect(text(fork)).toContain("J. J. Thomson, 1881");
    expect(text(fork)).toContain("no measurement of a body whose non-electromagnetic energy");
    // The deciding record is a link to its card on this page, not a printed id.
    expect(fork).toContain('href="#card-cockcroft-walton-1932-lithium"');
    expect(text(fork)).not.toContain("[#");
    const decider = FORK_FIELD_MASS.branches[0]?.outcome.whatWouldDecide;
    const card = MASS_ENERGY_LATER_EVIDENCE.find((c) => c.id === decider?.recordId);
    // Not decidable from the shelf: a later card, after 1904.
    expect(card?.status).toBe("later");
    expect(card?.date.latestYear).toBeGreaterThan(1904);
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
    expect(text(step)).toContain("L/9·10²⁰, with the energy in erg and the mass in grams");
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
      ...[FORK_POINCARE, FORK_FIELD_MASS].flatMap((f) => [f.question]),
      ...[...FORK_POINCARE.branches, ...FORK_FIELD_MASS.branches].flatMap((b) => [
        b.label,
        b.hypothesis,
        b.worksWhen,
        b.outcome.plainLanguage,
        b.outcome.insufficiency ?? "",
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

describe("the reader sees powers as powers", () => {
  test("no power of ten reaches the page as a raw caret", () => {
    // "6 × 10^23" is how a program writes it. A sweep of the live discover pages on 2026-09-24
    // found three on the Brownian route. KaTeX's TeX source rides in <annotation>, which no one
    // reads, so it is left out; an exercise that asks for typed input may still show one.
    const visible = html
      .replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, " ")
      .replace(/<[^>]+>/g, " ");
    expect(visible.match(/.{0,30}\d\s*\^\s*[-\d{]/g) ?? []).toEqual([]);
  });
});
