import { describe, expect, test } from "bun:test";
import { type Ledger, redescribe } from "../physics/reference/events.ts";
import { alignedBoost, inverseBoost } from "../physics/reference/kinematics.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("events.redescribe: Ledger redescription preserving identities (am-ref-events-yvl)", () => {
  test("Redescribing ledger preserves runId, event count, and event ids; inverse boost recovers coordinates", () => {
    const originalLedger: Ledger = {
      runId: "run-events-001",
      frame: "K",
      events: [
        { id: "e1", frame: "K", t: 0, x: 0, y: 0, z: 0, label: "Emission" },
        { id: "e2", frame: "K", t: 10, x: 6, y: 0, z: 0, label: "Reception" },
        { id: "e3", frame: "K", t: 20, x: 12, y: 0, z: 0, label: "Reunion" },
      ],
    };

    const boost = alignedBoost(0.6, 1.0);
    expect(boost.status).toBe("value");
    if (boost.status === "value") {
      const transformed = redescribe(originalLedger, boost.value);
      expect(transformed.status).toBe("value");
      if (transformed.status === "value") {
        expect(transformed.value.runId).toBe(originalLedger.runId);
        expect(transformed.value.events.length).toBe(originalLedger.events.length);
        expect(transformed.value.events.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);

        // Inverse boost
        const inv = inverseBoost(boost.value);
        expect(inv.status).toBe("value");
        if (inv.status === "value") {
          const recovered = redescribe(transformed.value, inv.value);
          expect(recovered.status).toBe("value");
          if (recovered.status === "value") {
            for (let i = 0; i < originalLedger.events.length; i++) {
              const orig = originalLedger.events[i];
              const rec = recovered.value.events[i];
              if (!orig || !rec) throw new Error("Missing event index");
              expect(withinTolerance(rec.t, orig.t, { absolute: 1e-12 }).ok).toBe(true);
              expect(withinTolerance(rec.x, orig.x, { absolute: 1e-12 }).ok).toBe(true);
            }
          }
        }
      }
    }
  });

  test("Adversarial: 'changing observer starts a new experiment' must fail (ids and runId unchanged)", () => {
    const originalLedger: Ledger = {
      runId: "experiment-realization-99",
      frame: "K",
      events: [
        { id: "event-alpha", frame: "K", t: 1.0, x: 2.0, y: 0, z: 0 },
        { id: "event-beta", frame: "K", t: 3.0, x: 4.0, y: 0, z: 0 },
      ],
    };

    const redescribed = redescribe(originalLedger, 0.5);
    expect(redescribed.status).toBe("value");
    if (redescribed.status === "value") {
      // Must NOT mint a new runId or mutate event ids
      expect(redescribed.value.runId).toBe("experiment-realization-99");
      expect(redescribed.value.events[0]?.id).toBe("event-alpha");
      expect(redescribed.value.events[1]?.id).toBe("event-beta");
      expect(redescribed.value.events.length).toBe(2);
      // Coordinates changed, but physical identity of experiment is invariant
      expect(redescribed.value.frame).toBe("k");
    }
  });
});
