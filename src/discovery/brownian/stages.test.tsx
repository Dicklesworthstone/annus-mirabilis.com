import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { BROWNIAN_LATER_EVIDENCE, BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
import { validateJourney } from "../../content/schemas/journey.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  ensembleMoments,
  equilibriumBalance,
  gaussianPropagator,
  intervalProbability,
  lockedClusterPressure,
  osmoticPressure,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
import {
  estimateSummaryStatistics,
  identifiabilityFamily,
} from "../../physics/reference/inference.ts";
import { enumerateSignedSteps } from "../../physics/reference/stepEnumeration.ts";
import { validateCardCitation } from "../cards/cardRules.ts";
import { checkJourney } from "../checks/journeyChecks.ts";
import { REAL_JOURNEYS } from "../journeys/realJourneys.ts";
import { SHELF_CARD_CONTEXT } from "../journeys/shelves.ts";
import { BrownianStage } from "./BrownianStage.tsx";
import {
  BROWNIAN_STAGES,
  DRAG_BALANCE_STAGE,
  INFERENCE_STAGE,
  INTERVAL_STAGE,
  OBSERVABLE_STAGE,
  OSMOTIC_STAGE,
  TIME_SCALING_STAGE,
} from "./stages.ts";

// Published argument anchors in source order. World check 06 and exercise section 08 are separate.
const ARGUMENT_ANCHORS = ["step-01", "step-02", "step-03", "step-04", "step-05", "step-07"];
const constants = getConstantSet("modern-si-2019");
const journey = REAL_JOURNEYS.find((record) => record.paper === "brownian-motion");

function value(evaluation: { result: ScientificResult }): number {
  assert(evaluation.result.status === "value");
  assert(typeof evaluation.result.value === "number");
  return evaluation.result.value;
}

describe("Brownian discovery's shared argument stages (am-4k0m)", () => {
  test("the actual journey contains the published argument and passes its epistemic checks", () => {
    expect(journey).toBeDefined();
    const parsed = validateJourney(journey);
    expect(parsed.stages.map((stage) => stage.id)).toEqual(ARGUMENT_ANCHORS);
    expect(parsed.completeness).toBe("complete");
    expect(parsed.pendingElements ?? []).toEqual([]);
    expect(
      checkJourney(parsed, { cards: SHELF_CARD_CONTEXT }).filter(
        (finding) => finding.severity === "error",
      ),
    ).toEqual([]);
    console.log(
      `[brownian stages] ${parsed.stages.length} authored argument stages; ${parsed.stages.reduce(
        (total, stage) => total + stage.premiseRefs.length,
        0,
      )} premise references checked`,
    );
  });

  test("premises name existing shelf cards admitted to real anchors, and reasoning tools resolve", () => {
    const anchors = new Set(ARGUMENT_ANCHORS);
    for (const stage of BROWNIAN_STAGES) {
      expect(stage.premiseRefs.length).toBeGreaterThan(0);
      expect(stage.support.workedExample.steps.length).toBeGreaterThan(0);
      expect(stage.support.partialComparison.toComplete.trim()).not.toBe("");
      expect(stage.support.prediction?.prompt.trim()).toBeTruthy();
      expect(stage.support.transferCase?.whatChanges.trim()).toBeTruthy();
      expect(stage.support.transferCase?.whatStaysValid.trim()).toBeTruthy();
      for (const reference of stage.premiseRefs) {
        const card = BROWNIAN_SHELF_CARDS.find((entry) => entry.id === reference.cardId);
        assert(card, `${stage.id}: ${reference.cardId}`);
        expect(card.date.latestYear).toBeLessThanOrEqual(1904);
        expect(
          validateCardCitation(card, { stageId: stage.id, journeyId: "brownian-motion" }, anchors),
        ).toEqual([]);
      }
      for (const reason of stage.reasoning) {
        expect(stage.prerequisites).toContain(reason.foundationId);
        expect(existsSync(`content/foundations/${reason.foundationId}.json`)).toBe(true);
      }
      expect(existsSync(`content/experiments/${stage.instrument?.instrumentId}.yaml`)).toBe(true);
    }
  });

  test("stage prose, worked support and the caller's rich content all reach static HTML", () => {
    const replacement = "A changed argument reaches the reader from its authored record.";
    const html = renderToStaticMarkup(
      <BrownianStage
        stage={{
          ...DRAG_BALANCE_STAGE,
          support: { ...DRAG_BALANCE_STAGE.support, explanation: replacement },
        }}
      >
        <p data-existing-formula="">Existing rich equation and disclosure</p>
      </BrownianStage>,
    );
    expect(html).toContain(replacement);
    expect(html).not.toContain("Suppose a force pulls every particle the same way");
    expect(html).toContain('id="step-03"');
    expect(html).toContain('aria-labelledby="step-03-question"');
    expect(html).toContain('href="#card-stokes-1851-sphere-drag"');
    expect(html).toContain('href="/foundations/viscosity-stokes-drag/"');
    expect(html).toContain('href="/lab/bm-04/"');
    expect(html).toContain("What this step uses");
    expect(html).toContain("Work through this step");
    expect(html).toContain("Compare your reasoning");
    expect(html).toContain("What if the liquid is twice as viscous?");
    expect(html.indexOf(replacement)).toBeLessThan(html.indexOf("data-existing-formula"));
    expect(html.indexOf("data-existing-formula")).toBeLessThan(
      html.indexOf("data-stage-worked-example"),
    );
  });

  test("the signed-mean example and its drift counterexample use the same scientific owner as BM-01", () => {
    const symmetric = ensembleMoments({ displacements: new Float64Array([2e-6, -2e-6]), d: 1 });
    const drifting = ensembleMoments({ displacements: new Float64Array([2e-6, 2e-6]), d: 1 });
    assert.equal(symmetric.kind, "accepted");
    assert.equal(drifting.kind, "accepted");
    const a = symmetric.data.axes[0];
    const b = drifting.data.axes[0];
    assert(a && b);
    expect(a.mean).toBe(0);
    expect(a.meanSquare / 1e-12).toBe(4);
    expect(a.rms / 1e-6).toBe(2);
    expect(b.mean / 1e-6).toBe(2);
    expect(b.meanSquare).toBe(a.meanSquare);
    expect(OBSERVABLE_STAGE.support.workedExample.steps.join(" ")).toContain(
      "four square micrometres",
    );
    expect(OBSERVABLE_STAGE.support.transferCase.whatChanges).toContain("square of the mean");
  });

  test("the ideal-pressure comparisons retain both the proportionality and the independence limit", () => {
    const first = value(osmoticPressure({ n: 1e15, T: 290 }, constants));
    const doubled = value(osmoticPressure({ n: 2e15, T: 290 }, constants));
    const diluted = value(osmoticPressure({ n: 0.5e15, T: 290 }, constants));
    expect(doubled / first).toBe(2);
    expect(diluted / first).toBe(0.5);
    const cluster = lockedClusterPressure(1, 290, constants);
    assert("locked" in cluster);
    const pairIndependent = value(osmoticPressure({ n: 2, T: 290 }, constants));
    expect(value(cluster.locked) / pairIndependent).toBe(0.5);
    expect(cluster.independent.result.status).toBe("outside-domain");
    expect(OSMOTIC_STAGE.support.transferCase.whatChanges).toContain("independent count");
  });

  test("force cancels only after relating equilibria; zero force stays a limit rather than a zero division", () => {
    const input = { T: 290, eta: 1e-3, a: 0.5e-6 };
    const D = value(stokesEinsteinD(input, constants));
    const balance = (force: number) =>
      equilibriumBalance(
        { force, temperature: input.T, eta: input.eta, a: input.a, kickDiffusivity: D },
        constants,
      );
    const first = balance(1e-15);
    const twice = balance(2e-15);
    const zero = balance(0);
    assert("balanceD" in first && "balanceD" in twice && "balanceD" in zero);
    expect(first.agree).toBe(true);
    expect(twice.agree).toBe(true);
    expect(value(twice.balanceD) / value(first.balanceD)).toBeCloseTo(1, 12);
    expect(zero.balanceD.result.status).toBe("not-applicable");
    expect(value(zero.mobilityD) / D).toBeCloseTo(1, 12);
    expect(value(stokesEinsteinD({ ...input, eta: 2e-3 }, constants)) / D).toBe(0.5);
    expect(DRAG_BALANCE_STAGE.support.partialComparison.explanation).toContain("zero equals zero");
  });

  test("exact step enumeration distinguishes independent and correlated paths, including unchanged signed means", () => {
    const independent = enumerateSignedSteps(2);
    const correlated = enumerateSignedSteps(2, "same-direction");
    const four = enumerateSignedSteps(4);
    expect(independent.rows.map((row) => row.square)).toEqual([4, 0, 0, 4]);
    expect(independent.mean).toBe(0);
    expect(independent.meanSquare).toBe(2);
    expect(independent.meanCrossTerm).toBe(0);
    expect(correlated.mean).toBe(0);
    expect(correlated.meanSquare).toBe(4);
    expect(correlated.meanCrossTerm).toBe(2);
    expect(four.meanSquare).toBe(4);
    expect(Math.sqrt(four.meanSquare)).toBe(2);
    expect(value(rmsDisplacement(1, 9)) / value(rmsDisplacement(1, 1))).toBe(3);
    expect(TIME_SCALING_STAGE.support.transferCase.explanation).toContain("four square units");
  });

  test("the interval example distinguishes density, probability, widening and the starting point mass", () => {
    const D = 1e-12;
    const inside = value(intervalProbability(-1e-6, 1e-6, 1, D));
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThan(1);
    expect(value(intervalProbability(-2e-6, 2e-6, 1, D))).toBeGreaterThan(inside);
    expect(value(intervalProbability(0, 0, 1, D))).toBe(0);
    expect(value(gaussianPropagator(0, 1, D))).toBeGreaterThan(0);
    expect(value(intervalProbability(0, 0, 0, D))).toBe(1);
    expect(gaussianPropagator(0, 0, D).result.status).toBe("analytic-limit");
    expect(INTERVAL_STAGE.support.transferCase.explanation).toContain("point mass");
  });

  test("the inverse example cannot manufacture a molecular count or an interval from missing information", () => {
    const estimate = estimateSummaryStatistics({
      meanSquareDisplacement: 4e-12,
      observationInterval: 2,
      independentCoordinateCount: null,
    });
    assert.equal(estimate.kind, "accepted");
    expect(estimate.data.dHat / 1e-12).toBe(1);
    expect(estimate.data.independentCoordinateCount).toBeNull();
    const family = identifiabilityFamily(
      { D: estimate.data.dHat, T: 290, eta: 1e-3, radiusRange: [0.5e-6, 1e-6], synthetic: true },
      getConstantSet("scenario-gas-constant-measured"),
    );
    assert.equal(family.kind, "accepted");
    const firstN = family.data.numbers[0];
    const lastN = family.data.numbers.at(-1);
    assert(firstN !== undefined && lastN !== undefined);
    expect(lastN / firstN).toBeCloseTo(0.5, 12);
    expect(family.data.semanticKind).toBe("synthetic-recovery");
    expect(INFERENCE_STAGE.support.partialComparison.explanation).toContain("second constraint");
    expect(INFERENCE_STAGE.support.transferCase.whatStaysValid).toContain("consistency check");
  });

  test("Perrin's later measurements cannot be smuggled into the historical stage premises", () => {
    const later = BROWNIAN_LATER_EVIDENCE.find(
      (card) => card.id === "perrin-1909-molecular-reality",
    );
    assert(later);
    const parsed = validateJourney(journey);
    const planted = {
      ...parsed,
      stages: parsed.stages.map((stage) =>
        stage.id === "step-07"
          ? { ...stage, premiseRefs: [...stage.premiseRefs, { cardId: later.id }] }
          : stage,
      ),
    };
    const findings = checkJourney(planted, {
      cards: {
        ...SHELF_CARD_CONTEXT,
        [later.id]: { id: later.id, status: later.status, date: later.date },
      },
    });
    expect(
      findings.some(
        (finding) =>
          finding.rule === "shelf-date-violation" && finding.path.endsWith("premiseRefs"),
      ),
    ).toBe(true);
  });
});
