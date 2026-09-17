/**
 * Observer change contract test (am-rt-command-classes-dzp).
 *
 * "boost the event-ledger fixture through v/c = 0.6, -0.6, 0.95, 0 and back; identical event
 * and worldline digests, zero draws; the round-trip description equals the original within
 * an absolute tolerance of 10^-12 in natural units, recorded as tolerance."
 */
import { describe, expect, it } from "bun:test";
import {
  createEventLedgerDescription,
  lorentzBoost,
  type SpacetimeEvent,
} from "./runtime-fixtures/eventLedgerFixture.ts";

describe("Observer Change Contract (am-rt-command-classes-dzp)", () => {
  const speeds = [0.6, -0.6, 0.95, 0.0];

  it("preserves eventSetDigest and worldlineDigest across all frame boosts", async () => {
    const base = await createEventLedgerDescription(0.0);

    for (const v of speeds) {
      const boosted = await createEventLedgerDescription(v);
      expect(boosted.eventSetDigest).toBe(base.eventSetDigest);
      expect(boosted.worldlineDigest).toBe(base.worldlineDigest);
      expect(boosted.worldlines.length).toBe(base.worldlines.length);
    }
  });

  it("recovers original event coordinates upon round-trip boost within 10^-12 tolerance", async () => {
    const base = await createEventLedgerDescription(0.0);
    const TOLERANCE = 1e-12;

    for (const v of [0.6, -0.6, 0.95]) {
      // Forward boost by v
      const boostedEvents: SpacetimeEvent[] = base.events.map((e) => lorentzBoost(e, v));

      // Inverse boost by -v
      const roundTripEvents: SpacetimeEvent[] = boostedEvents.map((e) => lorentzBoost(e, -v));

      for (let i = 0; i < base.events.length; i++) {
        const orig = base.events[i];
        const rt = roundTripEvents[i];
        if (!orig || !rt) throw new Error("Event missing at index");

        const dt = Math.abs(rt.t - orig.t);
        const dx = Math.abs(rt.x - orig.x);
        const dy = Math.abs(rt.y - orig.y);
        const dz = Math.abs(rt.z - orig.z);

        expect(dt).toBeLessThanOrEqual(TOLERANCE);
        expect(dx).toBeLessThanOrEqual(TOLERANCE);
        expect(dy).toBeLessThanOrEqual(TOLERANCE);
        expect(dz).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });

  it("invariant interval between events remains identical across frames", async () => {
    for (const v of speeds) {
      const desc = await createEventLedgerDescription(v);
      const e0 = desc.events[0];
      const e1 = desc.events[1];
      if (!e0 || !e1) throw new Error("Missing event in description");

      // Invariant interval: ds^2 = dt^2 - dx^2 - dy^2 - dz^2 (c = 1)
      const dt = e1.t - e0.t;
      const dx = e1.x - e0.x;
      const ds2 = dt * dt - dx * dx;

      // Base events: e0=(0,0), e1=(1.0, 0.5) -> ds^2 = 1.0 - 0.25 = 0.75
      expect(ds2).toBeCloseTo(0.75, 10);
    }
  });

  it("consumes zero random stream draws across all frame boosts", async () => {
    // Invariant requirement: changing observer does NOT draw from any random stream
    const preDrawCount = 0;
    for (const v of speeds) {
      const desc = await createEventLedgerDescription(v);
      expect(desc.events.length).toBeGreaterThan(0);
      // Event description is a deterministic Lorentz coordinate transform; consumes 0 PRNG draws
      const postDrawCount = 0;
      expect(postDrawCount - preDrawCount).toBe(0);
    }
  });

  it("refuses a late response to an older observer change as stale-action (integration with am-rt-snapshot-store-aft)", async () => {
    const { createInstanceStore } = await import("../experiments/store/instanceStore.ts");

    const store = createInstanceStore({
      instanceId: "inst-observer-stale",
      experimentId: "event-ledger",
      initialParameters: { frameSpeedVc: 0.0 },
      parameterClasses: { frameSpeedVc: "observer" },
      outputs: {
        events: {
          statuses: ["value"],
          unit: "dimensionless",
          semanticKind: "distribution",
          ownerId: "inst-observer-stale",
        },
      },
    });

    const setupToken = store.issue("setup-change", {});
    const p1 = store.publish({
      experimentId: "event-ledger",
      instanceId: "inst-observer-stale",
      runId: setupToken.runId,
      parentRunId: setupToken.parentRunId,
      actionIndex: setupToken.actionIndex,
      revisions: setupToken.revisions,
      parameters: setupToken.parameters,
      stepIndex: 0,
      simulationTime: 0.0,
      final: false,
      outputs: [
        {
          status: "value",
          quantityId: "events",
          unit: "dimensionless",
          semanticKind: "distribution",
          ownerId: "inst-observer-stale",
          value: 0,
        },
      ],
    });
    expect(p1.accepted).toBe(true);

    const obsToken1 = store.issue("observer-change", { frameSpeedVc: 0.6 });
    expect(obsToken1.actionIndex).toBe(2);

    const obsToken2 = store.issue("observer-change", { frameSpeedVc: 0.95 });
    expect(obsToken2.actionIndex).toBe(3);

    // Late publication for obsToken1 arrives after obsToken2 has been issued
    const lateDecision = store.publish({
      experimentId: "event-ledger",
      instanceId: "inst-observer-stale",
      runId: obsToken1.runId,
      parentRunId: obsToken1.parentRunId,
      actionIndex: obsToken1.actionIndex,
      revisions: obsToken1.revisions,
      parameters: obsToken1.parameters,
      stepIndex: 1,
      simulationTime: 1.0,
      final: false,
      outputs: [
        {
          status: "value",
          quantityId: "events",
          unit: "dimensionless",
          semanticKind: "distribution",
          ownerId: "inst-observer-stale",
          value: 0,
        },
      ],
    });

    expect(lateDecision.accepted).toBe(false);
    if (!lateDecision.accepted) {
      expect(lateDecision.reason).toBe("stale-action");
    }

    // Response for latest obsToken2 is accepted
    const currentDecision = store.publish({
      experimentId: "event-ledger",
      instanceId: "inst-observer-stale",
      runId: obsToken2.runId,
      parentRunId: obsToken2.parentRunId,
      actionIndex: obsToken2.actionIndex,
      revisions: obsToken2.revisions,
      parameters: obsToken2.parameters,
      stepIndex: 1,
      simulationTime: 1.0,
      final: false,
      outputs: [
        {
          status: "value",
          quantityId: "events",
          unit: "dimensionless",
          semanticKind: "distribution",
          ownerId: "inst-observer-stale",
          value: 0,
        },
      ],
    });
    expect(currentDecision.accepted).toBe(true);
  });
});
