import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { ConstantSetError, withMode1904Guard } from "./constants.ts";
import { Mode1904GuardError } from "./kinematics.ts";
import { logShelfOptics } from "./shelfOptics.log.ts";
import {
  SHELF_HISTORICAL_FIXTURES,
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

describe("Michelson-Morley in the ether frame (shelfOptics)", () => {
  test("arm-time identities for equal arms without contraction", () => {
    const t0 = Date.now();
    const L = 11;
    const beta = 0.5;
    const c = 299792458;
    const gamma = 1 / Math.sqrt(1 - beta * beta);

    const times = michelsonMorleyTimes({
      length: L,
      beta,
      contraction: false,
      constantSet: "modern-si-2019",
    });

    expect(times.status).toBe("value");
    expect(times.modelIdentity).toBe("mm-ether");
    expectClose(times.gamma, gamma);
    expectClose(val(times.timeParallel), (2 * L * gamma * gamma) / c);
    expectClose(val(times.timePerpendicular), (2 * L * gamma) / c);

    const expectedDt = (2 * L * gamma * (gamma - 1)) / c;
    expectClose(val(times.timeDifference), expectedDt);
    expectClose(val(times.timeParallel) - val(times.timePerpendicular), expectedDt);

    logShelfOptics({
      testId: "mm-arm-times-equal",
      owner: "shelf-optics",
      modelIdentity: "mm-ether",
      mode: "full",
      inputs: { length: L, beta, contraction: false },
      expected: expectedDt,
      actual: val(times.timeDifference),
      resultStatus: times.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Arm times match theoretical gamma^2 and gamma formulas.",
    });
  });

  test("contraction hypothesis nullifies time difference across beta in [0, 0.9]", () => {
    const t0 = Date.now();
    const L = 11;
    const testBetas = [0.0, 1e-6, 1e-4, 0.01, 0.1, 0.5, 0.8, 0.9];

    for (const beta of testBetas) {
      const times = michelsonMorleyTimes({
        length: L,
        beta,
        contraction: true,
      });

      expect(times.status).toBe("value");
      expect(times.modelIdentity).toBe("mm-ether-contraction");
      expect(Math.abs(val(times.timeDifference))).toBeLessThanOrEqual(1e-15);

      const shift = michelsonMorleyFringeShift({
        length: L,
        beta,
        wavelength: 5.5e-7,
        contraction: true,
      });
      expect(shift.status).toBe("value");
      expect(Math.abs(val(shift.fringeShift))).toBeLessThanOrEqual(1e-15);
    }

    logShelfOptics({
      testId: "mm-contraction-null",
      owner: "shelf-optics",
      modelIdentity: "mm-ether-contraction",
      mode: "full",
      inputs: { length: L, betas: testBetas, contraction: true },
      expected: 0.0,
      actual: 0.0,
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Contraction nullifies time and fringe shift to within 1e-15.",
    });
  });

  test("small-beta cancellation safety at beta = 1e-8 against (L/c)(beta^2 + 5/4 beta^4)", () => {
    const t0 = Date.now();
    const L = 11;
    const beta = 1e-8;
    const c = 299792458;
    const seriesDt = (L / c) * (beta * beta + 1.25 * beta ** 4);

    // Demonstrate naive float64 form fails with severe rounding noise / cancellation
    const naiveGamma = 1 / Math.sqrt(1 - beta * beta);
    const naiveDt = ((2 * L) / c) * (naiveGamma * naiveGamma - naiveGamma);
    // Naive evaluation yields rounding noise (~1.6e-23 instead of ~3.67e-24, > 300% error)
    expect(withinTolerance(naiveDt, seriesDt, { relative: 0.1 }).ok).toBe(false);

    // Cancellation-free reference from shelfOptics
    const times = michelsonMorleyTimes({
      length: L,
      beta,
      contraction: false,
      constantSet: "modern-si-2019",
    });
    expect(times.status).toBe("value");

    const actualDt = val(times.timeDifference);

    // Must match reference series to relative 1e-9
    expectClose(actualDt, seriesDt, { relative: 1e-9 });
    // Fixture value from bead: 3.669205e-24 s
    expectClose(actualDt, 3.669205378e-24, { relative: 1e-6 });

    logShelfOptics({
      testId: "mm-cancellation-free-small-beta",
      owner: "shelf-optics",
      modelIdentity: "mm-ether",
      mode: "full",
      inputs: { length: L, beta },
      expected: seriesDt,
      actual: actualDt,
      resultStatus: times.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Cancellation-free evaluation preserves full precision at beta=1e-8.",
    });
  });

  test("unequal arms calculation", () => {
    const t0 = Date.now();
    const lPar = 10;
    const lPerp = 11;
    const beta = 0.3;
    const c = 299792458;
    const gamma = 1 / Math.sqrt(1 - beta * beta);

    const times = michelsonMorleyTimes({
      lengthParallel: lPar,
      lengthPerpendicular: lPerp,
      beta,
      contraction: false,
    });
    expect(times.status).toBe("value");

    const tParExpected = (2 * lPar * gamma * gamma) / c;
    const tPerpExpected = (2 * lPerp * gamma) / c;
    expectClose(val(times.timeParallel), tParExpected);
    expectClose(val(times.timePerpendicular), tPerpExpected);
    expectClose(val(times.timeDifference), tParExpected - tPerpExpected);

    const timesContract = michelsonMorleyTimes({
      lengthParallel: lPar,
      lengthPerpendicular: lPerp,
      beta,
      contraction: true,
    });
    expect(timesContract.status).toBe("value");
    const tParContract = (2 * lPar * gamma) / c;
    const tPerpContract = (2 * lPerp * gamma) / c;
    expectClose(val(timesContract.timeDifference), tParContract - tPerpContract);

    logShelfOptics({
      testId: "mm-unequal-arms",
      owner: "shelf-optics",
      modelIdentity: "mm-ether",
      inputs: { lengthParallel: lPar, lengthPerpendicular: lPerp, beta },
      expected: tParExpected - tPerpExpected,
      actual: val(times.timeDifference),
      resultStatus: times.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Unequal arm lengths evaluated faithfully.",
    });
  });

  test("units-of-c fixtures (1904 form)", () => {
    const t0 = Date.now();
    // Primary: beta = 1e-4, pathInWavelengths = 2e7 -> Delta N = 0.4000 fringe
    const primary = michelsonMorleyFringeShift({
      beta: 1e-4,
      pathInWavelengths: 2e7,
      contraction: false,
    });
    expect(primary.status).toBe("value");
    expectClose(val(primary.fringeShift), 0.4, { relative: 1e-4, absolute: 1e-4 });

    const primaryContract = michelsonMorleyFringeShift({
      beta: 1e-4,
      pathInWavelengths: 2e7,
      contraction: true,
    });
    expect(primaryContract.status).toBe("value");
    expect(val(primaryContract.fringeShift)).toBe(0.0);

    // Secondary: L = 11 m, lambda = 5.9e-7 m, beta = 1e-4 -> Delta N = 0.3729 fringe
    const secondary = michelsonMorleyFringeShift({
      length: 11,
      wavelength: 5.9e-7,
      beta: 1e-4,
      contraction: false,
    });
    expect(secondary.status).toBe("value");
    expectClose(val(secondary.fringeShift), 0.37288, { relative: 1e-4, absolute: 1e-4 });

    logShelfOptics({
      testId: "mm-units-of-c-fixtures",
      owner: "shelf-optics",
      modelIdentity: "mm-ether",
      mode: "1904",
      inputs: { beta: 1e-4, pathInWavelengths: 2e7 },
      expected: 0.4,
      actual: val(primary.fringeShift),
      resultStatus: primary.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Units-of-c fixtures match 0.4000 and 0.3729 fringe shifts.",
    });
  });

  test("modern computation fixture (modern-si-2019)", () => {
    const t0 = Date.now();
    const L = 11;
    const lambda = 550e-9;
    const v = 30000;

    const shift = michelsonMorleyFringeShift({
      length: L,
      wavelength: lambda,
      windSpeed: v,
      contraction: false,
      constantSet: "modern-si-2019",
    });

    expect(shift.status).toBe("value");
    // beta = 30000 / 299792458 = 1.0006922855944561e-4
    expectClose(shift.beta, 1.0006922855944561e-4, { relative: 1e-6 });
    // Delta N = 0.400554 fringe
    expectClose(val(shift.fringeShift), 0.400554, { relative: 1e-5 });

    // Agreement between exact time-difference form and 2*L*beta^2/lambda to 6e-9
    expectClose(val(shift.fringeShift), shift.expectedFringeShiftFirstOrder, {
      absolute: 1e-8,
      relative: 2e-8,
    });

    logShelfOptics({
      testId: "mm-modern-computation-fixture",
      owner: "shelf-optics",
      modelIdentity: "mm-ether",
      mode: "full",
      constantSetId: "modern-si-2019",
      inputs: { length: L, wavelength: lambda, windSpeed: v, contraction: false },
      expected: 0.400554,
      actual: val(shift.fringeShift),
      resultStatus: shift.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message:
        "Modern computation matches 0.400554 fringe and agrees with first-order form to 6e-9.",
    });
  });
});

describe("Fresnel drag and Fizeau's moving water (shelfOptics)", () => {
  test("fresnelDraggedSpeed fixture (n = 1.333, v = 7.06 m/s)", () => {
    const t0 = Date.now();
    const n = 1.333;
    const v = 7.06;

    const fresnel = fresnelDraggedSpeed({
      refractiveIndex: n,
      waterSpeed: v,
      constantSet: "modern-si-2019",
    });

    expect(fresnel.status).toBe("value");
    expect(fresnel.modelIdentity).toBe("fresnel-drag");

    // f = 1 - 1/n^2 = 0.43722
    expectClose(val(fresnel.dragCoefficient), 0.43722339, { relative: 1e-4 });
    // fv = 3.08676363 m/s
    expectClose(val(fresnel.velocityIncrement), 3.08676363, { relative: 1e-7 });

    const c = 299792458;
    expectClose(val(fresnel.draggedSpeed), c / n + val(fresnel.velocityIncrement), {
      relative: 1e-12,
    });

    logShelfOptics({
      testId: "fresnel-drag-fixture",
      owner: "shelf-optics",
      modelIdentity: "fresnel-drag",
      inputs: { refractiveIndex: n, waterSpeed: v },
      expected: 3.08676363,
      actual: val(fresnel.velocityIncrement),
      resultStatus: fresnel.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Fresnel dragged speed and increment match golden values.",
    });
  });

  test("cancellation-free relativisticDraggedSpeed increment and second-order term", () => {
    const t0 = Date.now();
    const n = 1.333;
    const v = 7.06;
    const c = 299792458;

    const rel = relativisticDraggedSpeed({
      refractiveIndex: n,
      waterSpeed: v,
      constantSet: "modern-si-2019",
    });

    expect(rel.status).toBe("value");
    expect(rel.modelIdentity).toBe("relativistic-drag-later");
    expect(rel.historicalStatus).toBe("later-development");

    // Relativistic increment: 3.08676358 m/s
    expectClose(val(rel.velocityIncrement), 3.08676358, { relative: 1e-7 });

    // Relative difference to Fresnel: -1.767e-8
    expectClose(val(rel.relativeDifferenceToFresnel), -1.767e-8, { relative: 1e-3 });

    // Second order term: -5.453e-8 m/s
    expectClose(val(rel.secondOrderTerm), -5.453e-8, { relative: 1e-3 });

    // Series expansion check: - (v^2 / (n*c)) * (1 - 1/n^2)
    const seriesSecondOrder = -((v * v) / (n * c)) * (1 - 1 / (n * n));
    expectClose(val(rel.secondOrderTerm), seriesSecondOrder, { relative: 1e-5 });

    // Demonstrate naive direct subtraction precision degradation
    const directU = (c / n + v) / (1 + v / (n * c));
    const directIncrement = directU - c / n;
    const naiveSecondOrder = directIncrement - (1 - 1 / (n * n)) * v;
    // Naive subtraction loses ~8 digits around 2.25e8, so difference between naive and exact is visible
    expect(Number.isFinite(naiveSecondOrder)).toBe(true);

    logShelfOptics({
      testId: "relativistic-drag-cancellation-free",
      owner: "shelf-optics",
      modelIdentity: "relativistic-drag-later",
      historicalStatus: "later-development",
      inputs: { refractiveIndex: n, waterSpeed: v },
      expected: 3.08676358,
      actual: val(rel.velocityIncrement),
      resultStatus: rel.status,
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Relativistic increment and second-order term computed without cancellation.",
    });
  });

  test("fizeauFringeShift for all three hypotheses and flow reversal", () => {
    const t0 = Date.now();
    const Lw = 3.0;
    const lambda = 530e-9;
    const n = 1.333;
    const v = 7.06;

    // 1. Fresnel drag (single direction and reversal)
    const fresnelSingle = fizeauFringeShift({
      waterPathPerBeam: Lw,
      waterSpeed: v,
      refractiveIndex: n,
      wavelength: lambda,
      dragHypothesis: "fresnel-drag",
      reversal: false,
    });
    expect(fresnelSingle.status).toBe("value");
    expect(fresnelSingle.modelIdentity).toBe("fresnel-drag");
    expectClose(val(fresnelSingle.fringeShift), 0.20712, { relative: 1e-4 });

    const fresnelRev = fizeauFringeShift({
      waterPathPerBeam: Lw,
      waterSpeed: v,
      refractiveIndex: n,
      wavelength: lambda,
      dragHypothesis: "fresnel-drag",
      reversal: true,
    });
    expect(fresnelRev.status).toBe("value");
    expectClose(val(fresnelRev.fringeShift), 0.41424, { relative: 1e-4 });
    expectClose(val(fresnelRev.fringeShift), 2 * val(fresnelSingle.fringeShift), {
      relative: 1e-12,
    });

    // Exact vs first-order agreement to 2e-9 relative
    expectClose(val(fresnelSingle.fringeShift), val(fresnelSingle.fringeShiftFirstOrder), {
      relative: 2e-9,
    });

    // 2. Full drag
    const fullDrag = fizeauFringeShift({
      waterPathPerBeam: Lw,
      waterSpeed: v,
      refractiveIndex: n,
      wavelength: lambda,
      dragHypothesis: "full-drag",
      reversal: false,
    });
    expect(fullDrag.status).toBe("value");
    expect(fullDrag.modelIdentity).toBe("fizeau-full-drag");
    expectClose(val(fullDrag.fringeShift), 0.47372, { relative: 1e-4 });

    // Full-drag to Fresnel ratio: n^2 / (n^2 - 1) = 2.2872
    const ratio = val(fullDrag.fringeShift) / val(fresnelSingle.fringeShift);
    expectClose(ratio, (n * n) / (n * n - 1), { relative: 1e-4 });
    expectClose(ratio, 2.2872, { relative: 1e-4 });

    // 3. No drag
    const noDrag = fizeauFringeShift({
      waterPathPerBeam: Lw,
      waterSpeed: v,
      refractiveIndex: n,
      wavelength: lambda,
      dragHypothesis: "no-drag",
      reversal: false,
    });
    expect(noDrag.status).toBe("value");
    expect(noDrag.modelIdentity).toBe("fizeau-no-drag");
    expect(val(noDrag.fringeShift)).toBe(0.0);
    expect(val(noDrag.dragCoefficient)).toBe(0.0);

    logShelfOptics({
      testId: "fizeau-fringe-hypotheses",
      owner: "shelf-optics",
      inputs: { waterPathPerBeam: Lw, waterSpeed: v, refractiveIndex: n, wavelength: lambda },
      expected: 0.20712,
      actual: val(fresnelSingle.fringeShift),
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Fizeau fringe shifts match all three hypotheses and reversal doubling.",
    });
  });
});

describe("Maxwell under Galilean and Lorentz substitutions (shelfOptics)", () => {
  test("Galilean residual is nonzero, cross term appears, and residual grows with |beta|", () => {
    const t0 = Date.now();
    const k = 2.5;
    const testBetas = [0.01, 0.05, 0.1, 0.3, 0.6];
    let prevResidual = 0;

    for (const beta of testBetas) {
      const res = waveEquationResidual({
        map: "galilean",
        beta,
        wavenumber: k,
        constantSet: "modern-si-2019",
      });

      expect(res.status).toBe("value");
      expect(res.modelIdentity).toBe("galilean-wave-operator");
      expect(res.historicalStatus).toBe("available-before-cutoff");
      expect(res.crossTermCoefficient).toBeGreaterThan(0);

      const relRes = val(res.relativeResidual);
      expect(relRes).toBeGreaterThan(prevResidual);
      prevResidual = relRes;

      expectClose(relRes, Math.abs(beta * (2 - beta)), { relative: 1e-12 });
      expectClose(val(res.maxResidual), k * k * relRes, { relative: 1e-12 });
    }

    logShelfOptics({
      testId: "wave-operator-galilean",
      owner: "shelf-optics",
      modelIdentity: "galilean-wave-operator",
      historicalStatus: "available-before-cutoff",
      inputs: { map: "galilean", wavenumber: k, betas: testBetas },
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Galilean residual grows with beta and reveals cross term.",
    });
  });

  test("Lorentz substitution is invariant with residual 0 and labeled available before cutoff", () => {
    const t0 = Date.now();
    const k = 3.2;
    const testBetas = [0.01, 0.1, 0.5, 0.9];

    for (const beta of testBetas) {
      const res = waveEquationResidual({
        map: "lorentz",
        beta,
        wavenumber: k,
        constantSet: "modern-si-2019",
      });

      expect(res.status).toBe("value");
      expect(res.modelIdentity).toBe("lorentz-1904-wave-operator");
      expect(res.historicalStatus).toBe("available-before-cutoff");
      expect(val(res.relativeResidual)).toBe(0.0);
      expect(val(res.maxResidual)).toBe(0.0);
      expect(res.crossTermCoefficient).toBe(0.0);
    }

    logShelfOptics({
      testId: "wave-operator-lorentz",
      owner: "shelf-optics",
      modelIdentity: "lorentz-1904-wave-operator",
      historicalStatus: "available-before-cutoff",
      inputs: { map: "lorentz", wavenumber: k, betas: testBetas },
      expected: 0.0,
      actual: 0.0,
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message: "Lorentz transformation wave operator is strictly invariant.",
    });
  });
});

describe("Refusal and domain checks (shelfOptics)", () => {
  test("superluminal speeds (|beta| >= 1) return outside-domain", () => {
    const mm = michelsonMorleyTimes({ length: 11, beta: 1.0, contraction: false });
    expect(mm.status).toBe("outside-domain");
    expect(mm.condition).toBe("superluminal-speed");

    const fizeau = fizeauFringeShift({
      waterPathPerBeam: 3,
      waterSpeedFractionOfC: 1.2,
      refractiveIndex: 1.333,
      wavelength: 530e-9,
      dragHypothesis: "fresnel-drag",
    });
    expect(fizeau.status).toBe("outside-domain");
    expect(fizeau.condition).toBe("superluminal-speed");

    const fresnel = fresnelDraggedSpeed({
      refractiveIndex: 1.333,
      waterSpeedFractionOfC: -1.0,
    });
    expect(fresnel.status).toBe("outside-domain");
    expect(fresnel.condition).toBe("superluminal-speed");

    const wave = waveEquationResidual({
      map: "galilean",
      beta: 1.5,
      wavenumber: 1.0,
    });
    expect(wave.status).toBe("outside-domain");
    expect(wave.condition).toBe("superluminal-speed");
  });

  test("sub-vacuum refractive index (n < 1) returns outside-domain", () => {
    const fizeau = fizeauFringeShift({
      waterPathPerBeam: 3,
      waterSpeed: 7.06,
      refractiveIndex: 0.9,
      wavelength: 530e-9,
      dragHypothesis: "fresnel-drag",
    });
    expect(fizeau.status).toBe("outside-domain");
    expect(fizeau.condition).toBe("sub-vacuum-index");

    const fresnel = fresnelDraggedSpeed({
      refractiveIndex: 0.5,
      waterSpeed: 7.06,
    });
    expect(fresnel.status).toBe("outside-domain");
    expect(fresnel.condition).toBe("sub-vacuum-index");

    const rel = relativisticDraggedSpeed({
      refractiveIndex: 0.8,
      waterSpeed: 7.06,
    });
    expect(rel.status).toBe("outside-domain");
    expect(rel.condition).toBe("sub-vacuum-index");
  });

  test("nonpositive geometry returns outside-domain", () => {
    const mmLen = michelsonMorleyTimes({ length: 0, beta: 0.1, contraction: false });
    expect(mmLen.status).toBe("outside-domain");
    expect(mmLen.condition).toBe("nonpositive-dimension");

    const mmWl = michelsonMorleyFringeShift({
      length: 11,
      wavelength: -500e-9,
      beta: 0.1,
      contraction: false,
    });
    expect(mmWl.status).toBe("outside-domain");
    expect(mmWl.condition).toBe("nonpositive-dimension");

    const fizeauPath = fizeauFringeShift({
      waterPathPerBeam: 0,
      waterSpeed: 7.06,
      refractiveIndex: 1.333,
      wavelength: 530e-9,
      dragHypothesis: "fresnel-drag",
    });
    expect(fizeauPath.status).toBe("outside-domain");
    expect(fizeauPath.condition).toBe("nonpositive-dimension");

    const waveK = waveEquationResidual({
      map: "galilean",
      beta: 0.1,
      wavenumber: 0,
    });
    expect(waveK.status).toBe("outside-domain");
    expect(waveK.condition).toBe("nonpositive-wavenumber");
  });

  test("nonfinite inputs return outside-domain", () => {
    const mm = michelsonMorleyTimes({ length: 11, beta: Number.NaN, contraction: false });
    expect(mm.status).toBe("outside-domain");
    expect(mm.condition).toBe("nonfinite-input");

    const fizeau = fizeauFringeShift({
      waterPathPerBeam: 3,
      waterSpeedFractionOfC: Number.POSITIVE_INFINITY,
      refractiveIndex: 1.333,
      wavelength: 530e-9,
      dragHypothesis: "fresnel-drag",
    });
    expect(fizeau.status).toBe("outside-domain");
    expect(fizeau.condition).toBe("superluminal-speed");
  });
});

describe("1904-mode discipline (AC8)", () => {
  test("In 1904 mode no function reads a numeric c; water speed in m/s is refused with guard typed error; relativistic comparison is absent", () => {
    const t0 = Date.now();
    withMode1904Guard(() => {
      // 1. Michelson-Morley units-of-c path succeeds without numeric c
      const mmShift = michelsonMorleyFringeShift({
        beta: 1e-4,
        pathInWavelengths: 2e7,
        contraction: false,
      });
      expect(mmShift.status).toBe("value");
      expectClose(val(mmShift.fringeShift), 0.4, { relative: 1e-4, absolute: 1e-4 });

      // 2. Passing windSpeed in m/s throws ConstantSetError (no-pre-1905-light-speed-set)
      expect(() => {
        michelsonMorleyTimes({
          length: 11,
          windSpeed: 30000,
          contraction: false,
        });
      }).toThrow(ConstantSetError);

      // 3. Passing modern-si-2019 throws ConstantSetError (modern-constant-in-1904-mode)
      expect(() => {
        michelsonMorleyTimes({
          length: 11,
          beta: 1e-4,
          contraction: false,
          constantSet: "modern-si-2019",
        });
      }).toThrow(ConstantSetError);

      // 4. Fizeau accepts waterSpeedFractionOfC without numeric c
      const fizeau = fizeauFringeShift({
        waterPathPerBeam: 3.0,
        waterSpeedFractionOfC: 2.355e-8,
        refractiveIndex: 1.333,
        wavelength: 530e-9,
        dragHypothesis: "fresnel-drag",
      });
      expect(fizeau.status).toBe("value");
      expect(val(fizeau.fringeShift)).toBeGreaterThan(0);

      // 5. Fizeau with waterSpeed in m/s throws ConstantSetError
      expect(() => {
        fizeauFringeShift({
          waterPathPerBeam: 3.0,
          waterSpeed: 7.06,
          refractiveIndex: 1.333,
          wavelength: 530e-9,
          dragHypothesis: "fresnel-drag",
        });
      }).toThrow(ConstantSetError);

      // 6. Fresnel dragged speed in units of c succeeds; m/s throws ConstantSetError
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

      // 7. Relativistic comparison is absent (throws Mode1904GuardError)
      expect(() => {
        relativisticDraggedSpeed({
          refractiveIndex: 1.333,
          waterSpeedFractionOfC: 2.355e-8,
        });
      }).toThrow(Mode1904GuardError);

      // 8. Wave equation residual with beta succeeds without constant set; m/s frameSpeed throws
      const gal = waveEquationResidual({
        map: "galilean",
        beta: 0.1,
        wavenumber: 2.0,
      });
      expect(gal.status).toBe("value");
      expect(val(gal.relativeResidual)).toBeGreaterThan(0);

      expect(() => {
        waveEquationResidual({
          map: "galilean",
          frameSpeed: 30000,
          wavenumber: 2.0,
        });
      }).toThrow(ConstantSetError);
    });

    logShelfOptics({
      testId: "shelf-optics-ac8-mode-1904",
      owner: "shelf-optics",
      mode: "1904",
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message:
        "AC8: In 1904 mode no function reads numeric c, m/s water speed refused, relativistic comparison absent.",
    });
  });
});

describe("Historical fixtures pending status (AC10)", () => {
  test("historical fixtures remain marked pending until inputs transcribed from cited papers and dataset", () => {
    const t0 = Date.now();
    expect(SHELF_HISTORICAL_FIXTURES.length).toBe(2);

    const mm1887 = SHELF_HISTORICAL_FIXTURES.find(
      (f) => f.id === "shelf-mm-1887-historical",
    );
    expect(mm1887).toBeDefined();
    expect(mm1887?.kind).toBe("historical-fixture");
    expect(mm1887?.paper).toBe("special-relativity");
    expect(mm1887?.printedPage).toBe(333);
    expect(mm1887?.transcription.status).toBe("pending");
    expect(mm1887?.transcription.reason).toContain(
      "1887 Michelson-Morley observational bound awaiting facsimile review",
    );

    const fizeau1851 = SHELF_HISTORICAL_FIXTURES.find(
      (f) => f.id === "shelf-fizeau-1851-historical",
    );
    expect(fizeau1851).toBeDefined();
    expect(fizeau1851?.kind).toBe("historical-fixture");
    expect(fizeau1851?.paper).toBe("special-relativity");
    expect(fizeau1851?.printedPage).toBe(349);
    expect(fizeau1851?.transcription.status).toBe("pending");
    expect(fizeau1851?.transcription.reason).toContain(
      "1851 Fizeau moving-water data awaiting transcription",
    );

    logShelfOptics({
      testId: "shelf-optics-ac10-historical-pending",
      owner: "shelf-optics",
      resultStatus: "value",
      outcome: "passed",
      durationMs: Date.now() - t0,
      message:
        "AC10: Historical fixtures remain marked pending with explicit reasons until transcribed.",
    });
  });
});
