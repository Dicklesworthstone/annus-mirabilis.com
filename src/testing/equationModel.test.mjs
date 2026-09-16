import test from 'node:test';
import assert from 'node:assert/strict';
import { rational, parseRational, add, multiply, dimension, power, runtimeDimension, dimensionText } from '../content/dimensions/rational.ts';
import { parseExpression, quantityBindings, canonical, substitute, walk } from '../equations/ast.ts';
import { BROWNIAN_QUANTITIES as quantities } from '../equations/quantities.ts';
import { checkDimensions } from '../equations/dimensions.ts';
const id='eq-model-bm-rms';
const symbol=(name,q)=>({kind:'symbol',termId:`${id}.t.${name}`,quantityId:q});
const tree=()=>({kind:'relation',operator:'=',opId:`${id}.op.equality`,left:symbol('rms','rmsDisplacement1d'),right:{kind:'root',degree:2,opId:`${id}.op.squareRoot`,radicand:{kind:'product',args:[{kind:'number',value:'2'},symbol('diffusion','diffusionCoefficient'),symbol('time','observationInterval')]}}});
test('exact dimensions preserve roots and large rational arithmetic without float rounding',()=>{
 assert.deepEqual(rational(2n,4n),{num:1n,den:2n});assert.deepEqual(add(parseRational('1/3'),parseRational('1/6')),rational(1n,2n));
 const big=rational(10n**100n+1n,3n);assert.deepEqual(multiply(big,rational(3n)),rational(10n**100n+1n));
 assert.equal(dimensionText(power(dimension(['2','0','0','0','0','0']),rational(1n,2n))),'1,0,0,0,0,0');
 assert.deepEqual(runtimeDimension(dimension(['2','0','-1','0','0','0'])),[2,0,-1,0,0,0]);
 assert.throws(()=>runtimeDimension(dimension(['1/2','0','0','0','0','0'])));assert.throws(()=>rational(1n,0n));
});
test('RMS equation passes exact dimension checking; squaring instead of rooting fails',()=>{
 const good=parseExpression(tree(),id,quantities);assert.equal(checkDimensions(good,quantities).status,'consistent');assert.ok(Object.isFrozen(good.right.radicand.args));
 const bad=tree();bad.right={kind:'power',base:bad.right.radicand,exponent:{num:2,den:1}};
 assert.equal(checkDimensions(parseExpression(bad,id,quantities),quantities).status,'inconsistent');
});
test('symbols require exact canonical identities; duplicate terms and hostile fields fail',()=>{
 for(const change of [t=>{t.left.quantityId='rms';},t=>{t.right.radicand.args[1].termId=t.left.termId;},t=>{t.left.termId=id+'.t.x,onclick=evil';},t=>{t.right.extra='unknown';}]){const t=tree();change(t);assert.throws(()=>parseExpression(t,id,quantities));}
 let called=false;const t=tree();Object.defineProperty(t.left,'quantityId',{get(){called=true;return 'rmsDisplacement1d';},enumerable:true});assert.throws(()=>parseExpression(t,id,quantities));assert.equal(called,false);
});
test('scaled bindings survive traversal, serialization and exact-id substitution',()=>{
 const t=tree();t.left.scale={num:1,den:2};const p=parseExpression(t,id,quantities);
 assert.deepEqual(quantityBindings(p)[0].scale,{num:1,den:2});
 const changed=substitute(p,id+'.t.time',symbol('anotherTime','observationInterval'),id,quantities);
 assert.deepEqual(quantityBindings(changed)[0].scale,{num:1,den:2});assert.equal(walk(changed).length,walk(p).length);
 assert.equal(canonical({a:1,b:2}),canonical({b:2,a:1}));assert.notEqual(canonical(p),canonical(changed));
 t.left.scale={num:2,den:4};assert.throws(()=>parseExpression(t,id,quantities));
});
test('semantic kinds block plausible dimension-only substitutions; functions require dimensionless inputs',()=>{
 const measured={...quantities.rmsDisplacement1d,id:'measuredPosition',semanticKind:'measured-position'};
 const reg={...quantities,measuredPosition:measured};const t={kind:'relation',operator:'=',left:symbol('latent','rmsDisplacement1d'),right:symbol('measured','measuredPosition')};
 assert.equal(checkDimensions(parseExpression(t,id,reg),reg).status,'semantic-mismatch');
 const exp={kind:'function',name:'exp',argument:symbol('time','observationInterval')};assert.equal(checkDimensions(parseExpression(exp,id,reg),reg).status,'inconsistent');
});
test('calculus carries integration and differentiation variable dimensions exactly',()=>{
 const d={kind:'derivative',expression:symbol('distance','rmsDisplacement1d'),variable:symbol('time','observationInterval'),order:2,partial:true};
 assert.equal(dimensionText(checkDimensions(parseExpression(d,id,quantities),quantities).dimension),'1,0,-2,0,0,0');
 const i={kind:'integral',expression:symbol('diffusion','diffusionCoefficient'),variable:symbol('time','observationInterval')};
 assert.equal(dimensionText(checkDimensions(parseExpression(i,id,quantities),quantities).dimension),'2,0,0,0,0,0');
});
test('unknown node kinds and bounded work fail closed rather than passing dimension checks',()=>{
 assert.throws(()=>parseExpression({kind:'javascript',code:'1'},id,quantities));
 let n=symbol('x','rmsDisplacement1d');for(let i=0;i<26;i++)n={kind:'group',argument:n};assert.throws(()=>parseExpression(n,id,quantities),/budget/);
 assert.equal(checkDimensions({kind:'unsupported'},quantities).status,'unsupported-check');
});
