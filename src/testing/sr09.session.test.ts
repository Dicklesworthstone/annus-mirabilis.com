import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { SR09_DEFAULTS, SR09_EVENTS, SR09_OUTPUTS } from "../experiments/sr09/definition.ts";
import { sr09InputFromParameters, validateSr09Parameters } from "../experiments/sr09/parameters.ts";
import { decodeSr09Settings, encodeSr09Settings } from "../experiments/sr09/permalink.ts";
import { createSr09Session, snapshotOutputs } from "../experiments/sr09/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";

const offsetEvent = SR09_EVENTS[1];
assert(offsetEvent);

function scalar(snapshot: AcceptedSnapshot, id: string): number {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  assert(output?.status === "value" && typeof output.value === "number");
  return output.value;
}

function vector(snapshot: AcceptedSnapshot, id: string): number[] {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  assert(output?.status === "value" && typeof output.value !== "number");
  return [...output.value.copy()];
}

describe("SR-09 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr09Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.map((output) => output.quantityId).sort()).toEqual(
      Object.keys(SR09_OUTPUTS).sort(),
    );
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
    expect(scalar(before, "detectorCrossings")).toBeCloseTo(10, 12);
    expect(scalar(after, "detectorCrossings")).toBeCloseTo(20, 12);
    expect(scalar(after, "countingWindowK") / scalar(before, "countingWindowK")).toBeCloseTo(2, 12);
    expect(scalar(after, "detectorProperRateHz")).toBe(scalar(before, "detectorProperRateHz"));
    expect(vector(after, "namedEventPhases")).toEqual(vector(before, "namedEventPhases"));
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
    expect(outputs.map((output) => output.quantityId).sort()).toEqual(
      Object.keys(SR09_OUTPUTS).sort(),
    );
    const doppler = outputs.find((o) => o.quantityId === "dopplerFactor");
    expect(doppler?.status).toBe("value");
    if (doppler?.status === "value") {
      expect(doppler.value).toBeCloseTo(0.5, 12);
    }
  });

  test("each detector publishes its own elapsed time, accumulated cycles, and proper rate", () => {
    for (const { detectorMotion, detectorSpeed, count, rate, speedK, elapsedFs } of [
      {
        detectorMotion: "rest-in-K",
        detectorSpeed: 0.8,
        count: 20,
        rate: 1,
        speedK: 0,
        elapsedFs: 40,
      },
      {
        detectorMotion: "rest-in-k",
        detectorSpeed: 0,
        count: 8,
        rate: 0.5,
        speedK: 0.6,
        elapsedFs: 32,
      },
      {
        detectorMotion: "custom",
        detectorSpeed: -0.8,
        count: 36,
        rate: 3,
        speedK: -0.8,
        elapsedFs: 24,
      },
    ] as const) {
      const session = createSr09Session();
      expect(
        session.apply({ ...SR09_DEFAULTS, detectorMotion, detectorSpeed, countingWindowCycles: 20 })
          .kind,
      ).toBe("accepted");
      const snapshot = session.getSnapshot().accepted;
      assert(snapshot);
      expect(scalar(snapshot, "detectorCrossings")).toBeCloseTo(count, 12);
      expect(scalar(snapshot, "detectorProperRateHz") / 5e14).toBeCloseTo(rate, 12);
      expect(scalar(snapshot, "detectorSpeedK")).toBe(speedK);
      expect(scalar(snapshot, "countingWindowK") * 1e15).toBeCloseTo(40, 12);
      expect(scalar(snapshot, "detectorProperWindow") * 1e15).toBeCloseTo(elapsedFs, 12);
    }
  });

  test("phase queries and observer changes preserve the named physical events", () => {
    const session = createSr09Session();
    const before = session.getSnapshot().accepted;
    assert(before);
    expect(vector(before, "namedEventTimesK")).toEqual([1e-15, 2e-15]);
    expect(vector(before, "namedEventPositionsK")).toEqual([0, 0, 0, 3e-7, 0, 0]);
    expect(vector(before, "namedEventPhases")[0]).toBeCloseTo(-Math.PI, 12);
    expect(vector(before, "namedEventPhaseAgreement")).toEqual([1, 1]);
    expect(
      session.apply({ ...session.acceptedParameters(), selectedEventId: offsetEvent.id }).kind,
    ).toBe("accepted");
    const selected = session.getSnapshot().accepted;
    assert(selected);
    expect(selected.runId).toBe(before.runId);
    expect(selected.revisions).toEqual(before.revisions);
    expect(vector(selected, "namedEventPhases")).toEqual(vector(before, "namedEventPhases"));

    expect(session.apply({ ...session.acceptedParameters(), beta: 0.8 }).kind).toBe("accepted");
    const moved = session.getSnapshot().accepted;
    assert(moved);
    expect(moved.runId).toBe(before.runId);
    expect(moved.parameters.selectedEventId).toBe(offsetEvent.id);
    expect(moved.revisions).toEqual({
      ...before.revisions,
      observer: before.revisions.observer + 1,
    });
    expect(vector(moved, "namedEventTimesK")).toEqual(vector(before, "namedEventTimesK"));
    expect(vector(moved, "namedEventPositionsK")).toEqual(vector(before, "namedEventPositionsK"));
    expect(vector(moved, "namedEventTimesMoving")).not.toEqual(
      vector(before, "namedEventTimesMoving"),
    );
    expect(vector(moved, "namedEventPhaseAgreement")).toEqual([1, 1]);
    const phases = vector(moved, "namedEventPhases");
    const originMoving = phases[1];
    const offsetMoving = phases[3];
    assert(originMoving !== undefined && offsetMoving !== undefined);
    expect(phases[0]).toBeCloseTo(originMoving, 12);
    expect(phases[2]).toBeCloseTo(offsetMoving, 12);
    expect(phases[0]).toBe(vector(before, "namedEventPhases")[0]);
    expect(phases[2]).toBe(vector(before, "namedEventPhases")[2]);
  });

  test("a fixed custom detector's published readings survive observer changes", () => {
    const session = createSr09Session();
    session.apply({
      ...SR09_DEFAULTS,
      detectorMotion: "custom",
      detectorSpeed: -0.8,
      countingWindowCycles: 20,
    });
    const before = session.getSnapshot().accepted;
    assert(before);
    session.apply({ ...session.acceptedParameters(), beta: -0.6 });
    const after = session.getSnapshot().accepted;
    assert(after);
    expect(after.runId).toBe(before.runId);
    for (const id of [
      "detectorCrossings",
      "detectorProperRateHz",
      "detectorProperWindow",
      "detectorSpeedK",
    ])
      expect(scalar(after, id)).toBe(scalar(before, id));
    expect(scalar(after, "waveFrequencyMoving")).not.toBe(scalar(before, "waveFrequencyMoving"));
  });

  test("unavailable phase evaluations do not become zero or a passing comparison", () => {
    const outputs = snapshotOutputs({ ...SR09_DEFAULTS, frequencyTHz: 1e300 });
    for (const id of ["wavePhase", "namedEventPhases", "namedEventPhaseAgreement"])
      expect(outputs.find((output) => output.quantityId === id)?.status).toBe("outside-domain");
    const forbiddenObserver = snapshotOutputs({ ...SR09_DEFAULTS, beta: 1 });
    expect(forbiddenObserver).toHaveLength(Object.keys(SR09_OUTPUTS).length);
    expect(forbiddenObserver.every((output) => output.status === "outside-domain")).toBe(true);
  });

  test("invalid event/motion choices are refused without changing the accepted reading", () => {
    const session = createSr09Session();
    const before = session.getSnapshot().accepted;
    for (const invalid of [
      { selectedEventId: "made-up-event" },
      { selectedEventId: 1 },
      { detectorMotion: "unknown-frame" },
    ]) {
      expect(session.apply({ ...SR09_DEFAULTS, ...invalid }).kind).toBe("refused");
      expect(session.getSnapshot().accepted).toBe(before);
    }
  });

  test("detector and event query settings survive a permalink round trip", () => {
    const parameters = {
      ...SR09_DEFAULTS,
      detectorMotion: "custom" as const,
      detectorSpeed: -0.8,
      countingWindowCycles: 20,
      selectedEventId: offsetEvent.id,
    };
    expect(decodeSr09Settings(encodeSr09Settings(parameters))).toEqual({
      kind: "settings",
      parameters,
    });
  });
});
