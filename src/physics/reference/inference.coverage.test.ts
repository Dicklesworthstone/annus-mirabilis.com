/**
 * THE SEEDED COVERAGE STUDY, AND ITS TWO WRONG-INTERVAL DETECTORS (am-ref-inference-2w9).
 *
 * The bead's third acceptance criterion, verbatim: "10 000 seeded synthetic experiments at q = 40
 * (d = 2, M = 20) and 95% nominal coverage fall inside the exact binomial band at family-wise error
 * 10^-6 (about [0.9393, 0.9607]). The same study detects the wrong-degrees-of-freedom interval
 * (using q = M, coverage 0.9944) and the forgotten-d estimator (coverage 0.1158)."
 *
 * DECLARED IN THE HEADER, as the bead's test plan asks ("seeds, sample sizes, family-wise error, and
 * bands declared in the test header; the two wrong-interval detectors; no reruns"):
 *
 *   trials            10 000          seed "1905"        kernel 0x19050004
 *   d = 2, M = 20  -> q = d*M = 40    dt = 1 s           D_true = 4.29439564555e-13 m^2/s
 *   nominal coverage 0.95             family-wise error 1e-6
 *   exact binomial band [0.9390, 0.9603]   (the bead's "about [0.9393, 0.9607]" is the normal
 *                                           approximation to it; both are computed below)
 *
 * NO GOLDEN NUMBERS, WHICH IS THE POINT. An empirical coverage depends on the seed, so pinning the
 * bead's 0.9944 and 0.1158 as goldens would freeze my seed choice and prove nothing about the
 * statistics. Instead each variant's coverage is PREDICTED analytically from the same
 * `chiSquareQuantile` the owner uses, by inverting it with bisection, and the empirical figure is
 * required to agree with its own prediction inside the binomial band. The bead's two figures then
 * become checkable predictions rather than recorded observations, and they are checked below.
 *
 * WHY THE TWO WRONG VARIANTS GO THE WAY THEY DO, since a detector whose direction is not understood
 * is a detector nobody can repair:
 *
 *   wrong degrees of freedom (q = M = 20 instead of d*M = 40). The pivot q*Dhat/D is chi-square on
 *     40, but the interval is built from chi-square-20 quantiles and is scaled by q = 20, so it is
 *     too WIDE and the coverage rises to about 0.992. An over-covering interval is the dangerous
 *     direction: it never looks wrong on an example, it just quietly claims less precision.
 *   forgotten d (dividing by 2*M*dt instead of 2*d*M*dt). The estimate is d = 2 times too large, so
 *     the whole interval is translated away from the truth and coverage collapses to about 0.11.
 *
 * Note the one case the fixture CANNOT discriminate, for the same reason rows 7 and 9 record theirs:
 * at d = 1 the forgotten-d error vanishes identically, and q = d*M = M makes the wrong-degrees-of-
 * freedom error vanish too. A coverage study run in one dimension detects neither defect. That is
 * why d = 2 is declared above rather than chosen.
 */
import { expect, test } from "bun:test";
import { normalQuantile } from "./diffusion/statistics.ts";
import { chiSquareQuantile } from "./diffusion.ts";
import { chiSquareInterval, estimateIncrements, estimatorInterval } from "./inference.ts";
import { createPhiloxStream } from "./philox.ts";

const TRIALS = 10_000;
const SEED = "1905";
const KERNEL = 0x19050004;
const DIMENSIONS = 2;
const INCREMENTS = 20;
const DEGREES_OF_FREEDOM = DIMENSIONS * INCREMENTS;
const DT = 1;
const D_TRUE = 4.29439564555e-13;
const NOMINAL = 0.95;
const ALPHA = 1 - NOMINAL;
const FAMILY_WISE_ERROR = 1e-6;

/**
 * The EXACT binomial band, by a pmf recurrence rather than a normal approximation.
 *
 * p(k+1)/p(k) = ((n-k)/(k+1)) * (p/(1-p)), summed outward from the mode, so no log-gamma is needed
 * and the result is exact to double precision. The band is the smallest [lo, hi] whose two tails are
 * each at most half the family-wise error.
 */
