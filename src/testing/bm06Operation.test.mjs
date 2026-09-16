import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBm06, validateBm06Parameters } from "../workers/operations/bm06.ts";
import { BM06_DEFAULTS as defaults, BM06_OUTPUTS } from "../experiments/bm06/definition.ts";
import { decodeResultBatch, decodeRefusal, decodeOutcome } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { BM06_PARAMETER_CLASSES } from "../experiments/bm06/definition.ts";
const noWait = async () => {};
const run = (patch = {}, extra = {}) => evaluateBm06({ ...defaults, ...patch }, { yieldControl: noWait, ...extra });
const get = (r, id) => { assert.equal(r.kind, "accepted"); return r.data.outputs.find(o => o.quantityId === id); };
const numeric = (r, id) => { const o = get(r, id); assert.equal(o.status, "value"); return o.value; };
const close = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a-b) <= tolerance*Math.max(Math.abs(b), 1e-300), `${a} != ${b}`);

test("BM-06 publishes one complete, typed batch from the real reference owners", async () => {
 const result = await run();
 close(numeric(result, "diffusionCoefficient"), 4.29439564554961453e-13);
 close(numeric(result, "rmsDisplacement1d"), 9.26757319426139146e-7);
 const revisions = { input: 1, observer: 0, measurement: 0, estimator: 0 };
 decodeResultBatch({ revisions, outputs: result.data.outputs }, { expectedRevisions: revisions, allowPartial: true, statuses: Object.fromEntries(Object.entries(BM06_OUTPUTS).map(([k,v]) => [k,v.statuses])) });
 assert.equal(get(result, "gridDensity").status, "not-applicable");
 assert.equal(numeric(result, "positionCoordinate1d").length, numeric(result, "probabilityDensity").length);
});
test("the probability within one RMS is 68.268949%, without conflating it with density", async () => {
 const r = await run(); const rms = numeric(r, "rmsDisplacement1d");
 const inside = await run({ lower: -rms, upper: rms });
 close(numeric(inside, "intervalProbability"), 0.6826894921370859);
});
test("zero-time curve is a point mass and closed endpoints include the atom", async () => {
 for (const [lower, upper, expected] of [[0,0,1],[0,1e-6,1],[1e-9,1e-6,0]]) {
  const r = await run({ t: 0, lower, upper });
  assert.equal(get(r,"probabilityDensity").status,"analytic-limit");
  assert.equal(numeric(r,"intervalProbability"),expected);
 }
 const grid = await run({t:0,gridEnabled:true});
 assert.equal(numeric(grid,"cellMasses").reduce((a,b)=>a+b),1);
 assert.equal(grid.data.stepIndex,0);
});
test("temperature and viscosity comparisons are recomputed by the owners", async () => {
 const base = await run(); const viscous = await run({eta:defaults.eta*2});
 close(numeric(viscous,"rmsDisplacement1d") / numeric(base,"rmsDisplacement1d"), 1/Math.SQRT2);
 const minute = await run({t:60});
 close(numeric(minute,"rmsDisplacement1d") / numeric(base,"rmsDisplacement1d"), Math.sqrt(60));
});
test("strict parameters reject unknown keys, missing values, strings, NaN and reversed intervals", async () => {
 for (const p of [{...defaults, rogue:1},{...defaults,T:undefined},{...defaults,T:"293"},{...defaults,t:NaN},{...defaults,t:-1},{...defaults,lower:2,upper:1},{...defaults,n:4.5}]) {
  const r=validateBm06Parameters(p); assert.equal(r.kind,"refused"); decodeRefusal(r.refusal);
 }
 let accessed=false; const p={...defaults}; Object.defineProperty(p,"T",{get(){accessed=true;return 293;},enumerable:true});
 assert.equal(validateBm06Parameters(p).kind,"refused"); assert.equal(accessed,false);
});
test("a stability refusal offers a steps repair that really succeeds", async () => {
 const refused=await run({gridEnabled:true,steps:1});
 assert.equal(refused.kind,"refused"); decodeRefusal(refused.refusal);
 assert.equal(refused.refusal.code,"ftcs-unstable");
 const repair=refused.refusal.rankedRepairs[0].action;
 assert.equal(repair.parameterId,"steps");
 const fixed=await run({gridEnabled:true,steps:repair.value});
 assert.equal(fixed.kind,"accepted"); assert.ok(numeric(fixed,"stabilityRatio")<=0.5);
});
test("FTCS is chunk-size invariant and conserves mass", async () => {
 const a=await run({gridEnabled:true},{chunkSteps:1});
 const b=await run({gridEnabled:true},{chunkSteps:128});
 assert.deepEqual(numeric(a,"gridDensity"),numeric(b,"gridDensity"));
 close(numeric(a,"cellMasses").reduce((a,b)=>a+b),1);
 assert.equal(a.data.stepIndex,defaults.steps);
});
test("cancellation is observed at a chunk boundary; budgets never become physics refusals", async () => {
 let chunks=0;
 const stopped=await run({gridEnabled:true},{chunkSteps:10,cancelled:()=>chunks===2,yieldControl:async()=>{chunks++;}});
 assert.equal(stopped.kind,"outcome"); assert.equal(stopped.outcome.outcome,"cancelled"); assert.equal(chunks,2);
 const huge=await run({gridEnabled:true,n:4097,steps:4000000});
 assert.equal(huge.kind,"outcome"); assert.equal(huge.outcome.outcome,"budget-exhausted"); decodeOutcome(huge.outcome);
});
test("a real lab result and refusal obey the existing accepted-state store", async () => {
 const store=createInstanceStore({experimentId:"bm-06",instanceId:"test",initialParameters:defaults,parameterClasses:BM06_PARAMETER_CLASSES,outputs:BM06_OUTPUTS,allowPartial:true});
 let token=store.issue("setup-change"); const r=await run();
 assert.equal(store.publish({...token,...r.data,final:true}).accepted,true);
 const snapshot=store.getSnapshot().accepted;
 token=store.issue("setup-change",{gridEnabled:true,steps:1});
 const bad=await run({gridEnabled:true,steps:1});
 assert.equal(store.refuse(token,bad.refusal).accepted,true);
 assert.equal(store.getSnapshot().accepted,snapshot);
 assert.equal(store.getSnapshot().requested.parameters.steps,1);
});
