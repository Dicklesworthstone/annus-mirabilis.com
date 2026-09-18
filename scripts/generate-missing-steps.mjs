import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderToString} from 'katex';
import {loadPaper} from '../src/content/server.ts';
import {parseContentJson} from '../src/content/compiler/loaders.ts';
import {hashModuleClosure} from '../src/content/kernel/sourceDigest.ts';
import {expressionToDerivationLatex} from '../src/equations/derivations/mathRenderer.ts';
import {parseMissingStepAllowlist,parseMissingStepLesson} from '../src/equations/missingStep/transitionSchema.ts';
import {missingStepRuleStatement} from '../src/equations/missingStep/ruleStatements.ts';
import {checkWorkedTransitions} from '../src/equations/missingStep/workedCheck.ts';
import {enumerateSignedSteps} from '../src/physics/reference/stepEnumeration.ts';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
/** These .yaml records deliberately use JSON's YAML-compatible subset. No source prose is executable. */
export async function generateMissingSteps(root=ROOT,profile=process.env.AM_RELEASE_PROFILE??'scaffold',output=resolve(root,'src/generated')) {
  if(!['scaffold','preview','launch'].includes(profile))throw new TypeError('Unknown missing-step publication profile.');
  const paper=await loadPaper('brownian-motion');
  const anchors=paper.arguments.map(a=>a.id);
  const directory=resolve(root,'content/equations/derivations');
  const policyRaw=await readFile(resolve(root,'content/equations/missing-step-allowlist.yaml'),'utf8');
  const allowed=parseMissingStepAllowlist(parseContentJson(policyRaw, 'equations/missing-step-allowlist.yaml'));
  const lessons=[];
  const inputs=[policyRaw];
  for(const file of (await readdir(directory)).filter(p=>p.endsWith('.yaml')).sort()) {
    const raw=await readFile(resolve(directory,file),'utf8');inputs.push(raw);
    const lesson=parseMissingStepLesson(parseContentJson(raw, file),allowed,anchors);
    checkWorkedTransitions(lesson);
    const math=(expression,highlights)=>{ const html=renderToString(expressionToDerivationLatex(expression,new Set(highlights),true),{
      displayMode:true,output:'htmlAndMathml',throwOnError:true,strict:code=>code==='htmlExtension'?'ignore':'error',
      trust:context=>context.command==='\\htmlData' && context.attributes &&
        Object.keys(context.attributes).length===1 && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(context.attributes['data-expression-id']??''),
      maxExpand:1000,maxSize:20,
    });
    // An untrusted KaTeX HTML extension may render as unsupported text instead of throwing.
    for(const id of highlights) if(!html.includes(`data-expression-id="${id}"`))
      throw new Error(`Missing-step mathematics omitted its changed-subexpression marker: ${id}.`);
    if(!html.includes('<math')) throw new Error('Missing-step mathematics lacks its MathML equivalent.');
    return html;
    };
    const steps=lesson.transitions.map(t=>{
      const step=lesson.chain.steps.find(s=>s.id===t.fromStepId);
      return {id:t.id,title:t.title,fromHtml:math(step.from,t.changedSubexpressionIds),toHtml:math(step.to,t.changedSubexpressionIds),
        changed:t.changedSubexpressionIds,rule:missingStepRuleStatement(step.rule),
        premiseTexts:lesson.premises.filter(p=>t.premiseIds.includes(p.id)).map(p=>p.text),readings:step.reasons,isMove:step.isMove};
    });
    if(profile==='scaffold')lessons.push({id:lesson.chain.id,argument:lesson.argument,title:lesson.title,routeLabel:lesson.routeLabel,
      sourceLink:lesson.sourceLink,sourceLabel:lesson.sourceLabel,sourceNotice:lesson.sourceNotice,premiseNotice:lesson.premiseNotice,
      generalization:lesson.generalization,absoluteNote:lesson.absoluteNote,modernNote:lesson.modernNote,steps,
      cases:[
        {label:'Independent steps',explanation:'All four pairs are equally likely. The cross products cancel only in the average, not in each outcome.',result:enumerateSignedSteps(2)},
        {label:'Always the same direction',explanation:'Both individual steps still have zero mean and mean square one. Removing independence makes the cross contribution positive.',result:enumerateSignedSteps(2,'same-direction')},
        {label:'Always opposite directions',explanation:'The same individual step averages now produce complete cancellation of the total displacement. Zero means alone are not enough.',result:enumerateSignedSteps(2,'opposite-direction')},
      ]});
  }
  const result={schemaVersion:1,profile,contentDigest:createHash('sha256').update(inputs.join('\0')).digest('hex'),
    sourceDigest:hashModuleClosure(root,['scripts/generate-missing-steps.mjs']),lessons};
  await mkdir(output,{recursive:true});await writeFile(resolve(output,'missing-steps.json'),JSON.stringify(result)+'\n');
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const result=await generateMissingSteps();console.log(JSON.stringify({event:'missing-steps-generated',lessons:result.lessons.length,contentDigest:result.contentDigest}));
}
