import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { C_SI, evaluateBoundaryLedger } from "../../physics/reference/massEnergy.ts";
import type { Baseline, ComparisonValue } from "../compare/Baseline.ts";
import { compareBaselines } from "../compare/compatibility.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import {
  ME03_COMPARISON,
  me03ComparisonIdentity,
  me03ComparisonParameters,
  verifyMe03Comparison,
  verifyMe03SavedComparison,
} from "./comparison.ts";
import { createMe03ComparisonSession } from "./comparisonSession.ts";
import { ME03_DEFAULTS, type Me03Parameters } from "./definition.ts";
import { createMe03Session } from "./session.ts";

const SOURCE = Object.freeze({ sourceDigest: `source:sha256:${"a".repeat(64)}` });
type Comparison = ReturnType<typeof createMe03ComparisonSession>;
const active: Comparison[] = [];

afterEach(() => {
  for (const comparison of active.splice(0)) comparison.disconnect();
});

function live(parameters: Me03Parameters = ME03_DEFAULTS, instanceId = "boundary-comparison") {
  const comparison = createMe03ComparisonSession(instanceId, parameters, SOURCE);
  active.push(comparison);
  comparison.connect();
  expect(comparison.start()).toBe(true);
  expect(comparison.getSnapshot().phase).toBe("live");
  expect(comparison.getSnapshot().pending).toBe(false);
  return comparison;
}

function numeric(output: ComparisonValue | undefined): number {
  assert.ok(output?.status === "value" && output.value !== null);
  return output.value;
}

test("redrawing body to complete system preserves the emission and changes only measurement", () => {
  const comparison = live({ ...ME03_DEFAULTS, emittedEnergy: 4000 });
  const before = comparison.getSnapshot();
  const requested = { ...before.baseline.parameters, boundary: "combined-isolated-system" };
  expect(comparison.apply(requested)).toBe(true);
  const after = comparison.getSnapshot();
  expect(after.baseline).toBe(before.baseline);
  expect(after.variant.runId).toBe(before.baseline.runId);
  expect(after.variant.instanceId).toBe(before.baseline.instanceId);
  for (const key of ["input", "observer", "estimator"] as const)
    expect(after.variant.revisions[key]).toBe(before.baseline.revisions[key]);
  expect(after.variant.revisions.measurement).toBe(before.baseline.revisions.measurement + 1);
  expect(after.result.kind).toBe("accepted");
  if (after.result.kind !== "accepted") throw new Error("Expected a comparison.");
  expect(after.result.variation).toEqual({
    kind: "accepted",
    changedInput: "boundary",
    command: "measurement-change",
  });
  expect(numeric(after.baseline.outputs.energyChange)).toBe(-4000);
  expect(numeric(after.variant.outputs.energyChange)).toBe(0);
  const massLoss = numeric(after.baseline.outputs.massChange);
  assert.ok(Math.abs(massLoss / (-4000 / C_SI ** 2) - 1) < 1e-14);
  expect(numeric(after.variant.outputs.massChange)).toBe(0);
  for (const id of ["radiationEnergyChange", "systemEnergyChange", "systemMassChange"])
    expect(after.variant.outputs[id]).toEqual(after.baseline.outputs[id]);
  expect(numeric(after.variant.outputs.radiationEnergyChange)).toBe(4000);
  expect(numeric(after.variant.outputs.systemMassChange)).toBe(0);
  const owner = evaluateBoundaryLedger("combined-isolated-system", "escapes", 4000, 0);
  expect(after.variant.outputs.massChange?.evidence).toEqual(owner.massChange);
  expect(
    verifyMe03Comparison(after.baselineSnapshot, after.variantSnapshot, after.result),
  ).toBeNull();
  expect(verifyMe03SavedComparison(after.baseline, after.variant, after.result)).toBeNull();
});

test("radiation retains positive energy and an inapplicable rest-mass change with full evidence", () => {
  const comparison = live();
  expect(comparison.apply({ ...ME03_DEFAULTS, boundary: "radiation" })).toBe(true);
  const state = comparison.getSnapshot();
  expect(numeric(state.variant.outputs.energyChange)).toBe(1);
  const mass = state.variant.outputs.massChange;
  expect(mass?.status).toBe("not-applicable");
  expect(mass?.value).toBeNull();
  expect(mass?.reason).toContain("not assigned an inertial rest mass");
  expect(mass?.evidence?.status).toBe("not-applicable");
  expect(state.variant.outputs.radiationMassChange?.value).toBeNull();
  assert.equal(state.result.kind, "accepted");
  const row = state.result.rows.find((entry) => entry.id === "massChange");
  expect(row?.ratio.status).toBe("not-applicable");
  expect(row?.difference.status).toBe("not-applicable");
  expect(verifyMe03SavedComparison(state.baseline, state.variant, state.result)).toBeNull();
});

test("every physical, presentation and extension setting is locked, including a second change", () => {
  const comparison = live();
  const baseline = comparison.getSnapshot().baseline;
  for (const change of [
    { emittedEnergy: 2 },
    { inputEnergy: 1 },
    { disposition: "retained" },
    { cardId: "me-03-card-sun" },
    { mode: "four-momentum" },
    { pulseSystem: "single-pulse" },
    { notation: "modern" },
    { boxMass: 2 },
    { boxLength: 2 },
    { pulseEnergy: 2 },
    { assignLightMass: false },
    { magnification: 1e16 },
    { boundary: "combined-isolated-system", emittedEnergy: 2 },
  ]) {
    const previous = comparison.getSnapshot();
    expect(comparison.apply({ ...baseline.parameters, ...change })).toBe(false);
    const current = comparison.getSnapshot();
    expect(current.baseline).toBe(previous.baseline);
    expect(current.variant).toBe(previous.variant);
    expect(current.error).not.toBe("");
  }
});

