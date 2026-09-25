import { describe, expect, test } from "bun:test";
import { BM08_DEFAULTS } from "../experiments/bm08/definition.ts";
import { validateBm08Parameters } from "../experiments/bm08/parameters.ts";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { validateLq06Parameters } from "../experiments/lq06/parameters.ts";
import { LQ08_DEFAULTS } from "../experiments/lq08/definition.ts";
import { validateLq08Parameters } from "../experiments/lq08/parameters.ts";
import { ME02_DEFAULTS } from "../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../experiments/me02/parameters.ts";
import { ME03_DEFAULTS } from "../experiments/me03/definition.ts";
import { validateMe03Parameters } from "../experiments/me03/parameters.ts";
import { refusalSentence } from "../experiments/results/refusalSentence.ts";
import { SR01_DEFAULTS } from "../experiments/sr01/definition.ts";
import { validateSr01Parameters } from "../experiments/sr01/parameters.ts";
import { SR02_DEFAULTS } from "../experiments/sr02/definition.ts";
import { validateSr02Parameters } from "../experiments/sr02/parameters.ts";
import { SR04_DEFAULTS } from "../experiments/sr04/definition.ts";
import { validateSr04Parameters } from "../experiments/sr04/parameters.ts";
import { SR08_DEFAULTS } from "../experiments/sr08/definition.ts";
import { validateSr08Parameters } from "../experiments/sr08/parameters.ts";
import { SR09_DEFAULTS } from "../experiments/sr09/definition.ts";
import { validateSr09Parameters } from "../experiments/sr09/parameters.ts";
import { SR10_DEFAULTS } from "../experiments/sr10/definition.ts";
import { validateSr10Parameters } from "../experiments/sr10/parameters.ts";
import { SR11_DEFAULTS } from "../experiments/sr11/definition.ts";
import { validateSr11Parameters } from "../experiments/sr11/parameters.ts";
import { SR12_DEFAULTS } from "../experiments/sr12/definition.ts";
import { validateSr12Parameters } from "../experiments/sr12/parameters.ts";
import { SR13_DEFAULTS } from "../experiments/sr13/definition.ts";
import { validateSr13Parameters } from "../experiments/sr13/parameters.ts";

/**
 * A value a reader can type into these labs used to be refused with the invalid-parameter code's
 * registered message alone, "These inputs do not meet the calculation's stated requirements.",
 * which names neither the input nor the range. Each case below is one such typed value; the reader
 * must now be told what to enter, and the refusal code is unchanged.
 */
const GENERIC = "These inputs do not meet the calculation's stated requirements.";
type Check = { kind: string; refusal?: { code: string; message: string; details?: unknown } };
/**
 * The fourth entry is the refusal code, invalid-parameter unless given. A value outside a range the
 * manifest declares is refused by withinDeclaredDomain as outside-model-domain, with the range in
 * words (dispatch 165); SR-09's frequency 0 is one since its lab took that check.
 */
const CASES: readonly (readonly [string, () => Check, string, string?])[] = [
  [
    "me-02 emitted energy 0",
    () => validateMe02Parameters({ ...ME02_DEFAULTS, emittedEnergy: 0 }),
    "energy",
  ],
  [
    "sr-02 conductor length 0",
    () => validateSr02Parameters({ ...SR02_DEFAULTS, segmentLength: 0 }),
    "length",
  ],
  [
    "sr-08 frame speed c",
    () => validateSr08Parameters({ ...SR08_DEFAULTS, boost: 299792458 }),
    "speed of light",
  ],
  [
    "sr-09 frequency 0",
    () => validateSr09Parameters({ ...SR09_DEFAULTS, frequencyTHz: 0 }),
    "frequency",
    "outside-model-domain",
  ],
  [
    "sr-10 initial energy -1",
    () => validateSr10Parameters({ ...SR10_DEFAULTS, initialEnergyJ: -1 }),
    "energy",
  ],
  [
    "sr-11 incidence 200 deg",
    () => validateSr11Parameters({ ...SR11_DEFAULTS, incidentAngleDeg: 200 }),
    "180°",
  ],
  [
    "sr-12 carrier at c",
    () => validateSr12Parameters({ ...SR12_DEFAULTS, carrierVelocityX: 299792458 }),
    "speed of light",
  ],
  [
    "sr-13 initial speed 1",
    () => validateSr13Parameters({ ...SR13_DEFAULTS, initialSpeed: 1 }),
    "speed of light",
  ],
];

