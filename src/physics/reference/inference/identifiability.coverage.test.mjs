import assert from "node:assert/strict";
import test from "node:test";
import { createPhiloxStream } from "../philox.ts";
import { estimateIncrements, estimatorInterval, invertToMolecularNumber } from "../inference.ts";
import { INFERENCE_CONSTANTS } from "./synthetic.ts";
import { conditionalMolecularNumberInterval } from "./identifiability.ts";

// Prespecified, not selected after looking at coverage: 10,000 repetitions; M=50
// one-coordinate Gaussian increments; dt=1 s; D=0.4e-12 m²/s. Independently measured
// radius is lognormal with log SD .30. Its 97.5% interval uses z_.9875 below.
// Require coverage >= .9428 (95% - 3.29 binomial standard errors). A deliberately
// invalid comparison treats the noisy radius as exact; its coverage must be <.94.
// The independent test streams and seed are fixed; no reruns or seed search.
const SETTINGS=Object.freeze({trials:10000,M:50,seed:"1837329",D:.4e-12,dt:1,a:.5e-6,T:293.15,eta:.001,logSd:.30,z:2.241402727604947});
const take=(result)=>{assert.equal(result.kind,"accepted");return result.data;};
test("independent-radius Bonferroni coverage, with an adverse false-exactness comparison",()=>{
 const p=SETTINGS;
 const displacement=createPhiloxStream({seed:p.seed,kernel:707,tile:0});
 const radiusNoise=createPhiloxStream({seed:p.seed,kernel:707,tile:1});
 const conditions={T:p.T,eta:p.eta,a:p.a,radiusProvenance:"independently-declared",synthetic:true};
 const target=take(invertToMolecularNumber({...conditions,dHat:p.D,interval:{lower:p.D,upper:p.D,coverage:.95,q:p.M,uncertaintyKind:"statistical-interval",coverageKind:"exact",estimatorId:"independent-increment-known-zero-drift"}},INFERENCE_CONSTANTS)).estimate;
 let conservative=0,invalidExact=0;
 for(let trial=0;trial<p.trials;trial++) {
  const increments=Float64Array.from({length:p.M},()=>Math.sqrt(2*p.D*p.dt)*displacement.nextNormal());
  const estimate=take(estimateIncrements(increments,p.dt,1,"independent-increment-known-zero-drift"));
  const measured=p.a*Math.exp(p.logSd*radiusNoise.nextNormal());
  const interval=take(conditionalMolecularNumberInterval({...conditions,estimate,alpha:.05,
   radius:{value:measured,interval:{lower:measured*Math.exp(-p.z*p.logSd),upper:measured*Math.exp(p.z*p.logSd),coverage:.975},provenance:"Independent synthetic lognormal calibration"}},INFERENCE_CONSTANTS));
  if(interval.lower<=target&&target<=interval.upper) conservative++;
  const naive=take(invertToMolecularNumber({...conditions,a:measured,dHat:estimate.dHat,interval:take(estimatorInterval(estimate,.05))},INFERENCE_CONSTANTS));
  if(naive.interval.lower<=target&&target<=naive.interval.upper) invalidExact++;
 }
 console.log(JSON.stringify({test:"independent-radius-coverage",...p,conservative,invalidExact,minimum:.9428,invalidMaximum:.94}));
 assert.ok(conservative/p.trials>=.9428,`Coverage ${conservative/p.trials} below prespecified .9428`);
 assert.ok(invalidExact/p.trials<.94,`Adverse false-exactness fixture did not expose its flaw: ${invalidExact/p.trials}`);
});
