import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstanceStore } from '../experiments/store/instanceStore.ts';
import { BM01_DEFAULTS,BM01_CLASSES,BM01_OUTPUTS } from '../experiments/bm01/definition.ts';
import { createBm01Recording,measureBm01 } from '../workers/operations/bm01.ts';
import { deriveHostExecution } from '../experiments/provenance/executionState.ts';
import { readTermValue,resolveSlot,retainedState,statusText } from '../equations/live/values.ts';
import { createSelectionStore } from '../equations/selectionStore.ts';
import { BROWNIAN_QUANTITIES } from '../equations/quantities.ts';
import { makeRefusal } from '../experiments/results/refusals.ts';
const digest=`source:sha256:${'b'.repeat(64)}`,p={...BM01_DEFAULTS,M:4,H:1};
const term=id=>({termId:`eq-model-bm-test.t.${id}`,quantityId:id,quantity:BROWNIAN_QUANTITIES[id],scale:{num:1,den:1}});
async function fixture(id='test',patch={}){
 const parameters={...p,...patch},r=await createBm01Recording(parameters,{yieldControl:async()=>{}});assert.equal(r.kind,'accepted');
 const e=measureBm01(r.data,parameters,false);assert.equal(e.kind,'accepted');
 const store=createInstanceStore({experimentId:'bm-01',instanceId:id,initialParameters:parameters,parameterClasses:BM01_CLASSES,outputs:BM01_OUTPUTS,allowPartial:true});
 const token=store.issue('setup-change');assert.equal(store.publish({...token,...e.data,final:true}).accepted,true);
 return {store,slot:(isStatic=false)=>{const view=store.getSnapshot();return {slot:'primary',experimentId:'bm-01',view,execution:deriveHostExecution(view,BM01_OUTPUTS,digest,isStatic)};}};
}
test('static and host labels derive from accepted contracts and require a valid source digest',async()=>{
 const f=await fixture();assert.equal(f.slot(true).execution.label,'static');assert.equal(f.slot().execution.label,'host');
 assert.equal(deriveHostExecution(f.store.getSnapshot(),BM01_OUTPUTS,'not-a-digest',false).label,'unavailable');
 const v=f.store.getSnapshot(),broken={...v,accepted:{...v.accepted,outputs:v.accepted.outputs.map((o,i)=>i?o:{...o,ownerId:'invented'})}};
 assert.equal(deriveHostExecution(broken,BM01_OUTPUTS,digest,false).label,'unavailable');
});
test('live equations format exact accepted outputs rather than evaluating draft parameters',async()=>{
 const f=await fixture();assert.equal(readTermValue(term('viscosity'),f.slot()).text,'1');
 assert.equal(readTermValue(term('diffusionCoefficient'),f.slot()).text,'0.42944');
 const before=f.store.getSnapshot().accepted;f.store.issue('setup-change',{eta:.002});
 assert.equal(f.store.getSnapshot().accepted,before);assert.equal(readTermValue(term('viscosity'),f.slot()).text,'1');assert.match(retainedState(f.slot()),/Previous accepted settings.*pending/);
});
test('refusals and pauses retain original values and distinguish them from requested settings',async()=>{
 const f=await fixture(),token=f.store.issue('measurement-change',{interval:.015});
 f.store.refuse(token,makeRefusal('off-replay-grid',{parameterIds:['interval']}));
 assert.match(retainedState(f.slot()),/request refused/);assert.equal(readTermValue(term('observationInterval'),f.slot()).text,'1');
 f.store.pause();assert.match(retainedState(f.slot()),/stopped/);
});
test('two primary slots fail ambiguous and separate instances never use each other’s values',async()=>{
 const a=await fixture('a'),b=await fixture('b',{eta:.002});
 assert.equal(resolveSlot([], 'bm-01','primary').kind,'unresolved');assert.equal(resolveSlot([a.slot(),b.slot()], 'bm-01','primary').kind,'ambiguous');
 assert.equal(readTermValue(term('viscosity'),a.slot()).text,'1');assert.equal(readTermValue(term('viscosity'),b.slot()).text,'2');
 assert.equal(resolveSlot([a.slot()], 'bm-06','primary').kind,'unresolved');
});
test('zero interval keeps apparent-speed explanation instead of a fabricated zero or infinity',async()=>{
 const f=await fixture('zero',{interval:0});const speed=readTermValue(term('modelApparentSpeed'),f.slot());assert.equal(speed.kind,'status');assert.match(speed.text,/positive observation interval/);
 assert.equal(readTermValue(term('rmsDisplacement1d'),f.slot()).text,'0');
});
test('wrong meaning or units, missing or repeated outputs remain symbolic',async()=>{
 const f=await fixture();for(const mutate of [o=>({...o,unit:'cm'}),o=>({...o,semanticKind:'sample-rms'})]){
  const t=term('rmsDisplacement1d'),s=f.slot();s.view={...s.view,accepted:{...s.view.accepted,outputs:s.view.accepted.outputs.map(o=>o.quantityId===t.quantityId?mutate(o):o)}};assert.equal(readTermValue(t,s).kind,'symbolic');
 }
 const s=f.slot(),t=term('temperature');s.view={...s.view,accepted:{...s.view.accepted,outputs:s.view.accepted.outputs.filter(o=>o.quantityId!==t.quantityId)}};assert.equal(readTermValue(t,s).kind,'symbolic');
 const duplicate=f.slot();duplicate.view={...duplicate.view,accepted:{...duplicate.view.accepted,outputs:[...duplicate.view.accepted.outputs,duplicate.view.accepted.outputs.find(o=>o.quantityId===t.quantityId)]}};assert.equal(readTermValue(t,duplicate).kind,'symbolic');
 assert.equal(readTermValue(t,null).kind,'symbolic');
});
test('selection stores are local, immutable, stable and independent of experiment state',async()=>{
 const f=await fixture(),before=f.store.getSnapshot(),a=createSelectionStore(),b=createSelectionStore();let changes=0;const off=a.subscribe(()=>changes++);
 const s={nodeId:'brownian-motion/eq-model-bm-rms.t.diffusion',quantityId:'diffusionCoefficient',kind:'term'};a.select(s);const first=a.getSnapshot();a.select({...s});assert.equal(a.getSnapshot(),first);assert.equal(changes,1);assert.ok(Object.isFrozen(first));assert.equal(b.getSnapshot(),null);assert.equal(f.store.getSnapshot(),before);off();a.select(null);assert.equal(changes,1);
});
test('every nonnumeric scientific status has a readable explanation',()=>{
 for(const status of [{status:'symbolic'},{status:'analytic-limit',description:'The limiting point.'},{status:'underdetermined',compatibleFamily:'A family.',neededInformation:['Measure radius.']},{status:'not-applicable',reason:'Not applicable.'},{status:'outside-domain',reason:'Outside this model.'},{status:'divergent',rate:{statement:'Grows without bound.'}}])assert.ok(statusText(status).length>5);
});

test('exact term scales change only the displayed factor, without mutating the owner value',async()=>{
 const f=await fixture(),s=f.slot(),t={...term('viscosity'),scale:{num:1,den:2}};
 assert.equal(readTermValue(t,s).text,'0.5');assert.equal(readTermValue(term('viscosity'),s).text,'1');
});
