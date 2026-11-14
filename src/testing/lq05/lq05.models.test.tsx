import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { IndependentConfigurationsPlot } from "../../components/lab/lq05/IndependentConfigurationsPlot.tsx";
import { LQ05_DEFAULTS, LQ05_OUTPUTS } from "../../experiments/lq05/definition.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { streamAllocationRegistry } from "../../experiments/streams/allocation.ts";
import { createPhiloxStream } from "../../physics/reference/philox.ts";
import { createLq05Session, evaluateLq05 } from "../../experiments/lq05/session.ts";
import {
  binomialInside,
  enumerateFractionConfigurations,
  lockedPointsInside,
  sampleIndependentPoints,
  sampleLockedPoints,
} from "../../physics/reference/radiation.ts";
import { configurationFraction } from "../../physics/reference/radiation/configurationCounts.ts";

test("large exact counts remain normalized finite probabilities at every admitted fraction", () => {
  for (const n of [1, 4, 10, 60]) {
    for (const f of [0.00101, 0.123456789123456, 0.3, 1 / 3, 0.5, 0.7, 0.99999999, 1]) {
      const distribution = binomialInside(n, f);
      const denominator = distribution.terms[0]?.exactProbability.denominator;
      expect(denominator).toBeDefined();
      expect(distribution.terms.reduce((sum, term) => sum + term.exactProbability.numerator, 0n))
        .toBe(denominator);
      expect(distribution.terms.reduce((sum, term) => sum + term.probability, 0))
        .toBeCloseTo(1, 13);
      for (const term of distribution.terms) {
        expect(Number.isFinite(term.probability)).toBe(true);
        expect(term.probability).toBeGreaterThanOrEqual(0);
        expect(term.probability).toBeLessThanOrEqual(1);
      }
      const allInside = distribution.terms[n]?.probability ?? NaN;
      expect(Math.abs(allInside / f ** n - 1)).toBeLessThan(2e-13);
    }
  }
  expect(binomialInside(1, 0.123456789123456).terms[1]?.probability)
    .toBeCloseTo(0.123456789123456, 15);
});

test("exact enumeration uses the accepted fraction, including nonreciprocal fractions and the full volume", () => {
  for (const [f, favorable, total] of [[0.3, 81, 10000], [0.75, 81, 256], [1, 1, 1]]) {
    if (f === undefined || favorable === undefined || total === undefined) continue;
    const enumeration = enumerateFractionConfigurations(4, f);
    expect(enumeration).toMatchObject({
      status: "value",
      n: 4,
      favorableConfigurations: favorable,
      totalConfigurations: total,
      probability: favorable / total,
    });
    if (enumeration.status === "value")
      expect(enumeration.probability).toBeCloseTo(f ** 4, 14);
  }
  expect(enumerateFractionConfigurations(60, 0.3, true)).toMatchObject({
    status: "value",
    n: 60,
    favorableConfigurations: 3,
    totalConfigurations: 10,
    probability: 0.3,
  });
});

test("enumeration keeps the work boundary and the exact over-budget count without nonfinite metadata", () => {
  expect(enumerateFractionConfigurations(20, 0.5).status).toBe("value");
  expect(enumerateFractionConfigurations(21, 0.5).status).toBe("execution-outcome");
  const f = 0.123456789123456;
  const result = enumerateFractionConfigurations(60, f);
  expect(result.status).toBe("execution-outcome");
  if (result.status !== "execution-outcome" || result.outcome.outcome !== "budget-exhausted")
    return;
  expect(Number.isSafeInteger(result.outcome.requested.workUnits)).toBe(true);
  expect(result.outcome.requested.workUnits).toBeGreaterThan(result.outcome.allowed.workUnits);
  expect(result.outcome.details?.requestedConfigurations)
    .toBe((configurationFraction(f).q ** 60n).toString());
  expect(result.outcome.details?.requestedWorkIsLowerBound).toBe(true);
});

test("coincident locked points admit only all-outside and all-inside outcomes", () => {
  for (const n of [1, 4, 60]) {
    const distribution = lockedPointsInside(n, 0.3);
    expect(distribution.terms[0]?.probability).toBeCloseTo(0.7, 14);
    expect(distribution.terms[n]?.probability).toBeCloseTo(0.3, 14);
    expect(distribution.terms.slice(1, n).every((term) => term.probability === 0)).toBe(true);
    expect(distribution.terms.reduce((sum, term) => sum + term.probability, 0)).toBeCloseTo(1, 14);
  }
});

