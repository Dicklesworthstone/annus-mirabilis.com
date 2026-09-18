import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { getQuantity, UnknownQuantityError } from "../../content/quantities/registry.ts";
import { gamma } from "./kinematics.ts";
import { logWaves } from "./waves.log.ts";
import {
  C_SI,
  FORBIDDEN_PHASE_CALLEES,
  phaseAtEvent,
  transformWaveVector,
  verifyPhaseAtEventIndependence,
} from "./waves.ts";

describe("am-ref-waves-r53: waves.phaseAtEvent.test.ts", () => {
  test("hand-computed phases on wavefront, origin, and unwrapped cycles downstream", () => {
    const t0 = performance.now();
    const omega = 100;
    const c = 1.0;
    const kMag = omega / c;
    const wave = { omega, kx: kMag, ky: 0, kz: 0 }; // propagating along +x
    const lambda = (2 * Math.PI) / kMag;

    // 1. Origin (t = 0, x = 0) -> phase = 0
    const resOrigin = phaseAtEvent({ t: 0, x: 0, y: 0, z: 0 }, wave);
    expect(resOrigin.status).toBe("value");
    if (resOrigin.status === "value") {
      expect(resOrigin.value).toBe(0);
      expect(resOrigin.quantityId).toBe("wavePhase");
      expect(resOrigin.unit).toBe("rad");
      expect(resOrigin.semanticKind).toBe("angle");
      expect(resOrigin.frame).toBe("frame-independent");
    }

    // 2. One full cycle downstream (t = 0, x = lambda) -> phase = k*lambda = 2*pi
    const resOneCycle = phaseAtEvent({ t: 0, x: lambda, y: 0, z: 0 }, wave);
    expect(resOneCycle.status).toBe("value");
    if (resOneCycle.status === "value") {
      expect(resOneCycle.value).toBeCloseTo(2 * Math.PI, 12);
    }

    // 3. Ten full cycles downstream (t = 0, x = 10 * lambda) -> phase = 20*pi (unwrapped, not 0)
    const resTenCycles = phaseAtEvent({ t: 0, x: 10 * lambda, y: 0, z: 0 }, wave);
    expect(resTenCycles.status).toBe("value");
    if (resTenCycles.status === "value") {
      expect(resTenCycles.value).toBeCloseTo(20 * Math.PI, 12);
      expect(resTenCycles.value).not.toBeCloseTo(0, 5);
    }

    // 4. Propagating wavefront point: x = c*t -> phase = k*(c*t) - omega*t = 0
    const resWavefront = phaseAtEvent({ t: 2.5, x: 2.5 * c, y: 0, z: 0 }, wave);
    expect(resWavefront.status).toBe("value");
    if (resWavefront.status === "value") {
      expect(Math.abs(resWavefront.value as number)).toBeLessThan(1e-12);
    }

    logWaves({
      testId: "hand-computed-phase-unwrapped",
      resultStatus: "value",
      expected: 20 * Math.PI,
      actual:
        resTenCycles.status === "value" && typeof resTenCycles.value === "number"
          ? resTenCycles.value
          : undefined,
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Origin gives 0, 1 cycle gives 2pi, 10 cycles gives 20pi unwrapped.",
      extra: {
        wavePhase:
          resTenCycles.status === "value" && typeof resTenCycles.value === "number"
            ? resTenCycles.value
            : undefined,
        wavePhaseFrame: resTenCycles.frame,
      },
    });
  });

  test("nonfinite coordinates and components return outside-domain naming the field", () => {
    const t0 = performance.now();
    const validCoords = { t: 1, x: 2, y: 3, z: 4 };
    const validWave = { omega: 10, kx: 1, ky: 0, kz: 0 };

    const coordFields = ["t", "x", "y", "z"] as const;
    for (const field of coordFields) {
      const badCoords = { ...validCoords, [field]: Number.NaN };
      const res = phaseAtEvent(badCoords, validWave);
      expect(res.status).toBe("outside-domain");
      if (res.status === "outside-domain") {
        expect(res.condition).toBe("nonfinite-input");
        expect(res.reason).toContain(`coordinates.${field}`);
        expect(res.boundary).toEqual({ parameterId: `coordinates.${field}`, value: 0 });
      }
    }

    const waveFields = ["omega", "kx", "ky", "kz"] as const;
    for (const field of waveFields) {
      const badWave = { ...validWave, [field]: Number.POSITIVE_INFINITY };
      const res = phaseAtEvent(validCoords, badWave);
      expect(res.status).toBe("outside-domain");
      if (res.status === "outside-domain") {
        expect(res.condition).toBe("nonfinite-input");
        expect(res.reason).toContain(`waveComponents.${field}`);
        expect(res.boundary).toEqual({ parameterId: `waveComponents.${field}`, value: 0 });
      }
    }

    logWaves({
      testId: "nonfinite-fields-outside-domain-named",
      resultStatus: "outside-domain",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Nonfinite coordinates and components return outside-domain with named parameterId.",
    });
  });

  test("wavePhase resolves in the canonical registry, while bare phase throws UnknownQuantityError", () => {
    const t0 = performance.now();
    const qRecord = getQuantity("wavePhase");
    expect(qRecord.id).toBe("wavePhase");
    expect(qRecord.frame).toBe("frame-independent");
    expect(qRecord.dimensionlessKind).toBe("angle");
    expect(qRecord.mathematicalKind).toBe("scalar");

    // Bare "phase" is not a registered quantity and throws UnknownQuantityError
    expect(() => getQuantity("phase")).toThrow(UnknownQuantityError);

    logWaves({
      testId: "wavePhase-registry-binding-verification",
      resultStatus: "value",
      expected: "wavePhase",
      actual: qRecord.id,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "wavePhase resolves in registry; bare phase throws UnknownQuantityError.",
    });
  });

  test("phase invariance the honest way across sweep of speeds and angles", () => {
    const t0 = performance.now();
    const speeds = [0, -0.6, 0.6, -0.95, 0.95];
    const angles = [0, (30 * Math.PI) / 180, Math.PI / 2, Math.PI];

    for (const beta of speeds) {
      const gRes = gamma(beta);
      if (gRes.status !== "value") continue;
      const g = gRes.value;

      for (const theta of angles) {
        const omegaK = 5e14 * 2 * Math.PI;
        const kMag = omegaK / C_SI;
        const kxK = kMag * Math.cos(theta);
        const kyK = kMag * Math.sin(theta);
        const kzK = 0;

        const eventK = { t: 1e-15, x: 2e-7, y: 1.5e-7, z: 0 };
        const event_k = {
          t: g * (eventK.t - (beta * eventK.x) / C_SI),
          x: g * (eventK.x - beta * C_SI * eventK.t),
          y: eventK.y,
          z: eventK.z,
        };

        const waveK = { omega: omegaK, kx: kxK, ky: kyK, kz: kzK };
        const boosted = transformWaveVector(omegaK, { x: kxK, y: kyK, z: kzK }, beta, C_SI);
        const wave_k = {
          omega: boosted.omegaPrime,
          kx: boosted.kPrime.x,
          ky: boosted.kPrime.y,
          kz: boosted.kPrime.z,
        };

        const phaseK = phaseAtEvent(eventK, waveK, "K");
        const phase_k = phaseAtEvent(event_k, wave_k, "k");

        expect(phaseK.status).toBe("value");
        expect(phase_k.status).toBe("value");

        if (phaseK.status === "value" && phase_k.status === "value") {
          const diff = Math.abs((phaseK.value as number) - (phase_k.value as number));
          expect(diff).toBeLessThan(1e-12);
        }
      }
    }

    logWaves({
      testId: "honest-phase-invariance-sweep",
      resultStatus: "value",
      tolerance: 1e-12,
      comparisonKind: "absolute",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Independently computed phases in K and k agree within 1e-12 across beta and theta.",
    });
  });

  test("structural call-graph check: phaseAtEvent is independent, planted calls fail", () => {
    const t0 = performance.now();
    const wavesSource = readFileSync(
      fileURLToPath(new URL("./waves.ts", import.meta.url)),
      "utf-8",
    );
    const check = verifyPhaseAtEventIndependence(wavesSource);
    expect(check.independent).toBe(true);
    expect(check.forbiddenCalleesFound).toHaveLength(0);

    // Planted call tests: verify that each of the four forbidden callees is caught and named
    for (const callee of FORBIDDEN_PHASE_CALLEES) {
      const planted = `
        function phaseAtEvent(coordinates, waveComponents) {
          const leak = ${callee}(0, 0);
          return leak;
        }
      `;
      const plantedCheck = verifyPhaseAtEventIndependence(planted);
      expect(plantedCheck.independent).toBe(false);
      expect(plantedCheck.forbiddenCalleesFound).toContain(callee);
    }

    logWaves({
      testId: "structural-callgraph-phaseAtEvent-independence",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "phaseAtEvent call graph contains no forbidden Doppler/aberration/lightComplex callees.",
      extra: {
        forbiddenCalleesFound: check.forbiddenCalleesFound,
      },
    });
  });
});
