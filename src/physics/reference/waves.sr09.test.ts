import { describe, expect, test } from "bun:test";
import {
  aberration,
  classicalObserverDopplerFactor,
  classicalSourceDopplerFactor,
  dopplerFactor,
  evaluateSr09,
  transformWaveVector,
} from "./waves.ts";

describe("SR-09 Doppler and aberration from one transform", () => {
  test("dopplerFactor and aberration match transformWaveVector at 0.6c transverse", () => {
    const beta = 0.6;
    const theta = Math.PI / 2;
    const boosted = transformWaveVector(
      1,
      { x: Math.cos(theta), y: Math.sin(theta), z: 0 },
      beta,
      1,
    );
    expect(dopplerFactor(beta, theta)).toBeCloseTo(boosted.omegaPrime, 12);
    expect(dopplerFactor(beta, theta)).toBeCloseTo(1.25, 12);
    const ab = aberration(beta, theta);
    expect(ab.cosThetaPrime).toBeCloseTo(boosted.kPrime.x / boosted.omegaPrime, 12);
    expect(ab.sinThetaPrime).toBeCloseTo(boosted.kPrime.y / boosted.omegaPrime, 12);
    expect(ab.cosThetaPrime).toBeCloseTo(-0.6, 12);
  });

  test("transverse: relativistic factor is gamma, both medium formulae are 1", () => {
    const beta = 0.6;
    const theta = Math.PI / 2;
    expect(dopplerFactor(beta, theta)).toBeCloseTo(1.25, 12);
    expect(classicalObserverDopplerFactor(beta, theta)).toBeCloseTo(1, 12);
    expect(classicalSourceDopplerFactor(beta, theta)).toBeCloseTo(1, 12);
  });

  test("evaluateSr09 publishes classical and line-of-sight factors from the snapshot", () => {
    const snap = evaluateSr09({
      beta: 0.6,
      propagationAngleDeg: 90,
      frequencyHz: 5e14,
    });
    expect(snap.status).toBe("value");
    expect(snap.dopplerFactor).toBeCloseTo(1.25, 12);
    const classicalO = snap.results.find((r) => r.quantityId === "classicalObserverDopplerFactor");
    const classicalS = snap.results.find((r) => r.quantityId === "classicalSourceDopplerFactor");
    expect(classicalO?.status).toBe("value");
    expect(classicalS?.status).toBe("value");
    if (classicalO?.status === "value" && typeof classicalO.value === "number") {
      expect(classicalO.value).toBeCloseTo(1, 12);
    }
  });

  test("|beta| >= 1 is outside-domain, not a clamp", () => {
    const snap = evaluateSr09({
      beta: 1,
      propagationAngleDeg: 0,
      frequencyHz: 5e14,
    });
    expect(snap.status).toBe("outside-domain");
    expect(snap.results.every((r) => r.status === "outside-domain")).toBe(true);
    expect(snap.results[0] && "reason" in snap.results[0] ? snap.results[0].reason : "").toContain(
      "|v| >= c",
    );
  });
});

describe("SR-09 detector clocks and counting windows", () => {
  const frequencyHz = 5e14;
  const trial = {
    beta: 0.6,
    propagationAngleDeg: 0,
    frequencyHz,
    countingWindow: 20 / frequencyHz,
  };

  test("rest modes override custom speed and each detector uses its own clock", () => {
    // Twenty source cycles elapse in K. The moving detector counts fewer or more fronts;
    // converting that interval to its own time is a separate operation.
    for (const { mode, speed, count, rate } of [
      { mode: "rest-in-K", speed: 0.8, count: 20, rate: 1 },
      { mode: "rest-in-k", speed: 0, count: 8, rate: 0.5 },
      { mode: "custom", speed: -0.8, count: 36, rate: 3 },
    ] as const) {
      const snap = evaluateSr09({ ...trial, detectorMotion: mode, detectorSpeed: speed });
      expect(snap.status).toBe("value");
      expect(snap.detectorCrossings).toBeCloseTo(count, 12);
      expect(snap.detectorProperRateHz / frequencyHz).toBeCloseTo(rate, 12);
    }
  });

  test("a custom detector's count and proper rate do not depend on the viewing frame", () => {
    for (const beta of [-0.8, 0, 0.6]) {
      const snap = evaluateSr09({
        ...trial,
        beta,
        detectorMotion: "custom",
        detectorSpeed: -0.6,
      });
      expect(snap.detectorCrossings).toBeCloseTo(32, 12);
      expect(snap.detectorProperRateHz / frequencyHz).toBeCloseTo(2, 12);
    }
  });

  test("a detector at rest in k measures the transformed wave frequency", () => {
    for (const beta of [-0.6, 0, 0.6, 0.8]) {
      for (const propagationAngleDeg of [0, 60, 90, 180, 270]) {
        const snap = evaluateSr09({
          ...trial,
          beta,
          propagationAngleDeg,
          detectorMotion: "rest-in-k",
          detectorSpeed: -0.8,
        });
        expect(snap.detectorProperRateHz / snap.waveFrequencyMovingHz).toBeCloseTo(1, 12);
      }
    }
  });

  test("a longer coordinate window changes the count without changing the proper rate", () => {
    const base = evaluateSr09({ ...trial, detectorMotion: "rest-in-k" });
    for (const cycles of [5, 10, 40]) {
      const snap = evaluateSr09({
        ...trial,
        detectorMotion: "rest-in-k",
        countingWindow: cycles / frequencyHz,
      });
      expect(snap.detectorCrossings / base.detectorCrossings).toBeCloseTo(cycles / 20, 12);
      expect(snap.detectorProperRateHz / base.detectorProperRateHz).toBeCloseTo(1, 12);
    }
  });

  test("legacy callers without a detector mode retain their velocity selection", () => {
    for (const { speed, count, rate } of [
      { speed: null, count: 8, rate: 0.5 },
      { speed: 0, count: 20, rate: 1 },
      { speed: -0.6, count: 32, rate: 2 },
    ]) {
      const snap = evaluateSr09(speed === null ? trial : { ...trial, detectorSpeed: speed });
      expect(snap.detectorCrossings).toBeCloseTo(count, 12);
      expect(snap.detectorProperRateHz / frequencyHz).toBeCloseTo(rate, 12);
    }
  });
});
