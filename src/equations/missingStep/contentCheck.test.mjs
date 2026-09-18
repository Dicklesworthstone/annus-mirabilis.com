import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {checkMissingStepContent} from './contentCheck.ts';
import {matchContentRoute} from '../../content/compiler/routes.ts';
import {loadReadingFiles} from '../../../scripts/build-content.ts';
import {compileContent} from '../../content/compiler/compiler.ts';
const files = await Promise.all(['equations/derivations/bm-variance.yaml','equations/missing-step-allowlist.yaml'].map(async path=>({path,text:await readFile(new URL(`../../../content/${path}`,import.meta.url),'utf8')})));
const anchors=['arg-bm-independent-steps','arg-bm-diffusion-equation'];
test('worked derivations have their own route, never an Equation namespace',()=>{
 assert.equal(matchContentRoute(files[0].path).kind,'derivation-chain');
 assert.equal(matchContentRoute(files[1].path).kind,'derivation-policy');
 assert.equal(matchContentRoute('equations/brownian-motion/mean-square.json').kind,'equation');
});
test('policy, duplicate identities and JSON duplicate keys are not ignored',()=>{
 assert.ok(checkMissingStepContent(files.slice(0,1),anchors).length);
 assert.ok(checkMissingStepContent([...files,{...files[0],path:'equations/derivations/duplicate.yaml'}],anchors).length);
 assert.ok(checkMissingStepContent([{...files[0],text:files[0].text.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1')},files[1]],anchors).length);
 assert.deepEqual(checkMissingStepContent(files,anchors),[]);
});
test('the normal content loader includes both worked-chain and policy records',async()=>{
 const input=await loadReadingFiles();
 assert.ok(input.some(f=>f.path===files[0].path));assert.ok(input.some(f=>f.path===files[1].path));
 const compiled=await compileContent(input);assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics.filter(d=>d.severity==='error')));
});
test('the actual compiler rejects a planted cross-term error',async()=>{
 const input=await loadReadingFiles();
 const copy=input.map(file=>{
  if(file.path!==files[0].path)return file;
  const record=JSON.parse(file.text);record.chain.steps[0].to.argument.args[1].args[0].value='3';record.chain.steps[1].from.argument.args[1].args[0].value='3';
  return {...file,text:JSON.stringify(record)};
 });
 const compiled=await compileContent(copy);
 assert.equal(compiled.ok,false);assert.ok(compiled.diagnostics.some(d=>d.code==='missing-step-content'&&d.message.includes('worked-case')));
});
