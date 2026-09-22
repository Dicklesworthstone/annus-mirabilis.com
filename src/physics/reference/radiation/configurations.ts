/**
 * Independent-configuration counting, exact binomial distributions, and seeded sampling (paper 1 §5, LQ-05).
 * Specification: am-ref-radiation-15c.
 */

import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { createPhiloxStream } from "../philox.ts";
import { packLogRepresentation } from "./representability.ts";
import type {
  EnumerationOutcome,
  Rational,
  SeededPointSamplingResult,
} from "./types.ts";

export { binomialInside, lockedPositionsProbability } from "./configurationCounts.ts";

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
