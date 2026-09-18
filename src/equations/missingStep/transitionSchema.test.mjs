import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseMissingStepAllowlist,parseMissingStepLesson} from './transitionSchema.ts';
import {enumerateSignedSteps} from '../../physics/reference/stepEnumeration.ts';
import {checkWorkedTransitions} from './workedCheck.ts';
const load=(p)=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const input=load('../../../content/equations/derivations/bm-variance.yaml');
const policy=load('../../../content/equations/missing-step-allowlist.yaml');
const allowed=parseMissingStepAllowlist(policy);
const anchors=['arg-bm-independent-steps','arg-bm-diffusion-equation'];
const parse=(data)=>parseMissingStepLesson(data,allowed,anchors);
test('the authored chain exposes four transitions with one marked move',()=>{
 const data=parse(input); assert.equal(data.transitions.length,4);assert.equal(data.chain.steps.filter(s=>s.isMove).length,1);
 assert.equal(data.review,'draft');assert.ok(Object.isFrozen(data));
});
for(const [name,change,code] of [
 ['unknown highlight',d=>d.transitions[2].changedSubexpressionIds=['notThere'],'subexpression'],
 ['highlight disappears in destination',d=>d.chain.steps[2].to.args[1].opId='gone','subexpression'],
 ['foreign rule',d=>d.transitions[0].ruleIds=['magic'],'rule'],
 ['foreign identity',d=>d.chain.steps[1].rule.params.identityId='magic','rule'],
 ['hidden premise',d=>d.transitions[2].premiseIds=[],'premise'],
 ['missing premise source',d=>d.premises[0].argument='arg-unknown','premise'],
 ['invented source anchor',d=>d.sourceLink='/papers/brownian-motion/s4/#s4-p999','source'],
 ['unapproved chain',d=>d.chain.id='chain-unapproved','not-allowlisted'],
 ['absent step',d=>d.transitions[0].toStepId='notThere','transition'],
 ['duplicate transition',d=>d.transitions[1].id=d.transitions[0].id,'transition'],
 ['later dynamics in premise',d=>d.premiseNotice+=' momentum relaxation time','anachronism'],
 ['hostile symbol',d=>d.chain.steps[0].from.argument.base.args[0].termId='<script>','schema'],
]) test(name,()=>{const d=structuredClone(input);change(d);assert.throws(()=>parse(d),new RegExp(`missing-step-${code}`));});
test('expansion policy requires evidence and cannot relabel another initial case',()=>{
 assert.throws(()=>parseMissingStepAllowlist({schemaVersion:1,chains:[{chainId:'another',initialCase:true,evidenceIds:[]}]}),/expansion-evidence/);
 assert.deepEqual(parseMissingStepAllowlist({schemaVersion:1,chains:[{chainId:'another',evidenceIds:['review-record-1']}]}),['another']);
});
test('two-step table enumerates rather than typing totals',()=>{
 const e=enumerateSignedSteps(2);assert.equal(e.rows.length,4);assert.equal(e.mean,0);assert.equal(e.meanSquare,2);assert.equal(e.meanCrossTerm,0);assert.equal(e.meanAbsolute,1);
 for(const row of e.rows)assert.equal(row.square,row.sumSquares+row.crossTerm);
});
test('three and eight steps generalize the finite worked case',()=>{
 for(const n of [3,8]){const e=enumerateSignedSteps(n);assert.equal(e.rows.length,2**n);assert.equal(e.meanSquare,n);assert.equal(e.meanCrossTerm,0);}
});
test('zero means alone do not eliminate cross terms',()=>{
 const same=enumerateSignedSteps(2,'same-direction'),opposite=enumerateSignedSteps(2,'opposite-direction');
 assert.equal(same.mean,0);assert.equal(same.meanSquare,4);assert.equal(same.meanCrossTerm,2);
 assert.equal(opposite.mean,0);assert.equal(opposite.meanSquare,0);assert.equal(opposite.meanCrossTerm,-2);
});
test('unbounded enumerations and unregistered alternatives are refused',()=>{
 for(const n of [1,9,NaN,2.5])assert.throws(()=>enumerateSignedSteps(n));
 assert.throws(()=>enumerateSignedSteps(3,'same-direction'));assert.throws(()=>enumerateSignedSteps(2,'magic'));
});
test('finite worked check rejects a planted incorrect coefficient, never a proof certificate',()=>{
 checkWorkedTransitions(parse(input));
 const broken=structuredClone(input);broken.chain.steps[0].to.argument.args[1].args[0].value='3';
 assert.throws(()=>checkWorkedTransitions(parse(broken)),/missing-step-worked-case/);
});
