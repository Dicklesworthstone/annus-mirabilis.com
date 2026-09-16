import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coinWalkDistribution, kernelMoments, kernelDiffusivity, continuumLimit, randomWalkMoments, kolmogorovShapeTerm, kolmogorovDistanceToGaussian, dkwBound, uniformSumDistribution, WALK_KERNELS } from '../physics/reference/diffusion/walkLaws.ts';
import { decodeResult } from '../experiments/results/codec.ts';
import { BM05_ALLOCATION } from '../experiments/streams/allocation.ts';
const accepted=r=>{assert.equal(r.kind,'accepted',JSON.stringify(r));return r.data;};
const scalar=r=>{decodeResult(r);assert.equal(r.status,'value');assert.equal(typeof r.value,'number');return r.value;};
const close=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
test('step kernels preserve the second moment but not the fourth moment',()=>{
 for(const [kind,factor,kurtosis] of [['coin',1,-2],['uniform',1.8,-1.2],['gaussian',3,0]]){
  const k={kind,stepRms:2},m=kernelMoments(k),D=kernelDiffusivity(k,.1);
  assert.equal(scalar(m.mean),0);assert.equal(scalar(m.secondMoment),4);assert.equal(scalar(m.variance),4);close(scalar(m.fourthMoment),16*factor);assert.equal(WALK_KERNELS[kind].excessKurtosis,kurtosis);assert.equal(scalar(D.diffusion),20);
 }
});
test('kernel ids and stream allocation agree with the checked binding document',()=>{
 const binding=readFileSync(new URL('../../docs/FRANKENSIM_BINDING.md',import.meta.url),'utf8');
 const block=binding.match(/```kernel-resolution\n([\s\S]*?)```/)[1];
 assert.match(block,/resolution: distinct-meaning/);assert.equal(WALK_KERNELS.gaussian.stepKernel,3);assert.equal(WALK_KERNELS.coin.stepKernel,0);assert.equal(WALK_KERNELS.uniform.stepKernel,1);
 assert.match(block,/id: 2\n    name: unit-gaussian-teaching/);assert.match(block,/id: 3\n    name: gaussian-exact-D/);
 assert.match(binding,/bm-05\.walk\.v1[^\n]*0x19050001[^\n]*tile = j/);assert.equal(BM05_ALLOCATION.streamKernelId,0x19050001);
});
test('four coin steps have exact integer coefficients and discrete support',()=>{
 const d=accepted(coinWalkDistribution(4,1));assert.deepEqual([...d.positions],[-4,-2,0,2,4]);assert.deepEqual(d.coefficients,['1','4','6','4','1']);assert.equal(d.denominator,'16');assert.deepEqual([...d.probabilities],[1,4,6,4,1].map(x=>x/16));
 const z=accepted(coinWalkDistribution(0,1));assert.deepEqual([...z.probabilities],[1]);
 for(const n of [16,64,400,10000]){const x=accepted(coinWalkDistribution(n,1));close(x.probabilities.reduce((a,b)=>a+b),1);close(x.probabilities.reduce((sum,p,k)=>sum+p*x.positions[k]**2,0),n,1e-11);}
});
test('shape terms match independently evaluated binomial and high-precision uniform fixtures',()=>{
 for(const [n,coin,uniform] of [[1,.341344746068543,.0572067211769904],[4,.1875,.0073842319360238],[16,.0981903076171875,.0017440682988787],[64,.0496733768739834,.0004316075946803],[400,.0199346509818965,.0000688608203641]]){
  close(accepted(kolmogorovShapeTerm('coin',n)).distance,coin,2e-13);close(accepted(kolmogorovShapeTerm('uniform',n)).distance,uniform,2e-13);assert.equal(accepted(kolmogorovShapeTerm('gaussian',n)).distance,0);
 }
 assert.equal(kolmogorovShapeTerm('uniform',401).kind,'outcome');assert.equal(kolmogorovShapeTerm('coin',0).kind,'refused');
});
test('uniform CDF/PDF recurrence agrees with independent SciPy fixtures, including knots',()=>{
 const f=JSON.parse(readFileSync(new URL('./walk-law-fixtures.json',import.meta.url),'utf8'));
 for(const row of f.rows){const r=uniformSumDistribution(row.n,row.x);close(r.cdf,row.cdf,1e-13);close(r.pdf,row.pdf,1e-13);}
 assert.throws(()=>uniformSumDistribution(401,1));assert.throws(()=>uniformSumDistribution(2,NaN));
});
test('empirical Kolmogorov calculation checks both limits at repeated observations without mutation',()=>{
 const samples=new Float64Array([-2,0,0,0,2]),copy=samples.slice();close(accepted(kolmogorovDistanceToGaussian(samples,1)),.3);assert.deepEqual(samples,copy);
 assert.equal(kolmogorovDistanceToGaussian(samples,0).kind,'refused');close(accepted(dkwBound(2000,.001)),.04359157733881077);
});
test('analytical deviations distinguish drift, infinite variance, and the wrong continuum limit',()=>{
 const k={kind:'biased-coin',stepRms:.5e-6,probability:.6},m=kernelMoments(k),D=kernelDiffusivity(k,.1);
 close(scalar(m.mean)*1e6,.1);assert.equal(D.diffusion.status,'outside-domain');close(scalar(D.drift)*1e6,1);close(scalar(D.centeredDiffusion)*1e12,1.2);
 const heavy=kernelDiffusivity({kind:'cauchy',scale:1},.1);assert.equal(heavy.diffusion.status,'outside-domain');decodeResult(heavy.diffusion);
 assert.equal(continuumLimit({stepScale:1,tau:.1,scaling:'fixed-step'}).status,'outside-domain');assert.equal(scalar(continuumLimit({stepScale:1,tau:.1,scaling:'fixed-ratio'})),5);
 const walk=accepted(randomWalkMoments(.5e-6,.1,400));close(walk.diffusion*1e12,1.25);close(walk.meanSquare*1e12,100);assert.equal(walk.elapsedTime,40);
});
test('invalid and unrepresentable law inputs do not become plausible physical zeros',()=>{
 assert.equal(kernelMoments({kind:'coin',stepRms:NaN}).variance.status,'outside-domain');assert.equal(kernelMoments({kind:'gaussian',stepRms:1e-100}).fourthMoment.status,'outside-domain');assert.equal(randomWalkMoments(1e200,1,4).kind,'outcome');assert.equal(dkwBound(0,.01).kind,'refused');
});
