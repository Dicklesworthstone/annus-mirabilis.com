import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { SR09_DEFAULTS } from "../experiments/sr09/definition.ts";
import { sr09InputFromParameters, validateSr09Parameters } from "../experiments/sr09/parameters.ts";
import { createSr09Session, snapshotOutputs } from "../experiments/sr09/session.ts";

describe("SR-09 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr09Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.length).toBe(12);
    expect(session.acceptedParameters().beta).toBe(0.6);
  });

  test("observer change updates state and maintains store integrity", () => {
    const session = createSr09Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      beta: 0.8,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
    expect(session.acceptedParameters().beta).toBe(0.8);
  });

  test("setup change updates propagation angle and frequency", () => {
    const session = createSr09Session();
    const applied = session.apply({
      ...session.acceptedParameters(),
      propagationAngleDeg: 180,
      frequencyTHz: 600,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.acceptedParameters().propagationAngleDeg).toBe(180);
    expect(session.acceptedParameters().frequencyTHz).toBe(600);
  });

  test("counting-window changes keep the run and revise only its measurement", () => {
    const session = createSr09Session("sr09-counting-window");
    expect(
      session.apply({ ...session.acceptedParameters(), detectorMotion: "rest-in-K" }).kind,
    ).toBe("accepted");
    const before = session.getSnapshot().accepted;
    assert(before);
    const input = { ...session.acceptedParameters(), countingWindowCycles: 20 };

    expect(session.apply(input).kind).toBe("accepted");
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(after.parameters).toEqual(input);
    expect(after.runId).toBe(before.runId);
    expect(after.parentRunId).toBe(before.parentRunId);
    expect(after.revisions).toEqual({
      ...before.revisions,
      measurement: before.revisions.measurement + 1,
    });
    expect(after.outputs).toEqual(before.outputs);
    const counted = session.evaluate(sr09InputFromParameters(session.acceptedParameters()));
    expect(counted.detectorCrossings).toBeCloseTo(20, 12);

    expect(session.apply(input).kind).toBe("accepted");
    const repeated = session.getSnapshot().accepted;
    assert(repeated);
    expect(repeated.runId).toBe(after.runId);
    expect(repeated.parentRunId).toBe(after.parentRunId);
    expect(repeated.revisions).toEqual(after.revisions);
    expect(repeated.parameters).toEqual(input);
  });

  test("observer, counting-window and presentation changes share one accepted run", () => {
    const session = createSr09Session("sr09-mixed-measurement");
    const before = session.getSnapshot().accepted;
    assert(before);
    const input = {
      ...session.acceptedParameters(),
      beta: 0.8,
      countingWindowCycles: 25,
      showCovectorNote: true,
    };

    expect(session.apply(input).kind).toBe("accepted");
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(after.parameters).toEqual(input);
    expect(after.runId).toBe(before.runId);
    expect(after.parentRunId).toBe(before.parentRunId);
    expect(after.revisions).toEqual({
      ...before.revisions,
      observer: before.revisions.observer + 1,
      measurement: before.revisions.measurement + 1,
    });
    const doppler = after.outputs.find((output) => output.quantityId === "dopplerFactor");
    assert(doppler?.status === "value" && typeof doppler.value === "number");
    expect(doppler.value).toBeCloseTo(1 / 3, 12);
  });

  test("setup changes and explicit restarts carry measurements into one new run", () => {
    for (const newRun of [false, true]) {
      const session = createSr09Session("sr09-new-run-measurement");
      const before = session.getSnapshot().accepted;
      assert(before);
      const input = {
        ...session.acceptedParameters(),
        frequencyTHz: newRun ? SR09_DEFAULTS.frequencyTHz : 600,
        countingWindowCycles: 30,
      };

      const applied = newRun ? session.startNewRun(input) : session.apply(input);
      expect(applied.kind).toBe("accepted");
      const after = session.getSnapshot().accepted;
      assert(after);
      expect(after.parameters).toEqual(input);
      expect(after.runId).not.toBe(before.runId);
      expect(after.parentRunId).toBe(before.runId);
      expect(after.revisions).toEqual({
        ...before.revisions,
        input: before.revisions.input + 1,
        measurement: before.revisions.measurement + 1,
      });
    }
  });

  test("superluminal speed is refused", () => {
    const checked = validateSr09Parameters({
      ...SR09_DEFAULTS,
      beta: 1.05,
    });
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") {
      // The bead asks for v = -V to be refused with the explanation, not the generic refusal.
      expect(checked.refusal.code).toBe("superluminal-observer");
      expect(checked.refusal.message).toContain("more slowly than light");
    }
    for (const beta of [-1, 1]) {
      const edge = validateSr09Parameters({ ...SR09_DEFAULTS, beta });
      expect(edge.kind === "refused" && edge.refusal.code).toBe("superluminal-observer");
    }

    const session = createSr09Session("sr09-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      beta: 1.2,
    });
    expect(res.kind).toBe("refused");
  });

  test("snapshot outputs match evaluateSr09", () => {
    const outputs = snapshotOutputs(SR09_DEFAULTS);
    expect(outputs.length).toBe(12);
    const doppler = outputs.find((o) => o.quantityId === "dopplerFactor");
    expect(doppler?.status).toBe("value");
    if (doppler?.status === "value") {
      expect(doppler.value).toBeCloseTo(0.5, 12);
    }
  });
});
