import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { ConstantSetError, withMode1904Guard } from "./constants.ts";
import { Mode1904GuardError } from "./kinematics.ts";
import { logShelfOptics } from "./shelfOptics.log.ts";
import {
  fizeauFringeShift,
  fresnelDraggedSpeed,
  michelsonMorleyFringeShift,
  michelsonMorleyTimes,
  relativisticDraggedSpeed,
  waveEquationResidual,
} from "./shelfOptics.ts";

function val(r: ScientificResult): number {
  if (r.status !== "value" || typeof r.value !== "number") {
    throw new Error(`expected value status, got ${r.status}`);
  }
  return r.value;
}

function expectClose(
  actual: number,
  expected: number,
  tolerance: { relative?: number; absolute?: number; relativeTo?: "larger" | "reference" } = {
    relative: 1e-9,
    absolute: 1e-12,
  },
): void {
  const verdict = withinTolerance(actual, expected, tolerance);
  if (!verdict.ok) {
    throw new Error(
      `expected ${actual} to be within tolerance of ${expected} (diff: ${verdict.diff}, allowed: ${verdict.allowed})`,
    );
  }
}

describe("1904-mode discipline (shelfOptics)", () => {
  test("Michelson-Morley units-of-c path succeeds under guard; m/s input or modern set throws", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      // Units of c form succeeds without constant set
      const mmShift = michelsonMorleyFringeShift({
        beta: 1e-4,
        pathInWavelengths: 2e7,
        contraction: false,
      });
      expect(mmShift.status).toBe("value");
      expectClose(val(mmShift.fringeShift), 0.4, { relative: 1e-4, absolute: 1e-4 });

      // Passing windSpeed in m/s without constant set throws no-pre-1905-light-speed-set
      expect(() => {
        michelsonMorleyTimes({
          length: 11,
          windSpeed: 30000,
          contraction: false,
        });
      }).toThrow(ConstantSetError);

      // Passing modern-si-2019 throws modern-constant-in-1904-mode
      expect(() => {
        michelsonMorleyTimes({
          length: 11,
          beta: 1e-4,
          contraction: false,
          constantSet: "modern-si-2019",
        });
      }).toThrow(ConstantSetError);
    });

    logShelfOptics({
      testId: "mm-mode-1904",
      owner: "shelf-optics",
      mode: "1904",
      inputs: { beta: 1e-4, pathInWavelengths: 2e7 },
      expected: 0.4,
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "MM units-of-c succeeds in 1904 mode, m/s input refused.",
    });
  });

  test("Fizeau accepts waterSpeedFractionOfC; waterSpeed in m/s or modern set throws", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      // waterSpeedFractionOfC succeeds without constant set
      const fizeau = fizeauFringeShift({
        waterPathPerBeam: 3.0,
        waterSpeedFractionOfC: 2.355e-8,
        refractiveIndex: 1.333,
        wavelength: 530e-9,
        dragHypothesis: "fresnel-drag",
      });
      expect(fizeau.status).toBe("value");
      expect(val(fizeau.fringeShift)).toBeGreaterThan(0);

      // waterSpeed in m/s throws no-pre-1905-light-speed-set
      expect(() => {
        fizeauFringeShift({
          waterPathPerBeam: 3.0,
          waterSpeed: 7.06,
          refractiveIndex: 1.333,
          wavelength: 530e-9,
          dragHypothesis: "fresnel-drag",
        });
      }).toThrow(ConstantSetError);

      // Explicit modern set throws modern-constant-in-1904-mode
      expect(() => {
        fizeauFringeShift({
          waterPathPerBeam: 3.0,
          waterSpeed: 7.06,
          refractiveIndex: 1.333,
          wavelength: 530e-9,
          dragHypothesis: "fresnel-drag",
          constantSet: "modern-si-2019",
        });
      }).toThrow(ConstantSetError);
    });

    logShelfOptics({
      testId: "fizeau-mode-1904",
      owner: "shelf-optics",
      mode: "1904",
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Fizeau m/s water speed refused in 1904 mode.",
    });
  });

  test("Fresnel dragged speed in units of c succeeds; m/s input throws", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      const fresnel = fresnelDraggedSpeed({
        refractiveIndex: 1.333,
        waterSpeedFractionOfC: 2.355e-8,
      });
      expect(fresnel.status).toBe("value");
      expect(val(fresnel.dragCoefficient)).toBeGreaterThan(0);

      expect(() => {
        fresnelDraggedSpeed({
          refractiveIndex: 1.333,
          waterSpeed: 7.06,
        });
      }).toThrow(ConstantSetError);
    });

    logShelfOptics({
      testId: "fresnel-drag-mode-1904",
      owner: "shelf-optics",
      mode: "1904",
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Fresnel dragged speed units-of-c succeeds; m/s throws under guard.",
    });
  });

  test("relativisticDraggedSpeed is refused in 1904 mode", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      expect(() => {
        relativisticDraggedSpeed({
          refractiveIndex: 1.333,
          waterSpeedFractionOfC: 2.355e-8,
        });
      }).toThrow(Mode1904GuardError);
    });

    logShelfOptics({
      testId: "relativistic-drag-mode-1904-refused",
      owner: "shelf-optics",
      mode: "1904",
      resultStatus: "refused",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Relativistic dragged speed refused with Mode1904GuardError.",
    });
  });

  test("Wave equation residual with beta succeeds without constant set", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      const gal = waveEquationResidual({
        map: "galilean",
        beta: 0.1,
        wavenumber: 2.0,
      });
      expect(gal.status).toBe("value");
      expect(val(gal.relativeResidual)).toBeGreaterThan(0);

      const lor = waveEquationResidual({
        map: "lorentz",
        beta: 0.1,
        wavenumber: 2.0,
      });
      expect(lor.status).toBe("value");
      expect(val(lor.relativeResidual)).toBe(0.0);

      expect(() => {
        waveEquationResidual({
          map: "galilean",
          frameSpeed: 30000,
          wavenumber: 2.0,
        });
      }).toThrow(ConstantSetError);
    });

    logShelfOptics({
      testId: "wave-residual-mode-1904",
      owner: "shelf-optics",
      mode: "1904",
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Wave equation residual dimensionless evaluation succeeds in 1904 mode.",
    });
  });
});
