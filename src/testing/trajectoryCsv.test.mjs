import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTrajectoryCsv as parse,
  TRAJECTORY_LIMITS,
  TrajectoryImportError,
  trajectorySiCsv,
} from "../experiments/bm07/trajectoryCsv.ts";

const units = { time: "s", position: "um" };
const equal = (a, b) =>
  assert.ok(Math.abs(a - b) <= Math.max(Math.abs(b), Number.MIN_VALUE) * 1e-12, `${a} != ${b}`);
const reject = (csv, fragment, calibration = units) =>
  assert.throws(
    () => parse(csv, calibration),
    (e) => e instanceof TrajectoryImportError && e.message.includes(fragment),
  );

test("1D import converts explicitly declared units and freezes accepted data", () => {
  const t = parse("time,x\n0,0\n1,2\n2,1", units);
  assert.equal(t.dimension, 1);
  assert.equal(t.dt, 1);
  assert.equal(t.incrementCount, 2);
  equal(t.increments[0], 2e-6);
  equal(t.increments[1], -1e-6);
  assert.equal(t.kind, "user-supplied-trajectory");
  for (const value of [t, t.units, t.points, t.points[0], t.points[0].coordinates, t.increments])
    assert.equal(Object.isFrozen(value), true);
});
test("reordered columns, BOM, CRLF, decimal exponents and 3D are explicit", () => {
  const t = parse("\uFEFFz,track,time,y,x\r\n3,A,0,2,1\r\n6,A,5e2,4,2\r\n", {
    time: "ms",
    position: "nm",
  });
  assert.equal(t.dimension, 3);
  equal(t.dt, 0.5);
  equal(t.increments[2], 3e-9);
});
test("interleaved tracks never create cross-particle displacements", () => {
  const t = parse("track,time,x,y\na,0,0,0\nb,0,100,200\na,1,1,2\nb,1,103,204", units);
  assert.equal(t.trackCount, 2);
  assert.equal(t.incrementCount, 2);
  t.increments.forEach((n, i) => {
    equal(n, [1e-6, 2e-6, 3e-6, 4e-6][i]);
  });
});
test("quoted comma and escaped quote track labels work without prototype keys", () => {
  const t = parse('track,time,x\n"__proto__,a""b",0,0\n"__proto__,a""b",1,2', units);
  assert.equal(t.points[0].track, '__proto__,a"b');
});
test("pixel calibration is explicit and squared scaling is left to the owner", () => {
  const text = "time,x\n0,0\n10,3";
  reject(text, "positive independent calibration", { time: "ms", position: "px" });
  const t = parse(text, { time: "ms", position: "px", micrometresPerPixel: 0.4 });
  equal(t.dt, 0.01);
  equal(t.increments[0], 1.2e-6);
});
for (const value of [0, -1, Infinity, NaN, Number.MIN_VALUE])
  test(`reject invalid pixel calibration ${value}`, () => {
    assert.throws(
      () => parse("time,x\n0,0\n1,1", { time: "s", position: "px", micrometresPerPixel: value }),
      TrajectoryImportError,
    );
  });
for (const value of ["", "NaN", "Infinity", "0x10", "1_000", "=1+2", "1e309", "1e-999"])
  test(`reject invalid numeric field ${JSON.stringify(value)}`, () => {
    assert.throws(() => parse(`time,x\n0,0\n1,${value}`, units), TrajectoryImportError);
  });
test("do not sort duplicate or decreasing timestamps", () => {
  for (const times of [
    [0, 0],
    [1, 0],
  ])
    reject(`time,x\n${times[0]},0\n${times[1]},1`, "strictly increase");
});
test("irregular timing is retained for inspection but cannot receive a common dt", () => {
  const t = parse("time,x\n0,0\n1,1\n3,2", units);
  assert.equal(t.dt, null);
  assert.match(t.timingIssue, /sampling interval/);
  assert.equal(t.points.length, 3);
});
test("different track sampling intervals are not pooled as equally timed", () => {
  const t = parse("track,time,x\na,0,0\na,1,1\nb,0,1\nb,2,2", units);
  assert.equal(t.dt, null);
});
test("ordinary decimal time roundoff is not a false irregularity", () => {
  const t = parse("time,x\n0,0\n.1,1\n.2,2\n.3,3", units);
  equal(t.dt, 0.1);
});
test("unresolved absolute epochs are not declared exactly spaced", () => {
  const t = parse("time,x\n1000000000000,0\n1000000000001,1", units);
  assert.equal(t.dt, null);
  assert.match(t.timingIssue, /elapsed times/);
});
test("single-point tracks are never silently dropped", () =>
  reject("track,time,x\na,0,0\nb,0,1\nb,1,2", "only one position"));
