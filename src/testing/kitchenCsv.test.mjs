import test from 'node:test';import assert from 'node:assert/strict';
import { parseKitchenCsv, exportKitchenCsv } from '../experiments/bm07/kitchen/csv.ts';
import { KITCHEN_COLUMNS,KITCHEN_READER_COLUMNS,KITCHEN_METADATA_KEYS,KitchenInputError } from '../experiments/bm07/kitchen/schema.ts';
import { kitchenFixture } from './kitchen/fixture.mjs';
const read=()=>parseKitchenCsv(kitchenFixture());
test('classroom schema shares all twelve columns and worksheet omits only schema_version',()=>{
 assert.deepEqual(KITCHEN_COLUMNS,['schema_version','kind','object_id','frame_time_s','x_px','y_px','lost','loss_reason','point_status','exclusion_reason','calibration_id','identity_decision']);assert.deepEqual(KITCHEN_READER_COLUMNS,KITCHEN_COLUMNS.slice(1));
 const d=read();assert.equal(d.points.length,80);assert.equal(d.metadata.data_origin,'synthetic');assert.equal(d.points[0].x,100);assert.ok(Object.isFrozen(d.points[0]));assert.deepEqual(parseKitchenCsv(exportKitchenCsv(d)),d);
 assert.deepEqual(exportKitchenCsv(d).split('\n').filter(l=>l.startsWith('# ')).map(l=>l.slice(2).split('=')[0]),KITCHEN_METADATA_KEYS);
});
test('CSV is closed, bounded, row-numbered, strict about numeric cells and duplicates',()=>{
 for(const [find,replace] of [['x_px','unexpected'],['# sample=','# unknown='],['2,particle,p1,0,','2,particle,p1,=1+1,'],['2,particle,p1,1,','2,particle,p1,0,'],['2,particle,p1,0,100','2,particle,p1,0,Infinity'],['2,particle,p1,0,100','2,particle,p1,0,100001'],['2,particle,p1,0,','1,particle,p1,0,']])assert.throws(()=>parseKitchenCsv(kitchenFixture().replace(find,replace)),KitchenInputError);
 assert.throws(()=>parseKitchenCsv('# sample=a\n'+kitchenFixture()),/duplicate/);assert.throws(()=>parseKitchenCsv('x'.repeat(2*1024*1024+1)),/2 MiB/);
 assert.throws(()=>parseKitchenCsv(kitchenFixture().replace('2,particle,p1,0,','2,particle,p1,-1,')),/Row \d+/);
 assert.throws(()=>parseKitchenCsv(kitchenFixture().replace('2,particle,p1,0,100','2,particle,p1,0,1e-999')),/supported range/);
});
test('point provenance preserves exclusions and refuses silent label reuse',()=>{
 const points=[['2','particle','p1',0,1,2,0,'','measured','','c',''],['2','particle','p1',1,2,3,0,'','excluded','Image obscured','c',''],['2','particle','p1',2,'','',1,'edge','lost','','c',''],['2','particle','p1',4,5,6,0,'','measured','','c','reacquired-same']];
 const csv=kitchenFixture({points}),d=parseKitchenCsv(csv);assert.equal(d.points[1].x,2);assert.equal(d.points[2].x,null);assert.equal(d.points[3].identityDecision,'reacquired-same');assert.deepEqual(parseKitchenCsv(exportKitchenCsv(d)),d);
 assert.throws(()=>parseKitchenCsv(csv.replace('Image obscured','')),/exclusion_reason/);assert.throws(()=>parseKitchenCsv(csv.replace('reacquired-same','')),/identity_decision/);assert.throws(()=>parseKitchenCsv(csv.replace('1,edge,lost','0,edge,lost')),/must agree/);
});
test('CSV round-trip escapes formula-shaped text without changing numerical negative coordinates',()=>{
 const d=read(),ids=['=HYPERLINK("example")','+name','-name','@name',"'literal",'\tname','line,one'];
 for(const id of ids){const changed={...d,points:d.points.map(p=>({...p,objectId:id,kind:'particle',time:d.points.indexOf(p),x:-p.x}))};const csv=exportKitchenCsv(changed),round=parseKitchenCsv(csv);assert.equal(round.points[0].objectId,id);assert.equal(round.points[0].x,-100);assert.ok(csv.includes(id.startsWith("'")?"''literal":id.startsWith('-')?"'-name":',-100,'));}
});
test('quoted commas, escaped quotes, CRLF and multiline exclusion reasons remain data',()=>{
 const d=read();const points=d.points.map((p,i)=>i===1?{...p,status:'excluded',exclusionReason:'Blurred, then "lost"\nRecheck'}:p);const csv=exportKitchenCsv({...d,points});assert.deepEqual(parseKitchenCsv(csv).points,points);assert.equal(parseKitchenCsv(kitchenFixture().replaceAll('\n','\r\n')).points.length,80);
 assert.throws(()=>parseKitchenCsv(kitchenFixture().replace('2,particle,p1,0,100','2,particle,"p1"x,0,100')),/closing quote/);
});
test('per-axis scales retain unknown axes and deprecated scales normalize explicitly',()=>{
 const x=parseKitchenCsv(kitchenFixture({metadata:{calibration_axes:'x',pixels_per_um_y:'',pixel_aspect_ratio:''}}));assert.equal(x.metadata.pixels_per_um_y,'');
 const legacy=kitchenFixture().replace(/# pixels_per_um_[xy](?:_uncertainty)?=.*\n/g,'').replace('# calibration_axes=both','# pixels_per_um=10\n# pixels_per_um_uncertainty=0\n# calibration_axes=both');
 const d=parseKitchenCsv(legacy);assert.equal(d.metadata.pixels_per_um_x,'10');assert.equal(d.metadata.pixels_per_um_y,'10');assert.equal(d.notes.length,1);assert.ok(!exportKitchenCsv(d).includes('# pixels_per_um='));
 assert.throws(()=>parseKitchenCsv(kitchenFixture().replace('# calibration_axes=both','# pixels_per_um=10\n# calibration_axes=both')),/mix/);
 assert.throws(()=>parseKitchenCsv(kitchenFixture({metadata:{calibration_axes:'z'}})),/calibration_axes/);
});
test('unknown physics stays unknown; imported provenance cannot claim reviewed empirical data',()=>{
 const d=parseKitchenCsv(kitchenFixture({metadata:{temperature_k:'',viscosity_mpa_s:'',viscosity_source:'',radius_um:'',exposure_s:'',data_origin:undefined}}));assert.equal(d.metadata.temperature_k,'');assert.equal(d.metadata.exposure_s,'');assert.equal(d.metadata.data_origin,'reader-supplied');
 assert.throws(()=>parseKitchenCsv(kitchenFixture({metadata:{data_origin:'verified-empirical'}})),/data_origin/);assert.throws(()=>parseKitchenCsv(kitchenFixture({metadata:{constant_set_id:'unknown'}})),/constant_set_id/);assert.throws(()=>parseKitchenCsv(kitchenFixture({metadata:{radius_um:'.5',radius_interval_um:'[1,2]'}})),/contain/);
});
