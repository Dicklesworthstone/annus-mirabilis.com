import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { auditReadings } from "../../content/audits/readings.ts";
import {
  alignedBoost,
  type Event,
  type KinematicResult,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import type { Expression } from "../ast.ts";
import { exportProofRouteGraph } from "./exportProofGraph.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  srSimultaneityChain as chain,
  createSRSimultaneitySetup,
  presentSRSimultaneityExpression,
  SR_SIMULTANEITY_RECORDS,
  SRSimultaneityError,
  srSimultaneity,
  srSimultaneityHistoricalReading,
} from "./srSimultaneity.ts";
import { verifySRSimultaneity } from "./srSimultaneityProof.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";

test("the signed simultaneity offset has a complete exact eight-step teaching proof", () => {
  const report = verifySRSimultaneity();
  expect(report.passed).toBe(true);
  expect(report.isPublicationReady).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.graphIssues).toEqual([]);
  expect(report.stepReports).toHaveLength(8);
  expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
  expect(structurallyEqual(chain.steps.at(-1)!.to, srSimultaneity.setup.offset)).toBe(true);
  expect(chain.steps.filter((step) => step.isMove).map((step) => step.id)).toEqual([
    "sr-simultaneity-choose-equal-times",
  ]);
  const graph = exportProofRouteGraph(chain);
  expect(graph.isAcyclic).toBe(true);
  expect(graph.edges.filter((edge) => edge.from === "arg-sr-lorentz-map").length).toBeGreaterThan(
    0,
  );
  expect(graph.edges.every((edge) => edge.edgeType === "pedagogical-reconstruction")).toBe(true);
  expect(JSON.parse(JSON.stringify(report))).toEqual(report);
});

function withStep(id: string, change: (step: DerivationStep) => DerivationStep): DerivationChain {
  return { ...chain, steps: chain.steps.map((step) => (step.id === id ? change(step) : step)) };
}

test("lost event identity, sign, premises and disconnected steps cannot earn proof credit", () => {
  const first = chain.steps[0]!;
  const changed: DerivationChain[] = [
    { ...chain, steps: [] },
    { ...chain, steps: chain.steps.slice(1) },
    { ...chain, steps: [chain.steps[1]!, first, ...chain.steps.slice(2)] },
    { ...chain, target: "a-different-conclusion" },
    { ...chain, targetStepId: first.id },
    { ...chain, proofRouteId: "a-different-route" },
    { ...chain, routeKind: "source-order" },
    { ...chain, entryAssumptions: chain.entryAssumptions.slice(1) },
    {
      ...chain,
      entryAssumptions: chain.entryAssumptions.map((premise) => ({
        ...premise,
        edgeType: "historical-derivation",
      })),
    },
    withStep("sr-simultaneity-map-first-event", (step) => ({ ...step, from: step.to })),
    withStep("sr-simultaneity-map-first-event", (step) => ({ ...step, premiseRefs: [] })),
    withStep("sr-simultaneity-map-first-event", (step) => ({
      ...step,
      premiseRefs: step.premiseRefs.map((premise) => ({
        ...premise,
        edgeType: "historical-derivation",
      })),
    })),
    withStep("sr-simultaneity-choose-equal-times", (step) => ({
      ...step,
      rule: {
        ...step.rule,
        params: { ...step.rule.params, targetId: "eventSeparationTemporalMoving" },
      },
    })),
    withStep("sr-simultaneity-name-separation", (step) => ({
      ...step,
      rule: {
        ...step.rule,
        params: { ...step.rule.params, citedEquality: "Use an unsigned distance." },
      },
    })),
    withStep("sr-simultaneity-choose-equal-times", (step) => ({
      ...step,
      rule: {
        ...step.rule,
        params: { ...step.rule.params, replacement: { kind: "number", value: "1" } },
      },
    })),
    withStep("sr-simultaneity-choose-equal-times", (step) => ({
      ...step,
      rule: { ...step.rule, params: { ...step.rule.params, replacement: null } },
    })),
    withStep("sr-simultaneity-subtract-first-event", (step) => ({
      ...step,
      rule: { ...step.rule, params: { ...step.rule.params, operation: "add" } },
    })),
    withStep("sr-simultaneity-read-offset", (step) => {
      if (
        step.to.kind !== "relation" ||
        step.to.right.kind !== "quotient" ||
        step.to.right.numerator.kind !== "negate"
      )
        throw new Error("Expected the canonical negative offset.");
      return {
        ...step,
        to: {
          ...step.to,
          right: { ...step.to.right, numerator: step.to.right.numerator.argument },
        },
      };
    }),
  ];
  for (const mutation of changed) {
    const report = verifySRSimultaneity(mutation);
    expect(report.passed).toBe(false);
    expect(report.isPublicationReady).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  }
});

