import { describe, expect, test } from "bun:test";
import { computeLq02Snapshot, DEFAULT_LQ02_INPUTS } from "../experiments/lq02/session.ts";
import { encodeResult, parseResult } from "../experiments/results/codec.ts";
import { refuseNonFiniteValues } from "../experiments/results/numberRange.ts";
import type { ScientificResult } from "../experiments/results/types.ts";
import { SR02_DEFAULTS } from "../experiments/sr02/definition.ts";
import { createSr02Session } from "../experiments/sr02/session.ts";
import { SR09_DEFAULTS } from "../experiments/sr09/definition.ts";
import { createSr09Session } from "../experiments/sr09/session.ts";
import { SR12_DEFAULTS } from "../experiments/sr12/definition.ts";
import { createSr12Session } from "../experiments/sr12/session.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { classicalCutoffEnergyDensity } from "../physics/reference/radiation.ts";

/**
 * A result past the floating-point range is a typed refusal a reader can read, never Infinity, NaN,
 * or a silent Apply.
 *
 * The defect behind this file, found 2026-09-23 by typing 1e300 into every lab input: sr-02, sr-09 and
 * sr-12 returned non-finite "value" outputs, the store refused the publication, and the session threw
 * where no component catches, so the reader's Apply changed nothing while the field showed the new
 * number over the old results. lq-02 went the other way and printed "Infinity J/m³" with a NaN share.
 */

/** Ids of value outputs holding a non-finite number. A published vector is a NumericView
 * ({ length, at, copy }), not a Float64Array: Array.from over the view itself yields undefined for
 * every element, which reads as non-finite, so it is read through copy(). */
function nonFinite(outputs: readonly ScientificResult[]): string[] {
  return outputs
    .filter((o) => {
      if (o.status !== "value") return false;
      const value: unknown = o.value;
      if (typeof value === "number") return !Number.isFinite(value);
      const view = value as { copy?: () => Float64Array };
      const numbers = typeof view.copy === "function" ? view.copy() : (value as Float64Array);
      return Array.from(numbers).some((x) => !Number.isFinite(x));
    })
    .map((o) => o.quantityId);
}

const identity = { unit: "1", semanticKind: "probe", ownerId: "probe" } as const;

describe("refuseNonFiniteValues", () => {
  test("finite outputs pass through unchanged", () => {
    const outputs: ScientificResult[] = [
      { quantityId: "a", ...identity, status: "value", value: 2 },
      { quantityId: "b", ...identity, status: "value", value: new Float64Array([1, 2]) },
    ];
    expect(refuseNonFiniteValues(outputs, [{ parameterId: "x", value: 1, admissible: 1 }])).toEqual(
      outputs,
    );
  });

  test("each non-finite value, scalar or array, becomes a numerical outside-domain result that survives the codec", () => {
    const outputs: ScientificResult[] = [
      { quantityId: "big", ...identity, status: "value", value: Number.POSITIVE_INFINITY },
      { quantityId: "ratio", ...identity, status: "value", value: Number.NaN },
      { quantityId: "row", ...identity, status: "value", value: new Float64Array([1, Number.NaN]) },
      { quantityId: "fine", ...identity, status: "value", value: 3 },
    ];
    const typed = refuseNonFiniteValues(outputs, [
      { parameterId: "small", value: 2, admissible: 1 },
      { parameterId: "huge", value: -1e300, admissible: 5 },
    ]);
    expect(nonFinite(typed)).toEqual([]);
    for (const id of ["big", "ratio", "row"]) {
      const r = typed.find((o) => o.quantityId === id);
      expect(r?.status).toBe("outside-domain");
      if (r?.status !== "outside-domain") continue;
      expect(r.condition).toBe("result-beyond-number-range");
      expect(r.domainKind).toBe("numerical");
      // The repair names the input that overflowed, by magnitude, not the first one listed.
      expect(r.boundary).toEqual({ parameterId: "huge", value: 5 });
      expect(parseResult(encodeResult(r))).toEqual(r);
    }
    expect(typed.find((o) => o.quantityId === "fine")).toEqual(outputs[3] as ScientificResult);
  });
});

