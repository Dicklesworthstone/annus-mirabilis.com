import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import { LIGHT_QUANTA_SHELF_CARDS } from "../../../content/lightQuantaShelf.ts";
import { checkMoveSummary } from "../../../discovery/checks/moveSummaryGuard.ts";
import {
  DOORS,
  FIRST_HONEST_QUESTION,
  FORK_ENTROPY_ACCOUNT,
  FORK_ONE_LUMP,
  MOVE,
  MOVE_HREF,
  NAGGING_FACT,
  SOURCE_JUMPS,
} from "../../../discovery/lightQuanta/journeyI.ts";
import { LQ05_PRESETS } from "../../../experiments/lq05/definition.ts";
import { decodeLq05Settings } from "../../../experiments/lq05/permalink.ts";
import lqEquations from "../../../generated/light-quanta-equations.json";
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
    // The journey's own narration has no photons. The embedded LQ-08 laboratory's list of what it
    // does not model names "multi-photon" emission and disclaims that its marks depict photons;
    // those are the instrument's labelled limits, so the laboratory is cut out before the check.
    const lab = html.indexOf('data-instrument-id="lq-08"', at('id="step-08"'));
    expect(lab).toBeGreaterThan(-1);
    const narration = text(html.slice(0, lab) + html.slice(at("data-world-check-id")));
    expect(narration).not.toMatch(/\bphotons?\b/i);
    // Positive control: the cut really removed the laboratory, which does contain the word.
    expect(text(html)).toMatch(/\bphotons?\b/i);
  });

  test("the forks and the move sit where the bead puts them", () => {
    const order = [
      'id="step-04"',
      'id="arg-fork-lq-volume-logarithm"',
      'id="step-05"',
      'id="step-06"',
      "data-move-marker",
      'id="arg-fork-lq-one-lump"',
      'id="step-07"',
      'id="step-08"',
      "data-world-check-live",
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("step 08 checks the §8 figure live from LQ-08, with Millikan later and off the shelf", () => {
    const start = at('id="step-08"');
    const step = html.slice(start, html.indexOf('id="in-the-paper"'));
    expect(step).toContain('data-world-check-quantity="stoppingPotentialMagnitude"');
    expect(step).toContain('data-instrument-id="lq-08"');
    expect(step).toContain('id="card-millikan-1916-photoelectric-h"');
    const shelf = html.slice(at('id="shelf"'), at('id="nagging-fact"'));
    expect(shelf).not.toContain("millikan");
    // Cited, not plotted: the withdrawn dataset draws no point on the route.
    expect(step).not.toContain("millikan-1916-sodium");
  });

  test("Fork A keeps Planck's account weaker, not refuted, and names him", () => {
    const start = at('id="arg-fork-lq-volume-logarithm"');
    const fork = html.slice(start, html.indexOf("</section>", start));
    expect(fork).toContain('data-outcome-type="correct-but-weaker"');
    expect(fork).toContain('data-outcome-type="papers-route"');
    expect(fork).not.toContain('data-outcome-type="dead-end-on-constraint"');
    expect(text(fork)).toContain("Max Planck, 1900–1901");
    expect(html).toContain('href="#card-planck-1901-energy-elements"');
  });

  test("Fork B's spreading account fails against Lenard's card, linked and not printed as an id", () => {
    const start = at('id="arg-fork-lq-one-lump"');
    const fork = html.slice(start, html.indexOf("</section>", start));
    expect(fork).toContain('data-outcome-type="dead-end-on-constraint"');
    expect(fork).toContain('data-outcome-type="papers-route"');
    expect(fork).toContain('href="#card-lenard-1902-photoelectric"');
    expect(text(fork)).not.toContain("#lenard");
  });

  test("the move is marked after the comparison, opens §6, and its ids are the paper's", () => {
    const start = at("data-move-marker");
    const marker = html.slice(start, html.indexOf("</aside>", start));
    expect(text(marker)).toContain("The move");
    expect(marker).toContain(`href="${MOVE_HREF}"`);
    // The ids resolve: the chain is the §6 argument record, and the step is an equation record
    // that belongs to it.
    const root = process.cwd();
    const argument = join(root, "content/arguments/light-quanta", `${MOVE.chainId}.json`);
    expect(existsSync(argument)).toBe(true);
    expect(JSON.parse(readFileSync(argument, "utf8")).section).toBe("s6");
    const equation = JSON.parse(
      readFileSync(join(root, "content/equations/light-quanta", `${MOVE.stepId}.json`), "utf8"),
    );
    expect(equation.argument).toBe(MOVE.chainId);
    expect(MOVE_HREF).toBe(`/papers/light-quanta/s6/#${MOVE.chainId}`);
  });

  test("the move's summary keeps its heuristic status and passes the guard", () => {
    const summary = MOVE.r0Summary.text;
    expect(checkMoveSummary(summary).issues).toEqual([]);
    expect(MOVE.r0Summary.reviewState).toBe("draft");
    expect(summary).toContain("heuristic");
    expect(summary).toContain("as if");
    expect(summary.split(/\s+/).length).toBeLessThanOrEqual(100);
    for (const banned of [
      "photon",
      "ultraviolet catastrophe",
      "proved",
      "proves",
      "not a wave",
      "particles of light",
    ])
      expect(summary.toLowerCase()).not.toContain(banned);
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
      ...[FORK_ENTROPY_ACCOUNT, FORK_ONE_LUMP].flatMap((f) => [
        f.question,
        ...f.branches.flatMap((b) => [
          b.label,
          b.hypothesis,
          b.worksWhen,
          b.outcome.plainLanguage,
          ...b.steps.map((s) => s.text),
        ]),
      ]),
    ].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

describe("what Einstein actually wrote, and two doors to the same place", () => {
  const inPaper = () => {
    const start = html.indexOf('<section id="in-the-paper"');
    expect(start).toBeGreaterThan(-1);
    return html.slice(start);
  };
  const argument = (id: string) => {
    const file = join(process.cwd(), "content", "arguments", "light-quanta", `${id}.json`);
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as { id: string; section: string })
      : null;
  };

  test("five jumps, §4 to §9 in the paper's order, each to an argument of that section", () => {
    const sections = SOURCE_JUMPS.map((j) => j.section);
    expect(sections).toEqual(["s4", "s5", "s7", "s8", "s9"]);
    const part = inPaper();
    let previous = -1;
    for (const jump of SOURCE_JUMPS) {
      const href = `/papers/light-quanta/${jump.section}/#${jump.targetAnchor}`;
      const at = part.indexOf(`href="${href}"`);
      expect(at, href).toBeGreaterThan(previous);
      previous = at;
      // The anchor is an argument record, and it belongs to the section the jump opens.
      expect(argument(jump.targetAnchor)?.section).toBe(jump.section);
    }
  });

  test("both doors arrive at the effective count of §6, the record the move marks", () => {
    const record = (lqEquations.equations as { id: string; argument: string }[]).find(
      (e) => e.id === DOORS.frontDoor.arrivesAtEquationId,
    );
    expect(record?.argument).toBe(MOVE.chainId);
    expect(DOORS.frontDoor.arrivesAtEquationId).toBe(MOVE.stepId);
    expect(DOORS.sideDoors.length).toBe(1);
    for (const door of DOORS.sideDoors)
      expect(door.arrivesAtEquationId).toBe(DOORS.frontDoor.arrivesAtEquationId);
    const part = text(inPaper());
    expect(part).toContain("Two doors lead to the same place");
    expect(part).toContain(
      `All doors arrive at the same result: ${DOORS.frontDoor.arrivesAtLabel}`,
    );
  });

  test("the programmer door opens LQ-05 at exactly its registered preset, n = 60, logarithmic", () => {
    const door = DOORS.sideDoors[0];
    const href = door?.href ?? "";
    expect(href.startsWith("/lab/lq-05/?")).toBe(true);
    const decoded = decodeLq05Settings(href.slice(href.indexOf("?")));
    if (decoded.kind !== "settings") throw new Error(`the door's link decodes as ${decoded.kind}`);
    expect(decoded.parameters).toEqual({ ...LQ05_PRESETS["lq-05-n60-log"]?.parameters });
    expect(decoded.parameters.n).toBe(60);
    expect(decoded.parameters.view).toBe("logarithmic");
    expect(inPaper()).toContain(`href="${href.replace(/&/g, "&amp;")}"`);
  });

  test("the front door opens an argument the paper's §4 page carries", () => {
    const [path, anchor] = (DOORS.frontDoor.href ?? "").split("#");
    expect(path).toBe("/papers/light-quanta/s4/");
    expect(argument(anchor ?? "")?.section).toBe("s4");
  });

  test("the words keep the paper's letters, name h only in a modern-lens sentence, and pass the lint", () => {
    const doors = [DOORS.frontDoor, ...DOORS.sideDoors];
    const words = [
      ...SOURCE_JUMPS.flatMap((j) => [j.label, j.pointer]),
      ...doors.flatMap((d) => [d.title, d.summary ?? "", d.arrivesAtLabel ?? ""]),
    ];
    for (const sentence of words.join(" ").split(/(?<=\.)\s+/))
      if (/\bh\b/.test(sentence)) expect(sentence).toContain("modern lens");
    const lower = words.join(" ").toLowerCase();
    for (const banned of ["photon", "ultraviolet catastrophe", "proved", "not a wave"])
      expect(lower).not.toContain(banned);
    const errors = checkVoice(words.join(" "), { context: "prose" }).filter(
      (f) => f.severity === "error",
    );
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