test("changed canonical map, Lorentz branch or offset refuses at the production boundary", () => {
  for (const key of Object.keys(
    SR_SIMULTANEITY_RECORDS,
  ) as (keyof typeof SR_SIMULTANEITY_RECORDS)[]) {
    const original = SR_SIMULTANEITY_RECORDS[key];
    const wrongTree: Expression = { kind: "number", value: "1" };
    assert.throws(
      () =>
        createSRSimultaneitySetup({
          ...SR_SIMULTANEITY_RECORDS,
          [key]: { ...original, tree: wrongTree },
        }),
      (error) => {
        expect(error).toBeInstanceOf(SRSimultaneityError);
        expect(error).toMatchObject({
          code: "sr-simultaneity-canonical-mismatch",
          path: original.id,
        });
        return true;
      },
    );
    expect(() =>
      createSRSimultaneitySetup({
        ...SR_SIMULTANEITY_RECORDS,
        [key]: { ...original, id: "unrelated-record" },
      }),
    ).toThrow(SRSimultaneityError);
  }
  assert.throws(
    () =>
      presentSRSimultaneityExpression({
        kind: "symbol",
        termId: "unknown",
        quantityId: "unknown",
      }),
    (error) => {
      expect(error).toBeInstanceOf(SRSimultaneityError);
      expect(error).toMatchObject({
        code: "sr-simultaneity-missing-glyph",
        path: "sr-simultaneity.presentation",
      });
      return true;
    },
  );
});

function value<T>(result: KinematicResult<T>): T {
  expect(result.status).toBe("value");
  if (result.status !== "value") throw new Error("The test left the stated inertial domain.");
  return result.value;
}

function bindings(first: Event, second: Event, beta: number) {
  const boost = value(alignedBoost(beta, 1));
  const firstMoving = value(transformEvent(first, boost));
  const secondMoving = value(transformEvent(second, boost));
  return {
    "coordinateTimeStationary.event1": first.t,
    "coordinateTimeStationary.event2": second.t,
    "coordinatePositionStationary.event1": first.x,
    "coordinatePositionStationary.event2": second.x,
    "coordinateTimeMoving.event1": firstMoving.t,
    "coordinateTimeMoving.event2": secondMoving.t,
    speedOfLight: 1,
    frameSpeed: beta,
    lorentzFactor: boost.gamma,
    eventSeparationTemporalStationary: second.t - first.t,
    eventSeparationTemporalMoving: secondMoving.t - firstMoving.t,
    eventSeparationSpatial: second.x - first.x,
  };
}

function checkEquality(tree: Expression, inputs: Readonly<Record<string, number>>) {
  if (tree.kind !== "relation") throw new Error("Expected a displayed equality.");
  const left = evaluateExpression(tree.left, inputs);
  const right = evaluateExpression(tree.right, inputs);
  expect(Number.isFinite(left) && Number.isFinite(right)).toBe(true);
  expect(Math.abs(left - right)).toBeLessThan(1e-11 * Math.max(1, Math.abs(left), Math.abs(right)));
}

test("every displayed step agrees with the reference event owner across signed speeds, offsets and separations", () => {
  let pairs = 0;
  for (const beta of [-0.9, -0.6, 0, 0.6, 0.9]) {
    for (const offset of [-4, 0, 7]) {
      for (const separation of [-10, 0, 10]) {
        const first = { t: 8 + offset, x: 3 + offset, y: 2, z: -1 };
        const second = { ...first, x: first.x + separation, y: -5 };
        const inputs = bindings(first, second, beta);
        for (const step of chain.steps) {
          checkEquality(step.from, inputs);
          checkEquality(step.to, inputs);
        }
        if (beta === 0 || separation === 0) expect(inputs.eventSeparationTemporalMoving).toBe(0);
        pairs++;
      }
    }
  }
  expect(pairs).toBe(45);
});

test("the general relation retains unequal times and swapping the event order reverses both differences", () => {
  const first = { t: 4, x: 3, y: 0, z: 0 };
  const second = { t: 6, x: 13, y: 0, z: 0 };
  const inputs = bindings(first, second, 0.6);
  checkEquality(srSimultaneity.generalDifference, inputs);
  const conclusion = srSimultaneity.setup.offset;
  expect(
    Math.abs(
      evaluateExpression(conclusion.left, inputs) - evaluateExpression(conclusion.right, inputs),
    ),
  ).toBeCloseTo(2.5, 12);
  const reverse = bindings(second, first, 0.6);
  checkEquality(srSimultaneity.generalDifference, reverse);
  expect(reverse.eventSeparationTemporalMoving).toBe(-inputs.eventSeparationTemporalMoving);
  expect(reverse.eventSeparationSpatial).toBe(-inputs.eventSeparationSpatial);
  expect(reverse.eventSeparationTemporalStationary).toBe(-inputs.eventSeparationTemporalStationary);
});

test("all step explanations retain their named authoring owner and explicit historical scope", () => {
  const owner = yaml.load(
    readFileSync(
      new URL(
        "../../../content/editorial/readings-owners/am-srk-equations-30cq.yaml",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { ownerBeadId: string; targets: { id: string; readings: unknown }[] };
  const targets = chain.steps.map((step) => {
    const targetId = `${chain.id}/${step.id}`;
    const readings = { ...step.reasons, ...srSimultaneityHistoricalReading };
    expect(owner.targets.find((item) => item.id === targetId)?.readings).toEqual(readings);
    return {
      targetId,
      targetKind: "derivation-step" as const,
      paper: "special-relativity",
      readings,
    };
  });
  const report = auditReadings({
    targets,
    owners: [
      {
        ownerBeadId: owner.ownerBeadId,
        fileName: `${owner.ownerBeadId}.yaml`,
        paper: "special-relativity",
        targetKinds: ["derivation-step"],
        targetIds: targets.map((target) => target.targetId),
      },
    ],
  });
  expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
});
