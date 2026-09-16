import { describe, expect, test } from "bun:test";
import {
  alignedBoost,
  boostMatrixXT,
  gamma,
  generalBoost,
  intervalSquared,
  inverseBoost,
  transformEvent,
} from "../../physics/reference/kinematics.ts";
import { kinematicsLogStart, logKinematics } from "./log.ts";

kinematicsLogStart();

function det2(m: number[][]): number {
  return (m[0]?.[0] ?? 0) * (m[1]?.[1] ?? 0) - (m[0]?.[1] ?? 0) * (m[1]?.[0] ?? 0);
}

describe("boosts", () => {
  test("beta 0.6: gamma 1.25, det 1, eigenvalues 0.5 and 2, simultaneous 10 ls events", () => {
    const g = gamma(0.6);
    const m = boostMatrixXT(0.6, 1);
    const boost = alignedBoost(0.6, 1);
    expect(g.status).toBe("value");
    expect(m.status).toBe("value");
    expect(boost.status).toBe("value");
    if (g.status === "value") expect(g.value).toBeCloseTo(1.25, 12);
    if (m.status === "value") {
      expect(det2(m.value)).toBeCloseTo(1, 12);
      const tr = (m.value[0]?.[0] ?? 0) + (m.value[1]?.[1] ?? 0);
      const disc = Math.sqrt(tr * tr - 4 * det2(m.value));
      const ev = [(tr + disc) / 2, (tr - disc) / 2].sort((a, b) => a - b);
      expect(ev[0]).toBeCloseTo(0.5, 12);
      expect(ev[1]).toBeCloseTo(2, 12);
    }
    if (boost.status !== "value") return;
    const a = transformEvent({ t: 0, x: 0, y: 0, z: 0 }, boost.value);
    const b = transformEvent({ t: 0, x: 10, y: 0, z: 0 }, boost.value);
    expect(a.status).toBe("value");
    expect(b.status).toBe("value");
    if (a.status === "value" && b.status === "value") {
      expect(b.value.t - a.value.t).toBeCloseTo(-7.5, 12);
      expect(b.value.x - a.value.x).toBeCloseTo(12.5, 12);
    }
    logKinematics({ testId: "boost-0.6-simultaneity", outcome: "pass", beta: 0.6 });
  });

  test("identity at zero boost", () => {
    const boost = alignedBoost(0, 1);
    expect(boost.status).toBe("value");
    if (boost.status !== "value") return;
    const ev = transformEvent({ t: 4, x: 3, y: 2, z: 1 }, boost.value);
    expect(ev.status).toBe("value");
    if (ev.status === "value") {
      expect(ev.value).toEqual({ t: 4, x: 3, y: 2, z: 1 });
    }
  });

  test("inverse is an actual round trip, not assumed", () => {
    const boost = generalBoost({ bx: 0.3, by: -0.2, bz: 0.1 }, 1);
    expect(boost.status).toBe("value");
    if (boost.status !== "value") return;
    const inv = inverseBoost(boost.value);
    expect(inv.status).toBe("value");
    if (inv.status !== "value") return;
    const event = { t: 2, x: 0.4, y: -0.3, z: 0.2 };
    const forth = transformEvent(event, boost.value);
    expect(forth.status).toBe("value");
    if (forth.status !== "value") return;
    const back = transformEvent(forth.value, inv.value);
    expect(back.status).toBe("value");
    if (back.status === "value") {
      expect(Math.abs(back.value.t - event.t)).toBeLessThan(1e-12);
      expect(Math.abs(back.value.x - event.x)).toBeLessThan(1e-12);
    }
  });

  test("interval classification can be indeterminate near the cone", () => {
    const event = { t: 1, x: 1, y: 0, z: 0 };
    const report = intervalSquared(event, 1);
    expect(report.status).toBe("value");
    if (report.status === "value") {
      expect(report.value.kind === "null" || report.value.kind === "indeterminate").toBe(true);
    }
  });
});
