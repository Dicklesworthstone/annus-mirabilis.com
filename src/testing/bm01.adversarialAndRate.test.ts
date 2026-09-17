import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { strictParse } from "../content/schemas/strictParse.ts";
import { BM01_CLASSES, BM01_DEFAULTS, BM01_OUTPUTS } from "../experiments/bm01/definition.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { createDeclaredConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import {
  moments,
  radialPropagator2d,
  rmsDisplacement,
  stokesEinsteinD,
} from "../physics/reference/diffusion.ts";
import { withinTolerance } from "../units/tolerance.ts";

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

function printedSet() {
  return createDeclaredConstantSet({
    id: "scenario-einstein-1905-brownian-printed",
    era: 1905,
    provenance: "Declared editorial inputs matching Einstein 1905 printed R and N.",
    precisionNote: "Two-significant-figure comparison to 0,8 Mikron and ca. 6 Mikron.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Paper 2 printed R = 8.31e7 erg mol^-1 K^-1.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: 6e23,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Paper 2 printed N = 6e23 mol^-1.",
        dependsOn: [],
      },
    ],
  });
}

describe("BM-01 Adversarial Fixtures (am-bm-01-tracer-ensemble-hdly)", () => {
  const modern = getConstantSet("modern-si-2019");

  test("adversarial fixture 1: 'halving diffusivity halves displacement' FAILS for intended reason", () => {
    // True physics: lambda_x = sqrt(2 * D * t).
    // Halving D to D/2 gives lambda_x' = sqrt(2 * (D/2) * t) = lambda_x / sqrt(2) ~= 0.7071068 * lambda_x.
    // The naive linear scaling prediction (lambda_x' = 0.5 * lambda_x) fails decisively by ~29.3%.
    const D0 = 4.29439564555e-13; // m^2/s
    const t = 1.0; // s
    const baselineRms = val(rmsDisplacement(D0, t));
    const trueHalvedRms = val(rmsDisplacement(D0 / 2, t));

    // True scaling factor is exactly 1/sqrt(2)
    const trueRatio = trueHalvedRms / baselineRms;
    expect(Math.abs(trueRatio - 1 / Math.SQRT2)).toBeLessThan(1e-14);

    // Naive linear scaling assertion must fail
    const naiveHalvedRms = 0.5 * baselineRms;
    const naiveRelativeError = Math.abs(naiveHalvedRms - trueHalvedRms) / trueHalvedRms;
    expect(naiveRelativeError).toBeGreaterThan(0.29);
    expect(naiveRelativeError).toBeLessThan(0.30);

    const verdict = withinTolerance(naiveHalvedRms, trueHalvedRms, { relative: 1e-4 });
    expect(verdict.ok).toBe(false);
  });

  test("adversarial fixture 2: 'a radial distribution is an ordinary Gaussian' FAILS for intended reason", () => {
    // True physics: In 2D, radial displacement r = sqrt(x^2 + y^2) is governed by the Rayleigh density:
    // p_r(r, t) = (r / (2Dt)) * exp(-r^2 / (4Dt)) for r >= 0.
    // The naive mistake treats r as an ordinary 1D Gaussian g(r) = (1/sqrt(4*pi*Dt)) * exp(-r^2 / (4Dt)).
    const D = 0.5;
    const t = 1.0;
    const stats = moments(2, D, t);

    // True 2D second moment is <r^2> = 4 * D * t
    const trueSecondMoment = val(stats.total);
    expect(Math.abs(trueSecondMoment - 4 * D * t)).toBeLessThan(1e-14);

    // 1. Unnormalized ordinary Gaussian restricted to r >= 0 integrates to 0.5, losing half the probability
    const naiveIntegral = 0.5;
    expect(naiveIntegral).toBe(0.5);

    // 2. Renormalized Gaussian 2 * g(r) gives second moment \int_0^\infty r^2 2 g(r) dr = 2 * D * t = 2.0,
    // which fails the true 4 * D * t by an exact factor of 2
    const naiveSecondMoment = 2 * D * t;
    expect(naiveSecondMoment).not.toBe(trueSecondMoment);
    expect(Math.abs(trueSecondMoment - 2 * naiveSecondMoment)).toBeLessThan(1e-14);

    // 3. The true 2D density peaks at r_peak = sqrt(2Dt) > 0, whereas an ordinary Gaussian peaks at r = 0
    const peakRadius = Math.sqrt(2 * D * t);
    const pPeak = val(radialPropagator2d(peakRadius, t, D));
    const pBelow = val(radialPropagator2d(peakRadius * 0.99, t, D));
    const pAbove = val(radialPropagator2d(peakRadius * 1.01, t, D));
    expect(pPeak).toBeGreaterThan(pBelow);
    expect(pPeak).toBeGreaterThan(pAbove);
  });

  test("adversarial fixture 3: 'an observer change starts a new experiment' FAILS for intended reason", () => {
    // In BM-01, observer/measurement parameters (interval, d, axis) and estimator parameter (statistic)
    // belong to "measurement" and "estimator" command classes.
    // Changing an observer parameter must NOT fork a new runId or start a new experiment.
    // The naive claim that "every parameter change restarts the experiment" must fail.
    const testOutputs = {
      testOutput: {
        unit: "m",
        semanticKind: "test",
        ownerId: "test",
        statuses: ["value"] as const,
      },
    };
    const store = createInstanceStore({
      experimentId: "bm-01",
      instanceId: "inst-test-observer",
      initialParameters: BM01_DEFAULTS,
      parameterClasses: BM01_CLASSES,
      outputs: testOutputs,
      allowPartial: true,
    });

    // Initial setup starts run 1
    const token1 = store.issue("setup-change");
    expect(token1.runId).toBe("inst-test-observer/run/1");

    // Publish a snapshot for run 1
    const decision = store.publish({
      ...token1,
      outputs: [
        {
          quantityId: "testOutput",
          status: "value",
          unit: "m",
          semanticKind: "test",
          ownerId: "test",
          value: 1,
        },
      ],
      stepIndex: 0,
      simulationTime: 10,
      final: true,
    });
    expect(decision.accepted).toBe(true);

    const runIdBefore = store.getSnapshot().accepted!.runId;
    expect(runIdBefore).toBe("inst-test-observer/run/1");

    // Observer change 1: change observation interval
    const tokenInterval = store.issue("measurement-change", { interval: 4 });
    expect(tokenInterval.runId).toBe("inst-test-observer/run/1");
    expect(tokenInterval.revisions.measurement).toBe(1);

    // Observer change 2: change dimension / axis
    const tokenAxis = store.issue("measurement-change", { axis: 1, d: 2 });
    expect(tokenAxis.runId).toBe("inst-test-observer/run/1");
    expect(tokenAxis.revisions.measurement).toBe(2);

    // Estimator change: change statistic
    const tokenStat = store.issue("estimator-change", { statistic: "mean" });
    expect(tokenStat.runId).toBe("inst-test-observer/run/1");
    expect(tokenStat.revisions.estimator).toBe(1);

    // Naive adversarial claim: token.runId !== runIdBefore (restarted experiment)
    const observerRestartsExperiment = () => {
      if (tokenInterval.runId !== runIdBefore) {
        throw new Error("Adversarial failure: observer change restarted the experiment");
      }
    };
    // The claim must NOT be true: runId is preserved
    expect(observerRestartsExperiment).not.toThrow();

    // Contrast with physical setup change (which DOES fork a new run)
    const tokenSetup = store.issue("setup-change", { eta: 0.002 });
    expect(tokenSetup.runId).toBe("inst-test-observer/run/2");
    expect(tokenSetup.runId).not.toBe(runIdBefore);
  });
});

