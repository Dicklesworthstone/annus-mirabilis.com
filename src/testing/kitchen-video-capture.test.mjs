import assert from "node:assert/strict";
import test from "node:test";
import { appendVideoPoint, calibrateVideoAxis, checkVideoFile, frameStamp, sourcePoint, startCapture,
  videoCaptureJson, videoDocument, videoGeometry } from "../experiments/bm07/kitchen/videoCapture.ts";
import { KITCHEN_VIDEO_LIMITS } from "../experiments/bm07/kitchen/definition.ts";
import { exportKitchenCsv, parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import { analyzeKitchen } from "../experiments/bm07/kitchen/analyze.ts";
import { KITCHEN_OPTIONS } from "../experiments/bm07/kitchen/definition.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";
const take = result => { assert.equal(result.kind, "ready", result.message); return result.value; };
const g = () => take(videoGeometry(640, 480, 60));
const frame = (time = 0, requested = time, counter = time + 1, id = time + 1) => take(frameStamp(requested, time, counter, 30, id, 60));
function calibrated(axis = "x") {
  let s = take(startCapture(g(), 30, "1"));
  for (const mark of ["a", "b"]) for (const delta of [-1, 0, 1])
    s = take(appendVideoPoint(s, frame(), `${axis}-${mark}`, axis === "x" ? (mark === "a" ? 100 : 300) + delta : 50,
      axis === "y" ? (mark === "a" ? 100 : 300) + delta : 50));
  return take(calibrateVideoAxis(s, axis, 20));
}
function observations() {
  let s = calibrated();
  for (let n = 0; n < 20; n++) s = take(appendVideoPoint(s, frame(), "stationary", 200 + (n % 2 ? 1 : -1), 100));
  for (let n = 0; n < 20; n++) s = take(appendVideoPoint(s, frame(n), "particle", 100 + [0, 20, 10, 40][n % 4], 50));
  return s;
}
for (const bytes of [0, -1, NaN, Infinity, 1.5, KITCHEN_VIDEO_LIMITS.fileBytes + 1])
  test(`file limit refuses ${bytes}`, () => assert.equal(checkVideoFile(bytes).kind, "refused"));
test("file admission uses injectable limits without allocating a large fixture", () => {
  assert.equal(checkVideoFile(8, { ...KITCHEN_VIDEO_LIMITS, fileBytes: 8 }).kind, "ready");
  const r = checkVideoFile(9, { ...KITCHEN_VIDEO_LIMITS, fileBytes: 8 });
  assert.equal(r.refusal.code, "invalid-parameter"); assert.equal(r.refusal.details.measured, 9);
  assert.equal(r.refusal.details.limit, 8);
});
for (const args of [[4097,480,20],[640,4097,20],[0,480,20],[640,480,601],[640,480,Infinity],[640,480,0],[1.1,1,1]])
  test(`metadata refuses ${args}`, () => assert.equal(videoGeometry(...args).kind, "refused"));
test("bounded canvas coordinates round-trip independently on both axes", () => {
  const a = take(videoGeometry(4096, 2731, 600));
  assert.equal(a.canvasWidth, 1920); assert.ok(a.canvasHeight <= 1920);
  const b = take(sourcePoint(a, 192, 93, 384, 186));
  assert.equal(b.x, 2048); assert.equal(b.y, 1365.5);
  assert.deepEqual(b, take(sourcePoint(a, 96, 46.5, 192, 93)));
  assert.equal(sourcePoint(a, -1, 0, 100, 100).kind, "refused");
  assert.equal(sourcePoint(a, 10, 0, 0, 100).kind, "refused");
});
for (const fps of [0, NaN, 10001]) test(`invalid frame rate ${fps}`, () => assert.equal(startCapture(g(), fps, "1").kind, "refused"));
test("sampling is a declaration, not a timestamp repair", () => {
  assert.equal(startCapture(g(), 30, "0.25").kind, "refused");
  const f = frame(1.2, 1, 8, 2);
  assert.equal(f.time, 1.2); assert.equal(f.stamp.requestedTime, 1);
  assert.equal(f.stamp.timingSource, "frame-callback-adjusted");
  assert.equal(frame(1.01, 1, 8, 2).stamp.timingSource, "frame-callback");
  assert.equal(frame(1.2, 1, null, 2).stamp.timingSource, "declared-rate");
});
for (const args of [[0,NaN,1,30,1,60],[0,0,-1,30,1,60],[0,0,1,30,2001,60],[0,61,1,30,1,60]])
  test(`invalid frame identity ${args}`, () => assert.equal(frameStamp(...args).kind, "refused"));
test("calibration needs repeated independent clicks on both marks", () => {
  let s = take(startCapture(g(), 30, "1"));
  assert.equal(calibrateVideoAxis(s, "x", 20).kind, "refused");
  for (let i=0;i<2;i++) s=take(appendVideoPoint(s,frame(),"x-a",100,50));
  assert.equal(calibrateVideoAxis(s,"x",20).kind,"refused");
  s=calibrated(); assert.equal(s.calibration.x.pixelsPerUm,10);
  assert.ok(Math.abs(s.calibration.x.standardUncertainty - Math.sqrt(2/3)/20) < 1e-14);
  assert.equal(s.calibration.y, undefined);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.points) && Object.isFrozen(s.calibration.x));
});
test("repeated same-frame stationary and micrometer clicks round-trip with genuine times", () => {
  const s=observations(), d=take(videoDocument(s,"0"));
  const restored=parseKitchenCsv(exportKitchenCsv(d));
  assert.deepEqual(restored,d);
  assert.equal(restored.points.filter(p=>p.kind==="stationary").length,20);
  assert.ok(restored.points.filter(p=>p.kind!=="particle").every(p=>p.time===0));
  assert.equal(restored.points[0].capture.presentedFrames,1);
});
test("new video CSV uses the real camera inference and never supplies guessed physical inputs", () => {
  const doc=take(videoDocument(observations(),"0"));
  const a=analyzeKitchen(doc,KITCHEN_OPTIONS);
  assert.equal(a.counts.retainedPairs,10); assert.equal(a.counts.stationary,20);
  assert.equal(a.outputs.find(o=>o.quantityId==="correctedD").status,"value");
  assert.equal(a.outputs.find(o=>o.quantityId==="molecularNumber").status,"underdetermined");
  assert.equal(doc.metadata.radius_um,""); assert.equal(doc.metadata.viscosity_mpa_s,"");
  assert.equal(doc.metadata.temperature_k,""); assert.equal(doc.metadata.pixel_aspect_ratio,"");
  assert.equal(doc.metadata.constant_set_id,"modern-si-2019");
  const y=analyzeKitchen(doc,{...KITCHEN_OPTIONS,axis:"y"});
  assert.equal(y.scaleSource,"unknown");
});
test("an omitted exposure is not silently an instantaneous camera", () => {
  const a=analyzeKitchen(take(videoDocument(observations())),KITCHEN_OPTIONS);
  assert.equal(a.outputs.find(o=>o.quantityId==="diffusionInterval").status,"not-applicable");
  assert.ok(a.intervalReasons.some(s=>s.includes("exposure")));
});
test("invalid exposure and unknown calibration preserve the raw recording", () => {
  const s=observations(), before=videoCaptureJson(s);
  assert.equal(videoDocument(s,"nonsense").kind,"refused");
  assert.equal(videoDocument(s,"2").kind,"refused");
  assert.equal(videoCaptureJson(s),before);
  assert.equal(videoDocument(take(startCapture(g(),30,"1"))).kind,"refused");
});
test("tracking locks calibration and forbids duplicate-time particle positions", () => {
  const s=take(appendVideoPoint(calibrated(),frame(),"particle",10,20));
  assert.equal(calibrateVideoAxis(s,"x",40).kind,"refused");
  assert.equal(appendVideoPoint(s,frame(),"x-a",10,20).kind,"refused");
  assert.equal(appendVideoPoint(s,frame(),"particle",20,30).kind,"refused");
  assert.equal(s.calibration.x.pixelsPerUm,10);
});
test("losing a particle preserves the row and requires an identity decision", () => {
  let s=take(appendVideoPoint(calibrated(),frame(),"particle",10,20));
  s=take(appendVideoPoint(s,frame(1),"particle",10,20,"p","edge"));
  assert.equal(s.points.at(-1).x,null);
  assert.equal(appendVideoPoint(s,frame(2),"particle",20,20,"p").kind,"refused");
  s=take(appendVideoPoint(s,frame(2),"particle",20,20,"p","","new-object"));
  const d=take(videoDocument(s)); assert.equal(d.points.at(-1).identityDecision,"new-object");
});
test("raw recovery JSON carries no media bytes, pixels, blob URL or file name", () => {
  const payload=JSON.parse(videoCaptureJson(observations()));
  assert.equal(payload.coordinateSpace,"browser-oriented-intrinsic-pixels");
  assert.deepEqual(Object.keys(payload),["format","coordinateSpace","acquisition","geometry","fps","interval","calibration","points"]);
});
test("old classroom observations keep their twelve-column contract", () => {
  const d=parseKitchenCsv(kitchenFixture()); const csv=exportKitchenCsv(d);
  assert.ok(!csv.includes("requested_time_s")); assert.deepEqual(parseKitchenCsv(csv),d);
});
test("malformed optional stamp, counter and formula text are rejected", () => {
  const csv=exportKitchenCsv(take(videoDocument(observations(),"0")));
  for (const change of [s=>s.replace(",frame-callback,1,1",",frame-callback,,1"),
    s=>s.replace(",frame-callback,1,1",",declared-rate,1,1"),
    s=>s.replace(",frame-callback,1,1",",frame-callback,1,2001"),
    s=>s.replace("requested_time_s","arbitrary_payload")]) assert.throws(()=>parseKitchenCsv(change(csv)));
});
test("capture provenance cannot attach conflicting evidence to the same acquired frame", () => {
  const d=take(videoDocument(observations(),"0"));
  const p=d.points.find(p=>p.kind==="particle" && p.time===1);
  const altered={...d,points:d.points.map(q=>q===p?{...q,capture:{...q.capture,frameId:1}}:q)};
  assert.throws(()=>exportKitchenCsv(altered),/conflicting/);
});
test("skipped compositor counts survive export and withhold interval coverage", () => {
  const d=take(videoDocument(observations(),"0"));
  const changed={...d,points:d.points.map(p=>p.time>0?{...p,capture:{...p.capture,presentedFrames:p.capture.presentedFrames+2}}:p)};
  const restored=parseKitchenCsv(exportKitchenCsv(changed));
  const analysis=analyzeKitchen(restored,KITCHEN_OPTIONS);
  assert.ok(analysis.warnings.some(w=>w.includes("2 additional frames")));
  assert.equal(analysis.outputs.find(o=>o.quantityId==="diffusionInterval").status,"not-applicable");
});
