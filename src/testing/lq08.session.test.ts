import { describe, expect, it } from "bun:test";
import {
  LQ08_DEFAULTS,
  LQ08_DISTRIBUTIONS,
  LQ08_MODEL,
  LQ08_OUTPUTS,
} from "../experiments/lq08/definition.ts";
import { validateLq08Parameters } from "../experiments/lq08/parameters.ts";
import { createLq08Session } from "../experiments/lq08/session.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import {
  kMax,
  photocurrent,
  stoppingPotentialFromEv,
  stoppingPotentialMagnitude,
} from "../physics/reference/photoelectric.ts";

describe("LQ-08 Session Management (am-lq-08-photoelectric-va5a)", () => {
  it("initializes an instance store and publishes initial accepted outputs", () => {
    const session = createLq08Session("inst-lq08-test-01");
    const snapshot = session.getSnapshot();

    expect(snapshot.accepted).toBeDefined();
    expect(snapshot.accepted?.experimentId).toBe("lq-08");
    expect(snapshot.accepted?.instanceId).toBe("inst-lq08-test-01");
    expect(snapshot.accepted?.final).toBe(true);

    const outputs = snapshot.accepted?.outputs;
    expect(outputs).toBeDefined();

    const stoppingOutput = outputs?.find((o) => o.quantityId === "stoppingPotentialMagnitude");
    expect(stoppingOutput).toBeDefined();
    expect(stoppingOutput?.status).toBe("value");
    if (stoppingOutput?.status === "value") {
      expect(stoppingOutput.value).toBeGreaterThan(0);
    }
  });

  it("updates outputs upon parameter application", () => {
    const session = createLq08Session("inst-lq08-test-02");

    // Apply higher frequency (800 THz)
    const res = session.apply({
      ...LQ08_DEFAULTS,
      frequency: 8.0e14,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const stoppingOutput = snapshot.accepted?.outputs.find(
      (o) => o.quantityId === "stoppingPotentialMagnitude",
    );
    expect(stoppingOutput?.status).toBe("value");
    if (stoppingOutput?.status === "value") {
      // At 800 THz, E_q = 3.3085 eV, Phi = 2.2 eV -> V_s ≈ 1.1085 V
      expect(stoppingOutput.value).toBeCloseTo(1.1085, 2);
    }
  });

  it("produces not-applicable status when parameter update is below threshold", () => {
    const session = createLq08Session("inst-lq08-test-03");

    // Subthreshold frequency (400 THz)
    const res = session.apply({
      ...LQ08_DEFAULTS,
      frequency: 4.0e14,
    });
    expect(res.kind).toBe("accepted");

    const snapshot = session.getSnapshot();
    const stoppingOutput = snapshot.accepted?.outputs.find(
      (o) => o.quantityId === "stoppingPotentialMagnitude",
    );
    expect(stoppingOutput?.status).toBe("not-applicable");
    if (stoppingOutput?.status === "not-applicable") {
      expect(stoppingOutput.reason).toBe("no emitted electron in this model");
    }
  });
});

function acceptedNumber(session: ReturnType<typeof createLq08Session>, quantityId: string) {
  const output = session.getSnapshot().accepted?.outputs.find((o) => o.quantityId === quantityId);
  expect(output?.status).toBe("value");
  const value = output?.status === "value" ? output.value : undefined;
  expect(typeof value).toBe("number");
  return value as number;
}

describe("LQ-08 accepted equation values", () => {
  it("preserves the legacy output identities, units and default numerical values", () => {
    const session = createLq08Session("lq08-legacy-outputs");
    const legacy = [
      ["incidentPower", "W", "radiant-power", "lq08.acceptedInputs", 0.001],
      ["frequency", "Hz", "monochromatic-frequency", "lq08.acceptedInputs", 6e14],
      ["workFunction", "eV", "work-function", "lq08.acceptedInputs", 2.2],
      ["quantumEfficiency", "1", "quantum-efficiency", "lq08.acceptedInputs", 0.1],
      ["collectorPotential", "V", "collector-potential", "lq08.acceptedInputs", 0],
      [
        "quantumEnergy",
        "J",
        "quantum-energy",
        "photoelectric.quantumEnergy",
        3.9756420899999997e-19,
      ],
      [
        "thresholdFrequency",
        "Hz",
        "threshold-frequency",
        "photoelectric.thresholdFrequency",
        531957633258682,
      ],
      ["maxKineticEnergy", "J", "max-kinetic-energy", "photoelectric.kMax", 4.508534951999996e-20],
      [
        "stoppingPotentialMagnitude",
        "V",
        "stopping-potential",
        "photoelectric.stoppingPotentialMagnitude",
        0.28140061815431494,
      ],
      ["quantumRate", "s^-1", "quantum-rate", "photoelectric.quantumRate", 2515316966070253.5],
      ["emissionRate", "s^-1", "emission-rate", "photoelectric.emissionRate", 251531696607025.38],
      ["photocurrent", "A", "photocurrent", "photoelectric.photocurrent", 0.00004029982070141531],
    ] as const;
    for (const [quantityId, unit, semanticKind, ownerId, value] of legacy) {
      expect(LQ08_OUTPUTS[quantityId]).toMatchObject({ unit, semanticKind, ownerId });
      expect(
        session.getSnapshot().accepted?.outputs.find((o) => o.quantityId === quantityId),
      ).toMatchObject({ quantityId, unit, semanticKind, ownerId, status: "value", value });
    }
    expect(session.acceptedParameters().workFunction).toBe(2.2);
  });

  it("publishes the same selected constants and SI escape work used by the reference owner", () => {
    const session = createLq08Session("lq08-live-constants");
    const constants = getConstantSet(LQ08_MODEL.constantSetId);
    expect(LQ08_MODEL.constantSetId).toBe("modern-si-2019");
    for (const [quantityId, unit, semanticKind] of [
      ["planckConstant", "J s", "planck-constant"],
      ["elementaryCharge", "C", "elementary-charge-magnitude"],
    ] as const) {
      expect(
        session.getSnapshot().accepted?.outputs.find((o) => o.quantityId === quantityId),
      ).toMatchObject({
        quantityId,
        unit,
        semanticKind,
        ownerId: "lq08.acceptedConstants",
        status: "value",
        value: constantValue(constants, quantityId).value,
      });
    }
    expect(
      session.getSnapshot().accepted?.outputs.find((o) => o.quantityId === "escapeWork"),
    ).toMatchObject({
      quantityId: "escapeWork",
      unit: "J",
      semanticKind: "work-function",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: 3.5247885948e-19,
    });
    const h = acceptedNumber(session, "planckConstant");
    const e = acceptedNumber(session, "elementaryCharge");
    const escapeEnergy = acceptedNumber(session, "escapeWork");
    expect(escapeEnergy).toBe(acceptedNumber(session, "workFunction") * e);
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(
      h * acceptedNumber(session, "frequency") - escapeEnergy,
    );
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(
      acceptedNumber(session, "maxKineticEnergy") / e,
    );
    expect(acceptedNumber(session, "thresholdFrequency")).toBe(escapeEnergy / h);
  });

  it("keeps energy and constants fixed when lamp power changes, then uses accepted frequency and escape work", () => {
    const session = createLq08Session("lq08-energy-versus-rate");
    const energy = acceptedNumber(session, "maxKineticEnergy");
    const rate = acceptedNumber(session, "emissionRate");
    const h = acceptedNumber(session, "planckConstant");
    const e = acceptedNumber(session, "elementaryCharge");
    const escapeEnergy = acceptedNumber(session, "escapeWork");
    expect(session.apply({ incidentPower: 0.002 }).kind).toBe("accepted");
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(energy);
    expect(acceptedNumber(session, "emissionRate")).toBe(2 * rate);
    expect(acceptedNumber(session, "planckConstant")).toBe(h);
    expect(acceptedNumber(session, "elementaryCharge")).toBe(e);
    expect(acceptedNumber(session, "escapeWork")).toBe(escapeEnergy);
    expect(session.apply({ frequency: 8e14, workFunction: 2.5 }).kind).toBe("accepted");
    expect(session.acceptedParameters().workFunction).toBe(2.5);
    expect(acceptedNumber(session, "workFunction")).toBe(2.5);
    expect(acceptedNumber(session, "escapeWork")).toBe(2.5 * e);
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(h * 8e14 - 2.5 * e);
  });

  it("distinguishes exact threshold zero from an electron that is absent below threshold", () => {
    const session = createLq08Session("lq08-threshold-status");
    const threshold = acceptedNumber(session, "thresholdFrequency");
    const escapeEnergy = acceptedNumber(session, "escapeWork");
    expect(session.apply({ frequency: threshold }).kind).toBe("accepted");
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(0);
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(0);
    expect(acceptedNumber(session, "escapeWork")).toBe(escapeEnergy);
    expect(session.apply({ frequency: threshold * (1 - Number.EPSILON) }).kind).toBe("accepted");
    for (const quantityId of ["maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      const result = session
        .getSnapshot()
        .accepted?.outputs.find((o) => o.quantityId === quantityId);
      expect(result).toMatchObject({
        status: "not-applicable",
        reason: "no emitted electron in this model",
      });
      expect(result && "value" in result).toBe(false);
    }
    expect(acceptedNumber(session, "escapeWork")).toBe(escapeEnergy);
    expect(acceptedNumber(session, "emissionRate")).toBe(0);
  });

  it("keeps stopping energy separate from a partially retarding collector and from zero light power", () => {
    const session = createLq08Session("lq08-apparatus-distinction");
    const before = session.getSnapshot().accepted;
    const stopping = acceptedNumber(session, "stoppingPotentialMagnitude");
    const energy = acceptedNumber(session, "maxKineticEnergy");
    expect(session.apply({ collectorPotential: -0.1 }).kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(before?.runId);
    expect(session.getSnapshot().accepted?.revisions.input).toBe(before?.revisions.input);
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(stopping);
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(energy);
    expect(
      session.getSnapshot().accepted?.outputs.find((o) => o.quantityId === "photocurrent")?.status,
    ).toBe("underdetermined");
    expect(session.apply({ incidentPower: 0 }).kind).toBe("accepted");
    expect(acceptedNumber(session, "emissionRate")).toBe(0);
    expect(acceptedNumber(session, "photocurrent")).toBe(0);
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(energy);
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(stopping);
  });

  it("keeps all accepted equation values after an invalid request", () => {
    const session = createLq08Session("lq08-refused-equation-change");
    const before = session.getSnapshot().accepted;
    expect(session.apply({ frequency: 0 }).kind).toBe("refused");
    expect(session.getSnapshot().accepted).toBe(before);
    expect(acceptedNumber(session, "workFunction")).toBe(2.2);
    expect(acceptedNumber(session, "escapeWork")).toBe(3.5247885948e-19);
  });
});

function acceptedSweep(session: ReturnType<typeof createLq08Session>) {
  const sweep = session.getSnapshot().collectorSweep;
  expect(sweep).not.toBeNull();
  if (!sweep) throw new Error("Expected the accepted photoelectric collector sweep.");
  return sweep;
}

describe("LQ-08 declared electron distributions", () => {
  it("upgrades only complete legacy settings to the undeclared-distribution model", () => {
    const { distributionModel: _model, transferModel: _transfer, ...legacy } = LQ08_DEFAULTS;
    expect(validateLq08Parameters(legacy)).toEqual({ kind: "accepted", data: LQ08_DEFAULTS });
    for (const distributionModel of [undefined, null, "uniform-0-kmax", "measured", 0]) {
      expect(validateLq08Parameters({ ...legacy, distributionModel }).kind).toBe("refused");
    }
    expect(validateLq08Parameters({ ...legacy, materialDistribution: "uniform" }).kind).toBe(
      "refused",
    );
    expect(validateLq08Parameters({ frequency: legacy.frequency }).kind).toBe("refused");
    const session = createLq08Session("lq08-legacy-model-choice");
    expect(session.apply({ distributionModel: "uniform" }).kind).toBe("accepted");
    expect(session.apply(legacy).kind).toBe("accepted");
    expect(session.acceptedParameters()).toEqual(LQ08_DEFAULTS);
  });

  it("changes retarding current without changing the accepted electron energy", () => {
    const session = createLq08Session("lq08-distribution-current");
    const stopping = acceptedNumber(session, "stoppingPotentialMagnitude");
    const energy = acceptedNumber(session, "maxKineticEnergy");
    const collectorPotential = -stopping / 2;
    expect(session.apply({ collectorPotential }).kind).toBe("accepted");
    const none = acceptedSweep(session);
    expect(none.operatingPoint.result.status).toBe("underdetermined");
    if (none.operatingPoint.result.status === "underdetermined") {
      expect(none.operatingPoint.result.bounds).toEqual([0, none.saturationCurrent]);
      expect(Object.isFrozen(none.operatingPoint.result.bounds)).toBe(true);
    }
    expect(session.apply({ distributionModel: "uniform" }).kind).toBe("accepted");
    expect(
      acceptedNumber(session, "photocurrent") / acceptedSweep(session).saturationCurrent,
    ).toBeCloseTo(0.5, 12);
    expect(session.apply({ distributionModel: "all-at-kmax" }).kind).toBe("accepted");
    expect(acceptedNumber(session, "photocurrent")).toBe(acceptedSweep(session).saturationCurrent);
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(stopping);
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(energy);
    expect(session.acceptedParameters().collectorPotential).toBe(collectorPotential);
  });

  it("keeps the cutoff jump explicit instead of connecting it by an invented ramp", () => {
    const session = createLq08Session("lq08-cutoff-jump");
    expect(session.apply({ distributionModel: "all-at-kmax" }).kind).toBe("accepted");
    const cutoff = -acceptedNumber(session, "stoppingPotentialMagnitude");
    const sweep = acceptedSweep(session);
    const high = sweep.segments.find((segment) => !segment.startIncluded);
    expect(high?.points[0]).toEqual({
      collectorPotential: cutoff,
      current: sweep.saturationCurrent,
    });
    const low = sweep.segments.find(
      (segment) => segment.points.at(-1)?.collectorPotential === cutoff,
    );
    expect(low?.endIncluded).toBe(true);
    expect(low?.points.at(-1)?.current).toBe(0);
    expect(
      sweep.samples.find((sample) => sample.collectorPotential === cutoff)?.result,
    ).toMatchObject({ status: "value", value: 0 });
    expect(sweep.underdetermined).toEqual([]);
    expect(session.apply({ collectorPotential: cutoff }).kind).toBe("accepted");
    expect(acceptedNumber(session, "photocurrent")).toBe(0);
    expect(session.apply({ collectorPotential: cutoff / 2 }).kind).toBe("accepted");
    expect(acceptedNumber(session, "photocurrent")).toBe(sweep.saturationCurrent);
  });

  it("publishes only a compatible-current band inside an undeclared retarding distribution", () => {
    const session = createLq08Session("lq08-current-enclosure");
    const sweep = acceptedSweep(session);
    const cutoff = -acceptedNumber(session, "stoppingPotentialMagnitude");
    expect(sweep.underdetermined).toEqual([
      {
        minPotential: cutoff,
        maxPotential: 0,
        lowerCurrent: 0,
        upperCurrent: sweep.saturationCurrent,
        includeMin: false,
        includeMax: false,
      },
    ]);
    expect(sweep.segments.length).toBeGreaterThan(0);
    for (const segment of sweep.segments) {
      for (const point of segment.points) {
        expect(point.collectorPotential <= cutoff || point.collectorPotential >= 0).toBe(true);
      }
    }
    const interior = sweep.samples.filter(
      (sample) => sample.collectorPotential > cutoff && sample.collectorPotential < 0,
    );
    expect(interior.length).toBeGreaterThan(0);
    for (const sample of interior) {
      expect(sample.result.status).toBe("underdetermined");
      if (sample.result.status === "underdetermined") {
        expect(sample.result.bounds).toEqual([0, sweep.saturationCurrent]);
        expect(Object.isFrozen(sample.result.bounds)).toBe(true);
      }
    }
  });

  it("evaluates every sweep sample through the selected owner and includes the true operating point", () => {
    const session = createLq08Session("lq08-current-samples");
    const constants = getConstantSet(LQ08_MODEL.constantSetId);
    const charge = constantValue(constants, "elementaryCharge").value;
    for (const distributionModel of LQ08_DISTRIBUTIONS) {
      expect(session.apply({ distributionModel, collectorPotential: -0.123456 }).kind).toBe(
        "accepted",
      );
      const parameters = session.acceptedParameters();
      const sweep = acceptedSweep(session);
      expect(sweep.samples.length).toBeGreaterThan(0);
      expect(
        sweep.samples.find((sample) => sample.collectorPotential === parameters.collectorPotential),
      ).toEqual(sweep.operatingPoint);
      for (const sample of sweep.samples) {
        expect(sample.result).toEqual(
          photocurrent(
            parameters.incidentPower,
            parameters.frequency,
            parameters.workFunction * charge,
            parameters.quantumEfficiency,
            sample.collectorPotential,
            constants,
            distributionModel,
          ),
        );
      }
    }
    expect(session.apply({ collectorPotential: 10, frequency: 3e15, workFunction: 0 }).kind).toBe(
      "accepted",
    );
    const wide = acceptedSweep(session);
    expect(wide.domain.max).toBeGreaterThanOrEqual(10);
    expect(wide.domain.min).toBeLessThanOrEqual(
      -acceptedNumber(session, "stoppingPotentialMagnitude"),
    );
    expect(wide.samples.some((sample) => sample.collectorPotential === 10)).toBe(true);
  });

  it("distinguishes no emission and no light from the exact-threshold collection jump", () => {
    const session = createLq08Session("lq08-distribution-boundaries");
    for (const distributionModel of LQ08_DISTRIBUTIONS) {
      expect(session.apply({ ...LQ08_DEFAULTS, distributionModel, frequency: 4e14 }).kind).toBe(
        "accepted",
      );
      let sweep = acceptedSweep(session);
      expect(sweep.saturationCurrent).toBe(0);
      expect(sweep.underdetermined).toEqual([]);
      expect(
        sweep.samples.every(
          (sample) => sample.result.status === "value" && sample.result.value === 0,
        ),
      ).toBe(true);
      expect(session.apply({ frequency: 6e14, incidentPower: 0 }).kind).toBe("accepted");
      sweep = acceptedSweep(session);
      expect(
        sweep.samples.every(
          (sample) => sample.result.status === "value" && sample.result.value === 0,
        ),
      ).toBe(true);
    }
    const constants = getConstantSet(LQ08_MODEL.constantSetId);
    const h = constantValue(constants, "planckConstant").value;
    const e = constantValue(constants, "elementaryCharge").value;
    const parameters = { ...LQ08_DEFAULTS, workFunction: (h * LQ08_DEFAULTS.frequency) / e };
    expect(parameters.workFunction * e).toBe(h * parameters.frequency);
    expect(session.apply(parameters).kind).toBe("accepted");
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(0);
    const threshold = acceptedSweep(session);
    expect(threshold.underdetermined).toEqual([]);
    expect(
      threshold.segments.some(
        (segment) => !segment.endIncluded && segment.points.at(-1)?.collectorPotential === 0,
      ),
    ).toBe(true);
    expect(threshold.operatingPoint.result).toMatchObject({
      status: "value",
      value: threshold.saturationCurrent,
    });
    expect(session.apply({ collectorPotential: -0.01 }).kind).toBe("accepted");
    expect(acceptedNumber(session, "photocurrent")).toBe(0);
  });

  it("keeps stable accepted curve identity through reads, refusal and pending notifications", () => {
    const session = createLq08Session("lq08-sweep-identity");
    const before = session.getSnapshot();
    const server = session.getServerSnapshot();
    expect(session.getSnapshot()).toBe(before);
    expect(session.getServerSnapshot()).toBe(server);
    expect(before.collectorSweep).toMatchObject({
      snapshotVersion: before.accepted?.snapshotVersion,
      actionIndex: before.accepted?.actionIndex,
      runId: before.accepted?.runId,
    });
    expect(session.apply({ distributionModel: "unmeasured-material" }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
    const pending: ReturnType<typeof session.getSnapshot>[] = [];
    const off = session.subscribe(() => {
      const view = session.getSnapshot();
      if (view.pending) pending.push(view);
    });
    expect(session.apply({ distributionModel: "uniform" }).kind).toBe("accepted");
    off();
    expect(pending.length).toBeGreaterThan(0);
    for (const view of pending) {
      expect(view.accepted).toBe(before.accepted);
      expect(view.collectorSweep).toBe(before.collectorSweep);
    }
    const after = session.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.collectorSweep).not.toBe(before.collectorSweep);
    expect(after.collectorSweep).toMatchObject({
      distributionModel: "uniform",
      snapshotVersion: after.accepted?.snapshotVersion,
      actionIndex: after.accepted?.actionIndex,
    });
    expect(before.collectorSweep?.distributionModel).toBe("none");
    expect(session.getServerSnapshot()).toBe(server);
  });

  it("rebuilds curve evidence for a restored checkpoint rather than retaining the initial curve", () => {
    const source = createLq08Session("lq08-sweep-checkpoint");
    expect(source.apply({ distributionModel: "uniform", collectorPotential: -0.1 }).kind).toBe(
      "accepted",
    );
    const checkpoint = source.exportCheckpoint();
    expect(checkpoint).not.toBeNull();
    const target = createLq08Session("lq08-sweep-checkpoint");
    const before = target.getSnapshot();
    expect(target.restoreCheckpoint(checkpoint).kind).toBe("restored");
    const restored = target.getSnapshot();
    expect(restored.collectorSweep).not.toBe(before.collectorSweep);
    expect(restored.collectorSweep).toEqual(source.getSnapshot().collectorSweep);
    expect(restored.collectorSweep?.snapshotVersion).toBe(restored.accepted?.snapshotVersion);
    expect(restored.collectorSweep?.actionIndex).toBe(restored.accepted?.actionIndex);
    expect(target.getSnapshot()).toBe(restored);
    expect(before.collectorSweep?.distributionModel).toBe("none");
  });
});

function acceptedEnergyBudget(session: ReturnType<typeof createLq08Session>) {
  const budget = session.getSnapshot().energyBudget;
  expect(budget).not.toBeNull();
  if (!budget) throw new Error("Expected the accepted photoelectric energy budget.");
  return budget;
}

describe("LQ-08 unspecified partial energy transfer", () => {
  it("admits both older settings shapes with complete transfer and rejects unknown transfer choices", () => {
    const { transferModel: _transfer, ...sixFields } = LQ08_DEFAULTS;
    const sixWithDistribution = { ...sixFields, distributionModel: "uniform" as const };
    expect(validateLq08Parameters(sixWithDistribution)).toEqual({
      kind: "accepted",
      data: { ...sixWithDistribution, transferModel: "complete" },
    });
    const { distributionModel: _distribution, ...fiveFields } = sixFields;
    expect(validateLq08Parameters(fiveFields)).toEqual({ kind: "accepted", data: LQ08_DEFAULTS });
    for (const transferModel of [undefined, null, "measured", 0]) {
      expect(validateLq08Parameters({ ...LQ08_DEFAULTS, transferModel }).kind).toBe("refused");
    }
    const session = createLq08Session("lq08-legacy-transfer");
    expect(session.apply({ transferModel: "partial" }).kind).toBe("accepted");
    expect(session.apply(sixWithDistribution).kind).toBe("accepted");
    expect(session.acceptedParameters().transferModel).toBe("complete");
    expect(session.acceptedParameters().distributionModel).toBe("uniform");
    const before = session.getSnapshot();
    expect(session.apply({ transferModel: "unknown-fraction-value" }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
  });

  it("retains the complete result only as an upper bound and restores equality when complete transfer returns", () => {
    const session = createLq08Session("lq08-energy-bound");
    const completeEnergy = acceptedNumber(session, "maxKineticEnergy");
    const completeStopping = acceptedNumber(session, "stoppingPotentialMagnitude");
    const completeThreshold = acceptedNumber(session, "thresholdFrequency");
    expect(session.apply({ transferModel: "partial" }).kind).toBe("accepted");
    const view = session.getSnapshot();
    const budget = acceptedEnergyBudget(session);
    for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude"] as const) {
      const output = view.accepted?.outputs.find((value) => value.quantityId === id);
      expect(output?.status).toBe("underdetermined");
      expect(output && "value" in output).toBe(false);
      expect(output && "upperBound" in output).toBe(false);
      if (output?.status === "underdetermined") {
        expect(output.neededInformation).toContain("single-quantum-transfer-fraction");
      }
    }
    expect(budget.maxKineticEnergy).toMatchObject({
      status: "underdetermined",
      upperBound: completeEnergy,
      bounds: [0, completeEnergy],
      unit: "J",
    });
    expect(budget.stoppingPotentialMagnitude).toMatchObject({
      status: "underdetermined",
      upperBound: completeStopping,
      bounds: [0, completeStopping],
      unit: "V",
    });
    expect(budget).toMatchObject({
      instanceId: view.accepted?.instanceId,
      runId: view.accepted?.runId,
      snapshotVersion: view.accepted?.snapshotVersion,
      actionIndex: view.accepted?.actionIndex,
      transferModel: "partial",
      constantSetId: LQ08_MODEL.constantSetId,
    });
    if (budget.maxKineticEnergy.status === "underdetermined") {
      expect(Object.isFrozen(budget.maxKineticEnergy.bounds)).toBe(true);
    }
    expect(acceptedNumber(session, "thresholdFrequency")).toBe(completeThreshold);
    expect(session.apply({ transferModel: "complete" }).kind).toBe("accepted");
    expect(acceptedNumber(session, "maxKineticEnergy")).toBe(completeEnergy);
    expect(acceptedNumber(session, "stoppingPotentialMagnitude")).toBe(completeStopping);
  });

  it("keeps exact-threshold partial transfer as a zero-width bound in the reference and published owner", () => {
    const constants = getConstantSet(LQ08_MODEL.constantSetId);
    const h = constantValue(constants, "planckConstant").value;
    const e = constantValue(constants, "elementaryCharge").value;
    const nu = LQ08_DEFAULTS.frequency;
    const workFunctionJoules = h * nu;
    const workFunction = workFunctionJoules / e;
    expect(workFunction * e).toBe(h * nu);
    expect(kMax(nu, workFunctionJoules, constants, "partial")).toMatchObject({
      status: "underdetermined",
      upperBound: 0,
      bounds: [0, 0],
      unit: "J",
    });
    expect(stoppingPotentialMagnitude(nu, workFunctionJoules, constants, "partial")).toMatchObject({
      status: "underdetermined",
      upperBound: 0,
      bounds: [0, 0],
      unit: "V",
    });
    expect(kMax(nu, workFunctionJoules, constants, "complete")).toMatchObject({
      status: "value",
      value: 0,
    });
    expect(stoppingPotentialMagnitude(nu, workFunctionJoules, constants, "complete")).toMatchObject(
      { status: "value", value: 0 },
    );
    const session = createLq08Session("lq08-zero-width-bound");
    expect(session.apply({ transferModel: "partial", workFunction }).kind).toBe("accepted");
    for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      expect(
        session.getSnapshot().accepted?.outputs.find((output) => output.quantityId === id)?.status,
      ).toBe("underdetermined");
    }
    expect(acceptedEnergyBudget(session).maxKineticEnergy).toMatchObject({
      status: "underdetermined",
      upperBound: 0,
    });
    expect(acceptedEnergyBudget(session).stoppingPotentialMagnitude).toMatchObject({
      status: "underdetermined",
      upperBound: 0,
    });
    expect(session.apply({ frequency: 4e14 }).kind).toBe("accepted");
    expect(acceptedEnergyBudget(session).maxKineticEnergy.status).toBe("not-applicable");
    expect(acceptedEnergyBudget(session).stoppingPotentialMagnitude.status).toBe("not-applicable");
    expect(acceptedNumber(session, "photocurrent")).toBe(0);
  });

  it("leaves partial retarding current unknown for every declared distribution", () => {
    const session = createLq08Session("lq08-partial-current");
    const cutoff = -acceptedNumber(session, "stoppingPotentialMagnitude");
    for (const distributionModel of LQ08_DISTRIBUTIONS) {
      expect(
        session.apply({
          distributionModel,
          transferModel: "partial",
          collectorPotential: cutoff / 2,
        }).kind,
      ).toBe("accepted");
      const sweep = acceptedSweep(session);
      expect(sweep.transferModel).toBe("partial");
      expect(sweep.ownerId).toBe("photoelectric.photocurrent");
      expect(sweep.operatingPoint.result).toMatchObject({
        status: "underdetermined",
        bounds: [0, sweep.saturationCurrent],
      });
      if (sweep.operatingPoint.result.status === "underdetermined") {
        expect(sweep.operatingPoint.result.neededInformation).toContain(
          "single-quantum-transfer-fraction",
        );
      }
      expect(sweep.underdetermined).toEqual([
        {
          minPotential: cutoff,
          maxPotential: 0,
          lowerCurrent: 0,
          upperCurrent: sweep.saturationCurrent,
          includeMin: false,
          includeMax: false,
        },
      ]);
      for (const segment of sweep.segments) {
        expect(
          segment.points.every(
            (point) => point.collectorPotential <= cutoff || point.collectorPotential >= 0,
          ),
        ).toBe(true);
      }
      expect(session.apply({ collectorPotential: cutoff }).kind).toBe("accepted");
      expect(acceptedNumber(session, "photocurrent")).toBe(0);
      expect(session.apply({ collectorPotential: 0 }).kind).toBe("accepted");
      expect(acceptedNumber(session, "photocurrent")).toBe(sweep.saturationCurrent);
    }
    expect(session.apply({ incidentPower: 0, collectorPotential: cutoff / 2 }).kind).toBe(
      "accepted",
    );
    expect(acceptedNumber(session, "photocurrent")).toBe(0);
    expect(acceptedSweep(session).underdetermined).toEqual([]);
    expect(acceptedEnergyBudget(session).maxKineticEnergy.status).toBe("underdetermined");
  });

  it("publishes the stopping-frequency envelope as bounded reference results, including actual accepted frequency", () => {
    const session = createLq08Session("lq08-stopping-envelope");
    const constants = getConstantSet(LQ08_MODEL.constantSetId);
    for (const transferModel of ["complete", "partial"] as const) {
      expect(session.apply({ transferModel, frequency: 1.8e15 }).kind).toBe("accepted");
      const parameters = session.acceptedParameters();
      const budget = acceptedEnergyBudget(session);
      expect(budget.stoppingSweep.samples.length).toBeGreaterThan(0);
      expect(budget.stoppingSweep.domain.max).toBeGreaterThanOrEqual(parameters.frequency);
      const current = budget.stoppingSweep.samples.find(
        (sample) => sample.frequency === parameters.frequency,
      );
      expect(current?.result).toEqual(budget.stoppingPotentialMagnitude);
      const necessaryFrequency = acceptedNumber(session, "thresholdFrequency");
      expect(
        budget.stoppingSweep.samples.some((sample) => sample.frequency === necessaryFrequency),
      ).toBe(true);
      for (const sample of budget.stoppingSweep.samples) {
        expect(sample.result).toEqual(
          stoppingPotentialFromEv(
            sample.frequency,
            parameters.workFunction,
            constants,
            transferModel,
          ),
        );
        if (transferModel === "partial" && sample.result.status !== "not-applicable") {
          expect(sample.result.status).toBe("underdetermined");
        }
      }
    }
    expect(session.apply({ workFunction: 0 }).kind).toBe("accepted");
    expect(
      acceptedEnergyBudget(session).stoppingSweep.samples.every((sample) => sample.frequency > 0),
    ).toBe(true);
  });

  it("keeps energy and current evidence on the same accepted snapshot through refusal, pending and restore", () => {
    const session = createLq08Session("lq08-partial-evidence");
    const before = session.getSnapshot();
    expect(session.getSnapshot()).toBe(before);
    expect(session.getSnapshot().energyBudget).toBe(before.energyBudget);
    const pending: ReturnType<typeof session.getSnapshot>[] = [];
    const off = session.subscribe(() => {
      const view = session.getSnapshot();
      if (view.pending) pending.push(view);
    });
    expect(
      session.apply({
        transferModel: "partial",
        distributionModel: "uniform",
        collectorPotential: -0.1,
      }).kind,
    ).toBe("accepted");
    off();
    expect(pending.length).toBeGreaterThan(0);
    for (const view of pending) {
      expect(view.energyBudget).toBe(before.energyBudget);
      expect(view.collectorSweep).toBe(before.collectorSweep);
    }
    const partial = session.getSnapshot();
    expect(partial.energyBudget).not.toBe(before.energyBudget);
    expect(partial.energyBudget?.snapshotVersion).toBe(partial.accepted?.snapshotVersion);
    expect(partial.collectorSweep?.snapshotVersion).toBe(partial.energyBudget?.snapshotVersion);
    expect(partial.collectorSweep?.actionIndex).toBe(partial.energyBudget?.actionIndex);
    expect(session.apply({ transferModel: "unavailable" }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(partial);
    const checkpoint = session.exportCheckpoint();
    expect(checkpoint).not.toBeNull();
    const restored = createLq08Session("lq08-partial-evidence");
    expect(restored.restoreCheckpoint(checkpoint).kind).toBe("restored");
    expect(restored.getSnapshot().energyBudget).toEqual(partial.energyBudget);
    expect(restored.getSnapshot().collectorSweep).toEqual(partial.collectorSweep);
    expect(before.energyBudget?.transferModel).toBe("complete");
  });
});
