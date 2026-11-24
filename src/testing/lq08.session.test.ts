import { describe, expect, it } from "bun:test";
import { LQ08_DEFAULTS, LQ08_MODEL, LQ08_OUTPUTS } from "../experiments/lq08/definition.ts";
import { createLq08Session } from "../experiments/lq08/session.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";

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
