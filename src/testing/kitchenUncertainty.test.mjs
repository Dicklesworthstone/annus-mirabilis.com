import assert from "node:assert/strict";
import test from "node:test";
import { analyzeKitchen, KITCHEN_OPTIONS } from "../experiments/bm07/kitchen/analyze.ts";
import { parseKitchenCsv, exportKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import { kitchenInputDraft, reviseKitchenInputs } from "../experiments/bm07/kitchen/edit.ts";
import { kitchenAnalysisJson } from "../experiments/bm07/kitchen/export.ts";
import { createKitchenHost } from "../experiments/bm07/kitchen/host.ts";
import { decodeKitchenResponse } from "../experiments/bm07/kitchen/protocol.ts";
import { KITCHEN_UNCERTAINTY_KEYS } from "../experiments/bm07/kitchen/schema.ts";
import { createKitchenSession } from "../experiments/bm07/kitchen/session.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";

const box = {
  radius_um: ".5", radius_provenance: "independent", radius_scale_axis: "independent",
  radius_interval_um: "[.4,.6]", temperature_interval_k: "[290,300]",
  pixels_per_um_x_interval: "[9,11]", pixels_per_um_y_interval: "[9,11]",
  viscosity_interval_mpa_s: "[.9,1.1]", gas_constant_interval: "[8.3144,8.3145]",
  physical_input_coverage: ".975", physical_input_provenance: "Synthetic test premise: complete joint box, not empirical evidence.",
};
const doc = (patch = {}) => parseKitchenCsv(kitchenFixture({ metadata: { ...box, ...patch } }));
const analyze = (d = doc(), patch = {}) => analyzeKitchen(d, { ...KITCHEN_OPTIONS, ...patch });
const output = (a, id) => a.outputs.find(o => o.quantityId === id);
const value = (a, id) => { const o = output(a,id); assert.equal(o.status,"value",JSON.stringify(o)); return o.value; };
const near = (a,b) => assert.ok(withinTolerance(a,b,{relative:1e-12}).ok,`${a} != ${b}`);

test("old CSV observations need no uncertainty fields and never acquire assumed coverage", () => {
  const d = parseKitchenCsv(kitchenFixture()), a = analyze(d);
  for (const key of KITCHEN_UNCERTAINTY_KEYS) assert.equal(d.metadata[key], "");
  assert.equal(a.uncertainty.state,"unavailable");
  assert.equal(a.uncertainty.combinedCoverage,null);
  assert.notEqual(output(a,"combinedMolecularInterval").status,"value");
  assert.deepEqual(parseKitchenCsv(exportKitchenCsv(d)),d);
});

test("a complete joint box allocates a fresh camera interval, not a relabeled conditional one", () => {
  const d=doc(), a=analyze(d), before=JSON.stringify(d);
  assert.equal(a.uncertainty.state,"combined");
  near(a.uncertainty.cameraCoverage,.975);
  assert.ok(a.uncertainty.combinedCoverage>=.95);
  assert.ok(a.uncertainty.combinedCoverage<=a.uncertainty.inputCoverage);
  const conditional=value(a,"diffusionInterval"), allocated=value(a,"combinedSamplingInterval");
  assert.ok(allocated[0]<conditional[0]); assert.ok(allocated[1]>conditional[1]);
  const sensitivity=value(a,"molecularInputRange"), combined=value(a,"combinedMolecularInterval");
  assert.ok(combined[0]<sensitivity[0]); assert.ok(combined[1]>sensitivity[1]);
  assert.equal(a.numberMeaning,"synthetic-recovery");
  assert.equal(JSON.stringify(d),before);
});

for (const coverage of ["", ".9", ".95"]) test(`joint coverage '${coverage}' retains range sensitivity without a confidence claim`, () => {
  const a=analyze(doc({physical_input_coverage:coverage}));
  assert.equal(a.uncertainty.state,"sensitivity");
  assert.equal(a.uncertainty.combinedCoverage,null);
  assert.equal(a.uncertainty.cameraCoverage,null);
  assert.equal(output(a,"molecularInputRange").status,"value");
  assert.notEqual(output(a,"combinedMolecularInterval").status,"value");
});

test("input ranges change neither the pair selection nor any existing point or conditional estimate", () => {
  const d=doc(), a=analyze(d), b=analyze(doc({physical_input_coverage:"",pixels_per_um_x_interval:"[8,12]"}));
  assert.deepEqual(d.points,doc({physical_input_coverage:""}).points);
  for (const id of ["pairs","pairTimes","pairCount","noiseVariance","correctedD","diffusionInterval","molecularNumber","molecularInterval"])
    assert.deepEqual(output(a,id),output(b,id),id);
});

test("same-ruler radius introduces precisely one additional inverse scale factor", () => {
  const independent=analyze(doc({physical_input_coverage:""}));
  const shared=analyze(doc({physical_input_coverage:"",radius_scale_axis:"x"}));
  assert.equal(independent.uncertainty.scaleExponent,-2);
  assert.equal(shared.uncertainty.scaleExponent,-3);
  near(value(shared,"molecularInputRange")[0],value(independent,"molecularInputRange")[0]*.9);
  near(value(shared,"molecularInputRange")[1],value(independent,"molecularInputRange")[1]*1.1);
});

for(const patch of [
  {radius_scale_axis:""}, {radius_scale_axis:"y"},
  {radius_scale_axis:"x",calibration_axes:"x",pixels_per_um_y:"",pixels_per_um_y_interval:""},
  {radius_scale_axis:"x",pixel_aspect_ratio:""}, {radius_provenance:"same-displacements"},
]) test(`unsupported radius/calibration relation stays unavailable: ${JSON.stringify(patch)}`,()=>{
  const a=analyze(doc(patch));
  assert.equal(a.uncertainty.state,"unavailable");
  assert.notEqual(output(a,"combinedMolecularInterval").status,"value");
});

test("uncertainty of a derived axis is not inferred from a point aspect ratio",()=>{
  const a=analyze(doc({calibration_axes:"x",pixels_per_um_y:"",pixels_per_um_y_interval:""}),{axis:"y"});
  assert.equal(a.scaleSource,"derived"); assert.equal(a.uncertainty.state,"unavailable");
  assert.match(a.combinedIntervalReason,/independently calibrated axis/);
});

for(const key of ["radius_interval_um","temperature_interval_k","viscosity_interval_mpa_s","pixels_per_um_x_interval","gas_constant_interval"])
  test(`missing ${key} never turns a standard error or nominal input into exact coverage`,()=>{
    const a=analyze(doc({[key]:""}));
    assert.equal(a.uncertainty.state,"unavailable");
    assert.notEqual(output(a,"molecularInputRange").status,"value");
  });

test("gas-source choices retain modern consistency versus independent experimental interpretation",()=>{
  const measured=analyze(doc({data_origin:"reader-supplied"}));
  assert.equal(measured.numberMeaning,"independent-estimate");
  const modern=analyze(doc({gas_constant_interval:"",data_origin:"reader-supplied"}),{constantSet:"modern-si-2019"});
  assert.equal(modern.uncertainty.state,"combined"); assert.equal(modern.numberMeaning,"consistency-check");
  const falseModern=analyze(doc(),{constantSet:"modern-si-2019"});
  assert.equal(falseModern.uncertainty.state,"unavailable");
  assert.match(falseModern.combinedIntervalReason,/exact/);
  const wrong=analyze(doc({gas_constant_interval:"[1,2]"}));
  assert.equal(wrong.uncertainty.state,"unavailable");
});

for(const patch of [{physical_input_provenance:""},{physical_input_coverage:"2"},
  {pixels_per_um_x_interval:"[11,12]"},{viscosity_interval_mpa_s:"[1,0]"},
  {radius_scale_axis:"__proto__"},{gas_constant_interval:"[0,9]"}])
  test(`malformed or unsupported declaration is refused at CSV admission: ${JSON.stringify(patch)}`,()=>assert.throws(()=>doc(patch)));

for(const defect of ["edge","excluded","missing","irregular"]) test(`even one ${defect} defect withholds combined coverage`,()=>{
  const d=doc(), points=d.points.map((p,i)=>i!==0?p:defect==="edge"?{...p,status:"lost",lossReason:"edge",x:null,y:null}:
    defect==="excluded"?{...p,status:"excluded",exclusionReason:"reader selected this point"}:
    defect==="irregular"?{...p,time:.01}:p);
  const a=analyze({...d,points:defect==="missing"?points.slice(1):points});
  assert.equal(a.uncertainty.state,"unavailable");
  assert.notEqual(output(a,"combinedMolecularInterval").status,"value");
  assert.match(a.combinedIntervalReason,/selection or censoring/);
});

test("zero-containing and empty camera sets cannot produce finite combined molecular bounds",()=>{
  const d=doc();
  for (const amplitude of [6,20]) {
    const points=d.points.map((p,i)=>p.kind==="stationary"?{...p,x:300+(i%2?amplitude:-amplitude)}:p);
    const a=analyze({...d,points});
    assert.notEqual(output(a,"combinedMolecularInterval").status,"value");
    assert.notEqual(a.uncertainty.state,"combined");
  }
});

test("the new declarations are editable and CSV-roundtrip without changing observations or provenance",()=>{
  const d=doc(), draft=kitchenInputDraft(d);
  for(const key of KITCHEN_UNCERTAINTY_KEYS) assert.equal(draft[key],d.metadata[key]);
  const next=reviseKitchenInputs(d,{...draft,physical_input_coverage:"",radius_scale_axis:"x"});
  assert.deepEqual(next.points,d.points); assert.deepEqual(parseKitchenCsv(exportKitchenCsv(next)),next);
  assert.equal(d.metadata.physical_input_coverage,"0.975");
  assert.throws(()=>reviseKitchenInputs(d,{...draft,physical_input_provenance:""}));
});

async function localSession(t, transform=x=>x) {
  const source=`source:sha256:${"c".repeat(64)}`;
  let listener, request, response;
  const host=createKitchenHost(message=>{response=structuredClone(message);listener(transform(structuredClone(message)));},source);
  const session=createKitchenSession("uncertainty-session",()=>({listen(fn){listener=fn;return()=>{};},send(message){request=structuredClone(message);void host.receive(request);},dispose(){host.dispose();}}),source);
  t.after(()=>session.disconnect());
  const wait=predicate=>{
    if(predicate(session.getSnapshot())) return Promise.resolve(session.getSnapshot());
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{off();reject(new Error(session.getSnapshot().message||"timeout"));},3000);
      const off=session.subscribe(()=>{const state=session.getSnapshot();if(predicate(state)){clearTimeout(timer);off();resolve(state);}});
    });
  };
  await session.submit(exportKitchenCsv(doc()));
  const state=await wait(s=>s.view.status==="accepted"||s.view.status==="unavailable");
  return {session,wait,state,source,getRequest:()=>request,getResponse:()=>structuredClone(response)};
}

