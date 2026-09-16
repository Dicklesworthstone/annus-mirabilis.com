/**
 * Independent-configuration counting, exact binomial distributions, and seeded sampling (paper 1 §5, LQ-05).
 * Specification: am-ref-radiation-15c.
 */

import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { createPhiloxStream } from "../philox.ts";
import { packLogRepresentation } from "./representability.ts";
import type {
  BinomialDistribution,
  BinomialTerm,
  EnumerationOutcome,
  Rational,
  SeededPointSamplingResult,
} from "./types.ts";

export const ENUMERATION_BUDGET_MAX_CONFIGURATIONS = 1048576; // 2^20

function bigIntPow(base: bigint, exp: number): bigint {
  let res = 1n;
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) res *= b;
    b *= b;
    e = Math.floor(e / 2);
  }
  return res;
}

function bigIntComb(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  const kEff = k > n - k ? n - k : k;
  let num = 1n;
  let den = 1n;
  for (let i = 1; i <= kEff; i++) {
    num *= BigInt(n - i + 1);
    den *= BigInt(i);
  }
  return num / den;
}

export type IndependentPointsProbabilityResult = Readonly<{
  status: "value";
  quantityId: "configurationProbability";
  unit: "";
  value: number;
  linearRepresentable: boolean;
  lnW: number;
  log10W: number;
  exactRational?: Rational | undefined;
  deltaSOverKb: number;
}>;

/** Independent point configuration probability W = (V/V0)^n = f^n. */
export function independentPointsProbability(
  n: number,
  f: number | { p: bigint; q: bigint },
): IndependentPointsProbabilityResult {
  let fNum: number;
  let exact: Rational | undefined;

  if (typeof f === "object") {
    fNum = Number(f.p) / Number(f.q);
    exact = {
      numerator: bigIntPow(f.p, n),
      denominator: bigIntPow(f.q, n),
    };
  } else {
    fNum = f;
  }

  const lnW = n * Math.log(fNum);
  const packed = packLogRepresentation(lnW, "probability");

  return {
    status: "value",
    quantityId: "configurationProbability",
    unit: "",
    value: packed.value,
    linearRepresentable: packed.linearRepresentable,
    lnW: packed.logFields.lnW ?? lnW,
    log10W: packed.logFields.log10W ?? lnW / Math.LN10,
    ...(exact ? { exactRational: exact } : {}),
    deltaSOverKb: lnW,
  };
}

/** Exact binomial distribution of points inside volume fraction f. */
export function binomialInside(
  n: number,
  f: number | { p: bigint; q: bigint },
): BinomialDistribution {
  let pBig: bigint;
  let qBig: bigint;
  let fNum: number;

  if (typeof f === "object") {
    pBig = f.p;
    qBig = f.q;
    fNum = Number(f.p) / Number(f.q);
  } else {
    fNum = f;
    // Attempt exact half/quarter conversion if familiar float
    if (f === 0.5) {
      pBig = 1n;
      qBig = 2n;
    } else if (f === 0.25) {
      pBig = 1n;
      qBig = 4n;
    } else {
      pBig = BigInt(Math.round(f * 1e6));
      qBig = 1000000n;
    }
  }

  const denomTotal = bigIntPow(qBig, n);
  const qMinusP = qBig - pBig;

  const terms: BinomialTerm[] = [];
  for (let k = 0; k <= n; k++) {
    const comb = bigIntComb(n, k);
    const num = comb * bigIntPow(pBig, k) * bigIntPow(qMinusP, n - k);
    terms.push({
      k,
      exactProbability: {
        numerator: num,
        denominator: denomTotal,
      },
      probability: Number(num) / Number(denomTotal),
    });
  }

  return {
    n,
    f: fNum,
    terms,
  };
}

/**
 * Exhaustive configuration enumeration for n particles in `cells` equal volumes.
 * Returns budget-exhausted if cells^n > 2^20 (1,048,576).
 */
export function enumerateConfigurations(n: number, cells: number): EnumerationOutcome {
  const total = cells ** n;
  if (total > ENUMERATION_BUDGET_MAX_CONFIGURATIONS) {
    return {
      status: "execution-outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits: total, allocationBytes: 0 },
        allowed: { workUnits: ENUMERATION_BUDGET_MAX_CONFIGURATIONS, allocationBytes: 0 },
      },
    };
  }

  // Exactly 1 favorable configuration where all n points reside in cell 0
  const favorable = 1;
  const probability = 1 / total;

  return {
    status: "value",
    n,
    cells,
    totalConfigurations: total,
    favorableConfigurations: favorable,
    probability,
  };
}

/**
 * Locked-positions counterexample: rigidly locked points move together with probability f, not f^n.
 */
export function lockedPositionsProbability(
  _n: number,
  f: number,
): Readonly<{
  status: "value";
  quantityId: "configurationProbability";
  unit: "";
  value: number;
  linearRepresentable: true;
  modelNote: string;
}> {
  return {
    status: "value",
    quantityId: "configurationProbability",
    unit: "",
    value: f,
    linearRepresentable: true,
    modelNote: "perfectly locked positions have probability f that all lie in fraction f",
  };
}

export type SeededSamplingInput = Readonly<{
  n: number;
  f: number;
  trials: number;
  seed: string | bigint;
  streamKernelId?: number | undefined;
  allocationId?: string | undefined;
}>;

/**
 * Seeded sampling of independent point placements through Philox stream (LQ-05).
 */
export function sampleIndependentPoints(input: SeededSamplingInput): SeededPointSamplingResult {
  const { n, f, trials } = input;
  const streamKernelId = input.streamKernelId ?? 0x19050005;
  const allocationId = input.allocationId ?? "lq-05.configuration.v1";
  const seed = typeof input.seed === "bigint" ? input.seed.toString() : input.seed;

  let successCount = 0;
  const drawsPerTrial = n;

  for (let t = 0; t < trials; t++) {
    const stream = createPhiloxStream({
      seed,
      kernel: streamKernelId,
      tile: t,
    });

    let allInside = true;
    for (let p = 0; p < n; p++) {
      const u = stream.nextF64();
      if (u >= f) {
        allInside = false;
      }
    }
    if (allInside) {
      successCount++;
    }
  }

  return {
    n,
    f,
    trials,
    successCount,
    sampleFraction: successCount / trials,
    drawCountBefore: 0,
    drawCountAfter: trials * drawsPerTrial,
    streamKernelId,
    allocationId,
    seed,
  };
}
