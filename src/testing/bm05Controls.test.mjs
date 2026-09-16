import test from 'node:test';import assert from 'node:assert/strict';
import {BM05_DEFAULTS} from '../experiments/bm05/definition.ts';
import {toWalkDraft,fromWalkDraft} from '../experiments/bm05/controls.ts';
import {encodeBm05Settings,decodeBm05Settings} from '../experiments/bm05/permalink.ts';
import {validateBm05Parameters} from '../experiments/bm05/parameters.ts';
test('walk display units roundtrip without changing the underlying trial inputs',()=>{
 for(const kernel of ['coin','uniform','gaussian'])for(const stepRms of [.5e-6,1.234567890123456e-9,1e-40,1e40]){
  const p={...BM05_DEFAULTS,kernel,stepRms,seed:'18446744073709551615'};assert.deepEqual(fromWalkDraft(toWalkDraft(p)),p);
  const d=toWalkDraft(p);d.n='43';const q=fromWalkDraft(d);assert.equal(q.stepRms,p.stepRms);assert.equal(q.seed,p.seed);assert.equal(q.n,43);
 }
});
test('control parsing rejects invalid step counts, unsigned seeds and unsupported sampled laws',()=>{
 for(const patch of [{n:'.5'},{n:'401'},{walkers:'0'},{seed:'01'},{seed:'9007199254740993.0'},{stepRms:'1e-400'},{tau:'Infinity'},{kernel:'cauchy'},{bias:'1.1'}])assert.throws(()=>fromWalkDraft({...toWalkDraft(BM05_DEFAULTS),...patch}));
 assert.equal(fromWalkDraft({...toWalkDraft(BM05_DEFAULTS),n:'0'}).n,0);
});
test('accepted SI settings links retain the exact seed and all step parameters',()=>{
 for(const kernel of ['coin','uniform','gaussian']){
  const p={...BM05_DEFAULTS,kernel,n:64,seed:'9007199254740993'};const link=encodeBm05Settings(p),decoded=decodeBm05Settings(link);assert.equal(decoded.kind,'settings');assert.deepEqual(decoded.parameters,p);
 }
 assert.equal(decodeBm05Settings('').kind,'absent');assert.equal(decodeBm05Settings('?').kind,'absent');
});
test('settings links reject missing, duplicate, unknown, oversized and malformed data',()=>{
 const link=encodeBm05Settings(BM05_DEFAULTS);
 for(const broken of [link+'&n=4',link+'&extra=1',link.replace('walk=1','walk=2'),link.replace('n=4','n=NaN'),link.replace('&seed=1905',''),link.replace('seed=1905','seed=01'),'x'.repeat(4097),link+'&walk=1'])assert.equal(decodeBm05Settings(broken).kind,'invalid',broken);
 assert.throws(()=>encodeBm05Settings({...BM05_DEFAULTS,kernel:'cauchy'}));
});
test('parameter decoding does not evaluate accessors or silently drop unknown fields',()=>{
 let touched=false;const p={...BM05_DEFAULTS};Object.defineProperty(p,'n',{get(){touched=true;return 4;},enumerable:true});assert.equal(validateBm05Parameters(p).kind,'refused');assert.equal(touched,false);
 assert.equal(validateBm05Parameters({...BM05_DEFAULTS,hidden:1}).kind,'refused');assert.equal(validateBm05Parameters({...BM05_DEFAULTS,seed:1905}).kind,'refused');
});
