import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  SR03_DEFAULTS,
  SR03_OUTPUTS,
  SR03_PARAMETER_CLASSES,
  type Sr03Parameters,
} from "../../experiments/sr03/definition.ts";
import {
  createInstanceStore,
  type ExperimentView,
  type Parameters,
  type PublishedResult,
} from "../../experiments/store/instanceStore.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import { projectLaboratoryEquationView } from "./laboratoryProjection.ts";

const C = 299792458;

function output(view: ExperimentView, quantityId: string): PublishedResult {
  const result = view.accepted?.outputs.find((item) => item.quantityId === quantityId);
  assert.ok(result, `The real owner must publish ${quantityId}.`);
  return result;
}

function scalar(view: ExperimentView, quantityId: string): number {
  const result = output(view, quantityId);
  assert.ok(result.status === "value" && typeof result.value === "number");
  return result.value;
}

async function accepted(parameters: Sr03Parameters = SR03_DEFAULTS) {
  const store = createInstanceStore({
    experimentId: "sr-03",
    instanceId: "event-separation-owner",
    initialParameters: parameters as unknown as Parameters,
    parameterClasses: SR03_PARAMETER_CLASSES,
    outputs: SR03_OUTPUTS,
    allowPartial: true,
  });
  const request = store.issue("setup-change");
  const result = await evaluateSr03(request.parameters);
  assert.ok(result.kind === "accepted");
  assert.ok(store.publish({ ...request, ...result.data, final: true }).accepted);
  return store;
}

test("the signature pair preserves its accepted frames, units and separation from rod length", async () => {
  const store = await accepted();
  const view = store.getSnapshot();
  const projected = projectLaboratoryEquationView("sr-03", view);
  assert.ok(view.accepted && projected.accepted);
  expect(scalar(projected, "eventSeparationSpatial") / C).toBeCloseTo(10, 12);
  expect(scalar(projected, "eventSeparationSpatialMoving") / C).toBeCloseTo(12.5, 12);
  expect(scalar(projected, "eventSeparationTemporalStationary")).toBe(0);
  expect(scalar(projected, "eventSeparationTemporalMoving")).toBeCloseTo(-7.5, 12);
  expect(scalar(projected, "lorentzFactor")).toBe(scalar(view, "gammaFactor"));
  expect(scalar(projected, "lorentzFactor")).toBeCloseTo(1.25, 14);
  expect(scalar(view, "rodLengthK")).toBeCloseTo(8, 12);
  expect(output(view, "spatialSeparationK").unit).toBe("ls");
  expect(output(projected, "eventSeparationSpatial").unit).toBe("m");
  expect(projected.accepted.instanceId).toBe(view.accepted.instanceId);
  expect(projected.accepted.runId).toBe(view.accepted.runId);
  expect(projected.accepted.snapshotVersion).toBe(view.accepted.snapshotVersion);
  expect(projected.accepted.revisions).toBe(view.accepted.revisions);
  expect(projected.accepted.parameters).toBe(view.accepted.parameters);
  expect(projected.accepted.outputs.map((item) => item.quantityId).sort()).toEqual([
    "eventSeparationSpatial",
    "eventSeparationSpatialMoving",
    "eventSeparationTemporalMoving",
    "eventSeparationTemporalStationary",
    "lorentzFactor",
  ]);
});

test("nonzero first-event coordinates do not turn differences into event coordinates", async () => {
  const store = await accepted({
    ...SR03_DEFAULTS,
    endpointPairId: "custom",
    customT1: 2,
    customX1: 3,
    customT2: 5,
    customX2: 13,
  });
  const view = store.getSnapshot();
  const projected = projectLaboratoryEquationView("sr-03", view);
  expect(scalar(projected, "eventSeparationSpatial") / C).toBeCloseTo(10, 12);
  expect(scalar(projected, "eventSeparationTemporalStationary")).toBe(3);
  expect(scalar(projected, "eventSeparationSpatialMoving") / C).toBeCloseTo(10.25, 12);
  expect(scalar(projected, "eventSeparationTemporalMoving")).toBeCloseTo(-3.75, 12);
  expect(scalar(projected, "eventSeparationTemporalMoving")).toBe(
    scalar(view, "temporalSeparationKPrime"),
  );
});

test("a missing or mismatched moving separation cannot borrow the rod's length", async () => {
  const view = (await accepted()).getSnapshot();
  assert.ok(view.accepted);
  for (const outputs of [
    view.accepted.outputs.filter((item) => item.quantityId !== "spatialSeparationKPrime"),
    view.accepted.outputs.map((item) =>
      item.quantityId === "spatialSeparationKPrime" ? { ...item, unit: "m" } : item,
    ),
  ]) {
    const changed: ExperimentView = {
      ...view,
      accepted: { ...view.accepted, outputs },
    };
    const projected = projectLaboratoryEquationView("sr-03", changed);
    expect(
      projected.accepted?.outputs.some(
        (item) => item.quantityId === "eventSeparationSpatialMoving",
      ),
    ).toBe(false);
    expect(scalar(projected, "eventSeparationSpatial") / C).toBeCloseTo(10, 12);
    expect(scalar(view, "rodLengthK")).toBeCloseTo(8, 12);
  }
});

test("the real owner's refusal retains the accepted event pair through a pending request", async () => {
  const store = await accepted();
  const first = projectLaboratoryEquationView("sr-03", store.getSnapshot());
  const request = store.issue("setup-change", { v: 1 });
  const pending = projectLaboratoryEquationView("sr-03", store.getSnapshot());
  expect(pending.pending).toBe(true);
  expect(pending.accepted).toBe(first.accepted);
  expect(pending.requested).toBe(store.getSnapshot().requested);
  const result = await evaluateSr03(request.parameters);
  assert.ok(result.kind === "refused");
  assert.ok(store.refuse(request, result.refusal).accepted);
  const refused = projectLaboratoryEquationView("sr-03", store.getSnapshot());
  expect(refused.status).toBe("refused");
  expect(refused.pending).toBe(false);
  expect(refused.accepted).toBe(first.accepted);
  expect(refused.refusal).toBe(store.getSnapshot().refusal);
  expect(scalar(refused, "eventSeparationTemporalMoving")).toBeCloseTo(-7.5, 12);
});
