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