describe("a typed value outside a lab's range is refused with a sentence that says what to enter", () => {
  for (const [label, run, names, code = "invalid-parameter"] of CASES) {
    test(label, () => {
      const checked = run();
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused" || !checked.refusal) return;
      expect(checked.refusal.code).toBe(code);
      const sentence = refusalSentence(checked.refusal as Parameters<typeof refusalSentence>[0]);
      expect(sentence).not.toBe(GENERIC);
      expect(sentence.startsWith("Enter")).toBe(true);
      expect(sentence).toContain(names);
    });
  }

  test("refusalSentence falls back to the registered message when no requirement was given", () => {
    expect(refusalSentence({ message: GENERIC })).toBe(GENERIC);
    expect(refusalSentence({ message: GENERIC, details: { requirements: "   " } })).toBe(GENERIC);
  });
});

/**
 * SR-01 gave a requirement sentence, but it named the code's parameter ids ("stationSeparationLs
 * must be a finite, positive number of light-seconds."), and the lab showed it verbatim. Every
 * refusal a reader can reach by typing must name the control as the page does and say what to
 * enter. A camel-case identifier in the sentence is the tell.
 */
// Two lowercase letters before the capital, so a unit such as "eV" is not taken for an id.
const IDENTIFIER = /\b[a-z]{2,}[A-Z][A-Za-z]*\b/;
const SR01_CASES: readonly (readonly [string, Record<string, unknown>, string])[] = [
  ["station separation 0", { stationSeparationLs: 0 }, "station separation AB"],
  ["pair separation -3", { pairSeparationLs: -3 }, "moving pair's separation L"],
  ["emission time not a number", { emissionTimeA: Number.NaN }, "emission time at A"],
  ["clock offset text", { clockOffsetB: "x" }, "clock B's initial offset"],
  ["pair velocity c", { pairBeta: 1 }, "moving pair's velocity"],
  ["station speed -1.2", { rodBeta: -1.2 }, "stations' speed"],
  ["frame not a number", { frameBeta: Number.NaN }, "frame of description"],
];

describe("SR-01 refusals name the control as the page does, never a parameter id", () => {
  test("the identifier pattern catches the old sentence (positive control)", () => {
    expect(IDENTIFIER.test("stationSeparationLs must be a finite, positive number.")).toBe(true);
    expect(IDENTIFIER.test("candidateA and workFunction")).toBe(true);
    expect(IDENTIFIER.test("Enter the work function Φ, in eV, as a number.")).toBe(false);
  });
  for (const [label, bad, names] of SR01_CASES) {
    test(label, () => {
      const checked = validateSr01Parameters({ ...SR01_DEFAULTS, ...bad });
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused") return;
      const sentence = refusalSentence(checked.refusal);
      expect(sentence.startsWith("Enter")).toBe(true);
      expect(sentence).toContain(names);
      expect(sentence).not.toMatch(IDENTIFIER);
    });
  }
});

/**
 * ME-03's sentences read as code ("Box length ell must be a positive finite number.", "requires
 * E / (M * c^2) <= 10^-3."). Each one a reader can reach must say what to enter, in words.
 */
const CODE_TOKEN = /<=|>=|\*|\^|\bell\b/;
const ME03_CASES: readonly (readonly [string, Record<string, unknown>, string])[] = [
  ["energy given off 0", { emittedEnergy: 0 }, "energy L given off"],
  ["energy taken in -1", { inputEnergy: -1 }, "energy taken in"],
  ["box mass 0", { mode: "box-1906", boxMass: 0 }, "box mass M"],
  ["box length not a number", { mode: "box-1906", boxLength: Number.NaN }, "box length ℓ"],
  ["pulse energy -2", { mode: "box-1906", pulseEnergy: -2 }, "pulse energy E"],
  [
    "pulse energy beyond the box's bound",
    { mode: "box-1906", pulseEnergy: 1e15, boxMass: 1 },
    "a thousandth of Mc²",
  ],
];

describe("ME-03 refusals say what to enter, in words", () => {
  test("the code-token pattern catches the old sentences (positive control)", () => {
    expect(
      CODE_TOKEN.test("The nonrelativistic recoil approximation requires E / (M * c^2) <= 10^-3."),
    ).toBe(true);
    expect(CODE_TOKEN.test("Box length ell must be a positive finite number.")).toBe(true);
  });
  for (const [label, bad, names] of ME03_CASES) {
    test(label, () => {
      const checked = validateMe03Parameters({ ...ME03_DEFAULTS, ...bad });
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused") return;
      const sentence = refusalSentence(checked.refusal);
      expect(sentence.startsWith("Enter")).toBe(true);
      expect(sentence).toContain(names);
      expect(sentence).not.toMatch(IDENTIFIER);
      expect(sentence).not.toMatch(CODE_TOKEN);
    });
  }
});

/**
 * BM-08 answered every out-of-range value with one of three run-on sentences ("Use 3–1000
 * increments, 1–4 second frame spacing, one or two coordinates, 5–200 stationary clicks and
 * exposure between zero and frame spacing.") that named no parameter. Each control now gets its own
 * sentence and its own parameterIds.
 */
