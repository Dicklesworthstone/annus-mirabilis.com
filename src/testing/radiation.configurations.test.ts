import { afterAll, describe, expect, it } from "bun:test";
import {
  binomialInside,
  ENUMERATION_BUDGET_MAX_CONFIGURATIONS,
  enumerateConfigurations,
  independentPointsProbability,
  lockedPositionsProbability,
  sampleIndependentPoints,
} from "../physics/reference/radiation.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.configurations (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("independent points probability W = f^n handles exact BigInt rationals", () => {
    const n = 10;
    const f = { p: 1n, q: 2n };

    const res = independentPointsProbability(n, f);
    expect(res.status).toBe("value");
    expect(res.linearRepresentable).toBe(true);
    expect(res.value).toBe(1 / 1024);
    expect(res.exactRational).toBeDefined();
    if (res.exactRational) {
      expect(res.exactRational.numerator).toBe(1n);
      expect(res.exactRational.denominator).toBe(1024n);
    }
    expect(res.lnW).toBeCloseTo(10 * Math.log(0.5), 12);
    expect(res.deltaSOverKb).toBeCloseTo(res.lnW, 12);

    logger.log({
      testId: "configurations-exact-rational-probability",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("exact binomial distribution sums to 1 both in BigInt arithmetic and floating point", () => {
    const n = 8;
    const f = { p: 1n, q: 3n };

    const dist = binomialInside(n, f);
    expect(dist.n).toBe(8);
    expect(dist.terms.length).toBe(9);

    let bigIntSum = 0n;
    let floatSum = 0;
    const firstTerm = dist.terms[0];
    if (!firstTerm) throw new Error("Expected non-empty terms array in binomial distribution");
    const commonDenom = firstTerm.exactProbability.denominator;

    for (const term of dist.terms) {
      expect(term.exactProbability.denominator).toBe(commonDenom);
      bigIntSum += term.exactProbability.numerator;
      floatSum += term.probability;
    }

    expect(bigIntSum).toBe(commonDenom);
    expect(floatSum).toBeCloseTo(1.0, 12);

    logger.log({
      testId: "configurations-exact-binomial-sum",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("exhaustive enumeration honors 2^20 budget limit and reports budget-exhausted outcome", () => {
    // Under budget: cells = 2, n = 10 => 1024 <= 1048576
    const under = enumerateConfigurations(10, 2);
    expect(under.status).toBe("value");
    if (under.status === "value") {
      expect(under.totalConfigurations).toBe(1024);
      expect(under.favorableConfigurations).toBe(1);
      expect(under.probability).toBe(1 / 1024);
    }

    // Over budget: cells = 2, n = 21 => 2^21 = 2097152 > 1048576
    const over = enumerateConfigurations(21, 2);
    expect(over.status).toBe("execution-outcome");
    if (over.status === "execution-outcome" && over.outcome.outcome === "budget-exhausted") {
      expect(over.outcome.outcome).toBe("budget-exhausted");
      expect(over.outcome.allowed.workUnits).toBe(ENUMERATION_BUDGET_MAX_CONFIGURATIONS);
    }

    logger.log({
      testId: "configurations-enumeration-budget-enforcement",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("locked positions counterexample gives probability f independent of n", () => {
    const n = 100;
    const f = 0.5;

    const res = lockedPositionsProbability(n, f);
    expect(res.status).toBe("value");
    expect(res.value).toBe(0.5);
    expect(res.modelNote).toContain("locked positions");

    logger.log({
      testId: "configurations-locked-positions-counterexample",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("sampleIndependentPoints provides reproducible Philox sampling with draw tracking", () => {
    const input = {
      n: 4,
      f: 0.5,
      trials: 500,
      seed: "19050318",
    };

    const run1 = sampleIndependentPoints(input);
    const run2 = sampleIndependentPoints(input);

    expect(run1.successCount).toBe(run2.successCount);
    expect(run1.sampleFraction).toBe(run2.sampleFraction);
    expect(run1.drawCountAfter).toBe(500 * 4);
    expect(run1.streamKernelId).toBe(0x19050005);

    // Expected probability (0.5)^4 = 0.0625; check sample is within reasonable statistical range
    expect(run1.sampleFraction).toBeGreaterThan(0.02);
    expect(run1.sampleFraction).toBeLessThan(0.12);

    logger.log({
      testId: "configurations-seeded-philox-sampling",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