test("worker, immutable accepted snapshot and receipt retain the same uncertainty allocation",async t=>{
  const f=await localSession(t); assert.equal(f.state.view.status,"accepted",f.state.message);
  const accepted=f.state.accepted, receiptText=kitchenAnalysisJson(accepted,f.source), receipt=JSON.parse(receiptText);
  assert.equal(accepted.report.uncertainty.state,"combined");
  assert.deepEqual(receipt.report.uncertainty,accepted.report.uncertainty);
  assert.deepEqual(parseKitchenCsv(receipt.observationsCsv),accepted.document);
  assert.ok(Object.isFrozen(accepted.report.uncertainty));
  assert.equal(receipt.results.find(o=>o.quantityId==="combinedMolecularInterval").status,"value");
  const draft={...kitchenInputDraft(accepted.document),physical_input_coverage:".9"};
  assert.equal(kitchenAnalysisJson(accepted,f.source),receiptText);
  await f.session.revise(reviseKitchenInputs(accepted.document,draft));
  const next=(await f.wait(s=>s.accepted!==accepted&&s.view.status==="accepted")).accepted;
  assert.equal(next.report.uncertainty.state,"sensitivity"); assert.equal(next.sourceId,accepted.sourceId);
  assert.notEqual(next.documentDigest,accepted.documentDigest); assert.equal(next.snapshot.runId,accepted.snapshot.runId);
  assert.deepEqual(next.document.points,accepted.document.points);
  await f.session.submit("bad csv"); await f.wait(s=>s.view.status==="refused");
  assert.equal(f.session.getSnapshot().accepted,next); assert.equal(kitchenAnalysisJson(accepted,f.source),receiptText);
});

test("the response decoder rejects unsupported coverage, lost evidence and malformed envelopes",async t=>{
  const f=await localSession(t); assert.equal(f.state.view.status,"accepted");
  for(const mutate of [
    a=>a.uncertainty.combinedCoverage=.99,
    a=>a.uncertainty.cameraCoverage=.95,
    a=>a.uncertainty.inputCoverage=1,
    a=>a.uncertainty.state="sensitivity",
    a=>a.uncertainty.scaleExponent=-3,
    a=>a.lostPairs.edge=1,
    a=>a.intervalReasons.push("unverified timing"),
    a=>a.outputs.find(o=>o.quantityId==="combinedMolecularInterval").value=Float64Array.of(1),
    a=>a.outputs.find(o=>o.quantityId==="combinedMolecularInterval").value=Float64Array.of(5,2),
    a=>a.outputs.find(o=>o.quantityId==="combinedSamplingInterval").value=Float64Array.of(0,2),
    a=>a.scaleSource="derived",
    a=>a.scale=1.01e-7,
    a=>a.constantSetId="modern-si-2019",
  ]) {
    const forged=f.getResponse(); mutate(forged.result.analysis);
    assert.throws(()=>decodeKitchenResponse(forged,f.getRequest()));
  }
});
