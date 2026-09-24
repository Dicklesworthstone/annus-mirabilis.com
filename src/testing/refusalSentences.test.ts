import { describe, expect, test } from "bun:test";
import { ME02_DEFAULTS } from "../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../experiments/me02/parameters.ts";
import { refusalSentence } from "../experiments/results/refusalSentence.ts";
import { SR01_DEFAULTS } from "../experiments/sr01/definition.ts";
import { validateSr01Parameters } from "../experiments/sr01/parameters.ts";
import { SR02_DEFAULTS } from "../experiments/sr02/definition.ts";
import { validateSr02Parameters } from "../experiments/sr02/parameters.ts";
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
const CASES: readonly (readonly [string, () => Check, string])[] = [
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
  for (const [label, run, names] of CASES) {
    test(label, () => {
      const checked = run();
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused" || !checked.refusal) return;
      expect(checked.refusal.code).toBe("invalid-parameter");
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
const IDENTIFIER = /\b[a-z]+[A-Z][A-Za-z]*\b/;
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
