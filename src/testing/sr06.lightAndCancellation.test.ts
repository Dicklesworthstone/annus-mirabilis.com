import { expect, test } from "bun:test";
import { SR06_DEFAULTS } from "../experiments/sr06/definition.ts";
import { createSr06Session, evaluateSr06 } from "../experiments/sr06/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";

function scalar(
  outputs: AcceptedSnapshot["outputs"] | ReturnType<typeof evaluateSr06>,
  id: string,
) {
  const output = outputs.find((item) => item.quantityId === id);
  expect(output?.status).toBe("value");
  if (output?.status !== "value" || typeof output.value !== "number") throw new Error(id);
  return output.value;
}

test("the accepted opposite-speed setup publishes matching near-zero component and printed magnitudes", () => {
  const session = createSr06Session("sr06-opposing");
  const applied = session.apply({ ...SR06_DEFAULTS, mode: "angled", alphaDeg: 180 });
  expect(applied.kind).toBe("accepted");
  const accepted = session.getSnapshot().accepted;
  expect(accepted).not.toBeNull();
  if (!accepted) return;
  expect(Math.abs(scalar(accepted.outputs, "composedSpeedOverC"))).toBeLessThan(2e-15);
  expect(Math.abs(scalar(accepted.outputs, "printedSpeedOverC"))).toBeLessThan(2e-15);
  expect(scalar(accepted.outputs, "composedGamma")).toBeCloseTo(1, 14);
  expect(scalar(accepted.outputs, "shortfall")).toBeCloseTo(1, 14);
});

test("every admitted light-ray direction has a working inverse and no fictitious rest-frame factor", () => {
  for (const frameBeta of [-0.99, -0.6, 0, 0.6, 0.99]) {
    for (const alphaDeg of [0, 17, 37, 90, 135, 179, 180, 225, 270, 359]) {
      const outputs = evaluateSr06({
        ...SR06_DEFAULTS,
        mode: "angled",
        movingSpeed: 1,
        frameBeta,
        alphaDeg,
      });
      expect(scalar(outputs, "composedSpeedOverC")).toBe(1);
      expect(scalar(outputs, "printedSpeedOverC")).toBe(1);
      expect(scalar(outputs, "shortfall")).toBe(0);
      const alpha = (alphaDeg * Math.PI) / 180;
      expect(Math.abs(scalar(outputs, "inverseUxOverC") - Math.cos(alpha))).toBeLessThan(2e-12);
      expect(Math.abs(scalar(outputs, "inverseUyOverC") - Math.sin(alpha))).toBeLessThan(2e-12);
      expect(outputs.find((item) => item.quantityId === "composedGamma")?.status).toBe(
        "not-applicable",
      );
      expect(outputs.find((item) => item.quantityId === "rapidityMoving")?.status).toBe(
        "not-applicable",
      );
    }
  }
});

test("a speed rounded to c still has a positive shortfall and finite factor for a massive point", () => {
  const outputs = evaluateSr06({
    ...SR06_DEFAULTS,
    frameBeta: 0.99,
    movingSpeed: 1 - Number.EPSILON / 2,
  });
  expect(scalar(outputs, "shortfall")).toBeGreaterThan(0);
  expect(scalar(outputs, "shortfall")).toBeLessThan(Number.EPSILON);
  expect(Number.isFinite(scalar(outputs, "composedGamma"))).toBe(true);
  expect(scalar(outputs, "composedGamma")).toBeGreaterThan(1e8);
  expect(scalar(outputs, "printedSpeedOverC")).toBeLessThanOrEqual(1);
});

test("rejecting a light-speed observer retains the accepted light ray and can recover to a material point", () => {
  const session = createSr06Session("sr06-null-recovery");
  const ray = { ...SR06_DEFAULTS, mode: "angled" as const, movingSpeed: 1, alphaDeg: 135 };
  expect(session.apply(ray).kind).toBe("accepted");
  const accepted = session.getSnapshot().accepted;
  expect(session.apply({ ...ray, frameBeta: 1 }).kind).toBe("refused");
  expect(session.getSnapshot().accepted).toBe(accepted);
  expect(session.apply(SR06_DEFAULTS).kind).toBe("accepted");
  expect(scalar(session.getSnapshot().accepted?.outputs ?? [], "composedSpeedOverC")).toBeCloseTo(
    15 / 17,
    12,
  );
});
