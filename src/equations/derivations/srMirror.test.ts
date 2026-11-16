import { describe, expect, test } from "bun:test";
import {
  aberration,
  dopplerFactor,
  movingMirror,
} from "../../physics/reference/waves.ts";
import type { Expression } from "../ast.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srMirrorCanonicalFrequency,
  srMirrorChains,
  srMirrorDirection,
  srMirrorDirectionChain,
  srMirrorEnergyChain,
  srMirrorEnergyTransfer,
  srMirrorFrequency,
  srMirrorFrequencyChain,
  srMirrorIncidentFlux,
  srMirrorOutgoingFlux,
  srMirrorPressure,
  srMirrorPressureChain,
  srMirrorStationaryChain,
  srMirrorSymbols,
} from "./srMirror.ts";
import { checkSRMirrorCanonicalFrequency, verifySRMirror } from "./srMirrorProof.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

const one: Expression = { kind: "number", value: "1" };
const two: Expression = { kind: "number", value: "2" };
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const times = (...args: Expression[]): Expression => ({ kind: "product", args });
const plus = (...args: Expression[]): Expression => ({ kind: "sum", args });
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});

describe("SR §8 reflected wave and moving-surface energy proof", () => {
  test("every route has exact checks and declares its physical domain", () => {
    expect(srMirrorChains.length).toBeGreaterThan(0);
    for (const chain of srMirrorChains) {
      const report = verifySRMirror(chain);
      expect(report.errors).toEqual([]);
      expect(report.passed).toBe(true);
      expect(report.isPublicationReady).toBe(true);
      expect(report.stepReports.length).toBe(chain.steps.length);
      expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
      expect(
        chain.entryAssumptions.some((premise) => premise.ref === "sr-mirror-subluminal-interception"),
      ).toBe(true);
    }
    console.log(
      "[sr-mirror] " + srMirrorChains.length + " routes; " +
        srMirrorChains.flatMap((chain) => chain.steps).length + " checked transformations",
    );
  });

  test("the canonical ratio cannot reverse or inherit the printed denominator error", () => {
    expect(checkSRMirrorCanonicalFrequency()).toBe(true);
    const left = srMirrorCanonicalFrequency.left;
    const right = srMirrorCanonicalFrequency.right;
    if (left.kind !== "quotient" || right.kind !== "quotient")
      throw new Error("The canonical mirror equation must compare a frequency ratio.");
    expect(
      checkSRMirrorCanonicalFrequency({
        ...srMirrorCanonicalFrequency,
        left: { ...left, numerator: left.denominator, denominator: left.numerator },
      }),
    ).toBe(false);
    const printedError = {
      ...srMirrorCanonicalFrequency,
      right: {
        ...right,
        denominator: square(plus(one, negative(srMirrorSymbols.b))),
      },
    };
    expect(checkSRMirrorCanonicalFrequency(printedError)).toBe(false);
    expect(
      verifySRMirror(srMirrorFrequencyChain, srMirrorChains, printedError).passed,
    ).toBe(false);
    expect(
      checkSRMirrorCanonicalFrequency({ ...srMirrorCanonicalFrequency, operator: "approx" }),
    ).toBe(false);
  });

  test("locally valid substitutions cannot forge the rest-frame reflection premise", () => {
    const first = srMirrorFrequencyChain.steps[0]!;
    const targetId = first.rule.params.targetId as string;
    for (const replacement of [
      srMirrorSymbols.moving,
      times(two, first.rule.params.replacement as Expression),
    ]) {
      const forgedStep = {
        ...first,
        rule: { ...first.rule, params: { ...first.rule.params, replacement } },
        to: substituteNode(first.from, targetId, replacement),
      };
      const local: DerivationChain = {
        ...srMirrorFrequencyChain,
        targetStepId: forgedStep.id,
        steps: [forgedStep],
      };
      // The local checker proves application of a supplied replacement, not its provenance.
      expect(verifyChain(local).stepReports[0]?.ruleOutcome).toBe("pass");
      const changed = {
        ...srMirrorFrequencyChain,
        steps: [forgedStep, ...srMirrorFrequencyChain.steps.slice(1)],
      };
      expect(verifySRMirror(changed).passed).toBe(false);
    }
    expect(
      verifySRMirror({
        ...srMirrorFrequencyChain,
        steps: srMirrorFrequencyChain.steps.map((step, index) =>
          index === 0 ? { ...step, isMove: false, moveLabel: undefined } : step,
        ),
      }).passed,
    ).toBe(false);
  });

  test("interception, the nonzero work branch and stationary continuity cannot disappear", () => {
    for (const chain of srMirrorChains)
      expect(
        verifySRMirror({
          ...chain,
          entryAssumptions: chain.entryAssumptions.filter(
            (premise) => premise.ref !== "sr-mirror-subluminal-interception",
          ),
        }).passed,
      ).toBe(false);
    expect(
      verifySRMirror({
        ...srMirrorPressureChain,
        entryAssumptions: srMirrorPressureChain.entryAssumptions.filter(
          (premise) => premise.ref !== "sr-mirror-nonzero-speed-branch",
        ),
      }).passed,
    ).toBe(false);
    const pressure = srMirrorPressureChain.steps[0]!;
    expect(
      verifySRMirror({
        ...srMirrorPressureChain,
        steps: [
          {
            ...pressure,
            rule: {
              ...pressure.rule,
              params: { ...pressure.rule.params, nonzeroCondition: "" },
            },
          },
        ],
      }).passed,
    ).toBe(false);
    expect(
      verifySRMirror({
        ...srMirrorStationaryChain,
        entryAssumptions: srMirrorStationaryChain.entryAssumptions.filter(
          (premise) => premise.ref !== "sr-mirror-stationary-continuity",
        ),
      }).passed,
    ).toBe(false);
    const stationary = srMirrorStationaryChain.steps[0]!;
    expect(
      verifySRMirror({
        ...srMirrorStationaryChain,
        steps: [
          {
            ...stationary,
            premiseRefs: stationary.premiseRefs.filter(
              (premise) => premise.ref !== "sr-mirror-stationary-continuity",
            ),
          },
        ],
      }).passed,
    ).toBe(false);
  });

  test("a broken direction producer or incomplete family invalidates downstream support", () => {
    const brokenDirection: DerivationChain = {
      ...srMirrorDirectionChain,
      steps: srMirrorDirectionChain.steps.map((step, index) => {
        if (index !== srMirrorDirectionChain.steps.length - 1) return step;
        if (step.to.kind !== "relation") throw new Error("The direction result must be a relation.");
        return { ...step, to: { ...step.to, right: times(two, step.to.right) } };
      }),
    };
    const family = srMirrorChains.map((chain) =>
      chain.id === brokenDirection.id ? brokenDirection : chain,
    );
    expect(verifySRMirror(srMirrorPressureChain, family).passed).toBe(false);
    expect(verifySRMirror(srMirrorFrequencyChain, srMirrorChains.slice(1)).passed).toBe(false);
    expect(
      verifySRMirror(srMirrorFrequencyChain, [
        srMirrorFrequencyChain,
        ...srMirrorChains.slice(0, -1),
      ]).passed,
    ).toBe(false);
    for (const chain of srMirrorChains) {
      expect(
        verifySRMirror({
          ...chain,
          steps: chain.steps.slice(0, -1),
        }).passed,
      ).toBe(false);
    }
    const collected = srMirrorFrequencyChain.steps[2]!;
    expect(
      verifySRMirror({
        ...srMirrorFrequencyChain,
        steps: srMirrorFrequencyChain.steps.map((step) =>
          step.id === collected.id
            ? { ...step, rule: { ...step.rule, params: { exact: false } } }
            : step,
        ),
      }).passed,
    ).toBe(false);
  });

  test("fixed-plane incident power cannot replace the moving-surface energy premise", () => {
    const first = srMirrorEnergyChain.steps[0]!;
    if (first.from.kind !== "relation")
      throw new Error("The energy account must be a relation.");
    const fixedPlane = {
      ...first.from,
      right: plus(
        times(srMirrorSymbols.density, srMirrorSymbols.lightSpeed, srMirrorSymbols.a),
        negative(srMirrorOutgoingFlux.right),
      ),
    };
    const forgedStep = {
      ...first,
      from: fixedPlane,
      to: substituteNode(
        fixedPlane,
        first.rule.params.targetId as string,
        first.rule.params.replacement as Expression,
      ),
    };
    expect(
      verifyChain({
        ...srMirrorEnergyChain,
        steps: [forgedStep],
        targetStepId: forgedStep.id,
      }).stepReports[0]?.ruleOutcome,
    ).toBe("pass");
    expect(
      verifySRMirror({
        ...srMirrorEnergyChain,
        steps: [forgedStep, ...srMirrorEnergyChain.steps.slice(1)],
      }).passed,
    ).toBe(false);
    const mirror = movingMirror(0.6, 0, { u: 1, c: 1, Am: 1 });
    expect(mirror.status).toBe("value");
    if (mirror.status !== "value") throw new Error("Normal incidence must reach this mirror.");
    expect(mirror.energyBalanceResidual).toBeCloseTo(0, 12);
    // A fixed detector receives uc = 1 here; the moving mirror receives only 0.4.
    expect(1 - mirror.reflectedPower - mirror.workRate).toBeCloseTo(0.6, 12);
  });

  test("the conclusions agree with independent frame transforms and the existing wave owner", () => {
    let admitted = 0;
    const u = 2.3;
    const c = 1.7;
    const area = 3.2;
    for (const b of [-0.9, -0.6, 0, 0.6, 0.9]) {
      for (const a of [-0.8, -0.2, 0.2, 0.6, Math.cos(Math.PI / 6), 1]) {
        if (a <= b + 1e-6) continue;
        admitted++;
        const phi = Math.acos(a);
        const owner = movingMirror(b, phi, { u, c, Am: area });
        expect(owner.status).toBe("value");
        if (owner.status !== "value")
          throw new Error("An admitted intercepted ray did not yield a mirror account.");
        const bindings = { b, a, u, c, r: owner.frequencyRatio };
        expect(evaluateExpression(srMirrorFrequency.right, bindings)).toBeCloseTo(
          owner.frequencyRatio, 10,
        );
        expect(evaluateExpression(srMirrorDirection.right, bindings)).toBeCloseTo(
          owner.cosPhiReflected, 10,
        );
        expect(evaluateExpression(srMirrorPressure.right, bindings)).toBeCloseTo(
          owner.radiationPressure, 10,
        );
        expect(evaluateExpression(srMirrorIncidentFlux.right, bindings) * area).toBeCloseTo(
          owner.incidentPower, 10,
        );
        expect(evaluateExpression(srMirrorOutgoingFlux.right, bindings) * area).toBeCloseTo(
          owner.reflectedPower, 10,
        );
        expect(evaluateExpression(srMirrorEnergyTransfer.right, bindings) * area).toBeCloseTo(
          owner.workRate, 10,
        );
        const incidentInMirror = aberration(b, phi);
        const reflectedInMirror = Math.acos(-incidentInMirror.cosThetaPrime);
        const reflectedInK = aberration(-b, reflectedInMirror);
        expect(reflectedInK.cosThetaPrime).toBeCloseTo(owner.cosPhiReflected, 11);
        expect(dopplerFactor(b, phi) * dopplerFactor(-b, reflectedInMirror)).toBeCloseTo(
          owner.frequencyRatio, 11,
        );
        expect(owner.cosPhiReflected).toBeLessThan(b);
        expect(owner.radiationPressure).toBeGreaterThan(0);
        expect(owner.energyBalanceResidual).toBeCloseTo(0, 10);
      }
    }
    expect(admitted).toBeGreaterThan(10);
    console.log("[sr-mirror] " + admitted + " signed-speed / incidence comparisons with waves owner");
  });

  test("stationary pressure, positive outgoing directions and non-interception stay distinct", () => {
    const stationary = movingMirror(0, Math.PI / 3, { u: 3, c: 1, Am: 1 });
    expect(stationary.status).toBe("value");
    if (stationary.status !== "value") throw new Error("Stationary oblique ray must intercept.");
    expect(stationary.workRate).toBe(0);
    expect(stationary.radiationPressure).toBeCloseTo(1.5, 12);
    expect(stationary.frequencyRatio).toBe(1);
    const oblique = movingMirror(0.6, Math.PI / 6);
    expect(oblique.status).toBe("value");
    if (oblique.status !== "value") throw new Error("The oblique example must intercept.");
    expect(oblique.cosPhiReflected).toBeGreaterThan(0);
    expect(oblique.cosPhiReflected).toBeLessThan(0.6);
    expect(oblique.cosPhiReflected).toBeCloseTo(0.069, 3);
    expect(movingMirror(0.6, Math.acos(0.6)).status).toBe("indeterminate");
    expect(movingMirror(0, Math.PI / 2).status).toBe("indeterminate");
    expect(movingMirror(0.6, Math.acos(0.5)).status).toBe("not-applicable");
    expect(movingMirror(1, 0).status).toBe("outside-domain");
  });
});
