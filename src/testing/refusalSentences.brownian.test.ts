import { describe, expect, test } from "bun:test";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../experiments/bm01/parameters.ts";
import { fromBm03Draft, toBm03Draft } from "../experiments/bm03/controls.ts";
import { BM03_DEFAULTS } from "../experiments/bm03/definition.ts";
import { fromBm04Draft, toBm04Draft } from "../experiments/bm04/controls.ts";
import { BM04_DEFAULTS } from "../experiments/bm04/definition.ts";
import { validateBm04Parameters } from "../experiments/bm04/parameters.ts";
import { BM05_DEFAULTS } from "../experiments/bm05/definition.ts";
import { validateBm05Parameters } from "../experiments/bm05/parameters.ts";
import { fromBm06Draft, toBm06Draft } from "../experiments/bm06/controls.ts";
import { BM06_DEFAULTS } from "../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../experiments/bm06/parameters.ts";
import { BM07_DEFAULTS } from "../experiments/bm07/definition.ts";
import { validateBm07Parameters } from "../experiments/bm07/parameters.ts";
import { fromLq01Draft, toLq01Draft } from "../experiments/lq01/controls.ts";
import { LQ01_DEFAULTS } from "../experiments/lq01/definition.ts";
import { validateLq01Parameters } from "../experiments/lq01/parameters.ts";
import { enterNumberSentence, refusalSentence } from "../experiments/results/refusalSentence.ts";

/**
 * bm-01, bm-04, bm-06 and lq-01 used to refuse a typed value with a sentence that never said which
 * control: "Use finite numbers in the stated units.", "One of the inputs is not a finite number.", a
 * run-on list of limits, or, from the draft parsers, "enter a representable finite decimal number
 * in norm". Each refused value must now name its control and say what to enter.
 */
const UNSPECIFIC =
  /stated units|One of the inputs|representable|finite decimal|in (norm|ratio|count|×)\b|must be positive|\[0, ?1\]/;

type Check = { kind: string; refusal?: Parameters<typeof refusalSentence>[0] };
const VALIDATOR_CASES: readonly (readonly [string, () => Check, string])[] = [
  ["bm-01 viscosity 0", () => validateBm01Parameters({ ...BM01_DEFAULTS, eta: 0 }), "viscosity"],
  [
    "bm-01 temperature NaN",
    () => validateBm01Parameters({ ...BM01_DEFAULTS, T: Number.NaN }),
    "temperature",
  ],
  ["bm-01 5000 tracers", () => validateBm01Parameters({ ...BM01_DEFAULTS, M: 5000 }), "tracers"],
  [
    "bm-01 observation past the recording",
    () => validateBm01Parameters({ ...BM01_DEFAULTS, interval: 50 }),
    "observation time",
  ],
  ["bm-04 box width 0", () => validateBm04Parameters({ ...BM04_DEFAULTS, W: 0 }), "box width"],
  [
    "bm-04 2 spatial cells",
    () => validateBm04Parameters({ ...BM04_DEFAULTS, cells: 2 }),
    "spatial cells",
  ],
  [
    "bm-04 force NaN",
    () => validateBm04Parameters({ ...BM04_DEFAULTS, F: Number.NaN }),
    "external force",
  ],
  ["bm-06 cell width -1", () => validateBm06Parameters({ ...BM06_DEFAULTS, dx: -1 }), "cell width"],
  [
    "bm-06 5000 grid cells",
    () => validateBm06Parameters({ ...BM06_DEFAULTS, n: 5000 }),
    "grid cells",
  ],
  [
    "bm-06 viscosity NaN",
    () => validateBm06Parameters({ ...BM06_DEFAULTS, eta: Number.NaN }),
    "viscosity",
  ],
  [
    "bm-05 step RMS 0",
    () => validateBm05Parameters({ ...BM05_DEFAULTS, stepRms: 0 }),
    "step RMS size",
  ],
  [
    "bm-05 20000 recorded steps",
    () => validateBm05Parameters({ ...BM05_DEFAULTS, runSteps: 20000 }),
    "recorded steps",
  ],
  [
    "bm-05 right-step probability 2",
    () => validateBm05Parameters({ ...BM05_DEFAULTS, bias: 2 }),
    "right-step probability",
  ],
  [
    "bm-05 time between steps NaN",
    () => validateBm05Parameters({ ...BM05_DEFAULTS, tau: Number.NaN }),
    "time between steps",
  ],
  [
    "bm-07 generator radius 0",
    () => validateBm07Parameters({ ...BM07_DEFAULTS, generatorRadius: 0 }),
    "generator radius",
  ],
  [
    "bm-07 radius relative bound 100%",
    () => validateBm07Parameters({ ...BM07_DEFAULTS, radiusError: 1 }),
    "radius relative bound",
  ],
  [
    "bm-07 assumed viscosity NaN",
    () => validateBm07Parameters({ ...BM07_DEFAULTS, eta: Number.NaN }),
    "assumed viscosity",
  ],
  [
    "bm-07 0 displacements",
    () => validateBm07Parameters({ ...BM07_DEFAULTS, M: 0 }),
    "displacements",
  ],
  [
    "lq-01 wave 2 amplitude -1",
    () => validateLq01Parameters({ ...LQ01_DEFAULTS, A2: -1 }),
    "wave 2 amplitude",
  ],
  [
    "lq-01 observation radius 0",
    () => validateLq01Parameters({ ...LQ01_DEFAULTS, r: 0 }),
    "observation radius",
  ],
  [
    "lq-01 relative phase NaN",
    () => validateLq01Parameters({ ...LQ01_DEFAULTS, delta: Number.NaN }),
    "relative phase",
  ],
];