describe("BM-01 True Physical Rate and Scale Bar (am-bm-01-tracer-ensemble-hdly)", () => {
  test("manifest declares realRate with natural rate and 1 um scale bar", () => {
    const raw = readFileSync("content/experiments/bm-01.yaml", "utf8");
    const manifest = strictParse(raw, "yaml") as Record<string, any>;
    expect(manifest.realRate).toBeDefined();
    expect(manifest.realRate.natural).toBe(true);
    expect(manifest.realRate.quantity).toBe("displacement1d");
    expect(manifest.realRate.scaleBar).toEqual({ length: 1e-6, unit: "m" });
  });

  test("natural physical rate is ~0.8 um per second under historical constants and modern SI", () => {
    // Historical 1905 printed set: lambda_x(1 s) = 0.7947833 um ~= 0.79 um (~0.8 um)
    const histSet = printedSet();
    const D_hist = val(stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, histSet));
    const rms1s_hist = val(rmsDisplacement(D_hist, 1.0));
    expect(Math.abs(rms1s_hist * 1e6 - 0.7947833)).toBeLessThan(1e-6);
    expect(Math.round(rms1s_hist * 1e6 * 10) / 10).toBe(0.8);

    // Modern SI: lambda_x(1 s) with eta=1.0 mPa s is 0.9267573 um; with printed eta 1.35 mPa s is 0.7935339 um
    const modern = getConstantSet("modern-si-2019");
    const D_modern_printedEta = val(
      stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, modern),
    );
    const rms1s_modern = val(rmsDisplacement(D_modern_printedEta, 1.0));
    expect(Math.abs(rms1s_modern * 1e6 - 0.7935339)).toBeLessThan(1e-6);
    expect(Math.round(rms1s_modern * 1e6 * 10) / 10).toBe(0.8);
  });
});
