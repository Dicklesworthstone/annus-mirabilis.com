import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../../content/checks/voice/index.ts";
import {
  FORK_SOURCE_SPEED,
  FORK_UNDETECTED_ETHER,
  PPE_TASK,
  WORLD_CHECK,
} from "../../../discovery/relativity/journeyIII.ts";
import { SR05_PRESETS } from "../../../experiments/sr05/definition.ts";
import RelativityEncounter from "./page";

/**
 * /discover/special-relativity/: the numeric exercise in step 06 (am-disc-exercise-checker-i4h2),
 * and the forks, check against the world, exercises and doors of dispatch 260.
 */
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

  test("the clock comes first, as an expression, with its ranges stated", () => {
    const step = stepSix();
    const clock = step.indexOf('data-exercise-part="sr-moving-clock-reading"');
    expect(clock).toBeGreaterThan(step.indexOf("What the moving clock reading means"));
    expect(clock).toBeLessThan(step.indexOf('data-exercise-part="sr-moving-rod-length"'));
    const part = text(step.slice(clock, step.indexOf('data-exercise-part="sr-moving-rod-length"')));
    expect(part).toContain("Write it using t, v and c, the speed of light.");
    // Stripped without inserting spaces, as a reader reads it: the ranges line is one run of text.
    const joined = step.slice(clock).replace(/<[^>]+>/g, "");
    expect(joined).toContain("Answers are compared for t from 1 to 100, v from");
    expect(part).toContain("The paper writes V for the speed of light");
    const errors = checkVoice(part, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
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

describe("the forks on the 1904 table", () => {
  const at = (marker: string) => {
    const i = html.indexOf(marker);
    expect(i, marker).toBeGreaterThan(-1);
    return i;
  };
  const forkAt = (id: string) => {
    const start = at(`id="${id}"`);
    return html.slice(start, html.indexOf("</section>", start));
  };

  test("the server render carries two forks or more, each a Fork element", () => {
    const forks = [...html.matchAll(/data-fork-id="([^"]+)"/g)].map((m) => m[1]);
    expect(forks.length).toBeGreaterThanOrEqual(2);
    expect(forks).toEqual([FORK_UNDETECTED_ETHER.id, FORK_SOURCE_SPEED.id]);
  });

  test("the ether fork follows the null results, and the source fork the two statements", () => {
    const order = [
      'id="step-02"',
      `id="${FORK_UNDETECTED_ETHER.id}"`,
      'id="step-03"',
      `id="${FORK_SOURCE_SPEED.id}"`,
      'id="step-04"',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the ether at rest fails against Michelson and Morley's card, linked", () => {
    const fork = forkAt(FORK_UNDETECTED_ETHER.id);
    expect(fork).toContain('data-outcome-type="dead-end-on-constraint"');
    expect(fork).toContain('href="#card-michelson-morley-1887-no-drift"');
    expect(fork).toContain('data-outcome-type="empirically-equivalent-not-refuted"');
    expect(fork).toContain('href="#card-lorentz-1904-corresponding-states"');
    expect(fork).toContain('data-outcome-type="papers-route"');
  });

  test("the emission view stays open on the shelf, and de Sitter's 1913 card is later evidence", () => {
    const fork = forkAt(FORK_SOURCE_SPEED.id);
    expect(fork).toContain('data-outcome-type="undecided-on-available-evidence"');
    expect(fork).not.toContain('data-outcome-type="dead-end-on-constraint"');
    expect(fork).toContain('href="#card-de-sitter-1913-double-stars"');
    const shelf = html.slice(at('id="shelf"'));
    const shelfEnd = shelf.indexOf("</section>");
    expect(shelf.slice(0, shelfEnd)).not.toContain("de-sitter");
    expect(html).toContain('id="card-de-sitter-1913-double-stars"');
  });

  test("every in-page link lands on an element of the page", () => {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(targets.length).toBeGreaterThan(3);
    expect(targets.filter((target) => !ids.has(target))).toEqual([]);
  });

  test("the forks' words pass the voice lint", () => {
    const words = [FORK_UNDETECTED_ETHER, FORK_SOURCE_SPEED]
      .flatMap((f) => [
        f.question,
        ...f.branches.flatMap((b) => [
          b.label,
          b.hypothesis,
          b.worksWhen,
          b.outcome.plainLanguage,
          b.outcome.scopeNote ?? "",
          b.outcome.insufficiency ?? "",
          ...b.steps.map((s) => s.text),
        ]),
      ])
      .join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

describe("step 08 checks a moving clock against the world", () => {
  const at = (marker: string) => {
    const i = html.indexOf(marker);
    expect(i, marker).toBeGreaterThan(-1);
    return i;
  };

  test("live from SR-05's snapshot, with Ives and Stilwell later and off the shelf", () => {
    const step = html.slice(at('id="step-08"'), at('id="shelf"'));
    expect(step).toContain('data-world-check-id="sr-world-check-moving-clock"');
    expect(step).toContain('data-instrument-id="sr-05"');
    expect(step).toContain('data-world-check-quantity="properTime"');
    expect(step).toContain('id="card-ives-stilwell-1938-moving-atomic-clock"');
    // Every later card renders once, beside the check, and none sits on the shelf.
    for (const id of ["ives-stilwell-1938-moving-atomic-clock", "de-sitter-1913-double-stars"])
      expect(html.match(new RegExp(`id="card-${id}"`, "g"))?.length).toBe(1);
    const shelf = html.slice(at('id="shelf"'));
    const onShelf = shelf.slice(0, shelf.indexOf("</section>"));
    // Anchored on the card ids: a bare "ives" matches ordinary words on the shelf.
    expect(onShelf).not.toMatch(/card-ives-stilwell|card-de-sitter/);
    expect(onShelf).toContain('id="card-lorentz-1904-corresponding-states"');
  });

  test("the check's words pass the voice lint", () => {
    const step = html.slice(at('id="step-08"'), at('data-instrument-id="sr-05"'));
    const said = /data-world-check-later-measurement[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(said.length).toBeGreaterThan(0);
    const words = [WORLD_CHECK.claim, text(step), text(said)].join(" ");
    const errors = checkVoice(words, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});

describe("step 09: pieces to work by hand, then predict, perturb and explain", () => {
  const stepNine = () => {
    const start = html.indexOf('<section id="step-09"');
    expect(start).toBeGreaterThan(html.indexOf('<section id="step-08"'));
    expect(html.indexOf('<section id="shelf"')).toBeGreaterThan(start);
    return html.slice(start, html.indexOf('<section id="shelf"'));
  };

  test("two expressions, a number, an explanation, the task, and its explanation, in that order", () => {
    const step = stepNine();
    const order = [
      'data-exercise-part="sr-composed-speed"',
      'data-exercise-part="sr-clock-speed-from-readings"',
      'data-exercise-part="sr-light-clock-path"',
      'data-exercise-part="sr-neither-observer-wrong"',
      `data-ppe-task-id="${PPE_TASK.promptId}"`,
      'data-exercise-part="sr-ppe-two-paths-one-reading"',
    ].map((marker) => {
      const i = step.indexOf(marker);
      expect(i, marker).toBeGreaterThan(-1);
      return i;
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(PPE_TASK.promptId).toBe("ppe-special-relativity-s4");
  });

  test("the task names only buttons the laboratory at step 08 renders, and links there", () => {
    const eight = html.slice(
      html.indexOf('<section id="step-08"'),
      html.indexOf('<section id="step-09"'),
    );
    for (const id of ["sr-05-out-and-back-0.6c", "sr-05-circle-0.6c", "sr-05-low-speed-1e-4"]) {
      expect(eight).toContain(`data-preset-id="${id}"`);
      expect(PPE_TASK.perturbPrompt).toContain(`“${SR05_PRESETS[id]?.label}”`);
    }
    // A renamed preset would print its id instead of a label a reader can find.
    expect(PPE_TASK.perturbPrompt).not.toContain("sr-05-");
    expect(stepNine()).toContain('href="#step-08"');
  });

  test("the task's words pass the voice lint", () => {
    const words = [PPE_TASK.task, PPE_TASK.perturbPrompt, PPE_TASK.explainPrompt, text(stepNine())];
    const errors = checkVoice(words.join(" "), { context: "prose" }).filter(
      (f) => f.severity === "error",
    );
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
