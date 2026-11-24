import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  BM06_DEFAULTS,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
} from "../../experiments/bm06/definition.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import {
  SR09_CLASSES,
  SR09_DEFAULTS,
  SR09_OUTPUTS,
} from "../../experiments/sr09/definition.ts";
import { snapshotOutputs } from "../../experiments/sr09/session.ts";
import {
  createInstanceStore,
  type ExperimentView,
  type PublishedResult,
} from "../../experiments/store/instanceStore.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { projectLaboratoryEquationView } from "./laboratoryProjection.ts";

function output(view: ExperimentView, quantityId: string): PublishedResult {
  const found = view.accepted?.outputs.find((item) => item.quantityId === quantityId);
  assert.ok(found, "The fixture must publish " + quantityId);
  return found;
}

function scalar(view: ExperimentView, quantityId: string): number {
  const found = output(view, quantityId);
  assert.ok(found.status === "value" && typeof found.value === "number");
  return found.value;
}

function withOutputs(
  view: ExperimentView,
  outputs: readonly PublishedResult[],
): ExperimentView {
  assert.ok(view.accepted);
  return { ...view, accepted: { ...view.accepted, outputs } };
}

function replaceOutput(
  view: ExperimentView,
  quantityId: string,
  replace: (value: PublishedResult) => PublishedResult,
): ExperimentView {
  assert.ok(view.accepted);
  output(view, quantityId);
  return withOutputs(
    view,
    view.accepted.outputs.map((item) =>
      item.quantityId === quantityId ? replace(item) : item,
    ),
  );
}

function ray() {
  const parameters = { ...SR09_DEFAULTS, propagationAngleDeg: 90 };
  const store = createInstanceStore({
    experimentId: "sr-09",
    instanceId: "equation-ray",
    initialParameters: parameters,
    parameterClasses: SR09_CLASSES,
    outputs: SR09_OUTPUTS,
    allowPartial: true,
  });
  const request = store.issue("setup-change");
  assert.ok(
    store.publish({
      ...request,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: snapshotOutputs(parameters),
    }).accepted,
  );
  return store;
}

test("BM06 substitutes the copied diffusivity governing its accepted spread", async () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "equation-spread",
    initialParameters: BM06_DEFAULTS,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  const request = store.issue("setup-change", {
    t: 4,
    copiedDiffusivityInstanceId: "held-tracer",
    copiedDiffusivityRunId: "held-tracer-run",
    copiedDiffusivitySnapshotVersion: 7,
    copiedDiffusivityValue: 1.6e-12,
  });
  const evaluated = await evaluateBm06(request.parameters);
  assert.ok(evaluated.kind === "accepted");
  assert.ok(store.publish({ ...request, ...evaluated.data, final: true }).accepted);
  const original = store.getSnapshot();
  const projected = projectLaboratoryEquationView("bm-06", original);
  expect(scalar(original, "diffusionCoefficient")).not.toBe(
    scalar(original, "activeDiffusionCoefficient"),
  );
  expect(scalar(projected, "diffusionCoefficient")).toBe(1.6e-12);
  expect(output(projected, "diffusionCoefficient").ownerId).toBe("bm06.evaluate");
  expect(scalar(projected, "rmsDisplacement1d")).toBe(scalar(original, "rmsDisplacement1d"));
  expect(scalar(projected, "rmsDisplacement1d") / 1e-6).toBeCloseTo(3.577708763999664, 12);
  assert.ok(original.accepted);
  expect(projected.accepted?.parameters).toBe(original.accepted.parameters);
  expect(projected.accepted?.revisions).toBe(original.accepted.revisions);
  expect(projected.accepted?.instanceId).toBe(original.accepted.instanceId);
  expect(projected.accepted?.runId).toBe(original.accepted.runId);
  expect(projected.accepted?.snapshotVersion).toBe(original.accepted.snapshotVersion);
  expect(original.accepted.outputs).toContain(output(original, "activeDiffusionCoefficient"));
  const missingActive = withOutputs(
    original,
    original.accepted.outputs.filter(
      (item) => item.quantityId !== "activeDiffusionCoefficient",
    ),
  );
  expect(
    projectLaboratoryEquationView("bm-06", missingActive).accepted?.outputs.some(
      (item) => item.quantityId === "diffusionCoefficient",
    ),
  ).toBe(false);
  expect(
    projected.accepted?.outputs.some((item) => item.quantityId === "observationInterval"),
  ).toBe(false);
});

