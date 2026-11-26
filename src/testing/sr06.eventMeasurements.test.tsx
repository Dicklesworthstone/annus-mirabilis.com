import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VelocityEventComparison } from "../components/lab/sr06/VelocityEventComparison.tsx";
import { SR06_DEFAULTS, type Sr06Parameters } from "../experiments/sr06/definition.ts";
import { createSr06Session } from "../experiments/sr06/session.ts";
import type { AcceptedSnapshot } from "../experiments/store/instanceStore.ts";

function series(snapshot: AcceptedSnapshot, id: string) {
  const item = snapshot.outputs.find(x => x.quantityId === id);
  if (item?.status !== "value" || typeof item.value === "number") throw new Error(`Missing ${id}`);
  return item.value;
}

function scalar(snapshot: AcceptedSnapshot, id: string) {
  const item = snapshot.outputs.find(x => x.quantityId === id);
  if (item?.status !== "value" || typeof item.value !== "number") throw new Error(`Missing ${id}`);
  return item.value;
}

test("the same two events can be read from either frame's clocks", () => {
  const snapshot = createSr06Session("event-example").getSnapshot().accepted;
  if (!snapshot) throw new Error("No published worked example");
  expect(series(snapshot, "eventTimeMoving").at(0)).toBe(1);
  expect(series(snapshot, "eventTimeStationary").at(0)).toBeCloseTo(1.7, 13);
  expect(series(snapshot, "eventXStationary").at(0)).toBeCloseTo(1.5, 13);
  expect(series(snapshot, "eventTimeMoving").at(1)).toBeCloseTo(10 / 17, 13);
  expect(series(snapshot, "eventTimeStationary").at(1)).toBeCloseTo(1, 13);
  expect(series(snapshot, "eventXStationary").at(1)).toBeCloseTo(15 / 17, 13);
  const html = renderToStaticMarkup(<VelocityEventComparison snapshot={snapshot} />);
  expect(html).toContain('data-velocity-event="B"');
  expect(html).toContain('data-velocity-event="C"');
  expect(html).toContain("light-seconds");
  expect(html).toContain("/equations/special-relativity/eq-s5-d2/");
  const oldSnapshot = { ...snapshot, outputs: snapshot.outputs.filter(x => !x.quantityId.startsWith("event")) };
  expect(renderToStaticMarkup(<VelocityEventComparison snapshot={oldSnapshot} />)).toContain("Apply the saved settings");
});

test("both event-pair slopes reproduce the independent velocity calculation after Apply", () => {
  const session = createSr06Session("event-update");
  const cases: Partial<Sr06Parameters>[] = [
    { mode: "angled", alphaDeg: 90 },
    { mode: "angled", frameBeta: -0.8, movingSpeed: 1, alphaDeg: 135 },
    { mode: "collinear", frameBeta: -0.6 },
    { mode: "two-boosts", movingSpeed: 0.99, secondBeta: 0.25, secondAngleDeg: 270 },
    { mode: "collinear", frameBeta: 0, movingSpeed: 0 },
  ];
  for (const change of cases) {
    expect(session.apply({ ...SR06_DEFAULTS, ...change }).kind).toBe("accepted");
    const snapshot = session.getSnapshot().accepted;
    if (!snapshot) throw new Error("No accepted event measurement");
    for (const end of [0, 1]) {
      for (const axis of ["X", "Y"]) {
        for (const [frame, owner] of [["Moving", "moving"], ["Stationary", "composed"]]) {
          const distance = series(snapshot, `event${axis}${frame}`).at(end);
          const time = series(snapshot, `eventTime${frame}`).at(end);
          const slope = series(snapshot, `eventSlope${axis}${frame}`).at(end);
          expect(slope).toBeCloseTo(distance / time, 13);
          expect(slope).toBeCloseTo(scalar(snapshot, `${owner}U${axis.toLowerCase()}OverC`), 13);
        }
      }
    }
  }
});
