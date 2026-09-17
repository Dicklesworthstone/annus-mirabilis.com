import assert from "node:assert/strict";
import test from "node:test";
import { parseTrajectoryCsv } from "../experiments/bm07/trajectoryCsv.ts";
import { inspectTrajectory, trajectoryTrackIds, TRAJECTORY_PAGE_SIZE } from "../experiments/bm07/trajectoryInspection.ts";

const parse = (csv) => parseTrajectoryCsv(csv, { time: "s", position: "m" });
const rows = ["track,time,x,y"];
for (let i = 0; i < 53; i++) rows.push(`A,${i},${i},${i * 2}`, `B,${i},${100 + i},${200 + i}`);
const data = parse(rows.join("\n"));

test("inspection preserves first-seen track IDs and separates interleaved tracks", () => {
  assert.deepEqual(trajectoryTrackIds(data), ["A", "B"]);
  const view = inspectTrajectory(data, "B", 0, 1);
  assert.equal(view.total, 53);
  assert.equal(view.points.length, TRAJECTORY_PAGE_SIZE);
  assert.ok(view.points.every(p => p.source.track === "B"));
  assert.equal(view.points[0].source.row, 3);
  assert.equal(view.points[0].source, data.points[1]);
});
test("every accepted position appears exactly once across inspection pages", () => {
  for (const track of trajectoryTrackIds(data)) {
    const first = inspectTrajectory(data, track, 0, 1);
    const seen = [];
    for (let page = 1; page <= first.pages; page++) {
      const view = inspectTrajectory(data, track, 0, page);
      seen.push(...view.points.map(p => p.source.row));
      assert.deepEqual(view.timeRange, first.timeRange);
      assert.deepEqual(view.coordinateRange, first.coordinateRange);
    }
    assert.deepEqual(seen, data.points.filter(p => p.track === track).map(p => p.row));
    assert.equal(new Set(seen).size, 53);
  }
});
test("last page has truthful bounds rather than padding invented samples", () => {
  const v = inspectTrajectory(data, "A", 1, 3);
  assert.equal(v.start, 51); assert.equal(v.end, 53); assert.equal(v.points.length, 3);
  assert.deepEqual(v.coordinateRange, [0, 104]);
  assert.equal(v.points.at(-1).vertical, 1);
});
test("presentation changes cannot mutate accepted data or increments", () => {
  const before = JSON.stringify(data);
  inspectTrajectory(data, "A", 0, 1); inspectTrajectory(data, "B", 1, 2);
  assert.equal(JSON.stringify(data), before);
  const view = inspectTrajectory(data, "A", 0, 1);
  for (const object of [view, view.points, view.points[0], view.timeRange, view.coordinateRange])
    assert.equal(Object.isFrozen(object), true);
});
test("stationary coordinates are centered without fabricated numerical bounds", () => {
  const v = inspectTrajectory(parse("time,x\n0,2\n1,2"), "1", 0, 1);
  assert.deepEqual(v.coordinateRange, [2, 2]);
  assert.deepEqual(v.points.map(p => p.vertical), [.5, .5]);
});
test("large finite ranges do not produce Infinity or flatten the whole view", () => {
  const v = inspectTrajectory(parse("time,x\n0,-1e308\n1,0\n2,1e308"), "1", 0, 1);
  assert.deepEqual(v.points.map(p => p.vertical), [0, .5, 1]);
});
test("subnormal coordinates retain their representable range", () => {
  const v = inspectTrajectory(parse("time,x\n0,0\n1,5e-324\n2,1e-323"), "1", 0, 1);
  assert.deepEqual(v.points.map(p => p.vertical), [0, .5, 1]);
});
test("irregular timing remains inspectable without implying model admission", () => {
  const t = parse("time,x\n0,0\n1,2\n5,1");
  assert.equal(t.dt, null);
  const v = inspectTrajectory(t, "1", 0, 1);
  assert.deepEqual(v.points.map(p => p.horizontal), [0, .2, 1]);
});
for (const coordinate of [-1, 2, 1.5, NaN]) test(`reject unavailable coordinate ${coordinate}`, () => {
  assert.throws(() => inspectTrajectory(data, "A", coordinate, 1), /coordinate/);
});
for (const page of [-1, 0, 4, 1.5, NaN, Infinity]) test(`reject nonexistent page ${page}`, () => {
  assert.throws(() => inspectTrajectory(data, "A", 0, page), /page/);
});
test("an unknown track is not silently replaced", () => {
  assert.throws(() => inspectTrajectory(data, "missing", 0, 1), /track/);
});
