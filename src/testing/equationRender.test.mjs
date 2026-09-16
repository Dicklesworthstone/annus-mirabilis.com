import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileEquation } from '../equations/render.ts';
import { canonical } from '../equations/ast.ts';
const load=async name=>JSON.parse(await readFile(new URL(`../../content/equations/brownian-motion/eq-model-bm-${name}.json`,import.meta.url),'utf8'));
test('server rendering emits every declared hit target and one unannotated semantic MathML expression',async()=>{
 for(const name of ['rms','diffusivity','apparent-speed']){
  const compiled=compileEquation(await load(name));
  for(const n of compiled.navigation)assert.ok(compiled.html.includes(`data-${n.kind==='term'?'term':'op'}="${n.id}"`),n.id);
  assert.ok(!compiled.html.includes('katex-error'));assert.match(compiled.mathml,/<math/);assert.match(compiled.mathml,/<annotation/);assert.ok(!compiled.mathml.includes('data-term'));
  assert.ok(!compiled.html.includes('href=')&&!compiled.html.includes('onclick='));
 }
});
test('renders and equation identities reproduce exactly and edits invalidate the payload',async()=>{
 const raw=await load('rms'),a=compileEquation(raw),b=compileEquation(JSON.parse(canonical(raw)));
 assert.deepEqual(a,b);raw.notes[0].explanation+=' A separately authored clarification.';
 assert.notEqual(compileEquation(raw).treeDigest,a.treeDigest);
});
test('authored HTML and marker-injection cannot reach the trusted renderer',async()=>{
 for(const change of [e=>e.tree.left.termId+=' onclick=evil',e=>e.tree.left.quantityId='\\href{javascript:evil}{D}',e=>e.tree.right.radicand.args[0].value='\\htmlData{onclick=x}{2}',e=>e.title='<img src=x onerror=evil>']){
  const e=await load('rms');change(e);assert.throws(()=>compileEquation(e));
 }
});
