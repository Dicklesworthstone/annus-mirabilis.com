import { describe, expect, spyOn, test } from "bun:test";
import { getConstantSet } from "../../physics/reference/constants.ts";
import * as intervalOwner from "../../physics/reference/inference/identifiability.ts";
import { conditionalMolecularNumberInterval } from "../../physics/reference/inference/identifiability.ts";
import {
  type DiffusionIntervalEstimate,
  estimateSummaryStatistics,
  estimatorInterval,
  summaryChiSquareInterval,
} from "../../physics/reference/inference.ts";
import { ExecutionOutcomeError } from "../results/applyFailure.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import { avogadroBasis } from "./basis.ts";
import {
  AVOGADRO_DEFAULTS,
  type AvogadroParameters,
  decodeAvogadroParameters,
  encodeAvogadroParameters,
  validateAvogadroParameters,
} from "./definition.ts";
import { studyAvogadroSensitivity } from "./sensitivity.ts";
import { createAvogadroSession, evaluateAvogadro } from "./session.ts";

const withRadiusInterval = { ...AVOGADRO_DEFAULTS, radiusInterval: 1 };
function evaluated(parameters: AvogadroParameters) {
  const value = evaluateAvogadro(parameters);
  if (value.kind !== "accepted")
    throw new Error(value.kind === "refused" ? value.reason : value.outcome.message);
  return value;
}
function scalar(parameters: AvogadroParameters, quantity = "brownianNumber") {
  const value = evaluated(parameters).outputs.find((row) => row.quantityId === quantity);
  if (value?.status !== "value" || typeof value.value !== "number")
    throw new Error(`Expected a scalar ${quantity}.`);
  return value;
}
function interval(parameters: AvogadroParameters) {
  const value = scalar(parameters).uncertainty;
  if (value?.kind !== "statistical-interval") throw new Error("Expected a statistical interval.");
  return value;
}

