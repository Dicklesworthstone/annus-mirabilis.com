import { describe, expect, test } from "bun:test";
import { logElectron } from "../physics/reference/electron.log.ts";
import {
  acceleratingPotential,
  C_SI,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  electricRadius,
  kineticEnergy,
  magneticRadius,
} from "../physics/reference/electron.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("electron.energy.test.ts: Kinetic energy, potential, and radii of curvature (AC3)", () => {
  test("kinetic energy is stable down to beta = 1e-8 and reduces to 1/2 m v^2", () => {
    const t0 = performance.now();
    const betaSmall = 1e-8;
    const keSmall = kineticEnergy(ELECTRON_MASS, betaSmall);

    expect(keSmall.exact.status).toBe("value");
    const exactVal = keSmall.exact.value as number;
    const newtVal = keSmall.newtonian.value as number;

    // At beta = 1e-8, exact and newtonian should agree within 1e-12 relative
    expect(withinTolerance(exactVal, newtVal, { relative: 1e-12 }).ok).toBe(true);

    logElectron({
      testId: "electron-energy-stable-low-speed",
      beta: betaSmall,
      resultStatus: "value",
      expected: newtVal,
      actual: exactVal,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Kinetic energy is stable at beta = 1e-8 and matches Newtonian 1/2 m v^2.",
    });
  });

  test("evaluates paper fixtures at beta = 0.6 and beta = 0.95 with CODATA 2022 constants", () => {
    const t0 = performance.now();
    const m = ELECTRON_MASS;
    const c = C_SI;
    const mc2 = m * c * c;

    // 1. Beta = 0.6: gamma = 1.25, gamma - 1 = 0.25
    const ke06 = kineticEnergy(m, 0.6);
    expect(ke06.exact.status).toBe("value");
    expect(withinTolerance(ke06.exact.value as number, 0.25 * mc2, { relative: 1e-12 }).ok).toBe(
      true,
    );
    expect(
      withinTolerance(ke06.newtonian.value as number, 0.18 * mc2, { relative: 1e-12 }).ok,
    ).toBe(true);
    expect(withinTolerance(ke06.ratio, 25 / 18, { relative: 1e-12 }).ok).toBe(true);

    // Accelerating potential P = 127749.7 V (Newtonian 91979.8 V)
    const pot = acceleratingPotential(0.6, ELEMENTARY_CHARGE, m);
    expect(pot.exact.status).toBe("value");
    expect(withinTolerance(pot.exact.value as number, 127749.7, { relative: 1e-5 }).ok).toBe(true);
    expect(withinTolerance(pot.newtonian.value as number, 91979.8, { relative: 1e-5 }).ok).toBe(
      true,
    );

    // Magnetic radius Rm = 0.127838 m at B = 0.01 T (Newtonian 0.102271 m)
    const rm = magneticRadius(0.6, 0.01, ELEMENTARY_CHARGE, m);
    expect(rm.exact.status).toBe("value");
    expect(withinTolerance(rm.exact.value as number, 0.127838, { relative: 1e-5 }).ok).toBe(true);
    expect(withinTolerance(rm.newtonian.value as number, 0.102271, { relative: 1e-5 }).ok).toBe(
      true,
    );

    // Electric radius Re = 2.29950 m at E = 10^5 V/m (Newtonian 1.83960 m)
    const re = electricRadius(0.6, 1e5, ELEMENTARY_CHARGE, m);
    expect(re.exact.status).toBe("value");
    expect(withinTolerance(re.exact.value as number, 2.2995, { relative: 1e-5 }).ok).toBe(true);
    expect(withinTolerance(re.newtonian.value as number, 1.8396, { relative: 1e-5 }).ok).toBe(true);

    // 2. Beta = 0.95: W = 2.20256 m_e c^2
    const ke095 = kineticEnergy(m, 0.95);
    expect(ke095.exact.status).toBe("value");
    expect(withinTolerance(ke095.exact.value as number, 2.20256 * mc2, { relative: 1e-5 }).ok).toBe(
      true,
    );

    logElectron({
      testId: "electron-energy-fixtures-codata2022",
      beta: 0.6,
      resultStatus: "value",
      expected: 127749.7,
      actual: pot.exact.value,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Energy, potential, and radii fixtures match paper values within 1e-5 relative.",
    });
  });

  test("superluminal speed beta >= 1 is rejected as outside-domain", () => {
    const t0 = performance.now();
    const ke1 = kineticEnergy(ELECTRON_MASS, 1.0);
    expect(ke1.exact.status).toBe("outside-domain");

    const keSup = kineticEnergy(ELECTRON_MASS, 1.2);
    expect(keSup.exact.status).toBe("outside-domain");

    logElectron({
      testId: "electron-energy-superluminal-rejected",
      beta: 1.2,
      resultStatus: "outside-domain",
      expected: "outside-domain",
      actual: keSup.exact.status,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Superluminal beta >= 1 correctly returns outside-domain status.",
    });
  });
});
