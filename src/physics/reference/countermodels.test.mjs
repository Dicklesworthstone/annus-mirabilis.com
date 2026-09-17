import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { alignedBoost, composeCollinear, gamma, speedOfLightMetresPerSecond, transformEvent } from "./kinematics.ts";
import { countermodelEventMap, galileanCompose, lorentz1904EventMap, lorentzCompositionResidual,
  mappedClockRate, mappedRodLength, mappedWorldlineSpeed } from "./countermodels.ts";
import { withinTolerance } from "../../units/tolerance.ts";
const c = speedOfLightMetresPerSecond();
const value = (r) => { assert.equal(r.status, "value", r.reason); return r.value; };
const close = (a,b,absolute=1e-12) => assert.ok(withinTolerance(a,b,{absolute,relative:1e-12}).ok, `${a} != ${b}`);
const map = (id) => (e,b,k) => countermodelEventMap(id,e,b,k);

test("low-speed composition retains the cancellation-free residual", () => {
  assert.equal(value(galileanCompose(10,10)),20);
  // 60-digit decimal arithmetic with c=299792458: 2000/(c*c+100).
  const expected = 2.225300112107234388367885457458296632545019973e-14;
  assert.ok(withinTolerance(value(lorentzCompositionResidual(10,10)),expected,{relative:1e-12}).ok);
  assert.notEqual(value(lorentzCompositionResidual(10,10)),20-value(composeCollinear(10/c,10/c))*c);
});
test("signed residual follows the stable owner for opposite and zero velocities", () => {
  assert.ok(value(lorentzCompositionResidual(10,-10)) === 0);
  assert.ok(value(lorentzCompositionResidual(0,10)) === 0);
  assert.ok(value(lorentzCompositionResidual(-10,-10))<0);
});
test("ether and Einstein maps agree at twenty authored events and three boosts", () => {
  const events = Array.from({length:20},(_,i)=>({t:(i-9)/4,x:(i%5-2)*c/3,y:i-7,z:10-i}));
  for (const beta of [.1,.6,.9]) for (const event of events) {
    const ether = value(lorentz1904EventMap(event,beta*c));
    const einstein = value(transformEvent(event,value(alignedBoost(beta))));
    for (const key of ["t","x","y","z"]) close(ether[key],einstein[key],key==="t"?1e-12:1e-6);
  }
});
test("the ether route does not call the Einstein event map", () => {
  const source = readFileSync(new URL("./countermodels.ts",import.meta.url),"utf8");
  const body = source.split("export function lorentz1904EventMap")[1].split("/** Closed owner registry")[0];
  assert.ok(body.includes("galileanMap")); assert.ok(body.includes("gamma("));
  assert.ok(!body.includes("transformEvent") && !body.includes("alignedBoost"));
});
test("light worldline differs under Galilean absolute time", () => {
  close(value(mappedWorldlineSpeed(map("galilean"),c,.6,c)),.4*c,1e-6);
  for (const id of ["lorentz","lorentz-ether"]) close(value(mappedWorldlineSpeed(map(id),c,.6,c)),c,1e-6);
});
test("inverse transformations recover original events for every candidate", () => {
  for (const id of ["galilean","lorentz","lorentz-ether"]) for (const beta of [-.9,0,.6]) {
    const e={t:2,x:1.3*c,y:9,z:-2};
    const back=value(map(id)(value(map(id)(e,beta,c)),-beta,c));
    for (const k of ["t","x","y","z"]) close(back[k],e[k],k==="t"?1e-12:1e-6);
  }
});
test("simultaneous endpoint measurements derive the moving rod length", () => {
  close(value(mappedRodLength(map("galilean"),100,.6,c)),100);
  for(const id of ["lorentz","lorentz-ether"]) close(value(mappedRodLength(map(id),100,.6,c)),80);
});
test("clock rates and collinear composition arise from each candidate's events", () => {
  for(const id of ["lorentz","lorentz-ether"]){
    close(value(mappedClockRate(map(id),.6,c)),.8);
    close(value(mappedWorldlineSpeed(map(id),.6*c,-.6,c))/c,15/17);
  }
});
test("an intentionally first-order local time fails the clock and composition checks", () => {
  const broken=(e,b,k)=>({status:"value",value:{...e,x:value(gamma(b))*(e.x-b*k*e.t),t:e.t-b*e.x/k}});
  assert.ok(!withinTolerance(value(mappedClockRate(broken,.6,c)),.8,{relative:1e-12}).ok);
  assert.ok(!withinTolerance(value(mappedWorldlineSpeed(broken,.6*c,-.6,c))/c,15/17,{relative:1e-12}).ok);
});
test("nonfinite or luminal observer input returns a typed refusal, never numbers", () => {
  for (const v of [c,-c,Infinity,NaN]) {
    assert.equal(lorentz1904EventMap({t:1,x:0,y:0,z:0},v).status,"outside-domain");
    assert.equal(lorentzCompositionResidual(10,v).status,"outside-domain");
    assert.equal(galileanCompose(10,v).status,"outside-domain");
  }
  for(const id of ["galilean","lorentz","lorentz-ether"]){
    assert.equal(countermodelEventMap(id,{t:NaN,x:0,y:0,z:0},.6,c).status,"outside-domain");
    assert.equal(countermodelEventMap(id,{t:1,x:0,y:0,z:0},.6,0).status,"outside-domain");
  }
});
