import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {parseKitchenCsv} from '../src/experiments/bm07/kitchen/csv.ts';
import {KITCHEN_COLUMNS,KITCHEN_READER_COLUMNS} from '../src/experiments/bm07/kitchen/schema.ts';

/** Runs against the production export, or the separately labeled component harness. */
export async function checkKitchenBrowser(browser,url,check){
 const route='/lab/bm-07/kitchen/',practice=await readFile('public/edition/kitchen/practice.csv','utf8');
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});
 try{
  const page=await noJs.newPage();await page.goto(url+'/kitchen/');
  assert.equal(await page.locator('[data-kitchen-stages] tbody tr').count(),3);
  await page.getByText('Reader-filled columns and blank observation rows',{exact:true}).click();
  assert.deepEqual(await page.locator('.kitchen-worksheet thead th').allTextContents(),[...KITCHEN_READER_COLUMNS]);
  await page.getByText('Required CSV header and metadata declaration keys',{exact:true}).click();
  assert.equal(await page.locator('.kitchen-schema').innerText(),KITCHEN_COLUMNS.join(','));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const downloaded=await page.request.get(url+'/edition/kitchen/practice.csv');assert.ok(downloaded.ok());assert.equal(parseKitchenCsv(await downloaded.text()).points.length,130);
  await page.screenshot({path:'artifacts/browser/kitchen-guide-no-js-320.png',fullPage:true});
  await page.goto(url+route);assert.ok(await page.getByRole('button',{name:'Analyze synthetic practice data',exact:true}).isDisabled());
  assert.equal(await page.locator('[data-output="correctedD"]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('Kitchen: guide, shared-schema worksheet and downloads remain readable without JavaScript; no observations are fabricated');
 }finally{await noJs.close();}
 const context=await browser.newContext({viewport:{width:1280,height:950}}),page=await context.newPage();
 let workers=0;const errors=[],requests=[];page.on('worker',()=>workers++);page.on('pageerror',e=>errors.push(String(e)));context.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
 const out=(lab,id)=>lab.locator(`[data-output="${id}"]`).first();
 const value=async(lab,id)=>Number(await out(lab,id).getAttribute('data-value'));
 const identity=lab=>lab.evaluate(el=>({run:el.dataset.runId,version:el.dataset.snapshotVersion,digest:el.dataset.documentDigest}));
 const visibleRows=lab=>lab.locator('[data-kitchen-observations] tbody tr').evaluateAll(rows=>rows.map(r=>[...r.children].slice(0,7).map(c=>c.textContent)));
 async function action(lab,fn){const before=await identity(lab),index=await lab.evaluate(el=>[...document.querySelectorAll('[data-instrument-id="bm-07-kitchen"]')].indexOf(el));await fn();await page.waitForFunction(({before,index})=>{const el=document.querySelectorAll('[data-instrument-id="bm-07-kitchen"]')[index];return el&&el.dataset.documentDigest&&el.dataset.snapshotVersion!==before.version&&el.dataset.pending==='false';},{before,index},{timeout:30000});}
 async function showInputs(lab){const details=lab.locator('.kitchen-inputs');if(!await details.evaluate(el=>el.open))await details.locator('summary').click();}
 async function editInputs(lab,edits){await showInputs(lab);for(const [name,text]of Object.entries(edits)){const field=lab.locator(`[name="${name}"]`);if(await field.evaluate(el=>el.tagName==='SELECT'))await field.selectOption(text);else await field.fill(text);}await action(lab,()=>lab.getByRole('button',{name:'Apply input declarations',exact:true}).click());}
 try{
  await page.goto(url+route);const lab=page.locator('[data-instrument-id="bm-07-kitchen"]').first();
  await page.waitForFunction(()=>!document.querySelector('[data-instrument-id="bm-07-kitchen"] input[type="file"]').disabled);
  assert.equal(workers,0);assert.equal(await out(lab,'correctedD').count(),0);
  await action(lab,()=>lab.getByRole('button',{name:'Analyze synthetic practice data',exact:true}).click());
  assert.equal(workers,1);assert.equal(await value(lab,'pairCount'),50);assert.equal(await value(lab,'pairDegrees'),49);
  assert.equal(await out(lab,'molecularNumber').getAttribute('data-result-status'),'underdetermined');
  assert.equal(await lab.locator('[data-kitchen-origin]').getAttribute('data-kitchen-origin'),'synthetic');
  const first=await identity(lab),rows=await visibleRows(lab),diffusion=await value(lab,'correctedD');
  assert.ok((await lab.locator('[data-snapshot-version]').evaluateAll(nodes=>nodes.map(n=>n.dataset.snapshotVersion))).every(v=>v===first.version));
  check('Kitchen: explicit practice import starts one real worker and publishes coherent observations, plots and scientific results');

  await showInputs(lab);await lab.locator('[name="radius_um"]').fill('0.5');
  assert.deepEqual(await identity(lab),first);assert.equal(await out(lab,'molecularNumber').getAttribute('data-result-status'),'underdetermined');
  await lab.locator('[name="radius_provenance"]').selectOption('same-displacements');
  await action(lab,()=>lab.getByRole('button',{name:'Apply input declarations',exact:true}).click());
  assert.equal(await out(lab,'molecularNumber').getAttribute('data-result-status'),'underdetermined');
  await editInputs(lab,{radius_provenance:'independent'});assert.ok(await value(lab,'molecularNumber')>0);assert.equal(await lab.locator('[data-kitchen-meaning]').getAttribute('data-kitchen-meaning'),'synthetic-recovery');
  assert.equal(await value(lab,'correctedD'),diffusion);assert.equal((await identity(lab)).run,first.run);assert.deepEqual(await visibleRows(lab),rows);
  const halfRadiusN=await value(lab,'molecularNumber');await editInputs(lab,{radius_um:'1'});assert.equal(await value(lab,'molecularNumber'),halfRadiusN/2);
  const beforeEstimator=await identity(lab),beforeBound=await out(lab,'diffusionInterval').getAttribute('data-upper');
  await lab.locator('[name="coverage"]').fill('90');await action(lab,()=>lab.getByRole('button',{name:'Apply analysis choices',exact:true}).click());
  assert.equal((await identity(lab)).digest,beforeEstimator.digest);assert.equal((await identity(lab)).run,beforeEstimator.run);assert.notEqual(await out(lab,'diffusionInterval').getAttribute('data-upper'),beforeBound);assert.deepEqual(await visibleRows(lab),rows);
  check('Kitchen: independent-radius declarations and interval choices preserve observations; drafts and circular radius declarations cannot manufacture an inference');

  await editInputs(lab,{exposure_s:''});assert.equal(await out(lab,'diffusionInterval').getAttribute('data-result-status'),'not-applicable');assert.match(await out(lab,'diffusionInterval').innerText(),/exposure/);
  await editInputs(lab,{exposure_s:'0.5'});const beforeInvalid=await identity(lab);
  await showInputs(lab);await lab.locator('[name="pixels_per_um_x"]').fill('=1+1');await lab.getByRole('button',{name:'Apply input declarations',exact:true}).click();assert.match(await lab.getByRole('alert').innerText(),/finite decimal/);assert.deepEqual(await identity(lab),beforeInvalid);
  await action(lab,()=>lab.getByRole('button',{name:'Reanalyze accepted observations',exact:true}).click());
  check('Kitchen: unknown exposure withholds coverage; invalid calibration preserves the accepted analysis and recovery applies no unfinished drafts');

  await lab.getByRole('button',{name:'Inspect row 2',exact:true}).click();await lab.getByLabel('Reason for exclusion',{exact:true}).fill('Obscured by another particle');
  await action(lab,()=>lab.getByRole('button',{name:'Exclude selected observation',exact:true}).click());
  assert.equal(await value(lab,'pairCount'),49);assert.equal(await out(lab,'diffusionInterval').getAttribute('data-result-status'),'not-applicable');
  const excluded=await visibleRows(lab);assert.deepEqual(excluded[1].slice(0,5),rows[1].slice(0,5));assert.match(excluded[1][5],/excluded: Obscured/);
  await lab.getByRole('button',{name:'Inspect row 2',exact:true}).click();await action(lab,()=>lab.getByRole('button',{name:'Restore selected observation',exact:true}).click());
  assert.equal(await value(lab,'pairCount'),50);assert.equal(await value(lab,'correctedD'),diffusion);assert.deepEqual(await visibleRows(lab),rows);
  await lab.getByRole('button',{name:'Next observations',exact:true}).click();assert.equal(await lab.locator('[data-kitchen-row="50"]').count(),1);
  await lab.getByRole('button',{name:'Next observations',exact:true}).click();assert.equal(await lab.locator('[data-kitchen-observations] tbody tr').count(),30);assert.match(await lab.locator('[data-kitchen-observations]').innerText(),/stationary/);
  await lab.getByRole('button',{name:'Previous observations',exact:true}).click();await lab.getByRole('button',{name:'Previous observations',exact:true}).click();
  check('Kitchen: exclusions are reversible without erasing coordinates, pair boundaries or reasons; every observation is reachable');

  const old=await identity(lab);await lab.locator('input[type="file"]').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('not a CSV')});
  await lab.getByRole('button',{name:'Import selected CSV',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-instrument-id="bm-07-kitchen"] .status-line').textContent.includes('columns:'));
  assert.deepEqual(await identity(lab),old);
  await lab.locator('input[type="file"]').setInputFiles({name:'too-large.csv',mimeType:'text/csv',buffer:Buffer.alloc(2097153,120)});await lab.getByRole('button',{name:'Import selected CSV',exact:true}).click();assert.match(await lab.getByRole('alert').innerText(),/2 MiB/);assert.deepEqual(await identity(lab),old);
  const marker='PRIVATE-OBSERVATION-TEST-947251';const readerCsv=practice.replace('# data_origin=synthetic','# data_origin=reader-supplied').replace(/# sample=.*/,`# sample=${marker} <img src=x onerror=alert(1)>`);
  await lab.locator('input[type="file"]').setInputFiles({name:'my-observations.csv',mimeType:'text/csv',buffer:Buffer.from(readerCsv)});await action(lab,()=>lab.getByRole('button',{name:'Import selected CSV',exact:true}).click());
  assert.equal(await lab.locator('[data-kitchen-origin]').getAttribute('data-kitchen-origin'),'reader-supplied');assert.equal(await lab.locator('.accepted-caption img').count(),0);assert.ok((await lab.locator('.accepted-caption').innerText()).includes(marker));
  await editInputs(lab,{radius_um:'.5',radius_provenance:'independent'});assert.equal(await lab.locator('[data-kitchen-meaning]').getAttribute('data-kitchen-meaning'),'independent-estimate');
  const originalDiffusion=await value(lab,'correctedD'),originalFile=await identity(lab);
  await lab.locator('[name="constantSet"]').selectOption('modern-si-2019');await action(lab,()=>lab.getByRole('button',{name:'Apply analysis choices',exact:true}).click());
  assert.equal(await lab.locator('[data-kitchen-meaning]').getAttribute('data-kitchen-meaning'),'consistency-check');assert.equal(await value(lab,'correctedD'),originalDiffusion);assert.equal((await identity(lab)).digest,originalFile.digest);
  assert.ok(!requests.some(r=>r.url.includes(marker)||r.body?.includes(marker)));assert.ok(!requests.some(r=>r.method!=='GET'));assert.equal(await page.evaluate(marker=>JSON.stringify({...localStorage,...sessionStorage}).includes(marker),marker),false);
  check('Kitchen: real file imports are bounded and locally handled; literal input is not HTML, and modern-SI reanalysis changes interpretation without changing data');

  const beforeExport=await identity(lab),beforeWorkers=workers;
  for(const [button,name]of [['Export accepted observations','kitchen-accepted.csv'],['Export accepted analysis','kitchen-accepted.json']]){
    const event=page.waitForEvent('download');await lab.getByRole('button',{name:button,exact:true}).click();await (await event).saveAs(`artifacts/browser/${name}`);
  }
  const exported=parseKitchenCsv(await readFile('artifacts/browser/kitchen-accepted.csv','utf8')),receipt=JSON.parse(await readFile('artifacts/browser/kitchen-accepted.json','utf8'));
  assert.equal(exported.points.length,130);assert.equal(exported.metadata.radius_provenance,'independent');assert.deepEqual(parseKitchenCsv(receipt.observationsCsv).points,exported.points);assert.equal(receipt.documentDigest,beforeExport.digest);assert.equal(receipt.results.find(o=>o.quantityId==='correctedD').value,originalDiffusion);assert.match(receipt.provenance,/not been independently verified/);assert.equal(workers,beforeWorkers);assert.deepEqual(await identity(lab),beforeExport);
  const pasteDetails=lab.locator('details').filter({has:lab.getByText('Paste an observation CSV instead',{exact:true})});await pasteDetails.locator('summary').click();await lab.getByLabel('CSV text',{exact:true}).fill(await readFile('artifacts/browser/kitchen-accepted.csv','utf8'));await action(lab,()=>lab.getByRole('button',{name:'Import pasted CSV',exact:true}).click());assert.equal(await value(lab,'correctedD'),originalDiffusion);
  check('Kitchen: accepted CSV and analysis receipts round-trip through the real importer, preserving all observations and typed results without new computation on export');

  const firstBeforeSecond=await identity(lab);await page.getByRole('button',{name:'Open a separate observation laboratory',exact:true}).click();const second=page.locator('[data-instrument-id="bm-07-kitchen"]').nth(1);
  await action(second,()=>second.getByRole('button',{name:'Analyze synthetic practice data',exact:true}).click());assert.equal(workers,2);assert.deepEqual(await identity(lab),firstBeforeSecond);const secondIdentity=await identity(second);
  await lab.getByRole('button',{name:'Clear local observations',exact:true}).click();await lab.getByRole('button',{name:'Keep observations',exact:true}).click();assert.deepEqual(await identity(lab),firstBeforeSecond);
  await lab.getByRole('button',{name:'Clear local observations',exact:true}).click();await lab.getByRole('button',{name:'Confirm clear this laboratory',exact:true}).click();assert.equal(await lab.locator('[data-output]').count(),0);assert.deepEqual(await identity(second),secondIdentity);assert.equal(await lab.getByLabel('CSV text',{exact:true}).inputValue(),'');
  await page.getByRole('button',{name:'Close second observation laboratory',exact:true}).click();await action(lab,()=>lab.getByRole('button',{name:'Analyze synthetic practice data',exact:true}).click());assert.notEqual((await identity(lab)).run,firstBeforeSecond.run);
  check('Kitchen: separate placements own separate workers and observations; confirmed clearing affects only the selected local record');

  const audit=await new AxeBuilder({page}).include('#main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await lab.locator('.lab-columns').screenshot({path:'artifacts/browser/kitchen-desktop.png'});await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await lab.locator('.kitchen-results').screenshot({path:'artifacts/browser/kitchen-results-320.png'});
  await showInputs(lab);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.emulateMedia({media:'print'});assert.ok(!await lab.locator('.kitchen-import').isVisible());assert.ok(await lab.locator('.kitchen-results').isVisible());await page.emulateMedia({media:'screen'});
  assert.deepEqual(errors,[]);check('Kitchen: mobile reflow, scrollable evidence tables, print and automated accessibility',{violations:audit.violations.map(v=>v.id),manualScreenReaderReview:'not performed'});
 }catch(error){await writeFile('artifacts/browser/kitchen-failure.json',JSON.stringify({url:page.url(),errors,body:await page.locator('body').innerText()},null,2));await page.screenshot({path:'artifacts/browser/kitchen-failure.png',fullPage:true});throw error;}finally{await context.close();}
}
