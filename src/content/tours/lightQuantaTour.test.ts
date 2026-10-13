/**
 * The fifteen-minute light-quanta tour (am-tour-15min-light-quanta-yj70): the real record against
 * the real bindings, entrance, manifests, tape and Journey I.
 *
 * IT DOES NOT REPEAT THE VALIDATOR'S PLANTS. `massEnergyTour.test.ts` already drives eight of them
 * through `checkTour`, and the validator is shared, so a second copy of each would assert the same
 * code path twice and go stale together. What is here is what is specific to THIS record, plus the
 * one plant that proves a documented departure from its bead.
 *
 * THE DEPARTURE, and why it needs its own plant. The bead asks step 6 to use "the §6 paragraph
 * stating the heuristic conclusion", which is s6-p6, and that paragraph's R0 ends on the quantum's
 * size written with a beta. `mathAndPhrasingHits` forbids beta, so the step uses s6-p4 instead,
 * which the bead's own instruction allows: "The fix belongs in the readings bead or a different
 * anchor, never a substitute written in the tour." The last test plants s6-p6 back and shows the
 * refusal, so the reason in the record's header is evidence rather than an assertion, and so the
 * day am-lq-readings-s5-s6-deq6 gives s6-p6 a symbol-free R0 this test goes red and asks to be
 * re-read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVE as LIGHT_QUANTA_MOVE } from "../../discovery/lightQuanta/journeyI.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { checkTour, loadTour, mathAndPhrasingHits, readingMinutes } from "./tours.ts";

const ROOT = process.cwd();
const ID = "fifteen-minutes-light-quanta";
const loaded = loadTour(ROOT, ID);
const tour = loaded?.tour;
const rawText = readFileSync(join(ROOT, "content", "tours", `${ID}.yaml`), "utf8");
const raw = parseYaml(rawText) as Record<string, unknown>;

/** The paper's R0 overviews, read from the bindings the tour is supposed to be showing. */
function r0Of(unit: string): string {
  const bindings = readFileSync(join(ROOT, "content", "bindings", "light-quanta.yaml"), "utf8");
  const match = new RegExp(
    `^\\s*-\\s*unit:\\s*${unit}\\s*\\n(?:.*\\n)*?\\s*r0:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
    "m",
  ).exec(bindings);
  return match?.[1] ?? "";
}

describe("the light-quanta tour resolves", () => {
  test("every step, from its source, with no problem, within the fifteen-minute budget", () => {
    expect(loaded).not.toBeNull();
    expect(loaded?.problems).toEqual([]);
    expect(tour?.steps.length).toBe(8);
    const total = (tour?.steps ?? []).reduce((sum, step) => sum + step.minutes, 0);
    expect(total).toBeLessThanOrEqual(15);
    // A floor as well as a ceiling: a tour that lost its steps would also be under budget.
    expect(total).toBeGreaterThanOrEqual(12);
  });

  test("each reading step shows its paragraphs' own R0, not a copy written here", () => {
    const readings = (tour?.steps ?? []).flatMap((s) => (s.kind === "reading" ? [s] : []));
    expect(readings.length).toBe(3);
    for (const step of readings)
      for (const paragraph of step.paragraphs) {
        const fromBindings = r0Of(paragraph.anchor);
        expect(
          fromBindings.length,
          `${paragraph.anchor} has an R0 in the bindings`,
        ).toBeGreaterThan(0);
        expect(paragraph.r0).toBe(fromBindings);
        // And the record itself must not carry the sentence, or the tour could drift from the paper.
        expect(rawText.includes(fromBindings)).toBe(false);
      }
  });

  test("each reading step is at or above its honest reading time", () => {
    const readings = (tour?.steps ?? []).flatMap((s) => (s.kind === "reading" ? [s] : []));
    for (const step of readings) {
      const bound = readingMinutes([step.purpose, ...step.paragraphs.map((p) => p.r0)].join(" "));
      expect(step.minutes, `${step.id} is budgeted below its reading time`).toBeGreaterThanOrEqual(
        bound,
      );
    }
  });

  test("each prediction offers exactly its prompt's registered candidates", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
    expect(instruments.map((s) => s.promptId)).toEqual([
      "lq-01-predict-phase-shift",
      "lq-05-predict-ten-points",
      "lq-08-predict-double-power",
    ]);
    for (const step of instruments) {
      const manifest = parseYaml(
        readFileSync(join(ROOT, "content", "experiments", `${step.instrumentId}.yaml`), "utf8"),
      ) as { predictMode?: { prompts?: { promptId?: string; candidates?: { id?: string }[] }[] } };
      const prompt = (manifest.predictMode?.prompts ?? []).find(
        (p) => p.promptId === step.promptId,
      );
      const registered = (prompt?.candidates ?? []).map((c) => String(c.id)).sort();
      expect(registered.length, `${step.promptId} registers candidates`).toBeGreaterThan(0);
      expect([...step.choices.map((c) => c.candidateId)].sort()).toEqual(registered);
      for (const choice of step.choices) {
        expect(choice.text.length).toBeGreaterThan(0);
        expect(choice.response.length).toBeGreaterThan(0);
      }
    }
  });

  test("the move summary is Journey I's own, by reference, and the record holds no copy", () => {
    const stage = (tour?.steps ?? []).find((s) => s.kind === "journey-stage");
    expect(stage).toBeDefined();
    if (stage?.kind !== "journey-stage") return;
    expect(stage.summary).toBe(LIGHT_QUANTA_MOVE.r0Summary.text);
    expect(rawText.includes(LIGHT_QUANTA_MOVE.r0Summary.text)).toBe(false);
    // Draft today, and the scaffold profile shows a draft. Recorded so the day it is reviewed is a
    // deliberate change by a named reviewer rather than a silent one.
    expect(LIGHT_QUANTA_MOVE.r0Summary.reviewState).toBe("draft");
  });

  test("nothing the tour shows carries math, a symbol, or a forbidden phrasing", () => {
    const shown: string[] = [
      String(raw.introduction),
      String(raw.completion),
      String(raw.targetClaim),
    ];
    for (const step of tour?.steps ?? []) {
      shown.push(step.title, step.purpose);
      if (step.kind === "reading") shown.push(...step.paragraphs.map((p) => p.r0));
      if (step.kind === "instrument") {
        shown.push(step.question);
        for (const choice of step.choices) shown.push(choice.text, choice.response);
      }
      if (step.kind === "journey-stage") shown.push(step.summary);
    }
    // The population is printed because a loop over an empty list would report nothing wrong.
    expect(shown.length).toBeGreaterThan(30);
    const hits = shown.flatMap((text) => mathAndPhrasingHits(text));
    expect(hits).toEqual([]);
  });

  test("the authored chance is the one independence gives", () => {
    // My own number, checked rather than trusted: ten independent halves multiply to one in 1,024,
    // which every response in that step states. A response saying one in a thousand exactly, or one
    // in 512, would pass every other test in this file.
    expect(2 ** 10).toBe(1024);
    const step = (tour?.steps ?? []).find((s) => s.id === "independence");
    if (step?.kind !== "instrument") throw new Error("the independence step is not an instrument");
    for (const choice of step.choices) expect(choice.response).toContain("1,024");
  });

  test("planted: the paragraph the bead names is refused for its symbol (the documented departure)", () => {
    const edited = parseYaml(rawText) as { steps?: Record<string, unknown>[] };
    const heuristic = (edited.steps ?? []).find((s) => s.id === "heuristic");
    expect(heuristic, "the step this plant edits must exist").toBeDefined();
    if (!heuristic) return;
    heuristic.anchors = ["s6-p6"];
    const { problems } = checkTour(ROOT, edited as Record<string, unknown>);
    // Named, not merely non-empty: the refusal has to be the symbol and not some other breakage.
    expect(problems.some((p) => p.startsWith("tour-step-math:") && p.includes("β"))).toBe(true);
    // The positive control: s6-p4, which the record actually uses, is clean.
    expect(mathAndPhrasingHits(r0Of("s6-p4"))).toEqual([]);
    expect(mathAndPhrasingHits(r0Of("s6-p6")).length).toBeGreaterThan(0);
  });
});
