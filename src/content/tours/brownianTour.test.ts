/**
 * The fifteen-minute Brownian tour (am-tour-15min-brownian-z034): the real record against the real
 * bindings, entrance, manifests, teaching tape and Journey II. This is the fourth and last of the
 * four, so a census test below asserts that every paper now has one.
 *
 * IT DOES NOT REPEAT THE VALIDATOR'S PLANTS. `massEnergyTour.test.ts` already drives eight of them
 * through `checkTour`, and the validator is shared. What is here is what is specific to THIS
 * record: its own numbers, the two anchor choices its header documents, and the word scans its bead
 * asks for by name.
 *
 * WHY ITS NUMBERS ARE CHECKED AGAINST THE OWNER AND NOT AGAINST THE MANIFEST'S PROSE. Step 5's
 * three responses say "about seven tenths", "about 68 in 100" and "about twice the typical
 * distance". Those are plain-words roundings of 0.6744898, 0.682689492137 and 0.954499736104, and
 * the test recomputes each from `intervalProbability` rather than comparing one piece of authored
 * prose with another, which would only prove that two files agree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVE as BROWNIAN_MOVE } from "../../discovery/brownian/journeyII.ts";
import { intervalProbability } from "../../physics/reference/diffusion.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { checkTour, loadTour, mathAndPhrasingHits, readingMinutes, tourIds } from "./tours.ts";

const ROOT = process.cwd();
const ID = "fifteen-minutes-brownian-motion";
const loaded = loadTour(ROOT, ID);
const tour = loaded?.tour;
const rawText = readFileSync(join(ROOT, "content", "tours", `${ID}.yaml`), "utf8");
const raw = parseYaml(rawText) as Record<string, unknown>;

function r0Of(unit: string): string {
  const bindings = readFileSync(join(ROOT, "content", "bindings", "brownian-motion.yaml"), "utf8");
  const match = new RegExp(
    `^\\s*-\\s*unit:\\s*${unit}\\s*\\n(?:.*\\n)*?\\s*r0:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
    "m",
  ).exec(bindings);
  return match?.[1] ?? "";
}

type Manifest = {
  presets?: { presetId?: string; parameterValues?: Record<string, unknown> }[];
  predictMode?: {
    prompts?: { promptId?: string; controlId?: string; candidates?: { id?: string }[] }[];
  };
};
function manifestOf(instrumentId: string): Manifest {
  return parseYaml(
    readFileSync(join(ROOT, "content", "experiments", `${instrumentId}.yaml`), "utf8"),
  ) as Manifest;
}

function shownStrings(): string[] {
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
  return shown;
}

describe("the Brownian tour resolves", () => {
  test("every step, from its source, with no problem, at the bead's 14.5 minutes", () => {
    expect(loaded).not.toBeNull();
    expect(loaded?.problems).toEqual([]);
    expect(tour?.steps.length).toBe(7);
    const total = (tour?.steps ?? []).reduce((sum, step) => sum + step.minutes, 0);
    expect(total).toBe(14.5);
    expect(total).toBeLessThanOrEqual(15);
  });

  test("all four papers now have a fifteen-minute tour, each resolving", () => {
    // This record was the last of the four. Asserted by IDENTITY, one per paper, so it states the
    // historical fact rather than a count that the next tour would break.
    const ids = tourIds(ROOT);
    for (const paper of [
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "special-relativity",
    ] as const) {
      const id = `fifteen-minutes-${paper}`;
      expect(ids, `${paper} has a fifteen-minute tour record`).toContain(id);
      const other = loadTour(ROOT, id);
      expect(other?.problems, `${id} resolves`).toEqual([]);
      expect(other?.tour.paper).toBe(paper);
    }
  });

  test("each reading step shows its paragraphs' own R0, not a copy written here", () => {
    const readings = (tour?.steps ?? []).flatMap((s) => (s.kind === "reading" ? [s] : []));
    expect(readings.length).toBe(2);
    for (const step of readings)
      for (const paragraph of step.paragraphs) {
        const fromBindings = r0Of(paragraph.anchor);
        expect(fromBindings.length, `${paragraph.anchor} has an R0`).toBeGreaterThan(0);
        expect(paragraph.r0).toBe(fromBindings);
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
    expect(instruments.map((s) => s.instrumentId)).toEqual(["bm-01", "bm-05", "bm-06"]);
    expect(instruments.map((s) => s.promptId)).toEqual([
      "bm-01-predict-observation-interval",
      "bm-05-predict-step-shape",
      "bm-06-predict-within-one-typical-distance",
    ]);
    for (const step of instruments) {
      const prompt = (manifestOf(step.instrumentId).predictMode?.prompts ?? []).find(
        (p) => p.promptId === step.promptId,
      );
      const registered = (prompt?.candidates ?? []).map((c) => String(c.id)).sort();
      expect(registered.length, `${step.promptId} registers candidates`).toBe(3);
      expect([...step.choices.map((c) => c.candidateId)].sort()).toEqual(registered);
      for (const choice of step.choices) {
        expect(choice.text.length).toBeGreaterThan(0);
        expect(choice.response.length).toBeGreaterThan(0);
      }
    }
  });

  test("the bm-06 prompt this tour waited for is registered, not exempt", () => {
    // The whole reason this record could not be written until 2026-10-13. Asserted directly so the
    // day anyone re-exempts bm-06 this tour's own test says why it broke.
    const mode = manifestOf("bm-06").predictMode as { exempt?: boolean; prompts?: unknown[] };
    expect(mode.exempt).toBeUndefined();
    expect((mode.prompts ?? []).length).toBeGreaterThan(0);
  });

  test("each cited preset or tape commands its prompt's control", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
    expect(instruments.map((s) => `${s.reveal.kind}:${s.reveal.id}`)).toEqual([
      "preset:bm-01-radius-probe",
      "tape:coin-to-bell",
      "preset:bm-06-modern-one-second",
    ]);
    for (const step of instruments) {
      const manifest = manifestOf(step.instrumentId);
      const prompt = (manifest.predictMode?.prompts ?? []).find(
        (p) => p.promptId === step.promptId,
      );
      const control = String(prompt?.controlId ?? "");
      expect(control.length, `${step.promptId} targets a control`).toBeGreaterThan(0);
      if (step.reveal.kind === "preset") {
        const preset = (manifest.presets ?? []).find((p) => p.presetId === step.reveal.id);
        expect(Object.keys(preset?.parameterValues ?? {})).toContain(control);
      } else {
        const tape = readFileSync(
          join(ROOT, "content", "experiments", "tapes", `${step.reveal.id}.yaml`),
          "utf8",
        );
        expect(tape).toContain(`parameterId: ${control}`);
        expect(tape).toContain(`experimentId: ${step.instrumentId}`);
      }
    }
  });

  test("the velocity-trap preset is deliberately not the one cited", () => {
    // The record's header says why: the tour renders the cited preset's label, and this bead
    // forbids putting a speed or velocity of the particles in front of the reader.
    const step = (tour?.steps ?? []).find((s) => s.id === "how-fast-it-spreads");
    if (step?.kind !== "instrument") throw new Error("the bm-01 step is not an instrument");
    expect(step.reveal.id).not.toBe("bm-01-velocity-trap");
    // The positive control: that preset exists and does set this prompt's control, so the choice
    // was between two valid options rather than forced.
    const manifest = manifestOf("bm-01");
    const trap = (manifest.presets ?? []).find((p) => p.presetId === "bm-01-velocity-trap");
    expect(trap, "bm-01-velocity-trap exists").toBeDefined();
    expect(Object.keys(trap?.parameterValues ?? {})).toContain("interval");
    expect(String(trap?.parameterValues?.interval)).not.toBe(
      String(
        (manifest.presets ?? []).find((p) => p.presetId === "bm-01-radius-probe")?.parameterValues
          ?.interval,
      ),
    );
  });

  test("the move summary is Journey II's own, by reference, and the record holds no copy", () => {
    const stage = (tour?.steps ?? []).find((s) => s.kind === "journey-stage");
    expect(stage).toBeDefined();
    if (stage?.kind !== "journey-stage") return;
    expect(stage.summary).toBe(BROWNIAN_MOVE.r0Summary.text);
    expect(rawText.includes(BROWNIAN_MOVE.r0Summary.text)).toBe(false);
    expect(BROWNIAN_MOVE.r0Summary.reviewState).toBe("draft");
  });

  test("nothing the tour shows carries math, a symbol, or a forbidden phrasing", () => {
    const shown = shownStrings();
    expect(shown.length).toBeGreaterThan(35);
    expect(shown.flatMap((text) => mathAndPhrasingHits(text))).toEqual([]);
  });

  test("the bead's own Truth-at-R0 clauses hold over the visitor-facing text", () => {
    const shown = shownStrings().join("\n");
    // "Spread, not velocity": no step may give the particles a speed or a velocity. The word
    // "fast" survives only where it qualifies the SPREADING, which the next assertion pins.
    expect(/\bvelocit/i.test(shown), "no velocity of the particles").toBe(false);
    expect(/\bspeeds?\b/i.test(shown), "no speed of the particles").toBe(false);
    for (const match of shown.matchAll(/[^.]*\bfast\b[^.]*/gi))
      expect(match[0], "every 'fast' qualifies the spreading").toMatch(/spread/i);
    // Nothing claims the tour or the paper settled whether molecules exist.
    expect(/\bprove[dns]?\b/i.test(shown)).toBe(false);
    expect(/molecules exist/i.test(shown)).toBe(true); // it is mentioned, and only to be disclaimed
    for (const match of shown.matchAll(/[^.]*molecules exist[^.]*/gi))
      expect(match[0]).toMatch(/nothing|never|open|not\b/i);
    // "Count the molecules" always comes with what it needs.
    for (const match of shown.matchAll(/[^.]*\bcount(?:ing)? the molecules\b[^.]*/gi))
      expect(match[0], "counting the molecules names its inputs").toMatch(/temperature/i);
    // A positive control, so a mis-joined population cannot read as clean.
    expect(`${shown} velocity`.match(/\bvelocit/i)).not.toBeNull();
  });

  test("step 5's three roundings are the numbers the owner computes", () => {
    const step = (tour?.steps ?? []).find((s) => s.id === "how-many-are-close");
    if (step?.kind !== "instrument") throw new Error("the bm-06 step is not an instrument");
    const preset = (manifestOf("bm-06").presets ?? []).find(
      (p) => p.presetId === "bm-06-modern-one-second",
    );
    const v = (preset?.parameterValues ?? {}) as Record<string, number>;
    const t = v.t as number;
    const lambda = v.upper as number;
    // D consistent with the preset's own stored interval, so the two precisions do not mix.
    const D = (lambda * lambda) / (2 * t);
    const val = (e: { result: { status: string; value?: number | Float64Array } }): number => {
      expect(e.result.status).toBe("value");
      return e.result.value as number;
    };
    const share = val(intervalProbability(-lambda, lambda, t, D));
    // "About 68 in 100", the supported response.
    expect(Math.round(share * 100)).toBe(68);
    expect(step.choices.find((c) => c.candidateId === "about-two-in-three")?.response).toContain(
      "68 in 100",
    );
    // "About seven tenths of the typical distance" is where the half share is reached.
    const half = 0.6744898 * lambda;
    expect(val(intervalProbability(-half, half, t, D))).toBeCloseTo(0.5, 6);
    expect(Math.round((half / lambda) * 10) / 10).toBe(0.7);
    expect(step.choices.find((c) => c.candidateId === "about-half")?.response).toContain(
      "seven tenths",
    );
    // "About twice the typical distance" is where 95 in 100 is reached.
    expect(Math.round(val(intervalProbability(-2 * lambda, 2 * lambda, t, D)) * 100)).toBe(95);
    expect(step.choices.find((c) => c.candidateId === "about-95-in-100")?.response).toContain(
      "twice the typical distance",
    );
  });

  test("planted: the paragraphs this tour must avoid are the ones it avoids", () => {
    // The four RT/N paragraphs the completed detector now refuses, and §5's own two problem cases.
    // Asserted so the header's reasons are evidence rather than assertions.
    for (const unit of ["s1-p3", "s2-p1", "s2-p7", "s3-p8"]) {
      expect(r0Of(unit).length, `${unit} has an R0`).toBeGreaterThan(0);
      expect(mathAndPhrasingHits(r0Of(unit)), `${unit} carries RT/N`).toContain("RT/N");
    }
    // s5-p2 is refused by the detector for its superscripts.
    expect(mathAndPhrasingHits(r0Of("s5-p2")).length).toBeGreaterThan(0);
    // s5-p1 is NOT refused: it names four symbols and no fraction, so the detector passes it and
    // the record's header is what keeps it out. This asserts the gap rather than a refusal.
    expect(mathAndPhrasingHits(r0Of("s5-p1"))).toEqual([]);
    expect(r0Of("s5-p1")).toMatch(/λx/);
    // The positive control: the paragraphs the record does use are clean.
    for (const unit of ["s0-p1", "s0-p2", "s5-p3", "s5-p4"])
      expect(mathAndPhrasingHits(r0Of(unit)), `${unit} is clean`).toEqual([]);
    // And planting one of the four into this record is refused, naming the token.
    const edited = parseYaml(rawText) as { steps?: Record<string, unknown>[] };
    const step = (edited.steps ?? []).find((s) => s.id === "counting-the-molecules");
    if (!step) throw new Error("the step this plant edits must exist");
    step.anchors = ["s2-p1"];
    expect(step.anchors).toEqual(["s2-p1"]);
    const { problems } = checkTour(ROOT, edited as Record<string, unknown>);
    expect(problems.some((p) => p.startsWith("tour-step-math:") && p.includes("RT/N"))).toBe(true);
  });
});