test("SR09 converts speed and angles while preserving accepted frequencies and factor", () => {
  const view = ray().getSnapshot();
  const projected = projectLaboratoryEquationView("sr-09", view);
  expect(scalar(projected, "frameSpeed") / 299792458).toBeCloseTo(0.6, 14);
  expect(output(projected, "frameSpeed").unit).toBe("m/s");
  expect(output(projected, "frameSpeed").semanticKind).toBe("velocity-along-x");
  expect(scalar(projected, "propagationAngleStationary")).toBeCloseTo(Math.PI / 2, 14);
  expect(scalar(projected, "propagationAngleMoving")).toBeCloseTo(
    (scalar(view, "propagationAngleMoving") * Math.PI) / 180,
    14,
  );
  expect(scalar(projected, "waveFrequencyStationary")).toBe(5e14);
  expect(scalar(projected, "waveFrequencyMoving")).toBe(6.25e14);
  expect(scalar(projected, "dopplerFactor")).toBe(1.25);
  for (const item of projected.accepted?.outputs ?? []) expect(item.ownerId).toBe("waves");
  expect(scalar(view, "frameSpeed")).toBe(0.6);
  expect(output(view, "frameSpeed").unit).toBe("c");
  expect(projected.accepted?.outputs.some((item) => item.quantityId === "speedOfLight")).toBe(
    false,
  );
});

test("a typed domain result keeps its source explanation, owner and repair", () => {
  const store = ray();
  const parameters = { ...SR09_DEFAULTS, propagationAngleDeg: 90, beta: 1 };
  const request = store.issue("observer-change", { beta: 1 });
  assert.ok(
    store.publish({
      ...request,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: snapshotOutputs(parameters),
    }).accepted,
  );
  const view = store.getSnapshot();
  const projected = projectLaboratoryEquationView("sr-09", view);
  for (const quantityId of ["frameSpeed", "waveFrequencyMoving", "propagationAngleMoving"]) {
    const original = output(view, quantityId);
    const adapted = output(projected, quantityId);
    assert.ok(original.status === "outside-domain" && adapted.status === "outside-domain");
    expect(adapted.reason).toBe(original.reason);
    expect(adapted.boundary).toBe(original.boundary);
    expect(adapted.ownerId).toBe(original.ownerId);
    expect("value" in adapted).toBe(false);
  }
});

test("pending and refused updates retain the accepted snapshot and identities", () => {
  const store = ray();
  const original = store.getSnapshot();
  const first = projectLaboratoryEquationView("sr-09", original);
  const request = store.issue("observer-change", { beta: 0.8 });
  const pending = projectLaboratoryEquationView("sr-09", store.getSnapshot());
  expect(pending.pending).toBe(true);
  expect(pending.requested).toBe(store.getSnapshot().requested);
  expect(pending.accepted).toBe(first.accepted);
  expect(scalar(pending, "frameSpeed")).toBe(scalar(first, "frameSpeed"));
  const refusal = makeRefusal("superluminal-observer", { parameterIds: ["beta"] });
  store.refuse(request, refusal);
  const refused = projectLaboratoryEquationView("sr-09", store.getSnapshot());
  expect(refused.status).toBe("refused");
  expect(refused.pending).toBe(false);
  expect(refused.refusal).toBe(store.getSnapshot().refusal);
  expect(refused.accepted).toBe(first.accepted);
  expect(store.getSnapshot().accepted).toBe(original.accepted);
});

