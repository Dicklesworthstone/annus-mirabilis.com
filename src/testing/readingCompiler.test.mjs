import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContentJson } from '../content/compiler/json.ts';
import { validateReadingRecord, validateMath } from '../content/schemas/reading.ts';
import { compileReadingContent } from '../content/compiler/compile.ts';
const citation = { schemaVersion: 1, kind: 'citation', id: 'primary', title: 'Primary record', locator: 'Section 4', url: 'https://example.org/source' };
const f = (id, prerequisites=[]) => ({ schemaVersion: 1, kind: 'foundation', id, title: 'An idea', question: 'Why?', summary: 'Summary', review: 'draft', explanation: [{kind:'paragraph',text:'Explanation.'}], example: [{kind:'paragraph',text:'Example.'}], prerequisites, stoppingPoint: 'Count and compare.', citations: ['primary'] });
const file = r => ({path:`${r.kind==='citation'?'bibliography':'foundations'}/${r.id}.json`, text:JSON.stringify(r)});
test('JSON parsing preserves values but rejects duplicate escaped keys, malformed syntax and pollution', () => {
  const x=parseContentJson('{"a":[true,null,-1.25e2,"ü"]}'); assert.deepEqual(x.a,[true,null,-125,'ü']);
  for(const x of ['{"a":1,"\\u0061":2}','{"__proto__":{}}','[1,]','{"a":1,}','01','1e999','"\\q"','{"a":0}x']) assert.throws(()=>parseContentJson(x));
});
test('loader rejects non-NFC, oversized and deeply nested records',()=>{
 assert.throws(()=>parseContentJson('"e\u0301"'),/NFC/); assert.throws(()=>parseContentJson(' '.repeat(524289)),/512 KiB/); assert.throws(()=>parseContentJson('['.repeat(42)+'0'+']'.repeat(42)),/nesting/);
});
test('content schemas are closed and cannot claim a reviewed source edition',()=>{
 assert.equal(validateReadingRecord(citation,'x').id,'primary');
 for(const changed of [{...citation,url:'javascript:alert(1)'},{...citation,extra:1},{...f('a'),review:'reviewed'},{...f('a'),title:'<script>x</script>'}]) assert.throws(()=>validateReadingRecord(changed,'x'));
});
test('math allowlist refuses link, HTML, macro definitions and executable commands',()=>{
 validateMath('\\langle x^2\\rangle=2Dt');
 for(const tex of ['\\href{https://evil}{x}','\\htmlClass{x}{y}','\\def\\x{z}','\\includegraphics{a}','\\begin{evil}x\\end{evil}']) assert.throws(()=>validateMath(tex));
});
test('compiler aggregates independent errors instead of admitting partial output',()=>{
 const result=compileReadingContent([{path:'bad.yaml',text:'x'},file({...citation,url:'http://example.org'}),file(f('a',['absent']))]);
 assert.equal(result.ok,false); assert.equal(result.papers.length,0); assert.ok(result.diagnostics.filter(x=>x.severity==='error').length>=3);
});
test('foundations resolve prerequisite references and reject cycles',()=>{
 assert.equal(compileReadingContent([file(citation),file(f('a')),file(f('b',['a']))]).ok,true);
 assert.ok(compileReadingContent([file(citation),file(f('a',['b'])),file(f('b',['a']))]).diagnostics.some(d=>d.code==='prerequisite-cycle'));
});
test('compiler rejects path/id mismatches and repeated file inputs',()=>{
 assert.equal(compileReadingContent([{...file(citation),path:'bibliography/other.json'}]).ok,false);
 assert.ok(compileReadingContent([file(citation),file(citation)]).diagnostics.some(d=>d.code==='duplicate-path'));
});
test('a genuinely unrouted path still fails, including a misplaced quantities-like path (AGENTS.md: unrouted-content is load-bearing)',()=>{
 assert.ok(compileReadingContent([{path:'bad.yaml',text:'x'}]).diagnostics.some(d=>d.code==='unrouted-content'));
 assert.ok(compileReadingContent([{path:'quantitites/typo.yaml',text:'- id: x'}]).diagnostics.some(d=>d.code==='unrouted-content'));
 assert.ok(compileReadingContent([{path:'quantities/constant-sets/modern.yaml',text:'- id: x'}]).diagnostics.some(d=>d.code==='unrouted-content'));
});
test('quantities/*.yaml routes through the quantity schema and validates',()=>{
 const good=[{path:'quantities/generic.yaml',text:'- id: exampleLength\n  name: Example length\n  description: A test quantity.\n  dimensionStatus: declared\n  dimension: [1, 0, 0, 0, 0, 0]\n  mathematicalKind: scalar\n  frame: not-applicable\n'}];
 const result=compileReadingContent(good);
 assert.equal(result.ok,true);
});
test('an invalid quantity record is reported as a diagnostic, never a crash',()=>{
 const bad=[{path:'quantities/generic.yaml',text:'- id: NotCamelCase\n  name: Bad\n  description: Bad id casing.\n  dimensionStatus: declared\n  dimension: [1, 0, 0, 0, 0, 0]\n  mathematicalKind: scalar\n  frame: not-applicable\n'}];
 const result=compileReadingContent(bad);
 assert.equal(result.ok,false);
 assert.ok(result.diagnostics.some(d=>d.code==='invalid-quantity'));
});
test('duplicate quantity ids across files are reported, not silently overwritten',()=>{
 const files=[
  {path:'quantities/a.yaml',text:'- id: sharedLength\n  name: Shared length\n  description: First declaration.\n  dimensionStatus: declared\n  dimension: [1, 0, 0, 0, 0, 0]\n  mathematicalKind: scalar\n  frame: not-applicable\n'},
  {path:'quantities/b.yaml',text:'- id: sharedLength\n  name: Shared length again\n  description: Second declaration.\n  dimensionStatus: declared\n  dimension: [1, 0, 0, 0, 0, 0]\n  mathematicalKind: scalar\n  frame: not-applicable\n'},
 ];
 const result=compileReadingContent(files);
 assert.equal(result.ok,false);
 assert.ok(result.diagnostics.some(d=>d.code==='duplicate-id'&&d.message.includes('sharedLength')));
});
test('legacy-spellings.yaml cross-checks against the live quantity set: unresolved canonical id and id/spelling collision both fail',()=>{
 const quantity={path:'quantities/generic.yaml',text:'- id: keptId\n  name: Kept\n  description: A kept quantity.\n  dimensionStatus: declared\n  dimension: [1, 0, 0, 0, 0, 0]\n  mathematicalKind: scalar\n  frame: not-applicable\n'};
 const unresolved={path:'quantities/legacy-spellings.yaml',text:'- spelling: oldName\n  canonicalIds: [neverRegistered]\n'};
 const r1=compileReadingContent([quantity,unresolved]);
 assert.ok(r1.diagnostics.some(d=>d.code==='legacy-spelling-unresolved'));
 const collision={path:'quantities/legacy-spellings.yaml',text:'- spelling: keptId\n  canonicalIds: [keptId]\n'};
 const r2=compileReadingContent([quantity,collision]);
 assert.ok(r2.diagnostics.some(d=>d.code==='legacy-spelling-as-id'));
 const clean={path:'quantities/legacy-spellings.yaml',text:'- spelling: oldName\n  canonicalIds: [keptId]\n'};
 const r3=compileReadingContent([quantity,clean]);
 assert.equal(r3.ok,true);
});