function exactBinomialBand(
  n: number,
  p: number,
  familyWiseError: number,
): Readonly<{ lower: number; upper: number }> {
  const mode = Math.floor((n + 1) * p);
  const ratio = p / (1 - p);
  const weight = new Map<number, number>([[mode, 1]]);
  let w = 1;
  for (let k = mode; k < n; k += 1) {
    w *= ((n - k) / (k + 1)) * ratio;
    if (w < 1e-300) break;
    weight.set(k + 1, w);
  }
  w = 1;
  for (let k = mode; k > 0; k -= 1) {
    w /= ((n - k + 1) / k) * ratio;
    if (w < 1e-300) break;
    weight.set(k - 1, w);
  }
  const total = [...weight.values()].reduce((sum, value) => sum + value, 0);
  const tail = familyWiseError / 2;
  const keys = [...weight.keys()].sort((a, b) => a - b);
  let cumulative = 0;
  let lower = keys[0] as number;
  for (const k of keys) {
    cumulative += (weight.get(k) as number) / total;
    if (cumulative > tail) {
      lower = k;
      break;
    }
  }
  cumulative = 0;
  let upper = keys[keys.length - 1] as number;
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    const k = keys[i] as number;
    cumulative += (weight.get(k) as number) / total;
    if (cumulative > tail) {
      upper = k;
      break;
    }
  }
  return Object.freeze({ lower: lower / n, upper: upper / n });
}

/** The quantile accepted, or a thrown test failure naming which call refused. */
function quantile(q: number, p: number): number {
  const result = chiSquareQuantile(q, p);
  if (result.kind !== "accepted") {
    throw new Error(`chiSquareQuantile(${q}, ${p}) was ${result.kind}, not accepted`);
  }
  return result.data;
}

/**
 * The chi-square CDF on `q`, by inverting the owner's own quantile with bisection.
 *
 * Deliberately not a second chi-square implementation: the prediction and the interval then rest on
 * the SAME function, so this cannot pass by one of them being wrong in a compensating way. The
 * repository has no chi-square CDF, and adding one for a test would be a competing implementation of
 * the thing under test.
 */