test("missing, ambiguous and mismatched outputs never acquire equation values", () => {
  const view = ray().getSnapshot();
  assert.ok(view.accepted);
  expect(scalar(projectLaboratoryEquationView("sr-09", view), "frameSpeed")).toBeGreaterThan(0);
  const missing = withOutputs(
    view,
    view.accepted.outputs.filter((item) => item.quantityId !== "frameSpeed"),
  );
  const duplicate = withOutputs(view, [...view.accepted.outputs, output(view, "frameSpeed")]);
  const badViews = [
    missing,
    duplicate,
    replaceOutput(view, "frameSpeed", (item) => ({ ...item, unit: "m/s" })),
    replaceOutput(view, "frameSpeed", (item) => ({
      ...item,
      semanticKind: "velocity-along-y",
    })),
    replaceOutput(view, "frameSpeed", (item) => ({ ...item, ownerId: "unregistered-owner" })),
  ];
  for (const bad of badViews) {
    const projected = projectLaboratoryEquationView("sr-09", bad);
    expect(projected.accepted?.outputs.some((item) => item.quantityId === "frameSpeed")).toBe(
      false,
    );
    expect(scalar(projected, "waveFrequencyStationary")).toBe(5e14);
  }
});

test("arrays and unrepresentable conversions never become scalar zero", () => {
  const view = ray().getSnapshot();
  const vector = output(view, "namedEventTimesK");
  assert.ok(vector.status === "value" && typeof vector.value !== "number");
  const arrayView = replaceOutput(view, "frameSpeed", (item) => ({
    ...item,
    status: "value",
    value: vector.value,
  }));
  const overflow = replaceOutput(view, "frameSpeed", (item) => ({
    ...item,
    status: "value",
    value: Number.MAX_VALUE,
  }));
  for (const bad of [arrayView, overflow]) {
    expect(
      projectLaboratoryEquationView("sr-09", bad).accepted?.outputs.some(
        (item) => item.quantityId === "frameSpeed",
      ),
    ).toBe(false);
  }
  const underflow = replaceOutput(view, "propagationAngleStationary", (item) => ({
    ...item,
    status: "value",
    value: Number.MIN_VALUE,
  }));
  expect(
    projectLaboratoryEquationView("sr-09", underflow).accepted?.outputs.some(
      (item) => item.quantityId === "propagationAngleStationary",
    ),
  ).toBe(false);
});

test("uncertainty converts with the accepted value", () => {
  const view = ray().getSnapshot();
  const interval = replaceOutput(view, "frameSpeed", (item) => ({
    ...item,
    status: "value",
    value: 0.6,
    uncertainty: { kind: "enclosure", lower: 0.5, upper: 0.7, method: "fixture bounds" },
  }));
  const enclosed = output(projectLaboratoryEquationView("sr-09", interval), "frameSpeed");
  assert.ok(enclosed.status === "value" && enclosed.uncertainty?.kind === "enclosure");
  expect(enclosed.uncertainty.lower / 299792458).toBeCloseTo(0.5, 14);
  expect(enclosed.uncertainty.upper / 299792458).toBeCloseTo(0.7, 14);
  const magnitude = replaceOutput(view, "frameSpeed", (item) => ({
    ...item,
    status: "value",
    value: 0.6,
    uncertainty: {
      kind: "numerical-error-estimate",
      magnitude: 0.01,
      method: "fixture bound",
      guarantee: "bound",
    },
  }));
  const bounded = output(projectLaboratoryEquationView("sr-09", magnitude), "frameSpeed");
  assert.ok(
    bounded.status === "value" && bounded.uncertainty?.kind === "numerical-error-estimate",
  );
  expect(bounded.uncertainty.magnitude / 299792458).toBeCloseTo(0.01, 14);
  expect(bounded.uncertainty.guarantee).toBe("bound");
});

test("a view from another experiment is not repurposed, and an empty view stays empty", () => {
  const view = ray().getSnapshot();
  expect(projectLaboratoryEquationView("bm-06", view)).toBe(view);
  const empty: ExperimentView = { ...view, accepted: null, requested: null, status: "idle" };
  expect(projectLaboratoryEquationView("sr-09", empty)).toBe(empty);
});
