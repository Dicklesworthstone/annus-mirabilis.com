import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recordCameraPath,observeCameraPath} from '../src/physics/reference/inference/camera.ts';
import {exportKitchenCsv,parseKitchenCsv} from '../src/experiments/bm07/kitchen/csv.ts';
import {KITCHEN_METADATA_KEYS,KITCHEN_READER_COLUMNS} from '../src/experiments/bm07/kitchen/schema.ts';
import {analyzeKitchen,KITCHEN_OPTIONS} from '../src/experiments/bm07/kitchen/analyze.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function generateKitchen(){
 const sources=new Map();
 async function visit(path){if(sources.has(path))return;const text=await readFile(resolve(root,path),'utf8');sources.set(path,text);for(const m of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){const next=relative(root,resolve(root,dirname(path),m[1]));if(next.startsWith('../')||!/\.(ts|mjs)$/.test(next))throw new Error('Unsupported evaluator dependency');await visit(next);}}
 await visit('src/experiments/bm07/kitchen/host.ts');await visit('scripts/generate-kitchen.mjs');
 const hash=createHash('sha256');for(const [p,text]of [...sources].sort(([a],[b])=>a.localeCompare(b,'en')))hash.update(`${p}\0${Buffer.byteLength(text)}\0`).update(text);
 const sourceDigest=`source:sha256:${hash.digest('hex')}`;
 const recorded=await recordCameraPath({seed:'1905',D:.42944e-12,flowDrift:0},{yieldControl:async()=>{}},0,410);
 if(recorded.kind!=='accepted')throw new Error('Practice recording failed');
 const observed=observeCameraPath(recorded.data,{M:99,d:2,dt:1,exposure:.5,sigma:.2e-6,stageDrift:0,noiseSeed:'1905',clickSeed:'1926',clicks:30});if(observed.kind!=='accepted')throw new Error('Practice observation failed');
 const f=observed.data,metadata=Object.fromEntries(KITCHEN_METADATA_KEYS.map(k=>[k,'']));
 Object.assign(metadata,{source_width_px:'640',source_height_px:'480',working_scale:'1',rotation_degrees:'0',pixel_aspect_ratio:'1',pixels_per_um_x:'10',pixels_per_um_y:'10',pixels_per_um_x_uncertainty:'0',pixels_per_um_y_uncertainty:'0',calibration_axes:'both',calibration_method:'micrometer',declared_interval_s:'1',frame_rate_hz:'30',timing_source:'declared-rate',temperature_k:'293.15',viscosity_mpa_s:'1',viscosity_source:'Chosen synthetic scenario, not an observed viscosity',exposure_s:'.5',drift_source:'none',constant_set_id:'scenario-gas-constant-measured',sample:'SYNTHETIC PRACTICE: BM08 seed 1905, D 0.42944 um2/s; generated camera coordinates, not experimental evidence',data_origin:'synthetic',radius_provenance:'unknown'});
 const point=(kind,id,i,x,y)=>({kind,objectId:id,time:i,x:320+x/1e-7,y:240+y/1e-7,status:'measured',lossReason:'',exclusionReason:'',calibrationId:'practice-calibration',identityDecision:''});
 const points=[...Array.from({length:100},(_,i)=>point('particle','practice-particle',i,f.observed[2*i],f.observed[2*i+1])),...Array.from({length:30},(_,i)=>point('stationary','practice-feature',i,f.stationary[2*i],f.stationary[2*i+1]))];
 const csv=exportKitchenCsv({schemaVersion:2,metadata,points,notes:[]});const doc=parseKitchenCsv(csv),analysis=analyzeKitchen(doc,KITCHEN_OPTIONS);
 if(analysis.counts.retainedPairs!==50)throw new Error('Practice pairing changed');
 const worksheet=['ANNUS MIRABILIS — LOCAL OBSERVATION WORKSHEET','Record what you actually observed. Do not fill gaps with invented measurements.','Times in seconds; coordinates in the original source-image pixels. Add schema_version as the first column and 2 as the first cell of every observation row before importing.','',...KITCHEN_METADATA_KEYS.map(k=>`# ${k}=`),'',KITCHEN_READER_COLUMNS.join(','),...Array.from({length:20},()=>','.repeat(KITCHEN_READER_COLUMNS.length-1)),'','Record at least ten independent clicks on one stationary feature with the same localization variance assumption.','Mark every loss/exclusion and its reason; record a new-object or reacquired-same decision after loss.','This empty worksheet is not an importable observation file until its declarations and rows have been completed.',''].join('\n');
 await mkdir(resolve(root,'src/generated'),{recursive:true});await mkdir(resolve(root,'public/edition/kitchen'),{recursive:true});
 await writeFile(resolve(root,'src/generated/kitchen-practice.json'),JSON.stringify({csv,sourceDigest}));
 await writeFile(resolve(root,'src/generated/kitchen-provenance.ts'),`// Generated from the evaluator import closure.\nexport const KITCHEN_SOURCE_DIGEST=${JSON.stringify(sourceDigest)};\n`);
 await writeFile(resolve(root,'public/edition/kitchen/practice.csv'),csv);await writeFile(resolve(root,'public/edition/kitchen/worksheet.txt'),worksheet);
 return {sourceDigest,rows:doc.points.length,files:sources.size};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await generateKitchen()));
