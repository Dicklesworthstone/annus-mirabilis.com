import { afterAll, describe, expect, it } from "bun:test";
import {
  aperturePower,
  fringeSpacingSmallAngle,
  fringeVisibility,
  inverseSquareIntensity,
  planeWave,
  pointSourceField,
  shellPowerIdentity,
  twoSourceIntensity,
} from "../physics/reference/radiation.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.waves (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("planeWave evaluates harmonic scalar field with spatial and temporal periodicity", () => {
    const wavelength = 500e-9; // 500 nm
    const c = 299792458;
    const period = wavelength / c;
    const amplitude = 10.0;

    const psi0 = planeWave({ amplitude, wavelength }, 0, 0);
    expect(psi0.status).toBe("value");
    if (psi0.status === "value") {
      expect(psi0.value).toBeCloseTo(amplitude, 10);
    }

    // One full spatial period
    const psiLambda = planeWave({ amplitude, wavelength }, wavelength, 0);
    expect(psiLambda.status).toBe("value");
    if (psiLambda.status === "value") {
      expect(psiLambda.value).toBeCloseTo(amplitude, 10);
    }

    // One full temporal period
    const psiPeriod = planeWave({ amplitude, wavelength }, 0, period);
    expect(psiPeriod.status).toBe("value");
    if (psiPeriod.status === "value") {
      expect(psiPeriod.value).toBeCloseTo(amplitude, 10);
    }

    // Quarter cycle: cos(pi/2) = 0
    const psiQuarter = planeWave({ amplitude, wavelength }, wavelength / 4, 0);
    expect(psiQuarter.status).toBe("value");
    if (psiQuarter.status === "value") {
      expect(psiQuarter.value).toBeCloseTo(0, 10);
    }

    logger.log({
      testId: "waves-plane-wave-periodicity",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("pointSourceField exhibits 1/r amplitude decay and spherical phase", () => {
    const wavelength = 600e-9;
    const amplitude = 5.0;

    const r1 = 1.0;
    const r2 = 2.0;

    const psi1 = pointSourceField({ amplitude, wavelength }, r1, 0);
    const psi2 = pointSourceField({ amplitude, wavelength }, r2, 0);

    expect(psi1.status).toBe("value");
    expect(psi2.status).toBe("value");

    // At r <= 0, outside-domain is returned
    const psiZero = pointSourceField({ amplitude, wavelength }, 0, 0);
    expect(psiZero.status).toBe("outside-domain");

    logger.log({
      testId: "waves-point-source-decay",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("fringe visibility and spacing match classical interference optics", () => {
    // Equal amplitudes: V = 1.0
    expect(fringeVisibility(2.0, 2.0)).toBeCloseTo(1.0, 12);

    // Unequal amplitudes: A1 = 3, A2 = 1 => 2 * 3 * 1 / (9 + 1) = 6/10 = 0.6
    expect(fringeVisibility(3.0, 1.0)).toBeCloseTo(0.6, 12);

    // Fringe spacing: lambda = 500 nm, D = 1 m, d = 0.5 mm => delta y = 1.0 mm
    const dy = fringeSpacingSmallAngle(500e-9, 0.5e-3, 1.0);
    expect(dy).toBeCloseTo(1.0e-3, 12);

    logger.log({
      testId: "waves-fringe-visibility-and-spacing",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("twoSourceIntensity exhibits constructive and destructive interference extremes", () => {
    const wavelength = 500e-9;

    // Constructive interference: delta = 0 => (1 + 1)^2 = 4
    const constructive = twoSourceIntensity({
      A1: 1.0,
      A2: 1.0,
      r1: 1.0,
      r2: 1.0,
      wavelength,
      delta: 0,
      readout: "time-average",
    });
    expect(constructive.status).toBe("value");
    if (constructive.status === "value") {
      expect(constructive.value).toBeCloseTo(4.0, 12);
    }

    // Destructive interference: delta = pi => (1 - 1)^2 = 0
    const destructive = twoSourceIntensity({
      A1: 1.0,
      A2: 1.0,
      r1: 1.0,
      r2: 1.0,
      wavelength,
      delta: Math.PI,
      readout: "time-average",
    });
    expect(destructive.status).toBe("value");
    if (destructive.status === "value") {
      expect(destructive.value).toBeCloseTo(0.0, 12);
    }

    // Orthogonal phase: delta = pi/2 => 1^2 + 1^2 = 2
    const mid = twoSourceIntensity({
      A1: 1.0,
      A2: 1.0,
      r1: 1.0,
      r2: 1.0,
      wavelength,
      delta: Math.PI / 2,
      readout: "time-average",
    });
    expect(mid.status).toBe("value");
    if (mid.status === "value") {
      expect(mid.value).toBeCloseTo(2.0, 12);
    }

    logger.log({
      testId: "waves-two-source-interference-extremes",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("shellPowerIdentity integrates inverse-square intensity over sphere and equals source power P", () => {
    const P = 100.0; // 100 Watts
    const r = 5.0; // 5 meters

    const res = shellPowerIdentity({ P, r });
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(withinTolerance(res.value, P, { relative: 1e-12 }).ok).toBe(true);
    }

    // Intensity at distance r
    const iRes = inverseSquareIntensity(P, r);
    expect(iRes.status).toBe("value");
    if (iRes.status === "value") {
      expect(iRes.value).toBeCloseTo(P / (4 * Math.PI * r * r), 12);
    }

    logger.log({
      testId: "waves-shell-power-conservation",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("aperturePower computes small-aperture vs exact disk aperture with expected relative difference -2.387e-5", () => {
    const P = 1.0; // 1 Watt
    const r = 1.0; // 1 meter
    const apertureArea = 1e-4; // 1 cm^2 = 1e-4 m^2

    const res = aperturePower({ P, r, apertureArea });
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.smallAperturePower).toBeCloseTo(1e-4 / (4 * Math.PI), 10);
      expect(res.value.relativeDifference).toBeCloseTo(-2.387e-5, 7);
      expect(res.value.exactDiskPower).toBeLessThan(res.value.smallAperturePower);
    }

    logger.log({
      testId: "waves-aperture-power-exact-disk",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