describe("labs that square a large input publish a typed refusal instead of refusing silently", () => {
  const cases = [
    [
      "sr-02, B = 1e300 T",
      () => createSr02Session("nr-02"),
      { ...SR02_DEFAULTS, magneticField: 1e300 },
    ],
    [
      "sr-09, f = 1e300 THz",
      () => createSr09Session("nr-09"),
      { ...SR09_DEFAULTS, frequencyTHz: 1e300 },
    ],
    [
      "sr-12, ρ = 1e300",
      () => createSr12Session("nr-12"),
      { ...SR12_DEFAULTS, chargeDensity: 1e300 },
    ],
  ] as const;

  // Since dispatch 165 a lab refuses a setting outside its manifest's declared domain before
  // computing, so 1e300 no longer reaches the squaring there; refuseNonFiniteValues, above, still
  // guards the owners. A reader of such a lab gets the range in words, with the accepted trial kept.
  // The labs listed here have had that fix; the others still compute and type the overflow.
  const REFUSED_BEFORE_COMPUTING: readonly string[] = ["sr-02", "sr-09", "sr-12"];

  for (const [name, make, parameters] of cases) {
    if (REFUSED_BEFORE_COMPUTING.some((lab) => name.startsWith(`${lab},`))) {
      test(`${name}: refused by name before computing, and the accepted trial is kept`, () => {
        const session = make();
        const before = session.getSnapshot().accepted;
        const applied = session.apply(parameters);
        expect(applied.kind).toBe("refused");
        if (applied.kind === "refused") {
          expect(applied.refusal.code).toBe("outside-model-domain");
          expect(String(applied.refusal.details?.requirements)).toMatch(
            /^Enter the .+, the range this model describes/,
          );
        }
        expect(session.getSnapshot().accepted).toBe(before);
      });
      continue;
    }
    test(`${name}: Apply is accepted and the snapshot holds no non-finite value`, () => {
      const session = make();
      const before = session.getSnapshot().accepted?.snapshotVersion;
      // Threw "publication refused: unattributed-throw" before the fix.
      const applied = session.apply(parameters);
      expect(applied.kind).toBe("accepted");
      const snap = session.getSnapshot().accepted;
      expect(snap?.snapshotVersion).not.toBe(before);
      const outputs = (snap?.outputs ?? []) as unknown as ScientificResult[];
      expect(nonFinite(outputs)).toEqual([]);
      // Non-vacuous in both directions: something was refused for the range, and something still
      // computed. A fix that refused every output would pass the first check alone.
      const refused = outputs.filter(
        (o) => o.status === "outside-domain" && o.condition === "result-beyond-number-range",
      );
      expect(refused.length).toBeGreaterThan(0);
      expect(outputs.filter((o) => o.status === "value").length).toBeGreaterThan(0);
    });
  }
});

describe("lq-02's classical energy up to the cutoff", () => {
  const set = getConstantSet("modern-si-2019");

  test("computes below the range and refuses in words above it", () => {
    // The cube of the cutoff leaves the floating-point range near 5.6 × 10^102 Hz.
    const below = classicalCutoffEnergyDensity(5e102, 1500, set);
    expect(below.status).toBe("value");
    if (below.status === "value") expect(Number.isFinite(below.value)).toBe(true);
    const above = classicalCutoffEnergyDensity(1e103, 1500, set);
    expect(above.status).toBe("outside-domain");
    if (above.status === "outside-domain") {
      expect(above.condition).toBe("energy-beyond-number-range");
      expect(above.domainKind).toBe("numerical");
    }
  });

  test("the lab's snapshot at a 1e300 Hz cutoff carries no Infinity and no NaN share", () => {
    const snap = computeLq02Snapshot({ ...DEFAULT_LQ02_INPUTS, nuCutoff: 1e300 });
    // Printed "Infinity J/m³" and a NaN share (∞ − p)/∞ before the fix.
    expect(snap.energyUpToCutoff.status).toBe("outside-domain");
    expect(snap.shareAboveProbe.status).toBe("outside-domain");
    expect(snap.tenfoldWidenedEnergy.status).toBe("outside-domain");
  });
});
