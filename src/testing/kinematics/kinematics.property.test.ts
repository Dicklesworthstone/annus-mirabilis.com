import { describe, expect, test } from "bun:test";
import {
  composeBoosts,
  generalBoost,
  intervalSquared,
  inverseBoost,
  transformEvent,
} from "../../physics/reference/kinematics.ts";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("property tests", () => {
  test("inverse round trips and interval preservation, fixed seed", () => {
    const rnd = lcg(20250916);
    for (let i = 0; i < 20; i++) {
      const bx = (rnd() - 0.5) * 0.8;
      const by = (rnd() - 0.5) * 0.8;
      const bz = (rnd() - 0.5) * 0.4;
      const boost = generalBoost({ bx, by, bz }, 1);
      if (boost.status !== "value") continue;
      const inv = inverseBoost(boost.value);
      if (inv.status !== "value") continue;
      const event = {
        t: rnd(),
        x: (rnd() - 0.5) * 0.5,
        y: (rnd() - 0.5) * 0.5,
        z: (rnd() - 0.5) * 0.5,
      };
      const forth = transformEvent(event, boost.value);
      if (forth.status !== "value") continue;
      const back = transformEvent(forth.value, inv.value);
      if (back.status !== "value") continue;
      expect(Math.abs(back.value.t - event.t)).toBeLessThan(1e-12);
      const before = intervalSquared(event, 1);
      const after = intervalSquared(forth.value, 1);
      if (before.status === "value" && after.status === "value") {
        expect(Math.abs(before.value.s2 - after.value.s2)).toBeLessThan(1e-10);
      }
    }
  });

  test("collinear composition is a pure boost (rotation identity on time)", () => {
    const a = generalBoost({ bx: 0.3, by: 0, bz: 0 }, 1);
    const b = generalBoost({ bx: 0.4, by: 0, bz: 0 }, 1);
    expect(a.status).toBe("value");
    expect(b.status).toBe("value");
    if (a.status !== "value" || b.status !== "value") return;
    const p = composeBoosts(a.value, b.value);
    expect(p.status).toBe("value");
    if (p.status === "value") {
      expect(Math.abs(p.value.wignerAngle)).toBeLessThan(1e-12);
    }
  });
});
