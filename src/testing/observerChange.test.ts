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
});