const BM08_CASES: readonly (readonly [
  keyof typeof BM08_DEFAULTS,
  Record<string, unknown>,
  string,
])[] = [
  ["D", { D: 1 }, "diffusivity"],
  ["flowDrift", { flowDrift: 0.01 }, "fluid drift"],
  ["stageDrift", { stageDrift: -0.01 }, "stage drift"],
  ["sigma", { sigma: 0.01 }, "localization standard deviation"],
  ["dt", { dt: 0.5, exposure: 0.25 }, "frame spacing"],
  ["d", { d: 3 }, "observed coordinates"],
  ["M", { M: 2 }, "displacements"],
  ["clicks", { clicks: 1000 }, "stationary clicks"],
  ["exposure", { exposure: 2 }, "exposure"],
  ["coverage", { coverage: 0.3 }, "coverage"],
  ["coverageTrials", { coverageTrials: 500 }, "hypothetical trials"],
];

describe("BM-08 refusals name one control and say what to enter", () => {
  for (const [id, bad, names] of BM08_CASES) {
    test(`${id} out of range`, () => {
      const checked = validateBm08Parameters({ ...BM08_DEFAULTS, ...bad });
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused") return;
      expect(checked.refusal.affected?.parameterIds).toEqual([id]);
      const sentence = refusalSentence(checked.refusal);
      expect(/^(Enter|Choose)\b/.test(sentence)).toBe(true);
      expect(sentence).toContain(names);
      expect(sentence).not.toMatch(IDENTIFIER);
    });
  }
});

/**
 * A sweep of every lab validator through refusalSentence found field ids and computer notation in
 * sr-04 ("Candidate coefficient candidateA must be a finite number with magnitude at most 1e6."),
 * lq-06 and lq-08 ("Parameter \"workFunction\" must be a finite number.", "must be in [0, 1]",
 * "a positive safe integer"). Each case below must say what to enter, in words.
 */
type AnyCheck = { kind: string; refusal?: Parameters<typeof refusalSentence>[0] };
const SWEEP_CASES: readonly (readonly [string, () => AnyCheck, string])[] = [
  [
    "sr-04 candidate a not a number",
    () => validateSr04Parameters({ ...SR04_DEFAULTS, candidateA: Number.NaN }),
    "candidate coefficient a",
  ],
  [
    "sr-04 transverse scale 2e6",
    () => validateSr04Parameters({ ...SR04_DEFAULTS, candidateTransverseScale: 2e6 }),
    "transverse scale",
  ],
  [
    "sr-04 observer speed 1e5 m/s",
    () => validateSr04Parameters({ ...SR04_DEFAULTS, observerSpeed: 1e5 }),
    "10 000 m/s",
  ],
  [
    "lq-06 molecules 2.5",
    () => validateLq06Parameters({ ...LQ06_DEFAULTS, gasParticles: 2.5 }),
    "whole number of molecules",
  ],
  [
    "lq-06 frequency not a number",
    () => validateLq06Parameters({ ...LQ06_DEFAULTS, frequency: Number.NaN }),
    "frequency ν",
  ],
  [
    "lq-06 volume ratio 500",
    () => validateLq06Parameters({ ...LQ06_DEFAULTS, volumeRatio: 500 }),
    "volume ratio",
  ],
  [
    "lq-08 quantum efficiency 2",
    () => validateLq08Parameters({ ...LQ08_DEFAULTS, quantumEfficiency: 2 }),
    "quantum efficiency",
  ],
  [
    "lq-08 collector potential 500 V",
    () => validateLq08Parameters({ ...LQ08_DEFAULTS, collectorPotential: 500 }),
    "collector potential",
  ],
  [
    "lq-08 work function not a number",
    () => validateLq08Parameters({ ...LQ08_DEFAULTS, workFunction: Number.NaN }),
    "work function Φ",
  ],
];
const INTERVAL_NOTATION = /\[[^\]]*,[^\]]*\]|\d+e[+-]?\d+|safe integer/;

describe("sr-04, lq-06 and lq-08 refusals say what to enter, in words", () => {
  test("the notation pattern catches the old sentences (positive control)", () => {
    expect(INTERVAL_NOTATION.test("Quantum efficiency must be in [0, 1].")).toBe(true);
    expect(INTERVAL_NOTATION.test("magnitude at most 1e6.")).toBe(true);
    expect(INTERVAL_NOTATION.test("a positive safe integer.")).toBe(true);
  });
  for (const [label, run, names] of SWEEP_CASES) {
    test(label, () => {
      const checked = run();
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused" || !checked.refusal) return;
      const sentence = refusalSentence(checked.refusal);
      expect(sentence.startsWith("Enter")).toBe(true);
      expect(sentence).toContain(names);
      expect(sentence).not.toMatch(IDENTIFIER);
      expect(sentence).not.toMatch(INTERVAL_NOTATION);
    });
  }
});