function chiSquareCdf(q: number, x: number): number {
  if (x <= 0) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid <= 0 || mid >= 1) break;
    if (quantile(q, mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One trial's d*M increments, each component normal with variance 2*D*dt. */
function increments(stream: { nextNormal(): number }): Float64Array {
  const sigma = Math.sqrt(2 * D_TRUE * DT);
  const out = new Float64Array(DIMENSIONS * INCREMENTS);
  for (let i = 0; i < out.length; i += 1) out[i] = sigma * stream.nextNormal();
  return out;
}

const band = exactBinomialBand(TRIALS, NOMINAL, FAMILY_WISE_ERROR);

test("the EXACT binomial band, and why the bead's parenthetical differs from it", () => {
  // The bead asks for "the exact binomial band at family-wise error 10^-6 (about [0.9393, 0.9607])".
  // Computed rather than copied, the exact band is [0.9390, 0.9603]. The bead's figures are the
  // NORMAL APPROXIMATION to it, which the second half of this test reproduces to four decimals, so
  // the difference is explained here instead of absorbed into a looser assertion. The bead says
  // "about", so it is imprecise rather than wrong -- and the exact upper bound is BELOW the
  // approximate one, which makes using the exact band slightly stricter on the over-coverage side,
  // the side the wrong-degrees-of-freedom detector lives on.
  expect(band.lower.toFixed(4)).toBe("0.9390");
  expect(band.upper.toFixed(4)).toBe("0.9603");

  const z = normalQuantile(1 - FAMILY_WISE_ERROR / 2);
  if (z.kind !== "accepted") throw new Error(`normalQuantile refused: ${z.kind}`);
  const halfWidth = z.data * Math.sqrt((NOMINAL * (1 - NOMINAL)) / TRIALS);
  expect((NOMINAL - halfWidth).toFixed(4)).toBe("0.9393");
  expect((NOMINAL + halfWidth).toFixed(4)).toBe("0.9607");

  // And the exact band is contained in neither direction by accident: it is shifted DOWN by the
  // binomial's skew at p = 0.95, so both endpoints are lower than the symmetric approximation.
  expect(band.lower).toBeLessThan(NOMINAL - halfWidth);
  expect(band.upper).toBeLessThan(NOMINAL + halfWidth);
});

test("the seeded coverage study, and the two wrong-interval detectors", () => {
  const stream = createPhiloxStream({ seed: SEED, kernel: KERNEL, tile: 0 });
  let correct = 0;
  let wrongDegreesOfFreedom = 0;
  let forgottenDimension = 0;

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const estimate = estimateIncrements(
      increments(stream),
      DT,
      DIMENSIONS,
      "independent-increment-known-zero-drift",
    );
    if (estimate.kind !== "accepted") throw new Error(`trial ${trial}: ${estimate.kind}`);
    expect(estimate.data.q).toBe(DEGREES_OF_FREEDOM);

    // THE CORRECT PATH, entirely through the owner.
    const ok = estimatorInterval(estimate.data, ALPHA);
    if (ok.kind !== "accepted") throw new Error(`trial ${trial} interval: ${ok.kind}`);
    if (D_TRUE >= ok.data.lower && D_TRUE <= ok.data.upper) correct += 1;

    // DETECTOR 1: the owner's own estimate and the owner's own interval, with q = M.
    const wrongQ = chiSquareInterval({
      dHat: estimate.data.unbiasedDHat,
      q: INCREMENTS,
      alpha: ALPHA,
    });
    if (wrongQ.kind !== "accepted") throw new Error(`trial ${trial} wrong-q: ${wrongQ.kind}`);
    if (D_TRUE >= wrongQ.data.lower && D_TRUE <= wrongQ.data.upper) wrongDegreesOfFreedom += 1;

    // DETECTOR 2: the estimate a reader gets who divides by 2*M*dt, through the real interval.
    const forgotten = chiSquareInterval({
      dHat: estimate.data.unbiasedDHat * DIMENSIONS,
      q: estimate.data.q,
      alpha: ALPHA,
    });
    if (forgotten.kind !== "accepted") throw new Error(`trial ${trial} forgotten-d`);
    if (D_TRUE >= forgotten.data.lower && D_TRUE <= forgotten.data.upper) forgottenDimension += 1;
  }

  const observed = {
    correct: correct / TRIALS,
    wrongDegreesOfFreedom: wrongDegreesOfFreedom / TRIALS,
    forgottenDimension: forgottenDimension / TRIALS,
  };

  // THE ANALYTIC PREDICTIONS, from the same quantile function the intervals use.
  const loCorrect = quantile(DEGREES_OF_FREEDOM, ALPHA / 2);
  const hiCorrect = quantile(DEGREES_OF_FREEDOM, 1 - ALPHA / 2);
  const scale = DEGREES_OF_FREEDOM / INCREMENTS;
  const predicted = {
    correct:
      chiSquareCdf(DEGREES_OF_FREEDOM, hiCorrect) - chiSquareCdf(DEGREES_OF_FREEDOM, loCorrect),
    wrongDegreesOfFreedom:
      chiSquareCdf(DEGREES_OF_FREEDOM, quantile(INCREMENTS, 1 - ALPHA / 2) * scale) -
      chiSquareCdf(DEGREES_OF_FREEDOM, quantile(INCREMENTS, ALPHA / 2) * scale),
    forgottenDimension:
      chiSquareCdf(DEGREES_OF_FREEDOM, hiCorrect / DIMENSIONS) -
      chiSquareCdf(DEGREES_OF_FREEDOM, loCorrect / DIMENSIONS),
  };

  console.log(
    `[inference coverage] ${TRIALS} trials, seed ${SEED}, d=${DIMENSIONS} M=${INCREMENTS} q=${DEGREES_OF_FREEDOM}; ` +
      `band [${band.lower.toFixed(4)}, ${band.upper.toFixed(4)}] at family-wise error ${FAMILY_WISE_ERROR}\n` +
      `  correct              observed ${observed.correct.toFixed(4)}  predicted ${predicted.correct.toFixed(4)}\n` +
      `  wrong q (= M)        observed ${observed.wrongDegreesOfFreedom.toFixed(4)}  predicted ${predicted.wrongDegreesOfFreedom.toFixed(4)}  (bead: 0.9944)\n` +
      `  forgotten d          observed ${observed.forgottenDimension.toFixed(4)}  predicted ${predicted.forgottenDimension.toFixed(4)}  (bead: 0.1158)`,
  );

  // 1. The nominal interval covers at its nominal rate, inside the declared band. No reruns.
  expect(predicted.correct).toBeCloseTo(NOMINAL, 6);
  expect(observed.correct).toBeGreaterThanOrEqual(band.lower);
  expect(observed.correct).toBeLessThanOrEqual(band.upper);

  // 2. BOTH wrong intervals are DETECTED: each falls outside the band the correct one sits in.
  expect(observed.wrongDegreesOfFreedom).toBeGreaterThan(band.upper);
  expect(observed.forgottenDimension).toBeLessThan(band.lower);

  // 3. Each wrong variant agrees with its own analytic prediction, so the detection is understood
  //    rather than merely observed. The window is the band's half-width about the prediction.
  const halfWidth = (band.upper - band.lower) / 2;
  expect(Math.abs(observed.wrongDegreesOfFreedom - predicted.wrongDegreesOfFreedom)).toBeLessThan(
    halfWidth,
  );
  expect(Math.abs(observed.forgottenDimension - predicted.forgottenDimension)).toBeLessThan(
    halfWidth,
  );

  // 4. The bead's two figures, as PREDICTIONS rather than goldens: 0.9944 and 0.1158.
  expect(predicted.wrongDegreesOfFreedom).toBeCloseTo(0.9944, 3);
  expect(predicted.forgottenDimension).toBeCloseTo(0.1158, 3);
});

test("DEGENERATE: at d = 1 neither defect exists, so a one-dimensional study detects nothing", () => {
  // Recorded because it is the choice the fixture rests on. With d = 1 the forgotten-d division is
  // the correct one, and q = d*M = M makes the wrong-degrees-of-freedom interval the correct one, so
  // all three variants coincide and the study is vacuous. Asserted on the intervals themselves
  // rather than argued in prose.
  const stream = createPhiloxStream({ seed: SEED, kernel: KERNEL, tile: 1 });
  const sigma = Math.sqrt(2 * D_TRUE * DT);
  const flat = new Float64Array(INCREMENTS);
  for (let i = 0; i < flat.length; i += 1) flat[i] = sigma * stream.nextNormal();

  const estimate = estimateIncrements(flat, DT, 1, "independent-increment-known-zero-drift");
  if (estimate.kind !== "accepted") throw new Error(estimate.kind);
  expect(estimate.data.q).toBe(INCREMENTS);

  const ok = estimatorInterval(estimate.data, ALPHA);
  const wrongQ = chiSquareInterval({
    dHat: estimate.data.unbiasedDHat,
    q: INCREMENTS,
    alpha: ALPHA,
  });
  const forgotten = chiSquareInterval({
    dHat: estimate.data.unbiasedDHat * 1,
    q: estimate.data.q,
    alpha: ALPHA,
  });
  if (ok.kind !== "accepted" || wrongQ.kind !== "accepted" || forgotten.kind !== "accepted") {
    throw new Error("intervals must be accepted");
  }
  expect(wrongQ.data.lower).toBe(ok.data.lower);
  expect(wrongQ.data.upper).toBe(ok.data.upper);
  expect(forgotten.data.lower).toBe(ok.data.lower);
  expect(forgotten.data.upper).toBe(ok.data.upper);
});