test("locked sampling consumes one reproducible placement per trial independently of group size", () => {
  const input = { n: 60, f: 0.3, trials: 1000, seed: "19050318" };
  const locked = sampleLockedPoints(input);
  const allocation = streamAllocationRegistry.getAllocation("lq-05.locked.v1");
  let expectedSuccesses = 0;
  for (let trial = 0; trial < input.trials; trial++) {
    const stream = createPhiloxStream({
      seed: input.seed,
      kernel: allocation.streamKernelId,
      tile: allocation.computeTile(trial),
    });
    if (stream.nextF64() < input.f) expectedSuccesses++;
  }
  const smallerGroup = sampleLockedPoints({ ...input, n: 4 });
  expect(locked.successCount).toBe(expectedSuccesses);
  expect(locked.successCount).toBe(321);
  expect(locked.sampleFraction).toBe(expectedSuccesses / input.trials);
  expect(smallerGroup.successCount).toBe(locked.successCount);
  expect(locked.n).toBe(60);
  expect(locked.drawCountAfter).toBe(input.trials);
  expect(locked.allocationId).toBe("lq-05.locked.v1");
  expect(allocation.computeTile(0)).toBe(0x80000000);
  expect(allocation.computeTile(input.trials - 1)).toBe(0x80000000 + input.trials - 1);
  expect(sampleIndependentPoints({ ...input, n: 4 }).drawCountAfter).toBe(4 * input.trials);
});

test("one accepted dependence model owns the headline, distribution, sampling and logarithms", () => {
  const parameters = { ...LQ05_DEFAULTS, n: 10, f: 0.3, trials: 1000, locked: true };
  const result = evaluateLq05(parameters);
  expect(result.probability.value).toBe(0.3);
  expect(result.probability.lnW).toBe(Math.log(0.3));
  expect(result.probability.deltaSOverKb).toBe(Math.log(0.3));
  expect(result.probability.log10W).toBe(Math.log10(0.3));
  expect(result.distribution.terms[10]?.probability).toBeCloseTo(result.probability.value, 14);
  expect(result.sampling.drawCountAfter).toBe(parameters.trials);
  expect(result.outputs.find((output) => output.quantityId === "sampleFraction")).toMatchObject({
    status: "value",
    value: result.sampling.sampleFraction,
    ownerId: "radiation.sampleLockedPoints",
  });
  const session = createLq05Session("locked-model-consistency", parameters);
  const prepared = session.getServerSnapshot();
  const digest = "source:sha256:" + "a".repeat(64);
  expect(deriveHostExecution(prepared, LQ05_OUTPUTS, digest, true).label).toBe("static");
  expect(session.apply({ ...parameters, locked: false }).kind).toBe("accepted");
  const independent = session.getSnapshot().accepted;
  expect(deriveHostExecution(session.getSnapshot(), LQ05_OUTPUTS, digest, false).label).toBe("host");
  expect(independent?.outputs.find((output) => output.quantityId === "configurationProbability"))
    .toMatchObject({ ownerId: "radiation.independentPointsProbability" });
  expect(session.apply(parameters).kind).toBe("accepted");
  expect(session.getSnapshot().accepted?.outputs.find((output) => output.quantityId === "configurationProbability"))
    .toMatchObject({ value: 0.3, ownerId: "radiation.lockedPositionsProbability" });
  expect(deriveHostExecution(session.getSnapshot(), LQ05_OUTPUTS, digest, false).label).toBe("host");
  expect(session.getServerSnapshot()).toBe(prepared);
});

test("the rendered locked view agrees across bars, exact counts, sampling and logarithmic readouts", () => {
  const parameters = { ...LQ05_DEFAULTS, n: 4, f: 0.3, trials: 100, locked: true };
  const evaluation = evaluateLq05(parameters);
  const render = (view: "enumeration" | "sampling" | "logarithmic") =>
    renderToStaticMarkup(<IndependentConfigurationsPlot parameters={{ ...parameters, view }} evaluation={evaluation} />);
  const enumeration = render("enumeration");
  const text = enumeration.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  expect(enumeration).toContain("Locked distribution P(k)");
  expect(enumeration).toContain('data-configuration-k="1" data-probability="0"');
  expect(enumeration).toContain("height:0%");
  expect(enumeration).toContain("Probability table");
  expect(enumeration).toContain("<caption>Coincident locked positions");
  expect(text).toContain("Exact ratio: 3 / 10");
  expect(text).toContain("intermediate counts are impossible");
  expect(render("sampling")).toContain("One shared position per trial.");
  const logarithmic = render("logarithmic");
  expect(logarithmic).toContain(Math.log10(0.3).toFixed(4));
  expect(logarithmic).toContain(Math.log(0.3).toFixed(4));
  expect(logarithmic).not.toContain((4 * Math.log(0.3)).toFixed(4));
});

test("the full-volume endpoint and a budget-limited view never substitute another fraction", () => {
  const full = { ...LQ05_DEFAULTS, f: 1, trials: 20 };
  const evaluation = evaluateLq05(full);
  expect(evaluation.enumeration).toMatchObject({ status: "value", probability: 1, totalConfigurations: 1 });
  expect(evaluation.sampling.successCount).toBe(full.trials);
  expect(evaluation.distribution.terms[full.n]?.probability).toBe(1);
  const limited = { ...LQ05_DEFAULTS, n: 60, f: 0.3, trials: 20 };
  const html = renderToStaticMarkup(
    <IndependentConfigurationsPlot parameters={limited} evaluation={evaluateLq05(limited)} />,
  );
  expect(html).toContain('data-enumeration-budget="exceeded"');
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
});