test("stationary coordinates and zero numeric exponents are not missing data", () => {
  const t = parse("time,x\n0,0e-999\n1,-0.000", units);
  assert.equal(t.increments[0], 0);
});
for (const [csv, reason] of [
  ["time,x,x\n0,0,0\n1,1,1", "Duplicate"],
  ["time,x,z\n0,0,0\n1,1,1", "z requires y"],
  ["time,x,confidence\n0,0,1\n1,1,1", "extra columns"],
  ["time,x\n0,0\n1", "Expected 2 fields"],
  ["time,x\n0,0\n1,1,2", "Expected 2 fields"],
  ['time,x\n0,0\n1,"2', "Unclosed"],
  ['time,x\n0,0\n1,2"', "quote must begin"],
  ['time,x\n0,0\n1,"2"oops', "Unexpected text"],
  ['time,x,track\n0,0,"a\nb"\n1,1,"a\nb"', "printable"],
  ["time,x,track\n0,0,\n1,1,", "1–80"],
])
  test(`fail explicitly: ${reason}`, () => reject(csv, reason));
test("file byte limit accounts for UTF-8, not only JS character count", () => {
  reject("é".repeat(TRAJECTORY_LIMITS.bytes / 2 + 1), "UTF-8 bytes");
});
test("track budget is enforced before analysis", () => {
  const csv =
    "track,time,x\n" + Array.from({ length: 65 }, (_, i) => `${i},0,0\n${i},1,1`).join("\n");
  reject(csv, "64 distinct");
});
test("coordinate budget matches the numerical owner's 10000 limit", () => {
  const csv = "time,x,y,z\n" + Array.from({ length: 3335 }, (_, i) => `${i},0,0,0`).join("\n");
  reject(csv, "10000 displacement");
});
test("SI conversion and subtraction overflow fail loudly", () => {
  reject("time,x\n-1e308,0\n1e308,1", "strictly increase", { time: "s", position: "m" });
  reject("time,x\n0,-1e308\n1,1e308", "displacement exceeds", { time: "s", position: "m" });
  reject("time,x\n0,0\n1,1e-320", "SI units", { time: "s", position: "nm" });
});
test("SI export neutralizes formula-like track IDs and leaves original labels alone", () => {
  const t = parse('track,time,x\n"=HYPERLINK(foo)",0,0\n"=HYPERLINK(foo)",1,2', units);
  assert.equal(trajectorySiCsv(t), "track_id,time_s,x_m\r\n1,0,0\r\n1,1,0.000002\r\n");
  assert.equal(t.points[0].track, "=HYPERLINK(foo)");
});
test("SI exports round-trip with their explicit units and normalized track IDs", () => {
  const original = parse("track,time,x,y\na,0,0,2\nb,0,5,5\na,10,1,3\nb,10,6,7", {
    time: "ms",
    position: "um",
  });
  const imported = parse(trajectorySiCsv(original), { time: "s", position: "m" });
  assert.deepEqual(imported.increments, original.increments);
  assert.equal(imported.dt, original.dt);
  assert.equal(imported.trackCount, 2);
  assert.deepEqual(
    imported.points.map((p) => p.track),
    ["1", "2", "1", "2"],
  );
});
test("SI headers cannot be silently recalibrated with incompatible selected units", () => {
  reject("time_s,x_m\n0,0\n1,1", "requires seconds and metres");
  reject("time_s,x\n0,0\n1,1", "Do not mix", { time: "s", position: "m" });
});