test("pending and refused requests keep the completed pair, then a valid request can recover", () => {
  const comparison = live();
  const original = comparison.getSnapshot();
  const observed: ReturnType<Comparison["getSnapshot"]>[] = [];
  const unsubscribe = comparison.subscribe(() => observed.push(comparison.getSnapshot()));
  expect(comparison.apply({ ...ME03_DEFAULTS, boundary: "unsupported-boundary" })).toBe(false);
  expect(comparison.getSnapshot().baseline).toBe(original.baseline);
  expect(comparison.getSnapshot().variant).toBe(original.variant);
  expect(comparison.getSnapshot().error).toContain("do not match");
  expect(observed.some((state) => state.pending)).toBe(true);
  for (const state of observed.filter((item) => item.pending)) {
    expect(state.baseline).toBe(original.baseline);
    expect(state.variant).toBe(original.variant);
  }
  expect(comparison.apply({ ...ME03_DEFAULTS, boundary: "combined-isolated-system" })).toBe(true);
  expect(comparison.getSnapshot().error).toBe("");
  expect(comparison.getSnapshot().pending).toBe(false);
  unsubscribe();
});

test("pinning the accepted variant reverses the comparison without creating a new physical run", () => {
  const comparison = live();
  expect(comparison.apply({ ...ME03_DEFAULTS, boundary: "combined-isolated-system" })).toBe(true);
  const completed = comparison.getSnapshot().variant;
  expect(comparison.pinCurrent()).toBe(true);
  expect(comparison.getSnapshot().baseline).toBe(completed);
  expect(comparison.apply(ME03_DEFAULTS)).toBe(true);
  const state = comparison.getSnapshot();
  expect(state.variant.runId).toBe(completed.runId);
  expect(numeric(state.baseline.outputs.massChange)).toBe(0);
  expect(numeric(state.variant.outputs.massChange)).toBeLessThan(0);
  assert.equal(state.result.kind, "accepted");
  expect(state.result.rows.find((row) => row.id === "massChange")?.ratio).toEqual({
    status: "not-applicable",
    reason: "The baseline is zero; a ratio is not defined.",
  });
});

test("an independent pinned owner survives edits to the apparatus and another comparison", () => {
  const apparatus = createMe03Session("main-ledger");
  const first = live(apparatus.acceptedParameters(), "comparison-one");
  const second = live(apparatus.acceptedParameters(), "comparison-two");
  const original = first.getSnapshot();
  expect(apparatus.apply({ ...ME03_DEFAULTS, emittedEnergy: 2 }).kind).toBe("accepted");
  expect(second.apply({ ...ME03_DEFAULTS, boundary: "radiation" })).toBe(true);
  expect(first.getSnapshot()).toBe(original);
  expect(first.getSnapshot().baseline.instanceId).not.toBe(
    second.getSnapshot().baseline.instanceId,
  );
  expect(numeric(first.getSnapshot().baseline.outputs.energyChange)).toBe(-1);
});

test("boundary-comparison-evidence: malformed pins refuse; a complete isolated emission is accepted (comparison.ts:94)", () => {
  for (const input of [
    {},
    { ...ME03_DEFAULTS, boundary: "unknown" },
    { ...ME03_DEFAULTS, disposition: "unknown" },
    { ...ME03_DEFAULTS, emittedEnergy: Number.NaN },
    { ...ME03_DEFAULTS, unknown: 1 },
    { ...ME03_DEFAULTS, inputEnergy: 1 },
    { ...ME03_DEFAULTS, mode: "box-1906" },
    { ...ME03_DEFAULTS, mode: "four-momentum" },
  ]) {
    assert.throws(
      () => me03ComparisonParameters(input),
      (error) =>
        error instanceof ExperimentRuntimeError && error.code === "boundary-comparison-evidence",
    );
  }
  assert.throws(
    () => me03ComparisonIdentity({ sourceDigest: "src/physics/reference/massEnergy.ts" }),
    (error) =>
      error instanceof ExperimentRuntimeError && error.code === "boundary-comparison-evidence",
  );
  expect(me03ComparisonParameters(ME03_DEFAULTS)).toEqual(ME03_DEFAULTS);
  expect(Object.isFrozen(me03ComparisonParameters(ME03_DEFAULTS))).toBe(true);
});

test("saved evidence rejects changed runs, measurement identities, owners and invented zero masses", () => {
  const comparison = live();
  expect(comparison.apply({ ...ME03_DEFAULTS, boundary: "radiation" })).toBe(true);
  const state = comparison.getSnapshot();
  for (const variant of [
    { ...state.variant, runId: "another-emission" },
    {
      ...state.variant,
      revisions: { ...state.variant.revisions, input: state.variant.revisions.input + 1 },
    },
    {
      ...state.variant,
      revisions: { ...state.variant.revisions, measurement: state.baseline.revisions.measurement },
    },
    {
      ...state.variant,
      outputs: {
        ...state.variant.outputs,
        radiationEnergyChange: {
          ...state.variant.outputs.radiationEnergyChange,
          evidence: {
            ...state.variant.outputs.radiationEnergyChange?.evidence,
            ownerId: "another-owner",
          },
        },
      },
    },
    {
      ...state.variant,
      outputs: {
        ...state.variant.outputs,
        massChange: { ...state.variant.outputs.massChange, status: "value", value: 0, reason: "" },
      },
    },
  ]) {
    const candidate = variant as Baseline;
    const result = compareBaselines(state.baseline, candidate, ME03_COMPARISON);
    expect(verifyMe03SavedComparison(state.baseline, candidate, result)).not.toBeNull();
  }
});
