import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recordInferencePath, observeInferencePath, drawHiddenMolecularNumber, INFERENCE_CONSTANTS, INFERENCE_STREAMS } from '../physics/reference/inference/synthetic.ts';
import { independentIncrementEstimator, driftCenteredEstimator, estimatorInterval } from '../physics/reference/inference.ts';
const setup={seed:'9007199254740993',generatorT:293.15,generatorEta:.001,generatorRadius:.5e-6};
const ok=r=>{assert.equal(r.kind,'accepted',JSON.stringify(r));return r.data;};
const quiet={yieldControl:async()=>{}};
test('hidden number and latent path use the allocated independent streams without ambient modern constants',async()=>{
 const source=await readFile(new URL('../physics/reference/inference/synthetic.ts',import.meta.url),'utf8');
 assert.ok(!/getConstantSet|thermalConstant|constantValue\([^\n]+boltzmann/.test(source));
 assert.equal(INFERENCE_CONSTANTS.entries.length,1);assert.equal(INFERENCE_CONSTANTS.entries[0].quantityId,'molarGasConstant');
 const bindings=await readFile(new URL('../../docs/FRANKENSIM_BINDING.md',import.meta.url),'utf8');
 for(const id of ['0x19050003','0x19050007'])assert.ok(bindings.includes(id));
 assert.deepEqual(INFERENCE_STREAMS,{latent:0x19050003,parameter:0x19050007});
 const n=drawHiddenMolecularNumber(setup.seed);assert.ok(n>=3e23&&n<1.2e24);assert.notEqual(n,drawHiddenMolecularNumber('9007199254740992'));
 assert.equal(n,drawHiddenMolecularNumber(setup.seed));
});
test('chunks, coordinates, sample counts, and observation spacing never redraw the fixed logical path',async()=>{
 const a=ok(await recordInferencePath(setup,{...quiet,chunkSteps:7})),b=ok(await recordInferencePath(setup,{...quiet,chunkSteps:500}));
 assert.deepEqual(a.positions,b.positions);assert.equal(a.draws,16385);
 const copy=a.positions.slice(),one=ok(observeInferencePath(a,{M:20,d:1,dt:1})),two=ok(observeInferencePath(a,{M:50,d:2,dt:1}));
 for(let i=0;i<20;i++)assert.equal(one.increments[i],two.increments[2*i]);
 const coarse=ok(observeInferencePath(a,{M:10,d:2,dt:2}));for(let i=0;i<=10;i++)for(let c=0;c<2;c++)assert.equal(coarse.positions[2*i+c],two.positions[4*i+c]);
 assert.deepEqual(a.positions,copy);one.positions[0]=123;assert.deepEqual(a.positions,copy);
 assert.deepEqual(ok(observeInferencePath(a,{M:50,d:2,dt:1})),two);
});
test('off-grid observation repairs succeed and out-of-recording windows never truncate the sample',async()=>{
 const r=ok(await recordInferencePath(setup,quiet));const bad=observeInferencePath(r,{M:50,d:2,dt:.3});assert.equal(bad.kind,'refused');assert.equal(bad.refusal.code,'off-replay-grid');
 assert.equal(observeInferencePath(r,{M:50,d:2,dt:bad.refusal.rankedRepairs[0].action.value}).kind,'accepted');
 assert.equal(observeInferencePath(r,{M:1000,d:2,dt:2}).kind,'refused');
});
test('cancellation never publishes a partial recording; independent replicates do not reuse its stream',async()=>{
 let stop=false;assert.equal((await recordInferencePath(setup,{cancelled:()=>stop,yieldControl:async()=>{stop=true;}})).kind,'outcome');
 const a=ok(await recordInferencePath(setup,quiet,0,16)),b=ok(await recordInferencePath(setup,quiet,1,16));assert.notDeepEqual(a.positions,b.positions);assert.equal(a.hiddenNumber,b.hiddenNumber);
});
test('prespecified repeated trials cover the true diffusivity and reject the wrong degrees-of-freedom interval',async()=>{
 // Fixed seed, 400 trials, d=2 M=20; Hoeffding family error <=0.001 for two
 // coverage checks: tolerance sqrt(log(4000)/(2*400))=0.101821... . No reruns.
 const N=400,alpha=.05,tolerance=Math.sqrt(Math.log(4000)/(2*N));let covered=0,centeredCovered=0,wrongCovered=0;
 for(let p=1;p<=N;p++){
  const r=ok(await recordInferencePath(setup,quiet,p,80)),obs=ok(observeInferencePath(r,{M:20,d:2,dt:1}));
  for(const [estimate,which] of [[ok(independentIncrementEstimator(obs.increments,1,{d:2})),0],[ok(driftCenteredEstimator(obs.increments,1,{d:2})),1]]){
   const ci=ok(estimatorInterval(estimate,alpha));if(ci.lower<=r.D&&r.D<=ci.upper){if(which===0)covered++;else centeredCovered++;}
   if(which===0){const wrong=ok(estimatorInterval({...estimate,q:4000},alpha));if(wrong.lower<=r.D&&r.D<=wrong.upper)wrongCovered++;}
  }
 }
 assert.ok(Math.abs(covered/N-.95)<tolerance,{covered});assert.ok(Math.abs(centeredCovered/N-.95)<tolerance,{centeredCovered});assert.ok(wrongCovered/N<.5,{wrongCovered});
});
