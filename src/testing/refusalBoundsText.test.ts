import { describe, expect, test } from "bun:test";
import {
  AVOGADRO_DEFAULTS,
  validateAvogadroParameters,
} from "../experiments/avogadro/definition.ts";
import { LQ04_DEFAULTS } from "../experiments/lq04/definition.ts";
import { validateLq04Parameters } from "../experiments/lq04/parameters.ts";
import { SR03_DEFAULTS } from "../experiments/sr03/definition.ts";
import { validateSr03Parameters } from "../experiments/sr03/parameters.ts";
import {
  LIGHT_THREAD_DEFAULTS,
  validateLightThreadParameters,
} from "../physics/reference/lightThread.ts";

/**
 * A refusal a reader sees states its admission bounds in the page's notation, never as JavaScript
 * writes numbers. Before 6a8c500a and f73213c2 these read "pulseEnergyJ must be a finite number
 * between 1e-24 and 1000000", "Volume ratio must be between 1e-4 and 1e4", "enter a finite number
 * from 1e-8 to 1000000" and "within [1e-6, 1e6] ls". Each lab renders the text through withScripts,
 * so a power of ten is written 10^{n} here and raised there.
 */

/** Each validator returns its own refusal shape; the reader's text is in one of these fields. */
type RefusalShape = Readonly<{
  refusal?: Readonly<{ message?: string; details?: Readonly<{ requirements?: unknown }> }>;
  reason?: string;
}>;

function text(outcome: unknown): string {
  const o = outcome as RefusalShape;
  const requirements = o.refusal?.details?.requirements;
  return typeof requirements === "string" ? requirements : (o.refusal?.message ?? o.reason ?? "");
}

const cases: readonly [string, () => unknown][] = [
  [
    "light-thread pulse energy",
    () => validateLightThreadParameters({ ...LIGHT_THREAD_DEFAULTS, pulseEnergyJ: 1e300 }),
  ],
  [
    "light-thread frequency",
    () => validateLightThreadParameters({ ...LIGHT_THREAD_DEFAULTS, frequencyHz: 0 }),
  ],
  ["lq-04 volume ratio", () => validateLq04Parameters({ ...LQ04_DEFAULTS, volumeRatio: 1e300 })],
  [
    "lq-04 reference volume",
    () => validateLq04Parameters({ ...LQ04_DEFAULTS, referenceVolume: 1e300 }),
  ],
  [
    "avogadro mean square",
    () => validateAvogadroParameters({ ...AVOGADRO_DEFAULTS, meanSquareUm2: 1e300 }),
  ],
  ["sr-03 rod length", () => validateSr03Parameters({ ...SR03_DEFAULTS, L0: 1e300 })],
  ["sr-03 sphere radius", () => validateSr03Parameters({ ...SR03_DEFAULTS, R: 0 })],
];

describe("refusal messages write their bounds in the page's notation", () => {
  for (const [name, refuse] of cases) {
    test(name, () => {
      const message = text(refuse());
      // Non-vacuous: the case really refused, with its bounds in the message.
      expect(message).toContain("10^{");
      expect(message).not.toMatch(/\d(?:\.\d+)?e[+-]?\d/);
      expect(message).not.toMatch(/\^\d|\[|1000000|finite number/);
    });
  }
});
