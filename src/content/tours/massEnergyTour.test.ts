/**
 * The fifteen-minute mass-energy tour (am-tour-15min-mass-energy-nqz1): the real record against the
 * real bindings, entrance, manifests, tapes and Journey IV; each prediction's settled answer against
 * the owner that computes it; and each build rule refusing a copy of the record with one thing broken.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateMe02, evaluateMe03, pulseEnergies } from "../../physics/reference/massEnergy.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { resolveVoiceContext } from "../checks/voice/contexts.ts";
import { checkVoice } from "../checks/voice/index.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { checkTour, loadTour, mathAndPhrasingHits, readingMinutes } from "./tours.ts";

const ROOT = process.cwd();
const ID = "fifteen-minutes-mass-energy";
const loaded = loadTour(ROOT, ID);
const tour = loaded?.tour;
const raw = parseYaml(readFileSync(join(ROOT, "content", "tours", `${ID}.yaml`), "utf8")) as Record<
  string,
  unknown
>;
const instrumentSteps = (tour?.steps ?? []).flatMap((s) => (s.kind === "instrument" ? [s] : []));
const settled = (promptId: string) =>
  instrumentSteps.find((s) => s.promptId === promptId)?.supportedCandidateId;

describe("the mass-energy tour resolves", () => {
  test("every step, from its source, with no problem, within the fifteen-minute budget", () => {
    expect(loaded?.problems).toEqual([]);
    expect(tour?.steps.map((s) => `${s.kind}:${s.id}`)).toEqual([
      "first-encounter:first-encounter",
      "reading:opening",
      "instrument:two-flashes",
      "instrument:toward-low-speed",
      "instrument:sealed-box",
      "reading:conclusion",
      "reading:proposed-test",
      "journey-stage:the-move",
    ]);
    expect(tour?.totalMinutes).toBe(12.5);
    expect(tour?.budgetMinutes).toBe(15);
  });

  test("each reading step's text is its paragraphs' R0 overviews, and each is at or above its honest time", () => {
    const readings = (tour?.steps ?? []).flatMap((s) => (s.kind === "reading" ? [s] : []));
    expect(readings.length).toBeGreaterThan(0);
    for (const s of readings) {
      expect(s.paragraphs.every((p) => p.r0.length > 0)).toBe(true);
      expect(s.minutes).toBeGreaterThanOrEqual(
        readingMinutes([s.purpose, ...s.paragraphs.map((p) => p.r0)].join(" ")),
      );
    }
  });

  test("each prediction offers exactly its prompt's candidates, and the second ME-02 prompt is cited by no step", () => {
    expect(instrumentSteps.map((s) => s.promptId)).toEqual([
      "me-01-predict-tilt-axis",
      "me-02-predict-toward-low-speed",
      "me-03-predict-sealed-box",
    ]);
    for (const s of instrumentSteps) expect(s.choices).toHaveLength(3);
    expect(instrumentSteps.some((s) => s.promptId === "me-02-predict-exact-versus-quadratic")).toBe(
      false,
    );
  });

  test("the move summary is Journey IV's own, by reference, and the record holds no copy of it", () => {
    const move = tour?.steps.find((s) => s.kind === "journey-stage");
    expect(move?.kind === "journey-stage" && move.summary.length > 0).toBe(true);
    const text = readFileSync(join(ROOT, "content", "tours", `${ID}.yaml`), "utf8");
    if (move?.kind === "journey-stage") expect(text).not.toContain(move.summary.slice(0, 40));
  });

  test("nothing the tour shows carries math, a symbol, or a forbidden phrasing", () => {
    const texts = [
      tour?.title ?? "",
      tour?.introduction ?? "",
      tour?.completion ?? "",
      ...(tour?.steps ?? []).flatMap((s) => [
        s.purpose,
        ...(s.kind === "reading" ? s.paragraphs.map((p) => p.r0) : []),
        ...(s.kind === "instrument"
          ? [s.question, ...s.choices.flatMap((c) => [c.text, c.response])]
          : []),
        ...(s.kind === "journey-stage" ? [s.summary] : []),
      ]),
    ];
    expect(texts.filter(Boolean).length).toBeGreaterThan(20);
    expect(texts.flatMap((t) => mathAndPhrasingHits(t))).toEqual([]);
    // The scan sees what it forbids.
    expect(mathAndPhrasingHits("The paper derives \\(E=mc^2\\).").length).toBeGreaterThan(0);
    expect(mathAndPhrasingHits("mass converts into energy")).toContain("\\bconverts?\\b");
    const hits = mathAndPhrasingHits("L/c² in each case");
    expect(hits.includes("L/") && hits.includes("²")).toBe(true);
  });

  test("the tour's words pass the voice lint, and the lint sees a planted error", () => {
    const prose = resolveVoiceContext("argument", "readings.overview[0].text");
    const texts = [
      tour?.introduction ?? "",
      tour?.completion ?? "",
      ...(tour?.steps ?? []).flatMap((s) => [
        s.purpose,
        ...(s.kind === "instrument"
          ? [s.question, ...s.choices.flatMap((c) => [c.text, c.response])]
          : []),
      ]),
    ];
    const errors = texts.flatMap((t) =>
      checkVoice(t, { context: prose }).filter((f) => f.severity === "error"),
    );
    expect(errors.map((e) => `${e.rule}: ${e.matchedText}`)).toEqual([]);
    expect(checkVoice("This clearly proved it.", { context: prose }).length).toBeGreaterThan(0);
  });
});

describe("each prediction's settled answer is what the owner computes", () => {
  test("the two flashes: the traveler's total is the same at every angle", () => {
    const rel = { relative: 1e-12 };
    const at = (phi: number) => {
      const r = pulseEnergies(1, 0.6, phi, "degrees") as {
        pulse1: { value: number };
        pulse2: { value: number };
      };
      return [r.pulse1.value, r.pulse2.value];
    };
    const cases: [number, number, number][] = [
      [0, 0.25, 1.0],
      [60, 0.4375, 0.8125],
      [90, 0.625, 0.625],
    ];
    for (const [phi, one, two] of cases) {
      const [p1, p2] = at(phi);
      expect(withinTolerance(p1 ?? Number.NaN, one, rel).ok).toBe(true);
      expect(withinTolerance(p2 ?? Number.NaN, two, rel).ok).toBe(true);
      expect(withinTolerance((p1 ?? 0) + (p2 ?? 0), 1.25, rel).ok).toBe(true);
    }
    expect(settled("me-01-predict-tilt-axis")).toBe("me-01-candidate-sum-unchanged");
  });

  test("toward low speed: the drop settles on one lost mass, while its share of the energy falls", () => {
    const limit = evaluateMe02({ beta: 0, emittedEnergy: 1 } as never) as {
      limitingCoefficient: { status: string; representation: { value: number } };
    };
    expect(limit.limitingCoefficient.status).toBe("analytic-limit");
    const mass = limit.limitingCoefficient.representation.value;
    const cases: [number, number, number][] = [
      [0.1, 1.00756305, 0.005038],
      [0.01, 1.00007501, 0.00005],
      [0.001, 1.00000075, 0.0000005],
    ];
    for (const [beta, proxyOverLimit, share] of cases) {
      const s = evaluateMe02({ beta, emittedEnergy: 1 } as never) as {
        finiteSpeedProxy: { value: number };
        exactDifference: { value: number };
      };
      expect(
        withinTolerance(s.finiteSpeedProxy.value / mass, proxyOverLimit, { relative: 1e-8 }).ok,
      ).toBe(true);
      expect(withinTolerance(s.exactDifference.value, share, { relative: 1e-3 }).ok).toBe(true);
    }
    expect(settled("me-02-predict-toward-low-speed")).toBe("looks-like-lighter-body");
  });

  test("the sealed box: the combined system's mass is unchanged, while the lamp alone loses mass", () => {
    const at = (boundary: string) =>
      (
        evaluateMe03({
          boundary,
          disposition: "retained",
          cardId: "me-03-sealed-lamp-and-mirror",
          mode: "1905",
        } as never) as { massChange: { value: number } }
      ).massChange.value;
    expect(withinTolerance(at("combined-isolated-system"), 0, { absolute: 1e-30 }).ok).toBe(true);
    expect(at("body-alone")).toBeLessThan(0);
    expect(settled("me-03-predict-sealed-box")).toBe("stays-the-same");
  });
});

describe("each build rule refuses a broken copy by name", () => {
  const broken = (edit: (steps: Record<string, unknown>[]) => void, profile = "scaffold") => {
    const copy = structuredClone(raw);
    edit(copy.steps as Record<string, unknown>[]);
    return checkTour(ROOT, copy, profile).problems;
  };
  const step = (steps: Record<string, unknown>[], id: string) => {
    const s = steps.find((x) => x.id === id);
    if (!s) throw new Error(`no step ${id}`);
    return s;
  };

  test("the unbroken copy has no problem, so each refusal below is the edit's", () => {
    expect(broken(() => {})).toEqual([]);
  });

  test("a choice that is not the prompt's candidate: tour-prediction-candidates-mismatch, naming the expected ids", () => {
    const problems = broken((steps) => {
      const p = step(steps, "toward-low-speed").tourPrediction as {
        choices: { candidateId: string }[];
      };
      const third = p.choices[2];
      if (third) third.candidateId = "gained-a-little-mass";
    });
    expect(
      problems.some(
        (p) =>
          p.startsWith("tour-prediction-candidates-mismatch") &&
          p.includes("looks-like-lighter-body, drops-to-nothing-faster, stays-a-fixed-fraction"),
      ),
    ).toBe(true);
  });

  test("an instrument step citing no registered prompt: tour-instrument-step-missing-prompt", () => {
    const problems = broken((steps) => {
      step(steps, "sealed-box").promptId = "me-03-predict-nothing";
    });
    expect(problems.some((p) => p.startsWith("tour-instrument-step-missing-prompt"))).toBe(true);
  });

  test("a tape that never sets the prompt's control: tour-tape-does-not-reveal-prompt", () => {
    const problems = broken((steps) => {
      const s = step(steps, "toward-low-speed");
      s.promptId = "me-02-predict-exact-versus-quadratic";
      (s.tourPrediction as { promptId: string }).promptId = "me-02-predict-exact-versus-quadratic";
    });
    expect(problems.some((p) => p.startsWith("tour-tape-does-not-reveal-prompt"))).toBe(true);
  });

  test("math in a step: tour-step-math", () => {
    const problems = broken((steps) => {
      step(steps, "opening").purpose = "The famous \\(E=mc^2\\) is not in the paper.";
    });
    expect(problems.some((p) => p.startsWith("tour-step-math"))).toBe(true);
  });

  test("a step estimated below its honest time: tour-step-under-lower-bound", () => {
    const problems = broken((steps) => {
      step(steps, "two-flashes").minutes = 1;
    });
    expect(problems.some((p) => p.startsWith("tour-step-under-lower-bound"))).toBe(true);
  });

  test("steps adding up past the budget: tour-over-budget", () => {
    const problems = broken((steps) => {
      step(steps, "conclusion").minutes = 4;
    });
    expect(problems.some((p) => p.startsWith("tour-over-budget"))).toBe(true);
  });

  test("a draft move summary where the profile shows only a reviewed one: tour-move-summary-missing", () => {
    expect(broken(() => {}, "preview").some((p) => p.startsWith("tour-move-summary-missing"))).toBe(
      true,
    );
  });

  test("a paragraph with no R0 overview: tour-anchor-unresolved", () => {
    const problems = broken((steps) => {
      step(steps, "opening").anchors = ["s0-p99"];
    });
    expect(problems.some((p) => p.startsWith("tour-anchor-unresolved"))).toBe(true);
  });
});
