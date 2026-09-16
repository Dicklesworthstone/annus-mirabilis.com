import { describe, expect, test } from "bun:test";
import { SR01_DEFAULTS, SR01_PRESETS } from "./definition.ts";
import {
  computeSr01Ledger,
  createSr01Session,
  predictAnswerFor,
  snapshotOutputs,
} from "./session.ts";

function outputByQuantityId(outputs: readonly ReturnType<typeof snapshotOutputs>[number][], id: string) {
  const found = outputs.find((o) => o.quantityId === id);
  if (!found) throw new Error(`no output ${id}`);
  return found;
}

describe("snapshotOutputs (acceptance fixtures, against the real events.ts)", () => {
  test("the sr-01-sync-0-10 preset assigns 5", () => {
    const preset = SR01_PRESETS.find((p) => p.presetId === "sr-01-sync-0-10");
    if (!preset) throw new Error("preset missing");
    const outputs = snapshotOutputs(preset.parameterValues);
    const assigned = outputByQuantityId(outputs, "assignedRemoteTime");
    expect(assigned.status).toBe("value");
    if (assigned.status !== "value") throw new Error("expected value");
    expect(assigned.value).toBe(5);
  });

  test("the sr-01-second-flash-20-30 preset assigns 25", () => {
    const preset = SR01_PRESETS.find((p) => p.presetId === "sr-01-second-flash-20-30");
    if (!preset) throw new Error("preset missing");
    const outputs = snapshotOutputs(preset.parameterValues);
    const assigned = outputByQuantityId(outputs, "assignedRemoteTime");
    expect(assigned.status).toBe("value");
    if (assigned.status !== "value") throw new Error("expected value");
    expect(assigned.value).toBe(25);
  });

  test("the sr-01-round-trip-10ls preset gives speed c", () => {
    const preset = SR01_PRESETS.find((p) => p.presetId === "sr-01-round-trip-10ls");
    if (!preset) throw new Error("preset missing");
    const outputs = snapshotOutputs(preset.parameterValues);
    const speed = outputByQuantityId(outputs, "roundTripSpeed");
    expect(speed.status).toBe("value");
    if (speed.status !== "value") throw new Error("expected value");
    expect(speed.value).toBe(1);
  });

  test("the sr-01-rod-chase-0.6c preset gives legs of 25 s and 6.25 s", () => {
    const preset = SR01_PRESETS.find((p) => p.presetId === "sr-01-rod-chase-0.6c");
    if (!preset) throw new Error("preset missing");
    const outputs = snapshotOutputs(preset.parameterValues);
    const outbound = outputByQuantityId(outputs, "chaseOutboundLeg");
    const ret = outputByQuantityId(outputs, "chaseReturnLeg");
    expect(outbound.status).toBe("value");
    expect(ret.status).toBe("value");
    if (outbound.status !== "value" || ret.status !== "value") throw new Error("expected value");
    expect(outbound.value).toBe(25);
    expect(ret.value).toBe(6.25);
  });

  test("the sr-01-moving-pair-0.6c preset gives 6 s desynchronization", () => {
    const preset = SR01_PRESETS.find((p) => p.presetId === "sr-01-moving-pair-0.6c");
    if (!preset) throw new Error("preset missing");
    const outputs = snapshotOutputs(preset.parameterValues);
    const desync = outputByQuantityId(outputs, "desynchronization");
    expect(desync.status).toBe("value");
    if (desync.status !== "value") throw new Error("expected value");
    expect(desync.value).toBe(6);
  });

  test("at v = 0 there is no desynchronization", () => {
    const outputs = snapshotOutputs({ ...SR01_DEFAULTS, pairBeta: 0 });
    const desync = outputByQuantityId(outputs, "desynchronization");
    expect(desync.status).toBe("value");
    if (desync.status !== "value") throw new Error("expected value");
    expect(desync.value).toBe(0);
  });

  test("|v| >= c returns outside-domain for the desynchronization output", () => {
    const outputs = snapshotOutputs({ ...SR01_DEFAULTS, pairBeta: 1 });
    const desync = outputByQuantityId(outputs, "desynchronization");
    expect(desync.status).toBe("outside-domain");
  });

  test("one-way light speed is always not-applicable", () => {
    const outputs = snapshotOutputs(SR01_DEFAULTS);
    const oneWay = outputByQuantityId(outputs, "oneWayLightSpeed");
    expect(oneWay.status).toBe("not-applicable");
  });

  test("a malformed separation is refused with a reason, naming the entry", () => {
    const outputs = snapshotOutputs({ ...SR01_DEFAULTS, stationSeparationLs: 0 });
    const assigned = outputByQuantityId(outputs, "assignedRemoteTime");
    expect(assigned.status).toBe("outside-domain");
  });

  test("the criterion offset is zero when the declared clock has no offset, and tracks 2x the offset otherwise", () => {
    const zero = outputByQuantityId(snapshotOutputs(SR01_DEFAULTS), "criterionOffset");
    expect(zero.status).toBe("value");
    if (zero.status !== "value") throw new Error("expected value");
    expect(zero.value).toBe(0);

    const offset = outputByQuantityId(
      snapshotOutputs({ ...SR01_DEFAULTS, clockOffsetB: 3 }),
      "criterionOffset",
    );
    expect(offset.status).toBe("value");
    if (offset.status !== "value") throw new Error("expected value");
    expect(offset.value).toBe(6);
  });
});

