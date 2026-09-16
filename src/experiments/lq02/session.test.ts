import { describe, expect, test } from "bun:test";
import {
  computeLq02Snapshot,
  DEFAULT_LQ02_INPUTS,
  type Lq02Inputs,
  removeUpperLimit,
} from "./session";

const BASE: Lq02Inputs = DEFAULT_LQ02_INPUTS;

describe("computeLq02Snapshot: golden default (T = 1500 K, nu_c = 1e14 Hz)", () => {
  const snapshot = computeLq02Snapshot(BASE);

  test("energy up to the cutoff matches the bead's golden value", () => {
    expect(snapshot.energyUpToCutoff.status).toBe("value");
    if (snapshot.energyUpToCutoff.status === "value") {
      expect(snapshot.energyUpToCutoff.value).toBeCloseTo(6.439187004807029e-3, 12);
    }
  });

  test("mean resonator energy is k_B * T at every frequency", () => {
    expect(snapshot.meanResonatorEnergy.status).toBe("value");
    if (snapshot.meanResonatorEnergy.status === "value") {
      expect(snapshot.meanResonatorEnergy.value).toBeCloseTo(2.070974e-20, 24);
      expect(snapshot.meanResonatorEnergy.ratioToFreeMoleculeKineticEnergy).toBeCloseTo(2 / 3, 12);
    }
  });

  test("tenfold widening multiplies the energy by exactly 1000 (the growth law, as a ratio of two owner calls)", () => {
    expect(snapshot.growthRatio).not.toBeNull();
    expect(snapshot.growthRatio).toBeCloseTo(1000, 9);
  });

  test("share above the probe frequency is 1 - (probe/cutoff)^3", () => {
    expect(snapshot.shareAboveProbe.status).toBe("value");
    if (snapshot.shareAboveProbe.status === "value") {
      expect(snapshot.shareAboveProbe.value).toBeCloseTo(0.999, 9);
    }
  });

  test("regime boundaries come from the owner's regimeRelativeErrors, never a literal in this module", () => {
    // The bead text states the classical (Rayleigh-Jeans) 1% boundary as x = 0.0198678, but
    // solving 1 - x/(e^x - 1) = 0.01 independently (verified here by bisection, not by trusting
    // the bead's literal) gives x = 0.020067114..., which is what the owner's regimeRelativeErrors
    // actually returns. Reported to am-ref-radiation-15c / this bead rather than silently matched
    // to the bead's number or silently "corrected" in the owner, which this bead does not own.
    expect(snapshot.regimeBoundaries.classicalBoundaryX).toBeCloseTo(0.020067114396262874, 12);
    expect(snapshot.regimeBoundaries.wienBoundaryX).toBeCloseTo(4.605170186, 6);
  });

  test("the Avogadro readout reproduces the printed N and hydrogen-atom mass", () => {
    expect(snapshot.avogadro.status).toBe("value");
    expect(snapshot.avogadro.avogadroConstant).toBeCloseTo(6.170486e23, -18);
    expect(snapshot.avogadro.printedAvogadroConstant).toBe(6.17e23);
    expect(snapshot.avogadro.printedHydrogenAtomMassGrams).toBe(1.62e-24);
    expect(snapshot.avogadro.modernComparisons.modernAvogadro).toBe(6.02214076e23);
  });
});

describe("computeLq02Snapshot: cubic scaling across the frequency table", () => {
  test("U(1e13), U(1e14), U(1e15), U(1e16) match the bead's table at T = 1500 K", () => {
    const expected: Array<[number, number]> = [
      [1e13, 6.439187004807029e-6],
      [1e14, 6.439187004807029e-3],
      [1e15, 6.439187004807029],
      [1e16, 6439.187004807029],
    ];
    for (const [nuCutoff, value] of expected) {
      const snapshot = computeLq02Snapshot({ ...BASE, nuCutoff, probeFrequency: nuCutoff / 10 });
      expect(snapshot.energyUpToCutoff.status).toBe("value");
      if (snapshot.energyUpToCutoff.status === "value") {
        expect(snapshot.energyUpToCutoff.value).toBeCloseTo(value, 9);
      }
    }
  });
});

describe("removeUpperLimit: the classical total diverges, honestly", () => {
  test("returns a typed outside-domain refusal naming the divergence condition, never a huge number or Infinity", () => {
    const refusal = removeUpperLimit(BASE);
    expect(refusal.status).toBe("outside-domain");
    if (refusal.status === "outside-domain") {
      expect(refusal.condition).toBe("classical-total-diverges");
      expect(refusal.reason).toContain("unbounded total energy");
    }
  });

  test("the refusal does not depend on the accepted cutoff: widening nu_c first still diverges the same way", () => {
    const widened = removeUpperLimit({ ...BASE, nuCutoff: 1e16 });
    expect(widened.status).toBe("outside-domain");
  });
});

describe("computeLq02Snapshot: invalid and boundary inputs are refused, never clamped", () => {
  test("nonpositive temperature refuses both the cutoff energy and the mean resonator energy consistently", () => {
    const snapshot = computeLq02Snapshot({ ...BASE, T: -5 });
    expect(snapshot.energyUpToCutoff.status).toBe("outside-domain");
    expect(snapshot.meanResonatorEnergy.status).toBe("outside-domain");
    if (snapshot.meanResonatorEnergy.status === "outside-domain") {
      expect(snapshot.meanResonatorEnergy.condition).toBe("nonpositive-temperature");
    }
  });

  test("nonpositive cutoff frequency refuses with a named boundary condition, not a clamp to zero", () => {
    const snapshot = computeLq02Snapshot({ ...BASE, nuCutoff: 0 });
    expect(snapshot.energyUpToCutoff.status).toBe("outside-domain");
    if (snapshot.energyUpToCutoff.status === "outside-domain") {
      expect(snapshot.energyUpToCutoff.condition).toBe("nonpositive-cutoff-frequency");
    }
  });

  test("a probe frequency above the cutoff is refused, not silently reordered", () => {
    const snapshot = computeLq02Snapshot({ ...BASE, nuCutoff: 1e13, probeFrequency: 1e14 });
    expect(snapshot.shareAboveProbe.status).toBe("outside-domain");
    if (snapshot.shareAboveProbe.status === "outside-domain") {
      expect(snapshot.shareAboveProbe.condition).toBe("probe-above-cutoff");
    }
  });

  test("infinite cutoff on the setup snapshot (not the explicit removeUpperLimit action) still refuses honestly", () => {
    const snapshot = computeLq02Snapshot({ ...BASE, nuCutoff: Number.POSITIVE_INFINITY });
    expect(snapshot.energyUpToCutoff.status).toBe("outside-domain");
    if (snapshot.energyUpToCutoff.status === "outside-domain") {
      expect(snapshot.energyUpToCutoff.condition).toBe("classical-total-diverges");
    }
  });
});
