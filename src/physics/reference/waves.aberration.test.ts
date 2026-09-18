import { describe, expect, test } from "bun:test";
import { logWaves } from "./waves.log.ts";
import {
  aberration,
  aberrationAngleFromSpeedRatio,
  modernEarthOrbitAberration,
  validateAberrationLabel,
} from "./waves.ts";

describe("am-ref-waves-r53: waves.aberration.test.ts", () => {
  test("Aberration fixtures at beta = 0.6", () => {
    const t0 = performance.now();
    const beta = 0.6;

    // Transverse ray in K (theta = 90 deg)
    const ab90 = aberration(beta, Math.PI / 2);
    expect(ab90.cosThetaPrime).toBeCloseTo(-0.6, 12);
    expect(ab90.sinThetaPrime).toBeCloseTo(0.8, 12);
    expect((ab90.thetaPrimeRad * 180) / Math.PI).toBeCloseTo(126.8698976458, 8);

    // Fixed points: theta = 0 -> theta' = 0; theta = pi -> theta' = pi
    const ab0 = aberration(beta, 0);
    expect(ab0.cosThetaPrime).toBeCloseTo(1.0, 12);
    expect(ab0.thetaPrimeRad).toBeCloseTo(0, 12);

    const abPi = aberration(beta, Math.PI);
    expect(abPi.cosThetaPrime).toBeCloseTo(-1.0, 12);
    expect(Math.abs(abPi.thetaPrimeRad)).toBeCloseTo(Math.PI, 12);

    logWaves({
      testId: "aberration-fixtures-beta-0.6",
      beta,
      resultStatus: "value",
      expected: 126.8698976458,
      actual: (ab90.thetaPrimeRad * 180) / Math.PI,
      tolerance: 1e-8,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Aberration fixtures pass: 90 deg -> 126.8699 deg; fixed points 0 and pi pass.",
    });
  });

  test("Trigonometric identity cos^2 + sin^2 = 1 numerically across angles", () => {
    const t0 = performance.now();
    const testAngles = [0, 0.1, 0.4, Math.PI / 4, Math.PI / 2, 2.1, Math.PI];
    const testBetas = [-0.95, -0.6, 0, 0.6, 0.95];

    for (const beta of testBetas) {
      for (const theta of testAngles) {
        const ab = aberration(beta, theta);
        const norm = ab.cosThetaPrime * ab.cosThetaPrime + ab.sinThetaPrime * ab.sinThetaPrime;
        expect(norm).toBeCloseTo(1.0, 12);
      }
    }

    logWaves({
      testId: "aberration-trigonometric-identity",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "cos^2 theta' + sin^2 theta' identically equals 1.0 numerically.",
    });
  });

  test("Inverse aberration round-trips with -beta", () => {
    const t0 = performance.now();
    const beta = 0.6;
    for (const theta of [0.05, 0.5, 1.2, 2.0, 2.9]) {
      const fwd = aberration(beta, theta);
      const inv = aberration(-beta, fwd.thetaPrimeRad);
      expect(inv.thetaPrimeRad).toBeCloseTo(theta, 12);
      expect(inv.cosThetaPrime).toBeCloseTo(Math.cos(theta), 12);
    }

    logWaves({
      testId: "aberration-inverse-roundtrip",
      beta,
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Inverse aberration round-trips back to original angle within 1e-12.",
    });
  });

  test("Earth-orbit modern computation gives 20.4956 arcsec with modern computation label", () => {
    const t0 = performance.now();
    const modern = modernEarthOrbitAberration();
    expect(modern.label).toBe("modern computation");
    expect(modern.arcsec).toBeCloseTo(20.4956, 4);
    expect(modern.formatted).toBe('20.4956"');

    // Confirm that no output attributes this modern value to Bradley or 1729
    expect(modern.label).not.toContain("Bradley");
    expect(modern.label).not.toContain("1729");

    logWaves({
      testId: "modern-earth-orbit-aberration",
      resultStatus: "value",
      label: modern.label,
      expected: 20.4956,
      actual: modern.arcsec,
      tolerance: 0.0001,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Earth-orbit modern computation gives 20.4956 arcsec with 'modern computation' label.",
    });
  });

  test("Input ratio of 10,210 gives 20.2022 arcsec computed, not stored", () => {
    const t0 = performance.now();
    const ratio = 10210;
    const computedArcsec = aberrationAngleFromSpeedRatio(ratio);
    expect(computedArcsec).toBeCloseTo(20.2022, 4);

    // Verify it is an analytic computation, not a static lookup
    const ratio2 = 10000;
    const computed2 = aberrationAngleFromSpeedRatio(ratio2);
    const expected2 = (Math.atan(1 / 10000) * 180 * 3600) / Math.PI;
    expect(computed2).toBeCloseTo(expected2, 12);

    logWaves({
      testId: "aberration-speed-ratio-bradley",
      resultStatus: "value",
      expected: 20.2022,
      actual: computedArcsec,
      tolerance: 0.0001,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Input ratio 10,210 yields 20.2022 arcsec dynamically computed.",
    });
  });

  test("Label guard fails on any Bradley or 1729 attribution of the modern value", () => {
    const t0 = performance.now();
    // Valid modern attribution passes
    expect(() => validateAberrationLabel("modern computation", 20.4956)).not.toThrow();
    expect(() => validateAberrationLabel("modern IAU standard", 20.5)).not.toThrow();

    // Valid historical attribution of Bradley's actual ratio passes
    expect(() => validateAberrationLabel("Bradley 1729 (ratio 10,210)", 20.2022)).not.toThrow();

    // Attribution of modern value to Bradley or 1729 is refused by guard
    expect(() => validateAberrationLabel("Bradley 1729", 20.4956)).toThrow(
      /Historical attribution mismatch/,
    );
    expect(() => validateAberrationLabel("Bradley's measurement", 20.5)).toThrow(
      /Historical attribution mismatch/,
    );
    expect(() => validateAberrationLabel("1729 observation", 20.4956)).toThrow(
      /Historical attribution mismatch/,
    );

    logWaves({
      testId: "aberration-label-guard-bradley-separation",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Label guard cleanly prevents attributing modern computed ~20.5 arcsec to Bradley 1729.",
    });
  });

  test("Aberration refuses superluminal and luminal speeds", () => {
    const t0 = performance.now();
    const abSuper = aberration(1.0, Math.PI / 4);
    expect(Number.isNaN(abSuper.cosThetaPrime)).toBe(true);
    expect(Number.isNaN(abSuper.thetaPrimeRad)).toBe(true);

    const abNeg = aberration(-1.2, Math.PI / 4);
    expect(Number.isNaN(abNeg.cosThetaPrime)).toBe(true);

    logWaves({
      testId: "aberration-superluminal-refusal",
      resultStatus: "outside-domain",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Aberration refuses |beta| >= 1 with NaN components.",
    });
  });
});
