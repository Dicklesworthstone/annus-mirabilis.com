import { describe, expect, test } from "bun:test";
import { ME02_DEFAULTS } from "../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../experiments/me02/parameters.ts";
import { refusalSentence } from "../experiments/results/refusals.ts";
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
