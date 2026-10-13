/**
 * The fifteen-minute relativity tour (am-tour-15min-relativity-qcxc): the real record against the
 * real bindings, entrance, manifests, presets and Journey III.
 *
 * IT DOES NOT REPEAT THE VALIDATOR'S PLANTS. `massEnergyTour.test.ts` already drives eight of them
 * through `checkTour`, and the validator is shared. What is here is what is specific to THIS
 * record, plus one plant for each of its two documented departures from its bead.
 *
 * DEPARTURE ONE, step 4, and why it needs a plant. The bead's table names SR-03's candidate ids as
 * `still-simultaneous-10-ls`, `still-simultaneous-8-ls` and `not-simultaneous-not-a-length`;
 * sr-03.yaml registers `earlier-trailing`, `still-simultaneous` and `later-trailing` and asks a
 * different question. The bead already records that this step's PROMPT id drifted the same way
 * ("an earlier draft of this tour cited `sr-03-predict-events-pair`, which no manifest registers"),
 * so both plants below show that the bead's trio and its superseded prompt id are refused, which is
 * what forced the record to follow the manifest.
 *
 * DEPARTURE TWO, step 7, and why its plant asserts a GATE GAP rather than a refusal. The bead asks
 * for s4-p6, whose R0 states the lag as "about half of t times (v/V) squared seconds". That breaks
 * the bead's rule that "No step shows a symbol, a fraction bar, or a formula", but
 * `mathAndPhrasingHits` does NOT catch a bare-letter fraction, so planting s4-p6 back produces NO
 * refusal. Asserting a refusal there would be a test that cannot fail for the stated reason, so the
 * plant instead pins the gap itself: the detector passes s4-p6, s4-p6 does carry the fraction, and
 * s4-p7 does not. The day the detector is strengthened, or s4-p6 gets a symbol-free R0, this test
 * goes red and asks to be re-read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVE as RELATIVITY_MOVE } from "../../discovery/relativity/journeyIII.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { checkTour, loadTour, mathAndPhrasingHits, readingMinutes } from "./tours.ts";

const ROOT = process.cwd();
const ID = "fifteen-minutes-special-relativity";
const loaded = loadTour(ROOT, ID);
const tour = loaded?.tour;
const rawText = readFileSync(join(ROOT, "content", "tours", `${ID}.yaml`), "utf8");
const raw = parseYaml(rawText) as Record<string, unknown>;

/** The paper's R0 overviews, read from the bindings the tour is supposed to be showing. */
function r0Of(unit: string): string {
  const bindings = readFileSync(
    join(ROOT, "content", "bindings", "special-relativity.yaml"),
    "utf8",
  );
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

/** Everything this tour puts in front of a reader, for the scans that need a population. */
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

describe("the relativity tour resolves", () => {
  test("every step, from its source, with no problem, at the bead's 14.5 minutes", () => {
    expect(loaded).not.toBeNull();
    expect(loaded?.problems).toEqual([]);
    expect(tour?.steps.length).toBe(9);
    const total = (tour?.steps ?? []).reduce((sum, step) => sum + step.minutes, 0);
    expect(total).toBe(14.5);
    expect(total).toBeLessThanOrEqual(15);
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

  test("the four instrument steps cite the bead's prompts, in its order", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
    expect(instruments.map((s) => s.instrumentId)).toEqual(["sr-01", "sr-03", "sr-06", "sr-09"]);
    expect(instruments.map((s) => s.promptId)).toEqual([
      "sr-01-predict-moving-pair",
      "sr-03-predict-endpoint-pair",
      "sr-06-predict-collinear",
      "sr-09-predict-approaching",
    ]);
  });

  test("each prediction offers exactly its prompt's registered candidates", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
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

  test("the ids of steps 3, 5 and 6 are the ones the bead names literally", () => {
    // Asserted against the manifests rather than against the record, so a record edited to match a
    // drifted manifest would still have to answer to the bead's own three trios.
    const trios: Record<string, string[]> = {
      "sr-01-predict-moving-pair": ["they-agree", "leading-clock-ahead", "trailing-clock-ahead"],
      "sr-06-predict-collinear": ["galilean-sum", "relativistic-15-17", "unchanged-0-6c"],
      "sr-09-predict-approaching": [
        "doubles",
        "classical-approaching-observer",
        "classical-approaching-source",
      ],
    };
    for (const [promptId, expectedIds] of Object.entries(trios)) {
      const instrumentId = promptId.slice(0, 5);
      const prompt = (manifestOf(instrumentId).predictMode?.prompts ?? []).find(
        (p) => p.promptId === promptId,
      );
      expect((prompt?.candidates ?? []).map((c) => String(c.id)).sort()).toEqual(
        [...expectedIds].sort(),
      );
    }
  });

  test("each cited preset commands its prompt's control", () => {
    const instruments = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
    const cited = instruments.map((s) => s.reveal.id);
    expect(cited).toEqual([
      "sr-01-moving-pair-0.6c",
      "sr-03-boost-0.6c",
      "sr-06-collinear-0.6-0.6",
      "sr-09-approaching-0.6",
    ]);
    for (const step of instruments) {
      const manifest = manifestOf(step.instrumentId);
      const prompt = (manifest.predictMode?.prompts ?? []).find(
        (p) => p.promptId === step.promptId,
      );
      const preset = (manifest.presets ?? []).find((p) => p.presetId === step.reveal.id);
      expect(preset, `${step.reveal.id} is registered by ${step.instrumentId}`).toBeDefined();
      const control = String(prompt?.controlId ?? "");
      expect(control.length).toBeGreaterThan(0);
      expect(
        Object.keys(preset?.parameterValues ?? {}),
        `${step.reveal.id} must set ${control}`,
      ).toContain(control);
    }
  });

  test("the move summary is Journey III's own, by reference, and the record holds no copy", () => {
    const stage = (tour?.steps ?? []).find((s) => s.kind === "journey-stage");
    expect(stage).toBeDefined();
    if (stage?.kind !== "journey-stage") return;
    expect(stage.summary).toBe(RELATIVITY_MOVE.r0Summary.text);
    expect(rawText.includes(RELATIVITY_MOVE.r0Summary.text)).toBe(false);
    // Draft today, and the scaffold profile shows a draft. Recorded so the day it is reviewed is a
    // deliberate change by a named reviewer rather than a silent one.
    expect(RELATIVITY_MOVE.r0Summary.reviewState).toBe("draft");
  });

  test("nothing the tour shows carries math, a symbol, or a forbidden phrasing", () => {
    const shown = shownStrings();
    // The population is printed because a loop over an empty list would report nothing wrong.
    expect(shown.length).toBeGreaterThan(40);
    expect(shown.flatMap((text) => mathAndPhrasingHits(text))).toEqual([]);
  });

  test("none of the anachronisms and overclaims this bead forbids appear", () => {
    const shown = shownStrings().join("\n");
    const forbidden = [
      "illusion",
      "Michelson",
      "embankment",
      "lightning",
      "spacetime",
      "disproved",
      "proved",
      "the same thing",
      "the older answer",
      "ether theory's answer",
    ];
    for (const phrase of forbidden)
      expect(shown.toLowerCase().includes(phrase.toLowerCase()), `forbidden: ${phrase}`).toBe(
        false,
      );
    expect(/\btrain\b/i.test(shown), "the train-and-embankment picture").toBe(false);
    // A positive control, so an empty or mis-joined population cannot read as clean.
    expect(`${shown} illusion`.toLowerCase().includes("illusion")).toBe(true);
  });

  test("the arithmetic the responses state, checked rather than trusted", () => {
    // Step 5 says "fifteen seventeenths" and "about 0.88"; both must be the same number.
    expect(15 / 17).toBeCloseTo(0.8823529, 7);
    const speeds = (tour?.steps ?? []).find((s) => s.id === "adding-speeds");
    if (speeds?.kind !== "instrument")
      throw new Error("the adding-speeds step is not an instrument");
    const supported = speeds.choices.find((c) => c.candidateId === "relativistic-15-17");
    expect(supported?.response).toContain("fifteen seventeenths");
    // Step 6's two medium answers and the claim that the paper's factor is their geometric mean.
    const beta = 0.6;
    const observerMoves = 1 + beta;
    const sourceMoves = 1 / (1 - beta);
    expect(observerMoves).toBeCloseTo(1.6, 10);
    expect(sourceMoves).toBeCloseTo(2.5, 10);
    expect(Math.sqrt(observerMoves * sourceMoves)).toBeCloseTo(2, 10);
    const doppler = (tour?.steps ?? []).find((s) => s.id === "moving-toward-the-source");
    if (doppler?.kind !== "instrument") throw new Error("the doppler step is not an instrument");
    expect(doppler.choices.find((c) => c.candidateId === "doubles")?.response).toContain(
      "geometric mean",
    );
    expect(
      doppler.choices.find((c) => c.candidateId === "classical-approaching-observer")?.text,
    ).toContain("1.6");
    expect(
      doppler.choices.find((c) => c.candidateId === "classical-approaching-source")?.text,
    ).toContain("2.5");
  });

  test("the equator-clock remark the bead forbids here is not shown", () => {
    const anchors = (tour?.steps ?? []).flatMap((s) =>
      s.kind === "reading" ? s.paragraphs.map((p) => p.anchor) : [],
    );
    expect(anchors).not.toContain("s4-p8");
    // The positive control: that paragraph exists and is the equator remark, so the exclusion is
    // about this paragraph rather than about a name that resolves to nothing.
    expect(r0Of("s4-p8")).toContain("equator");
  });

  test("planted: the bead's superseded SR-03 candidate ids are refused", () => {
    const edited = parseYaml(rawText) as { steps?: Record<string, unknown>[] };
    const step = (edited.steps ?? []).find((s) => s.id === "marking-both-ends");
    expect(step, "the step this plant edits must exist").toBeDefined();
    if (!step) return;
    const prediction = step.tourPrediction as { choices?: Record<string, unknown>[] };
    const planted = [
      "still-simultaneous-10-ls",
      "still-simultaneous-8-ls",
      "not-simultaneous-not-a-length",
    ];
    (prediction.choices ?? []).forEach((choice, index) => {
      choice.candidateId = planted[index];
    });
    // What actually landed, printed before the verdict is read.
    expect((prediction.choices ?? []).map((c) => c.candidateId)).toEqual(planted);
    const { problems } = checkTour(ROOT, edited as Record<string, unknown>);
    const mismatch = problems.filter((p) => p.startsWith("tour-prediction-candidates-mismatch:"));
    expect(mismatch.length).toBeGreaterThan(0);
    // Named, not merely non-empty: the refusal must list the manifest's own three.
    expect(mismatch.some((p) => p.includes("earlier-trailing"))).toBe(true);
    expect(mismatch.some((p) => p.includes("still-simultaneous-10-ls"))).toBe(true);
  });

  test("planted: the bead's superseded SR-03 prompt id is refused, with the id named", () => {
    const edited = parseYaml(rawText) as { steps?: Record<string, unknown>[] };
    const step = (edited.steps ?? []).find((s) => s.id === "marking-both-ends");
    if (!step) throw new Error("the step this plant edits must exist");
    step.promptId = "sr-03-predict-events-pair";
    (step.tourPrediction as Record<string, unknown>).promptId = "sr-03-predict-events-pair";
    expect(step.promptId).toBe("sr-03-predict-events-pair");
    const { problems } = checkTour(ROOT, edited as Record<string, unknown>);
    expect(
      problems.some(
        (p) =>
          p.startsWith("tour-instrument-step-missing-prompt:") &&
          p.includes("sr-03-predict-events-pair"),
      ),
    ).toBe(true);
  });

  test("planted: the §4 paragraph the bead names is refused for its fraction bar", () => {
    // This test ASSERTED A PASS until the detector was completed, because `mathAndPhrasingHits`
    // only caught the hard-coded `L/` and let `(v/V) squared` through. The gap is closed, so the
    // plant now shows a refusal, and the departure documented in the record's header is enforced
    // rather than merely described. The three facts the header asserts are pinned either way.
    const named = r0Of("s4-p6");
    const used = r0Of("s4-p7");
    expect(named.length).toBeGreaterThan(0);
    expect(used.length).toBeGreaterThan(0);
    expect(named).toContain("(v/V)");
    expect(used).not.toContain("/");
    expect(mathAndPhrasingHits(named)).toContain("v/V");
    // The positive control: the paragraph the record actually uses is clean.
    expect(mathAndPhrasingHits(used)).toEqual([]);
    const edited = parseYaml(rawText) as { steps?: Record<string, unknown>[] };
    const step = (edited.steps ?? []).find((s) => s.id === "clock-carried");
    if (!step) throw new Error("the step this plant edits must exist");
    step.anchors = ["s4-p6"];
    expect(step.anchors).toEqual(["s4-p6"]);
    const { problems } = checkTour(ROOT, edited as Record<string, unknown>);
    // Named, not merely non-empty: the refusal has to be the fraction and not some other breakage.
    expect(problems.some((p) => p.startsWith("tour-step-math:") && p.includes("v/V"))).toBe(true);
  });
});
