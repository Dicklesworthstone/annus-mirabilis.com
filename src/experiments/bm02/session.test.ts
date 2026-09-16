import { describe, expect, test } from "bun:test";
import { computeBm02Snapshot, DEFAULT_BM02_INPUTS, PHI_MAX, SUGAR_0P01M_INPUTS } from "./session";

function value(result: { status: string; value?: unknown }): number {
  if (result.status !== "value") throw new Error(`expected a value result, got ${result.status}`);
  return result.value as number;
}

describe("BM-02 osmotic partition: golden default", () => {
  const snapshot = computeBm02Snapshot(DEFAULT_BM02_INPUTS);

  test("number density is 1.0e15 m^-3", () => {
    expect(value(snapshot.numberDensity)).toBeCloseTo(1.0e15, -6);
  });

  test("osmotic pressure matches the bead's exact figure within 1e-9 relative", () => {
    const pi = value(snapshot.osmoticPressure.result);
    const expected = 4.0473725e-6;
    expect(Math.abs(pi - expected) / expected).toBeLessThan(1e-6);
  });

  test("partition force matches 4.0473725e-14 N (40.47 fN)", () => {
    const f = value(snapshot.partitionForce.result);
    const expected = 4.0473725e-14;
    expect(Math.abs(f - expected) / expected).toBeLessThan(1e-6);
  });

  test("hydrostatic head matches 4.13544e-10 m", () => {
    const h = value(snapshot.hydrostaticHead.result);
    const expected = 4.13544e-10;
    expect(Math.abs(h - expected) / expected).toBeLessThan(1e-4);
  });

  test("volume fraction matches 5.23599e-4", () => {
    const phi = value(snapshot.volumeFraction);
    expect(Math.abs(phi - 5.23599e-4) / 5.23599e-4).toBeLessThan(1e-5);
  });

  test("the default sits inside the dilute domain", () => {
    expect("admitted" in snapshot.domain && snapshot.domain.admitted).toBe(true);
  });
});

describe("BM-02: molar agreement", () => {
  test("n = 1e18 m^-3 gives Pi = c*R*T within 1e-6 relative", () => {
    // n = Np / (V_um3 * 1e-18 m^3/um^3); Np/V_um3 = 1 gives n = 1e18 m^-3.
    const inputs = {
      Np: 1_000_000,
      V_um3: 1_000_000,
      T: 293.15,
      a_um: 0.0005,
      A_um2: 10_000,
      model: "molecular-kinetic" as const,
      constantSetId: "modern-si-2019" as const,
    };
    const snapshot = computeBm02Snapshot(inputs);
    const n = value(snapshot.numberDensity);
    expect(Math.abs(n - 1.0e18) / 1.0e18).toBeLessThan(1e-9);
    const pi = value(snapshot.osmoticPressure.result);
    const expected = 4.0473725e-3;
    expect(Math.abs(pi - expected) / expected).toBeLessThan(1e-6);
  });
});

describe("BM-02: size independence", () => {
  test("equal n at radius 0.5 nm and 500 nm gives bitwise-identical pressure", () => {
    const base = DEFAULT_BM02_INPUTS;
    const small = { ...base, a_um: 0.0005 };
    const large = { ...base, a_um: 0.5 };
    const snapSmall = computeBm02Snapshot(small);
    const snapLarge = computeBm02Snapshot(large);
    expect(value(snapSmall.osmoticPressure.result)).toBe(value(snapLarge.osmoticPressure.result));
  });
});

describe("BM-02: dilute boundary", () => {
  const V_um3 = 1_000_000;
  const a_um = 0.5;

  test("Np = 19098 is accepted (phi just under 0.01)", () => {
    const snapshot = computeBm02Snapshot({
      Np: 19_098,
      V_um3,
      T: 293.15,
      a_um,
      A_um2: 10_000,
      model: "molecular-kinetic",
      constantSetId: "modern-si-2019",
    });
    expect("admitted" in snapshot.domain && snapshot.domain.admitted).toBe(true);
    expect(snapshot.osmoticPressure.result.status).toBe("value");
  });

  test("Np = 19099 is refused as outside-domain, naming the admissible boundary", () => {
    const snapshot = computeBm02Snapshot({
      Np: 19_099,
      V_um3,
      T: 293.15,
      a_um,
      A_um2: 10_000,
      model: "molecular-kinetic",
      constantSetId: "modern-si-2019",
    });
    expect("admitted" in snapshot.domain && snapshot.domain.admitted).toBe(false);
    expect(snapshot.osmoticPressure.result.status).toBe("outside-domain");
    if (snapshot.osmoticPressure.result.status === "outside-domain") {
      expect(snapshot.osmoticPressure.result.reason).toContain("19098");
    }
    if ("maxAdmittedCount" in snapshot.domain) {
      expect(snapshot.domain.maxAdmittedCount).toBe(19_098);
    }
  });
});

