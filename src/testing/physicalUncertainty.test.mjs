import assert from "node:assert/strict";
import test from "node:test";
import { allocateJointInputCoverage, cameraMolecularInputEnvelope } from "../physics/reference/inference/physicalUncertainty.ts";
import { getConstantSet, constantValue } from "../physics/reference/constants.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { invertToMolecularNumber } from "../physics/reference/inference.ts";
import { disjointPairsKnownNoiseInterval, stationaryClickNoiseEstimate } from "../physics/reference/inference/observation.ts";
const set = getConstantSet("modern-si-2019"), R = constantValue(set,"molarGasConstant").value;
const interval = { lower: 1e-12, upper: 2e-12, q: 20, coverage: .95, coverageKind: "conservative",
  estimatorId: "test camera interval", uncertaintyKind: "statistical-interval" };
const box = () => ({ nominalScale: 1e-7, scale: [1e-7,1e-7], radius: [5e-7,5e-7],
  temperature: [293.15,293.15], viscosity: [.001,.001], gasConstant: [R,R], radiusCalibration: "independent-length" });
const value = r => { assert.equal(r.kind,"accepted",JSON.stringify(r)); return r.data; };
const near = (a,b) => assert.ok(withinTolerance(a,b,{relative:1e-12}).ok,`${a} != ${b}`);

test("singleton input box reproduces the existing inversion owner",()=>{
 const b=box(), a=value(cameraMolecularInputEnvelope(interval,b,set,false));
 const original=value(invertToMolecularNumber({dHat:1.5e-12,interval,T:293.15,eta:.001,a:5e-7,radiusProvenance:"independently-declared",synthetic:false},set));
 near(a.lower,original.interval.lower); near(a.upper,original.interval.upper);
 assert.equal(a.scaleExponent,-2);
});
for(const [mode,power] of [["independent-length",2],["same-axis",3]]) test(`${mode}: the shared scale has the correct exponent`,()=>{
 const b=box(), baseline=value(cameraMolecularInputEnvelope(interval,b,set,false));
 b.radiusCalibration=mode; b.scale=[b.nominalScale/2,b.nominalScale*2];
 const changed=value(cameraMolecularInputEnvelope(interval,b,set,false));
 near(changed.lower,baseline.lower/2**power); near(changed.upper,baseline.upper*2**power);
 assert.equal(changed.scaleExponent,-power);
});
for(const mode of ["independent-length","same-axis"]) test(`${mode}: every corner lies in the monotone envelope, including correlated corners`,()=>{
 const b=box(); Object.assign(b,{scale:[.8e-7,1.2e-7],radius:[4e-7,7e-7],temperature:[285,310],viscosity:[.0008,.0014],gasConstant:[R*.98,R*1.02],radiusCalibration:mode});
 const e=value(cameraMolecularInputEnvelope(interval,b,set,false));
 for(const s of b.scale) for(const a0 of b.radius) for(const T of b.temperature) for(const eta of b.viscosity) for(const gas of b.gasConstant) for(const D0 of [interval.lower,interval.upper]) {
  const D=D0*(s/b.nominalScale)**2, a=a0*(mode==="same-axis" ? s/b.nominalScale : 1);
  const N=gas*T/(6*Math.PI*eta*a*D);
  assert.ok((N>=e.lower || withinTolerance(N,e.lower,{relative:1e-12}).ok) &&
    (N<=e.upper || withinTolerance(N,e.upper,{relative:1e-12}).ok));
 }
});
test("the allocated camera error plus joint input error does not exceed target error",()=>{
 for(const target of [.5,.9,.95,.99,.999]) for(const input of [target+.00001,1]) {
  const a=value(allocateJointInputCoverage(target,input));
  assert.ok(a.alphaCamera+(1-input)<=1-target); assert.ok(a.coverageLowerBound>=target);
  near(a.cameraCoverage,1-a.alphaCamera);
 }
});
for(const input of [null,.8,.95,.95000000001]) test(`no coverage is manufactured from ${input}`,()=>{
 assert.equal(allocateJointInputCoverage(.95,input).kind,"no-value");
});
for(const input of [-1,0,1.1,NaN,Infinity]) test(`invalid coverage ${input} is refused`,()=>{
 assert.equal(allocateJointInputCoverage(.95,input).kind,"refused");
});
for(const target of [0,.499,1,NaN]) test(`invalid target ${target} is refused`,()=>{
 assert.equal(allocateJointInputCoverage(target,1).kind,"refused");
});
for(const [key,range] of [["radius",[0,1]],["temperature",[300,290]],["gasConstant",[1,2]],["scale",[2e-7,3e-7]],["viscosity",[NaN,1]],["scale",[1e-7]],["radius",null]]) test(`invalid ${key} range is refused`,()=>{
 assert.equal(cameraMolecularInputEnvelope(interval,{...box(),[key]:range},set,false).kind,"refused");
});
test("zero diffusion and empty sets never turn into bounded positive intervals",()=>{
 assert.equal(cameraMolecularInputEnvelope({...interval,lower:0},box(),set,false).kind,"no-value");
 for(const d of [null,{...interval,upper:-1},{...interval,lower:-1},{...interval,upper:0}]) assert.notEqual(cameraMolecularInputEnvelope(d,box(),set,false).kind,"accepted");
});
test("changing a source or range cannot silently import another gas constant",()=>{
 const measured=getConstantSet("scenario-gas-constant-measured");
 assert.equal(cameraMolecularInputEnvelope(interval,box(),measured,false).kind,"refused");
 const b=box(); b.gasConstant=[8.3144,8.3145];
 assert.equal(cameraMolecularInputEnvelope(interval,b,measured,false).kind,"accepted");
});
test("camera bounds really scale quadratically, including estimated localization error",()=>{
 const pixels=Float64Array.from({length:80},(_,i)=>i*.4+Math.sin(i*7)*10);
 const clicks=Float64Array.from({length:30},(_,i)=>.2*Math.sin(i*3));
 function camera(s) { const noise=value(stationaryClickNoiseEstimate(Float64Array.from(clicks,x=>x*s),{d:1})); return value(disjointPairsKnownNoiseInterval({positions:Float64Array.from(pixels,x=>x*s),dt:1,exposure:.5,d:1,alpha:.01,noise:{kind:"stationary-clicks",estimate:noise}})); }
 const a=camera(1e-7), b=camera(2e-7);
 near(b.interval.lower,a.interval.lower*4); near(b.interval.upper,a.interval.upper*4);
 near(b.estimate,a.estimate*4); assert.equal(a.coverageKind,"conservative");
});
test("overflow/underflow does not publish clamped endpoints",()=>{
 for(const scale of [[1e-300,1e-7],[1e-7,1e300]]) {
  assert.equal(cameraMolecularInputEnvelope(interval,{...box(),scale},set,false).kind,"refused");
 }
});