const parseMessage = (parse: () => unknown): string => {
  try {
    parse();
  } catch (error) {
    return String((error as Error).message);
  }
  return "";
};
const PARSER_CASES: readonly (readonly [string, () => string, string])[] = [
  [
    "bm-03 particle count",
    () => parseMessage(() => fromBm03Draft({ ...toBm03Draft(BM03_DEFAULTS), Np: "abc" })),
    "Particle count Np: enter a whole number.",
  ],
  [
    "bm-04 viscosity",
    () => parseMessage(() => fromBm04Draft({ ...toBm04Draft(BM04_DEFAULTS), eta: "abc" })),
    "Viscosity: enter a number, in mPa·s.",
  ],
  [
    "bm-06 grid cells",
    () => parseMessage(() => fromBm06Draft({ ...toBm06Draft(BM06_DEFAULTS), n: "abc" })),
    "Grid cells: enter a whole number.",
  ],
  [
    "lq-01 wave 1 amplitude",
    () => parseMessage(() => fromLq01Draft({ ...toLq01Draft(LQ01_DEFAULTS), A1: "abc" })),
    "Wave 1 amplitude: enter a number.",
  ],
  [
    "lq-01 wavelength",
    () => parseMessage(() => fromLq01Draft({ ...toLq01Draft(LQ01_DEFAULTS), wavelength: "abc" })),
    "Wavelength: enter a number.",
  ],
];

describe("Brownian and wave labs: a refused value names its control and says what to enter", () => {
  test("the pattern catches the old sentences (positive control)", () => {
    for (const old of [
      "Use finite numbers in the stated units.",
      "One of the inputs is not a finite number.",
      "Wave 1 amplitude: enter a representable finite decimal number in norm.",
      "Temperature, viscosity, radius, box width, and time step must be positive.",
    ])
      expect(UNSPECIFIC.test(old)).toBe(true);
  });
  for (const [label, run, names] of VALIDATOR_CASES) {
    test(label, () => {
      const checked = run();
      expect(checked.kind).toBe("refused");
      if (checked.kind !== "refused" || !checked.refusal) return;
      const sentence = refusalSentence(checked.refusal);
      expect(/^(Enter|Choose)\b/.test(sentence)).toBe(true);
      expect(sentence).toContain(names);
      expect(sentence).not.toMatch(UNSPECIFIC);
    });
  }
  for (const [label, run, expected] of PARSER_CASES) {
    test(`parser: ${label}`, () => {
      expect(run()).toBe(expected);
    });
  }
  test("enterNumberSentence reads units aloud and keeps pure numbers bare", () => {
    expect(enterNumberSentence("Relative phase", "rad")).toBe(
      "Relative phase: enter a number, in radians.",
    );
    expect(enterNumberSentence("Time step", "ms")).toBe(
      "Time step: enter a number, in milliseconds.",
    );
    expect(enterNumberSentence("Volume ratio V/V0", "ratio")).toBe(
      "Volume ratio V/V0: enter a number.",
    );
    expect(enterNumberSentence("Source separation", "λ")).toBe(
      "Source separation: enter a number, in wavelengths.",
    );
  });
});