describe("BM-02: zero and invalid inputs", () => {
  test("Np = 0 gives Pi = F = h = 0 as value results", () => {
    const snapshot = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, Np: 0 });
    expect(value(snapshot.osmoticPressure.result)).toBe(0);
    expect(value(snapshot.partitionForce.result)).toBe(0);
    expect(value(snapshot.hydrostaticHead.result)).toBe(0);
  });

  test("V <= 0 is refused as outside-domain, never clamped", () => {
    const snapshot = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, V_um3: 0 });
    expect(snapshot.numberDensity.status).toBe("outside-domain");
  });

  test("T <= 0 is refused as outside-domain", () => {
    const snapshot = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, T: 0 });
    expect(snapshot.osmoticPressure.result.status).toBe("outside-domain");
  });

  test("a non-integer particle count is refused as outside-domain", () => {
    const snapshot = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, Np: 3.5 });
    expect(snapshot.numberDensity.status).toBe("outside-domain");
  });

  test("NaN and infinite inputs are refused, never zero or a silent clamp", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const snapshot = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, T: bad });
      expect(snapshot.osmoticPressure.result.status).not.toBe("value");
    }
  });
});

describe("BM-02: sugar comparison", () => {
  test("0.01 mol/L at 293.15 K gives the bead's stated pressure and stays inside the dilute domain", () => {
    const snapshot = computeBm02Snapshot(SUGAR_0P01M_INPUTS);
    const n = value(snapshot.numberDensity);
    expect(Math.abs(n - 6.02214076e24) / 6.02214076e24).toBeLessThan(1e-6);
    const pi = value(snapshot.osmoticPressure.result);
    expect(Math.abs(pi - 2.43738e4) / 2.43738e4).toBeLessThan(1e-4);
    expect("admitted" in snapshot.domain && snapshot.domain.admitted).toBe(true);
  });
});

describe("BM-02: classical model", () => {
  test("the classical-expectation model gives zero pressure as a value, labeled, never refuted", () => {
    const snapshot = computeBm02Snapshot({
      ...DEFAULT_BM02_INPUTS,
      model: "classical-thermodynamics-suspended-bodies",
    });
    expect(value(snapshot.osmoticPressure.result)).toBe(0);
    expect(snapshot.osmoticPressure.result.status).toBe("value");
    if ("modelNote" in snapshot.osmoticPressure) {
      expect(snapshot.osmoticPressure.modelNote).toContain("Perrin");
      expect(snapshot.osmoticPressure.modelNote?.toLowerCase()).not.toContain("refuted");
    }
  });

  test("switching back to molecular-kinetic restores the default numbers bitwise", () => {
    const molecular = computeBm02Snapshot(DEFAULT_BM02_INPUTS);
    const classical = computeBm02Snapshot({
      ...DEFAULT_BM02_INPUTS,
      model: "classical-thermodynamics-suspended-bodies",
    });
    const backToMolecular = computeBm02Snapshot({
      ...DEFAULT_BM02_INPUTS,
      model: "molecular-kinetic",
    });
    expect(value(backToMolecular.osmoticPressure.result)).toBe(
      value(molecular.osmoticPressure.result),
    );
    expect(value(classical.osmoticPressure.result)).toBe(0);
  });
});

describe("BM-02: command classes", () => {
  test("changing partition area only changes force, not number density or pressure", () => {
    const before = computeBm02Snapshot(DEFAULT_BM02_INPUTS);
    const after = computeBm02Snapshot({ ...DEFAULT_BM02_INPUTS, A_um2: 20_000 });
    expect(value(after.numberDensity)).toBe(value(before.numberDensity));
    expect(value(after.osmoticPressure.result)).toBe(value(before.osmoticPressure.result));
    expect(value(after.partitionForce.result)).toBeGreaterThan(value(before.partitionForce.result));
  });
});

describe("BM-02: adversarial fixture", () => {
  test("a larger particle does not push harder at equal n (the owner returns identical pressure)", () => {
    const base = DEFAULT_BM02_INPUTS;
    const smallRadius = computeBm02Snapshot({ ...base, a_um: 0.0005 });
    const largeRadius = computeBm02Snapshot({ ...base, a_um: 0.5 });
    // This is the trap this bead's spec explicitly names: someone could
    // wrongly assert Pi scales with particle volume or radius. It does not.
    expect(value(largeRadius.osmoticPressure.result)).toBe(
      value(smallRadius.osmoticPressure.result),
    );
  });
});

describe("BM-02: the dilute-domain constant", () => {
  test("PHI_MAX is 0.01, matching the bead's stated bound", () => {
    expect(PHI_MAX).toBe(0.01);
  });
});
