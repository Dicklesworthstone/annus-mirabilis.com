import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraMoments, covarianceEstimator, bartlettBandsMA1, stationaryClickNoiseEstimate, disjointPairsKnownNoiseInterval } from '../physics/reference/inference/observation.ts';
const data = x => {assert.equal(x.kind,'accepted',JSON.stringify(x)); return x.data;};
const near = (a,b,t=1e-11) => assert.ok(Math.abs(a-b)<=t*Math.max(Math.abs(b),1e-300),`${a} != ${b}`);
const p={D:.42944e-12,dt:1,exposure:.5,sigma:.05e-6,drift:0,d:1};
test('camera moments reproduce the independent Berglund fixture and cancellation identity',()=>{
 const m=data(cameraMoments(p)); near(m.variance,.7207333333333333e-12);near(m.covariance,.06907333333333333e-12);near(m.naiveExpectation,.36036666666666665e-12);
 for(const exposure of [0,.25,.5,1])for(const sigma of [0,.05e-6,.2e-6,.5e-6]){const x=data(cameraMoments({...p,exposure,sigma}));near(x.variance+2*x.covariance,2*p.D*p.dt);}
});
test('noise and one-axis drift have distinct predicted effects in one and two coordinates',()=>{
 const m=data(cameraMoments({...p,exposure:0}));near(m.covariance,-.0025e-12);near(m.naiveExpectation,.43194e-12);
 near(data(cameraMoments({...p,drift:.1e-6})).naiveExpectation-data(cameraMoments(p)).naiveExpectation,.005e-12);
 near(data(cameraMoments({...p,d:2,drift:.1e-6})).naiveExpectation-data(cameraMoments(p)).naiveExpectation,.0025e-12);
});
test('camera speed crossover and zero-noise limits are not physical velocities',()=>{
 for(const dt of [4,1,.25,.0625,.01,.0025]){
  const m=data(cameraMoments({...p,exposure:0,sigma:.2e-6,dt}));near(m.apparentSpeedRatio,Math.sqrt(1+.04/(.42944*dt)));near(m.crossover,.04/.42944);
  const ideal=data(cameraMoments({...p,exposure:0,sigma:0,dt}));assert.equal(ideal.measuredApparentSpeed,ideal.idealApparentSpeed);assert.equal(ideal.crossover,null);
 }
 assert.equal(data(cameraMoments(p)).crossover,null);
});
test('invalid camera domains do not turn into plausible zeros',()=>{
 for(const patch of [{dt:0},{D:0},{sigma:-1},{exposure:2},{d:3},{drift:NaN},{D:Infinity}])assert.notEqual(cameraMoments({...p,...patch}).kind,'accepted');
});
test('CVE uses neighboring increments with distinct denominators and retains negative diagnostics',()=>{
 const x=Float64Array.of(1,2,3);const m=data(covarianceEstimator(x,1,{d:1,exposure:0}));near(m.variance,14/3);near(m.covariance,4);near(m.D,19/3);near(m.sigma2,-4);
 assert.notEqual(covarianceEstimator(Float64Array.of(1,2),1,{d:1,exposure:0}).kind,'accepted');
 const a=data(covarianceEstimator(Float64Array.of(3,4,5),1,{d:1,exposure:0,knownDrift:2}));assert.deepEqual(a,m);
});
test('Bartlett bands distinguish signed covariance from a diffusivity interval',()=>{
 const m=data(cameraMoments(p)),b=data(bartlettBandsMA1(m.variance,m.covariance,20000));near(b.sdVariance,Math.sqrt(2*(m.variance**2+2*m.covariance**2)/20000));near(data(bartlettBandsMA1(m.variance,m.covariance,20000,2)).sdCovariance,b.sdCovariance/Math.sqrt(2));
});
test('stationary clicks fit one unknown position per coordinate',()=>{
 const n=data(stationaryClickNoiseEstimate(Float64Array.of(1,9,2,10,3,11,4,12,5,13),{d:2}));near(n.sigma2,2.5);assert.equal(n.q,8);
 assert.notEqual(stationaryClickNoiseEstimate(Float64Array.of(1,2,3,4),{d:1}).kind,'accepted');
});
function pairPositions(K,scale=1,drift=0){const x=new Float64Array(K*2);for(let k=0;k<K;k++){x[2*k]=100*k;x[2*k+1]=100*k+scale*(k%2?1:-1)+drift;}return x;}
test('disjoint pairs use only non-shared endpoints and fit drift without truth',()=>{
 const x=pairPositions(6,2,9),a=data(disjointPairsKnownNoiseInterval({positions:x,dt:1,exposure:0,d:1,alpha:.05,noise:{kind:'exact',sigma2:.25}}));
 assert.equal(a.pairs,6);assert.equal(a.q,5);near(a.estimate,(24/5-.5)/2);assert.equal(a.coverageKind,'exact');assert.ok(a.interval.upper>a.interval.lower);
 const y=data(disjointPairsKnownNoiseInterval({positions:pairPositions(6,2,0),dt:1,exposure:0,d:1,alpha:.05,noise:{kind:'exact',sigma2:.25}}));assert.deepEqual(a,y);
});
test('empty physical confidence sets are retained as misses, not made positive',()=>{
 const e=data(disjointPairsKnownNoiseInterval({positions:pairPositions(4,0),dt:1,exposure:0,d:1,alpha:.05,noise:{kind:'exact',sigma2:1}}));assert.equal(e.empty,true);assert.equal(e.interval,null);assert.equal(e.estimate,-1);
});
test('estimated-noise intervals explicitly use a conservative split and reject wrong click degrees',()=>{
 const args={positions:pairPositions(6,2),dt:1,exposure:.5,d:1,alpha:.05};
 const e=data(disjointPairsKnownNoiseInterval({...args,noise:{kind:'stationary-clicks',estimate:{sigma2:.25,q:19,clicks:20,d:1}}}));assert.equal(e.coverageKind,'conservative');assert.equal(e.coverage,.95);assert.ok(e.noiseInterval[1]>.25);
 assert.notEqual(disjointPairsKnownNoiseInterval({...args,noise:{kind:'stationary-clicks',estimate:{sigma2:.25,q:20,clicks:20,d:1}}}).kind,'accepted');
 assert.notEqual(disjointPairsKnownNoiseInterval({...args,noise:{kind:'exact',sigma2:.25},equalSpacing:false}).kind,'accepted');
});
