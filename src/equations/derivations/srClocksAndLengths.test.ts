import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { auditReadings } from "../../content/audits/readings.ts";
import {
  alignedBoost,
  contractedLength,
  dilatedInterval,
  type Event,
  inverseBoost,
  type KinematicResult,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import { type Expression, walk } from "../ast.ts";
import { evaluateExpression } from "./spotCheck.ts";
import {
  createSRClocksAndLengthsSetup,
  presentSRClockLengthChain,
  presentSRClockLengthExpression,
  SR_CLOCKS_AND_LENGTHS_RECORDS,
  srClockLengthChains,
  srClockLengthHistoricalReading,
  srClockLengthSourceLinks,
  srClocksAndLengths,
  SRClocksAndLengthsError,
} from "./srClocksAndLengths.ts";
import { verifySRClocksAndLengths } from "./srClocksAndLengthsProof.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { verifyChain } from "./verifyChain.ts";

test("both measurement chains check every step and reach their canonical results", () => {
  for (const chain of srClockLengthChains) {
    const report = verifySRClocksAndLengths(chain);
    expect(report.passed).toBe(true);
    expect(report.isPublicationReady).toBe(true);
    expect(report.stepReports).toHaveLength(chain.steps.length);
    expect(report.stepReports.every((step) => step.verificationStatus === "verified")).toBe(true);
    expect(chain.steps.filter((step) => step.isMove)).toHaveLength(1);
    for (let index = 1; index < chain.steps.length; index++)
      expect(structurallyEqual(chain.steps[index - 1]!.to, chain.steps[index]!.from)).toBe(true);
  }
  expect(structurallyEqual(srClocksAndLengths.clock.steps.at(-1)!.to, srClocksAndLengths.setup.clock)).toBe(true);
  expect(structurallyEqual(srClocksAndLengths.length.steps.at(-1)!.to, srClocksAndLengths.setup.length)).toBe(true);
});

test("missing steps, reordered arguments and disconnected replacements receive no proof credit", () => {
  for (const chain of srClockLengthChains) {
    expect(verifySRClocksAndLengths({ ...chain, steps: chain.steps.slice(1) }).passed).toBe(false);
    const reordered = [...chain.steps];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    expect(verifySRClocksAndLengths({ ...chain, steps: reordered }).passed).toBe(false);
    const last = chain.steps.at(-1)!;
    const disconnected = { ...chain, steps: [...chain.steps.slice(0, -1), { ...last, from: last.to }] };
    if (last.rule.kind === "substitute")
      expect(verifyChain(disconnected, { isPublicationGate: true }).passed).toBe(true);
    expect(verifySRClocksAndLengths(disconnected).passed).toBe(false);
    expect(verifySRClocksAndLengths({ ...chain, target: "unrelated-equation" }).passed).toBe(false);
    expect(verifySRClocksAndLengths({ ...chain, routeKind: "source-order" }).passed).toBe(false);
    expect(verifySRClocksAndLengths({ ...chain, proofRouteId: "unrelated-route" }).passed).toBe(false);
  }
});

test("a measurement cannot silently change its frame, omit a premise or invent a definition", () => {
  for (const chain of srClockLengthChains) {
    expect(verifySRClocksAndLengths({ ...chain, entryAssumptions: [] }).passed).toBe(false);
    const move = chain.steps.find((step) => step.isMove)!;
    for (const changed of [
      { ...move, premiseRefs: [] },
      { ...move, rule: { ...move.rule, params: { ...move.rule.params, citedEquality: "Use equal coordinates in the other frame." } } },
      { ...move, rule: { ...move.rule, params: { ...move.rule.params, replacement: { kind: "number", value: "0" } } } },
    ]) {
      expect(verifySRClocksAndLengths({
        ...chain,
        steps: chain.steps.map((step) => step.id === move.id ? changed : step),
      }).passed).toBe(false);
    }
  }
});

test("division by the Lorentz factor requires its actual positive subluminal domain", () => {
  const chain = srClocksAndLengths.length;
  const last = chain.steps.at(-1)!;
  for (const patch of [
    { nonzeroCondition: "" },
    { nonzeroCondition: "zero is nonzero" },
    { quantity: { kind: "number", value: "0" } },
    { simplify: false },
  ]) {
    expect(verifySRClocksAndLengths({
      ...chain,
      steps: [...chain.steps.slice(0, -1), { ...last, rule: { ...last.rule, params: { ...last.rule.params, ...patch } } }],
    }).passed).toBe(false);
  }
});

test("changed canonical frame maps or result meanings refuse (srClocksAndLengths.ts:110)", () => {
  for (const key of Object.keys(SR_CLOCKS_AND_LENGTHS_RECORDS) as (keyof typeof SR_CLOCKS_AND_LENGTHS_RECORDS)[]) {
    const records = structuredClone(SR_CLOCKS_AND_LENGTHS_RECORDS);
    Object.assign(records[key], { tree: { kind: "number", value: "1" } });
    let caught: unknown;
    try { createSRClocksAndLengthsSetup(records); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(SRClocksAndLengthsError);
    expect((caught as SRClocksAndLengthsError).code).toBe("sr-clock-length-canonical-mismatch");
  }
});

test("unknown presentation quantities refuse (srClocksAndLengths.ts:291)", () => {
  let caught: unknown;
  try {
    presentSRClockLengthExpression({ kind: "symbol", termId: "unknown", quantityId: "unknown" });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(SRClocksAndLengthsError);
  expect((caught as SRClocksAndLengthsError).code).toBe("sr-clock-length-missing-glyph");
});

function value<T>(result: KinematicResult<T>): T {
  expect(result.status).toBe("value");
  if (result.status !== "value") throw new Error("The numerical fixture left the stated inertial domain.");
  return result.value;
}

function bindings(first: Event, second: Event, firstMoving: Event, secondMoving: Event, beta: number) {
  return {
    "coordinateTimeStationary.event1": first.t,
    "coordinateTimeStationary.event2": second.t,
    "coordinatePositionStationary.event1": first.x,
    "coordinatePositionStationary.event2": second.x,
    "coordinateTimeMoving.event1": firstMoving.t,
    "coordinateTimeMoving.event2": secondMoving.t,
    "coordinatePositionMoving.event1": firstMoving.x,
    "coordinatePositionMoving.event2": secondMoving.x,
    speedOfLight: 1,
    frameSpeed: beta,
    lorentzFactor: value(alignedBoost(beta, 1)).gamma,
    eventSeparationTemporalStationary: second.t - first.t,
    properTimeElapsed: secondMoving.t - firstMoving.t,
    lengthMeasuredStationary: second.x - first.x,
    lengthProper: secondMoving.x - firstMoving.x,
  };
}

function checkAllEqualities(chain: DerivationChain, inputs: Readonly<Record<string, number>>) {
  for (const step of chain.steps) {
    for (const equation of [step.from, step.to]) {
      if (equation.kind !== "relation") throw new Error("Every published clock and rod step must be an equality.");
      const left = evaluateExpression(equation.left, inputs);
      const right = evaluateExpression(equation.right, inputs);
      expect(Math.abs(left - right)).toBeLessThan(1e-11 * Math.max(1, Math.abs(left), Math.abs(right)));
    }
  }
}

test("all clock equations agree with transformed tick events at nonzero readings and positions", () => {
  for (const beta of [0, 0.6, -0.6, 0.9]) {
    const boost = value(alignedBoost(beta, 1));
    const inverse = value(inverseBoost(boost));
    for (const offset of [-4, 0, 7]) {
      const firstMoving = { t: 8 + offset, x: 3 + offset, y: 0, z: 0 };
      const secondMoving = { ...firstMoving, t: firstMoving.t + 0.8 };
      const first = value(transformEvent(firstMoving, inverse));
      const second = value(transformEvent(secondMoving, inverse));
      const inputs = bindings(first, second, firstMoving, secondMoving, beta);
      checkAllEqualities(srClocksAndLengths.clock, inputs);
      expect(inputs.eventSeparationTemporalStationary).toBeCloseTo(value(dilatedInterval(0.8, beta)), 12);
    }
  }
});

test("all length equations agree with simultaneous endpoint events at arbitrary K times", () => {
  for (const beta of [0, 0.6, -0.6, 0.9]) {
    const boost = value(alignedBoost(beta, 1));
    for (const offset of [-4, 0, 7]) {
      const first = { t: 8 + offset, x: 3 + offset, y: 0, z: 0 };
      const measured = value(contractedLength(1, beta));
      const second = { ...first, x: first.x + measured };
      const firstMoving = value(transformEvent(first, boost));
      const secondMoving = value(transformEvent(second, boost));
      const inputs = bindings(first, second, firstMoving, secondMoving, beta);
      checkAllEqualities(srClocksAndLengths.length, inputs);
      expect(inputs.lengthProper).toBeCloseTo(1, 12);
      expect(inputs.lengthMeasuredStationary).toBeCloseTo(measured, 12);
    }
  }
});

test("the wrong event conditions give different answers in the independent event transform", () => {
  const boost = value(alignedBoost(0.6, 1));
  const inverse = value(inverseBoost(boost));
  // Equal positions in K describe a clock resting in K, not the claimed clock resting in k.
  const first = { t: 7, x: 3, y: 0, z: 0 };
  const second = { ...first, t: 8 };
  const firstMoving = value(transformEvent(first, boost));
  const secondMoving = value(transformEvent(second, boost));
  expect(secondMoving.x - firstMoving.x).not.toBeCloseTo(0, 12);
  expect(second.t - first.t).not.toBeCloseTo(boost.gamma * (secondMoving.t - firstMoving.t), 12);
  // Equal k times on the rod select a different pair from the K-simultaneous length protocol.
  const leftMoving = { t: 5, x: 2, y: 0, z: 0 };
  const rightMoving = { ...leftMoving, x: 3 };
  const left = value(transformEvent(leftMoving, inverse));
  const right = value(transformEvent(rightMoving, inverse));
  expect(right.t - left.t).not.toBeCloseTo(0, 12);
  expect(right.x - left.x).toBeCloseTo(boost.gamma, 12);
  expect(right.x - left.x).not.toBeCloseTo(value(contractedLength(1, 0.6)), 12);
});

test("presentation preserves event identities, all source returns and owned R0–R3 reasons", () => {
  const owner = yaml.load(readFileSync(new URL(
    "../../../content/editorial/readings-owners/am-srk-equations-30cq.yaml", import.meta.url,
  ), "utf8")) as { ownerBeadId: string; targets: { id: string; readings: unknown }[] };
  const targets = srClockLengthChains.flatMap((chain) => {
    const display = presentSRClockLengthChain(chain);
    return chain.steps.map((step, index) => {
      const symbols = (tree: Expression) => walk(tree).filter((node) => node.kind === "symbol").map((node) =>
        node.kind === "symbol" && { quantityId: node.quantityId, index: node.index });
      expect(symbols(display.steps[index]!.to)).toEqual(symbols(step.to));
      expect(srClockLengthSourceLinks.some((source) => source.id === step.sourceAnchor)).toBe(true);
      const targetId = chain.id + "/" + step.id;
      const readings = { ...step.reasons, ...srClockLengthHistoricalReading };
      expect(owner.targets.find((target) => target.id === targetId)?.readings).toEqual(readings);
      return { targetId, targetKind: "derivation-step" as const, paper: "special-relativity", readings };
    });
  });
  const report = auditReadings({ targets, owners: [{
    ownerBeadId: owner.ownerBeadId, fileName: owner.ownerBeadId + ".yaml",
    paper: "special-relativity", targetKinds: ["derivation-step"], targetIds: targets.map((target) => target.targetId),
  }] });
  expect(report.findings.filter((finding) => finding.severity === "error")).toEqual([]);
});
