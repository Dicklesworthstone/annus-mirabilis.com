import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BoostOrderComparison } from "../../components/lab/sr06/BoostOrderComparison.tsx";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { SR06_DEFAULTS, SR06_REVERSED_OUTPUTS } from "./definition.ts";
import { decodeSr06Settings, encodeSr06Settings } from "./permalink.ts";
import { createSr06Session } from "./session.ts";

function boostPair(a: number, b: number, angle: number): AcceptedSnapshot {
  const owner = createSr06Session("order-check");
  const result = owner.apply({
    ...SR06_DEFAULTS, mode: "two-boosts", frameBeta: a, secondBeta: b, secondAngleDeg: angle,
  });
  if (result.kind !== "accepted") throw new Error("Refused comparison setup");
  return owner.getSnapshot().accepted!;
}
function scalar(snapshot: AcceptedSnapshot, id: string) {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  if (output?.status !== "value" || typeof output.value !== "number") throw new Error(id);
  return output.value;
}
function matrix(snapshot: AcceptedSnapshot, id: string) {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  if (output?.status !== "value" || typeof output.value === "number") throw new Error(id);
  return output.value.copy();
}

test("two perpendicular 0.6c boosts exchange velocity components and reverse the signed axes rotation", () => {
  const snapshot = boostPair(0.6, 0.6, 90);
  expect(scalar(snapshot, "composedUxOverC")).toBeCloseTo(0.6, 12);
  expect(scalar(snapshot, "composedUyOverC")).toBeCloseTo(0.48, 12);
  expect(scalar(snapshot, "reversedUxOverC")).toBeCloseTo(0.48, 12);
  expect(scalar(snapshot, "reversedUyOverC")).toBeCloseTo(0.6, 12);
  expect(scalar(snapshot, "rotationDeg")).toBeCloseTo(-12.680383, 5);
  expect(scalar(snapshot, "reversedRotationDeg")).toBeCloseTo(12.680383, 5);
  expect(matrix(snapshot, "reversedProductMatrix")).toHaveLength(16);
  const html = renderToStaticMarkup(<BoostOrderComparison snapshot={snapshot} />);
  expect(html).toContain("B then A");
  expect(html).toContain("reversedRotationDeg");
  expect(html).toContain("Inspect the reversed 4");
});

test("both reported velocities take the final frame origin to rest in their actual product", () => {
  for (const [a, b, angle] of [[0.7, 0.3, 37], [-0.4, 0.75, -52], [0.8, -0.25, 132]] as const) {
    const snapshot = boostPair(a, b, angle);
    for (const [m, xid, yid] of [
      ["productMatrix", "composedUxOverC", "composedUyOverC"],
      ["reversedProductMatrix", "reversedUxOverC", "reversedUyOverC"],
    ] as const) {
      const L = matrix(snapshot, m);
      const x = scalar(snapshot, xid);
      const y = scalar(snapshot, yid);
      // The worldline (ct, x, y, z) = (1, ux/c, uy/c, 0) has zero final spatial coordinates.
      expect(L[4]! + L[5]! * x + L[6]! * y).toBeCloseTo(0, 12);
      expect(L[8]! + L[9]! * x + L[10]! * y).toBeCloseTo(0, 12);
    }
    expect(scalar(snapshot, "reversedSpeedOverC")).toBeCloseTo(scalar(snapshot, "composedSpeedOverC"), 12);
    expect(scalar(snapshot, "reversedRotationDeg")).toBeCloseTo(-scalar(snapshot, "rotationDeg"), 12);
  }
});

test("signed angles and their positive full-turn equivalents give the same reverse order", () => {
  for (const angle of [-360, -52, 0, 308, 360]) {
    const p = { ...SR06_DEFAULTS, mode: "two-boosts" as const, secondAngleDeg: angle };
    expect(decodeSr06Settings(encodeSr06Settings(p))).toEqual({ kind: "settings", parameters: p });
  }
  expect(decodeSr06Settings("?mode=two-boosts&alpha2=-361").kind).toBe("invalid");
  const negative = boostPair(-0.4, 0.75, -52);
  const positive = boostPair(-0.4, 0.75, 308);
  for (const id of ["reversedUxOverC", "reversedUyOverC", "reversedSpeedOverC", "reversedRotationDeg"])
    expect(scalar(negative, id)).toBeCloseTo(scalar(positive, id), 12);
});

test("collinear boosts, opposite boosts and the identity commute", () => {
  for (const [a, b, angle] of [[0.6, -0.6, 0], [0.4, 0.7, 180], [0, -0.7, 67]] as const) {
    const snapshot = boostPair(a, b, angle);
    expect(scalar(snapshot, "reversedRotationDeg")).toBeCloseTo(0, 10);
    expect(scalar(snapshot, "reversedUxOverC")).toBeCloseTo(scalar(snapshot, "composedUxOverC"), 12);
    expect(scalar(snapshot, "reversedUyOverC")).toBeCloseTo(scalar(snapshot, "composedUyOverC"), 12);
    const forward = matrix(snapshot, "productMatrix");
    matrix(snapshot, "reversedProductMatrix").forEach((entry, i) => expect(entry).toBeCloseTo(forward[i]!, 12));
  }
});

test("ordinary velocity measurements keep their original outputs and older snapshots can be reopened", () => {
  const snapshot = createSr06Session().getSnapshot().accepted!;
  for (const id of Object.keys(SR06_REVERSED_OUTPUTS)) {
    expect(snapshot.outputs.find((entry) => entry.quantityId === id)?.status).toBe("not-applicable");
  }
  expect(scalar(snapshot, "fizeauIncrement")).toBeGreaterThan(0);
  const current = boostPair(0.6, 0.6, 90);
  const legacy = { ...current, outputs: current.outputs.filter(entry => !(entry.quantityId in SR06_REVERSED_OUTPUTS)) };
  expect(renderToStaticMarkup(<BoostOrderComparison snapshot={legacy} />)).toContain("Apply these saved settings");
  expect(matrix(current, "eventSlopeXStationary")[0]).toBeCloseTo(0.6, 12);
});