describe("Avogadro's declared radius uncertainty", () => {
  test("the interval owner admits the summary's actual sufficient statistics and degrees of freedom", () => {
    for (const independentCoordinateCount of [1, 100, 10000]) {
      const summary = estimateSummaryStatistics({
        meanSquareDisplacement: 0.86e-12,
        observationInterval: 1,
        independentCoordinateCount,
      });
      if (summary.kind !== "accepted") throw new Error("Summary was refused.");
      const sufficient: DiffusionIntervalEstimate = {
        unbiasedDHat: summary.data.dHat,
        q: independentCoordinateCount,
        estimatorId: "summary-statistic",
      };
      expect(estimatorInterval(sufficient, 0.025)).toEqual(
        summaryChiSquareInterval(summary.data, 0.025),
      );
      expect(Object.keys(sufficient).sort()).toEqual(["estimatorId", "q", "unbiasedDHat"]);
    }
  });

  test("both constant bases use the existing Bonferroni owner without changing the point estimate or other routes", () => {
    for (const constantBasis of [0, 1]) {
      const parameters = { ...withRadiusInterval, constantBasis };
      const exact = { ...parameters, radiusInterval: 0 };
      const summary = estimateSummaryStatistics({
        meanSquareDisplacement: parameters.meanSquareUm2 * 1e-12,
        observationInterval: parameters.observationSeconds,
        independentCoordinateCount: parameters.coordinateCount,
      });
      if (summary.kind !== "accepted") throw new Error("Summary was refused.");
      const owner = conditionalMolecularNumberInterval(
        {
          estimate: {
            unbiasedDHat: summary.data.dHat,
            q: parameters.coordinateCount,
            estimatorId: "summary-statistic",
          },
          T: parameters.temperature,
          eta: parameters.viscosityMpaS * 1e-3,
          alpha: 0.05,
          synthetic: false,
          radiusProvenance: "independently-declared",
          radius: {
            value: parameters.radiusUm * 1e-6,
            interval: {
              lower: parameters.radiusLowerUm * 1e-6,
              upper: parameters.radiusUpperUm * 1e-6,
              coverage: parameters.radiusCoveragePercent / 100,
            },
            provenance: "Declared illustrative radius bounds; no raw observations supplied.",
          },
        },
        getConstantSet(avogadroBasis(parameters).setId),
      );
      if (owner.kind !== "accepted") throw new Error("The owner refused valid intervals.");
      const combined = interval(parameters);
      expect(combined.lower).toBe(owner.data.lower);
      expect(combined.upper).toBe(owner.data.upper);
      expect(combined.coverage).toBe(owner.data.coverage);
      expect(combined.sampleSize).toBe(parameters.coordinateCount);
      expect(combined.method).toContain("Bonferroni");
      expect(owner.data.coverageKind).toBe("conservative");
      expect(scalar(parameters).value).toBe(scalar(exact).value);
      expect(combined.lower).toBeLessThan(interval(exact).lower);
      expect(combined.upper).toBeGreaterThan(interval(exact).upper);
      for (const quantity of [
        "radiationNumber",
        "molecularNumber",
        "definedNumber",
        "brownianRadiusProduct",
      ])
        expect(scalar(parameters, quantity)).toEqual(scalar(exact, quantity));
    }
  });

  test("only the supplied radius coverage contributes to the conservative guarantee", () => {
    expect(interval(withRadiusInterval).coverage).toBeCloseTo(0.95, 14);
    const certainBounds = interval({ ...withRadiusInterval, radiusCoveragePercent: 100 });
    expect(certainBounds.coverage).toBe(0.975);
    expect(certainBounds.lower).toBe(interval(withRadiusInterval).lower);
    expect(certainBounds.upper).toBe(interval(withRadiusInterval).upper);
    const wider = interval({ ...withRadiusInterval, radiusLowerUm: 0.3, radiusUpperUm: 0.8 });
    expect(wider.lower).toBeLessThan(interval(withRadiusInterval).lower);
    expect(wider.upper).toBeGreaterThan(interval(withRadiusInterval).upper);
  });

  test("insufficient coverage and malformed intervals retain the exact accepted view and notify nobody", () => {
    const session = createAvogadroSession("avogadro-radius-refusal", withRadiusInterval);
    const before = session.getSnapshot();
    let notifications = 0;
    session.subscribe(() => notifications++);
    for (const patch of [
      { radiusCoveragePercent: 95 },
      { radiusLowerUm: 0.6 },
      { radiusUpperUm: 0.4 },
      { radiusLowerUm: 0 },
      { radiusCoveragePercent: Number.NaN },
      { radiusInterval: 0.5 },
    ]) {
      const refusal = session.apply({ ...withRadiusInterval, ...patch, alphaScale: 2 });
      expect(refusal.kind).toBe("refused");
      if (refusal.kind !== "refused") throw new Error("An invalid draft was published.");
      expect(refusal.refusal.code).toBe("invalid-parameter");
      expect(refusal.reason.length).toBeGreaterThan(0);
      expect(session.getSnapshot()).toBe(before);
    }
    const coverage = session.apply({ ...withRadiusInterval, radiusCoveragePercent: 95 });
    if (coverage.kind !== "refused") throw new Error("Lower coverage was relabeled.");
    expect(coverage.reason).toContain("97.5");
    expect(notifications).toBe(0);
    expect(session.getSnapshot().pending).toBe(false);
  });

  test("declared bounds do not supply a missing radius or admit a noisy observation model", () => {
    for (const [patch, status] of [
      [{ radiusKnown: 0 }, "underdetermined"],
      [{ independentModel: 0 }, "outside-domain"],
    ] as const) {
      const outcome = evaluated({ ...withRadiusInterval, ...patch });
      const value = outcome.outputs.find((row) => row.quantityId === "brownianNumber");
      expect(value?.status).toBe(status);
      expect(Object.hasOwn(value ?? {}, "uncertainty")).toBe(false);
    }
    const exact = {
      ...AVOGADRO_DEFAULTS,
      radiusLowerUm: 2,
      radiusUpperUm: 3,
      radiusCoveragePercent: 20,
    };
    expect(scalar(exact)).toEqual(scalar(AVOGADRO_DEFAULTS));
  });

  test("an owner execution outcome stays typed and cannot replace a complete accepted comparison or study", () => {
    const session = createAvogadroSession("avogadro-radius-outcome");
    const before = session.getSnapshot();
    let notifications = 0;
    session.subscribe(() => notifications++);
    // Contract-boundary failure injection, not a claim that the bounded default exhausts the owner.
    const unavailable = Object.freeze({
      kind: "outcome" as const,
      outcome: Object.freeze({
        outcome: "invariant-violation" as const,
        ...executionOutcomeRegistry["invariant-violation"],
        details: { diagnostic: "interval owner contract test" },
      }),
    });
    const owner = spyOn(intervalOwner, "conditionalMolecularNumberInterval").mockReturnValue(
      unavailable,
    );
    try {
      expect(session.apply(withRadiusInterval)).toBe(unavailable);
      expect(session.getSnapshot()).toBe(before);
      expect(notifications).toBe(0);
      expect(
        studyAvogadroSensitivity(withRadiusInterval, "alphaScale", [2], evaluateAvogadro),
      ).toBe(unavailable);
      let thrown: unknown;
      try {
        createAvogadroSession("avogadro-radius-outcome-initial", withRadiusInterval);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ExecutionOutcomeError);
      if (!(thrown instanceof ExecutionOutcomeError)) throw new Error("The outcome lost its type.");
      expect(thrown.outcome).toBe(unavailable.outcome);
    } finally {
      owner.mockRestore();
    }
  });

  test("version 3 retains the whole declared interval; legacy links remain exact-radius calculations", () => {
    const supplied = {
      ...withRadiusInterval,
      constantBasis: 1,
      radiusLowerUm: 0.3,
      radiusUpperUm: 0.8,
      radiusCoveragePercent: 99,
    };
    const encoded = encodeAvogadroParameters(supplied);
    expect(new URLSearchParams(encoded).get("av")).toBe("3");
    expect(decodeAvogadroParameters(encoded)).toEqual({ kind: "accepted", parameters: supplied });
    for (const version of ["1", "2"]) {
      const query = new URLSearchParams(encoded);
      query.set("av", version);
      if (version === "1") query.delete("constantBasis");
      expect(decodeAvogadroParameters(query.toString()).kind).toBe("refused");
      for (const key of [
        "radiusInterval",
        "radiusLowerUm",
        "radiusUpperUm",
        "radiusCoveragePercent",
      ])
        query.delete(key);
      const legacy = decodeAvogadroParameters(query.toString());
      expect(legacy.kind).toBe("accepted");
      if (legacy.kind !== "accepted") throw new Error(legacy.reason);
      expect(legacy.parameters.radiusInterval).toBe(0);
      expect(legacy.parameters.constantBasis).toBe(version === "1" ? 0 : 1);
      expect(interval(legacy.parameters).coverage).toBe(0.95);
      const duplicate = `${query}&radiusInterval=0&radiusInterval=1`;
      expect(decodeAvogadroParameters(duplicate).kind).toBe("refused");
    }
  });

  test("a sensitivity study preserves its baseline and evaluates each interval through the same owner", () => {
    const study = studyAvogadroSensitivity(
      withRadiusInterval,
      "radiusUpperUm",
      [0.6, 0.8],
      evaluateAvogadro,
    );
    expect(study.kind).toBe("accepted");
    if (study.kind !== "accepted")
      throw new Error(study.kind === "refused" ? study.reason : study.outcome.message);
    expect(study.study.baseline.parameters.radiusUpperUm).toBe(0.55);
    for (const point of study.study.points) {
      const reading = point.readings.find((row) => row.result.quantityId === "brownianNumber");
      expect(reading?.result).toEqual(scalar(point.parameters));
      expect(reading?.ratio).toBe(1);
    }
    expect(validateAvogadroParameters({ ...withRadiusInterval, radiusUpperUm: 0.4 }).kind).toBe(
      "refused",
    );
  });
});
