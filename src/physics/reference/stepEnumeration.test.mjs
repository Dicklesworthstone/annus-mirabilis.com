import assert from 'node:assert/strict';
import test from 'node:test';
import {enumerateSignedSteps} from './stepEnumeration.ts';
test('two independent signed steps enumerate all four outcomes',()=>{
 const e=enumerateSignedSteps(2);assert.equal(e.rows.length,4);assert.equal(e.mean,0);assert.equal(e.meanSquare,2);assert.equal(e.meanCrossTerm,0);assert.equal(e.meanAbsolute,1);
 for(const row of e.rows)assert.equal(row.square,row.sumSquares+row.crossTerm);
});
test('three through eight independent steps have additive mean squares',()=>{
 for(let n=3;n<=8;n++){const e=enumerateSignedSteps(n);assert.equal(e.rows.length,2**n);assert.equal(e.meanSquare,n);assert.equal(e.meanCrossTerm,0);}
});
test('correlated zero-mean steps do not lose their cross contribution',()=>{
 const same=enumerateSignedSteps(2,'same-direction'),opposite=enumerateSignedSteps(2,'opposite-direction');
 assert.equal(same.mean,0);assert.equal(same.meanSquare,4);assert.equal(same.meanCrossTerm,2);
 assert.equal(opposite.mean,0);assert.equal(opposite.meanSquare,0);assert.equal(opposite.meanCrossTerm,-2);
 for(const e of [same,opposite])for(let i=0;i<2;i++)assert.equal(e.rows.reduce((sum,r)=>sum+r.steps[i],0),0);
});
test('results are immutable and unbounded enumerations are refused',()=>{
 const e=enumerateSignedSteps(2);assert.ok(Object.isFrozen(e.rows[0].steps));
 for(const n of [1,9,NaN,2.5])assert.throws(()=>enumerateSignedSteps(n));
 assert.throws(()=>enumerateSignedSteps(3,'same-direction'));assert.throws(()=>enumerateSignedSteps(2,'magic'));
});
