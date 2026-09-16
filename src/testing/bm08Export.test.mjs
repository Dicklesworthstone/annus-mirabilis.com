import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBm08Session } from '../experiments/bm08/session.ts';
import { cameraObservationCsv } from '../experiments/bm08/export.ts';
test('camera CSV exports every accepted SI coordinate with synthetic and source labels, without starting work', async () => {
 const example=JSON.parse(await readFile(new URL('../generated/bm08-example.json',import.meta.url),'utf8'));
 const session=createBm08Session('camera-csv',example,()=>{throw new Error('Export must not start a worker.');});
 const snapshot=session.getSnapshot().accepted, csv=cameraObservationCsv(snapshot,example.sourceDigest);
 assert.match(csv,/# Synthetic camera data; not historical or empirical observations/);assert.ok(csv.includes(example.sourceDigest));
 const rows=csv.trim().split('\n').filter(line=>!line.startsWith('#'));assert.equal(rows.length,1+(example.parameters.M+1)*example.parameters.d);
 assert.equal(rows[0],'time_s,coordinate,latent_start_m,exposure_average_m,camera_position_m');
 const actual=snapshot.outputs.find(o=>o.quantityId==='positions').value;
 for(let i=1;i<rows.length;i++){const values=rows[i].split(',');assert.equal(Number(values[4]),actual.at(i-1));assert.equal(values[1],(i-1)%example.parameters.d===0?'x':'y');}
 assert.equal(session.getSnapshot().accepted,snapshot);assert.equal(csv,cameraObservationCsv(snapshot,example.sourceDigest));
 assert.throws(()=>cameraObservationCsv({...snapshot,experimentId:'bm-07'},example.sourceDigest));
 assert.throws(()=>cameraObservationCsv(snapshot,'not-a-source-digest'));
});