describe("predictAnswerFor (the predict prompt's reveal, read from the accepted snapshot)", () => {
  test("the default (pairBeta = 0.6) settles trailing-clock-ahead", () => {
    expect(predictAnswerFor(SR01_DEFAULTS)).toBe("trailing-clock-ahead");
  });

  test("flipping the sign of pairBeta settles leading-clock-ahead", () => {
    expect(predictAnswerFor({ ...SR01_DEFAULTS, pairBeta: -0.6 })).toBe("leading-clock-ahead");
  });

  test("pairBeta = 0 settles they-agree", () => {
    expect(predictAnswerFor({ ...SR01_DEFAULTS, pairBeta: 0 })).toBe("they-agree");
  });
});

describe("computeSr01Ledger", () => {
  test("reception and remote-event times are distinct: the reflection is strictly between emission and reception", () => {
    const ledger = computeSr01Ledger(SR01_DEFAULTS);
    const emission = ledger.rows.find((r) => r.kind === "emission");
    const reflection = ledger.rows.find((r) => r.kind === "reflection");
    const reception = ledger.rows.find((r) => r.kind === "reception");
    if (!emission || !reflection || !reception) throw new Error("missing ledger row");
    expect(reflection.t).toBeGreaterThan(emission.t);
    expect(reception.t).toBeGreaterThan(reflection.t);
  });

  test("each clock's own reading at an event is unchanged by an observer change", () => {
    const rest = computeSr01Ledger(SR01_DEFAULTS);
    const moving = computeSr01Ledger({ ...SR01_DEFAULTS, frameBeta: 0.5 });
    expect(moving.rows.map((r) => r.ownClockReading)).toEqual(rest.rows.map((r) => r.ownClockReading));
    expect(moving.rows.map((r) => r.id)).toEqual(rest.rows.map((r) => r.id));
  });

  test("an observer change does change frame-dependent coordinates", () => {
    const rest = computeSr01Ledger(SR01_DEFAULTS);
    const moving = computeSr01Ledger({ ...SR01_DEFAULTS, frameBeta: 0.5 });
    expect(moving.rows[1]?.t).not.toBe(rest.rows[1]?.t);
  });

  test("three mutually resting stations are transitive", () => {
    const ledger = computeSr01Ledger(SR01_DEFAULTS);
    expect(ledger.transitivity?.status).toBe("transitive");
  });
});

describe("createSr01Session (instance store integration)", () => {
  test("the initial snapshot is accepted and carries the default outputs", () => {
    const session = createSr01Session("sr01-test-1");
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("accepted");
    expect(snapshot.accepted?.outputs.length).toBeGreaterThan(0);
  });

  test("changing observer starts a new experiment must fail: run identity is unchanged by an observer-change", () => {
    const session = createSr01Session("sr01-test-2");
    const before = session.getSnapshot().accepted?.runId;
    session.apply({ ...SR01_DEFAULTS, frameBeta: 0.3 });
    const after = session.getSnapshot().accepted?.runId;
    expect(after).toBe(before);
  });

  test("changing a setup parameter forks a new run", () => {
    const session = createSr01Session("sr01-test-3");
    const before = session.getSnapshot().accepted?.runId;
    session.apply({ ...SR01_DEFAULTS, stationSeparationLs: 20 });
    const after = session.getSnapshot().accepted?.runId;
    expect(after).not.toBe(before);
  });

  test("an out-of-domain change is refused, not silently accepted", () => {
    const session = createSr01Session("sr01-test-4");
    const outcome = session.apply({ ...SR01_DEFAULTS, pairBeta: 1 });
    expect(outcome.kind).toBe("refused");
  });

  test("two instances keep independent run ids", () => {
    const a = createSr01Session("sr01-test-a");
    const b = createSr01Session("sr01-test-b");
    expect(a.getSnapshot().accepted?.runId).not.toBe(b.getSnapshot().accepted?.runId);
  });
});
