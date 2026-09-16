import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

/** Real static pages and production dedicated workers, with no substitute UI. */
export async function checkWalkBrowser(browser,url,check) {
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});
 const staticPage=await noJs.newPage();await staticPage.goto(`${url}/lab/bm-05/`);
 const staticLab=staticPage.locator('[data-instrument-id="bm-05"]');
 assert.equal(await staticLab.locator('.walk-trace').count(),20);
 assert.equal(await staticLab.locator('[data-quantity-id="diffusionCoefficient"]').innerText(),'1.25');
 assert.equal(await staticLab.locator('[data-quantity-id="modelMeanSquare"]').innerText(),'1');
 assert.match(await staticLab.innerText(),/Binomial counts out of 16/);
 assert.equal(await staticLab.getByRole('button',{name:'Apply walk settings',exact:true}).isDisabled(),true);
 assert.ok(await staticPage.locator('math').count()>=3);
 assert.ok((await staticLab.locator('svg .axis').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fill))).every(fill=>fill==='none'));
 assert.ok(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await staticPage.screenshot({path:'artifacts/browser/walks-no-js-320.png',fullPage:true});
 check('BM-05: exact coin probabilities, model values, traces and derivation readable without JavaScript at 320px');await noJs.close();
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage();
 const errors=[];let workers=0;page.on('pageerror',e=>errors.push(String(e)));page.on('worker',()=>workers++);
 try {
  await page.goto(`${url}/lab/bm-05/`);const lab=page.locator('[data-instrument-id="bm-05"]').first(),apply=lab.getByRole('button',{name:'Apply walk settings',exact:true});
  await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
  assert.equal(workers,0);assert.deepEqual(errors,[]);check('BM-05: hydration preserves the worked example without starting a random trial');
  const value=id=>lab.locator(`[data-quantity-id="${id}"]`).first().getAttribute('data-value');
  async function accepted(action,target=lab){const before=Number(await target.getAttribute('data-snapshot-version')),id=await target.getAttribute('data-instance-id');await action();await page.waitForFunction(({id,before})=>{const n=[...document.querySelectorAll('[data-instrument-id="bm-05"]')].find(n=>n.dataset.instanceId===id);return n?.dataset.pending==='false'&&Number(n.dataset.snapshotVersion)>before;},{id,before},{timeout:20000});}
  await lab.locator('[name="walkers"]').fill('160');await lab.locator('[name="seed"]').fill('9007199254740993');await accepted(()=>apply.click());
  assert.equal(workers,1);assert.match(await lab.locator('.accepted-caption').innerText(),/9007199254740993/);
  const run=await lab.getAttribute('data-run-id'),draws=await lab.getAttribute('data-recording-draws'),initialTrace=await lab.locator('.walk-trace').first().getAttribute('d');
  const originalMean=await value('sampleMean');assert.equal(draws,'64000');assert.equal(await value('shapeTerm'),'0.1875');
  const versions=await lab.locator('[data-snapshot-version]').evaluateAll(ns=>ns.map(n=>n.dataset.snapshotVersion));assert.ok(versions.every(v=>v===versions[0]));
  check('BM-05: one worker publishes the exact four-step law, all-member statistics and a 64-bit seed');
  await accepted(()=>lab.getByRole('button',{name:'Observe 400 steps',exact:true}).click());assert.equal(await lab.getAttribute('data-run-id'),run);assert.equal(await lab.getAttribute('data-recording-draws'),draws);assert.equal(await lab.getAttribute('data-request-draws'),'0');assert.ok(Math.abs(Number(await value('modelMeanSquare'))*1e12-100)<1e-12);
  await lab.locator('[name="n"]').fill('43');await accepted(()=>apply.click());assert.equal(await lab.getAttribute('data-run-id'),run);assert.ok(Number(await lab.getAttribute('data-replayed-draws'))>0);
  await accepted(()=>lab.getByRole('button',{name:'Observe 4 steps',exact:true}).click());assert.equal(await lab.locator('.walk-trace').first().getAttribute('d'),initialTrace);assert.equal(await value('sampleMean'),originalMean);
  check('BM-05: cached and replayed observations preserve the identical trial and report replay work honestly');
  for(const kernel of ['uniform','gaussian']){
   await lab.locator('[name="kernel"]').selectOption(kernel);await accepted(()=>apply.click());assert.equal(await value('diffusionCoefficient'),'1.25e-12');assert.equal(await value('stepSecondMoment'),'2.5e-13');assert.notEqual(await lab.getAttribute('data-run-id'),run);
   const gap=Number(await value('shapeTerm'));if(kernel==='gaussian')assert.equal(gap,0);else assert.ok(Math.abs(gap-.0073842319360238)<1e-12);
  }
  check('BM-05: changing step shape preserves variance and diffusivity while changing the finite-step shape gap');
  const biasRun=await lab.getAttribute('data-run-id');await accepted(()=>lab.getByRole('button',{name:'Restore equal left/right probability',exact:true}).click());assert.equal(await lab.getAttribute('data-run-id'),biasRun);assert.equal(await lab.getAttribute('data-request-draws'),'0');assert.equal(await value('biasedDiffusion'),'1.25e-12');
  await lab.getByText('Remove finite variance: Cauchy steps',{exact:true}).click();assert.match(await lab.locator('[data-quantity-id="cauchyDiffusion"]').innerText(),/Cauchy variance is not finite/);
  await lab.getByText('Shrink the interval: what must stay fixed?',{exact:true}).click();assert.match(await lab.locator('[data-quantity-id="continuumLimit"]').innerText(),/grow without bound/);
  check('BM-05: analytic drift, infinite-variance and continuum-limit cases do not create unsupported sampled paths');
  await lab.locator('[name="n"]').fill('0');await accepted(()=>apply.click());assert.equal(await value('modelMeanSquare'),'0');assert.match(await lab.innerText(),/Before any steps, all walkers are at zero/);assert.equal(await lab.locator('.plot').first().locator('.comparison-curve').count(),0);
  const zeroVersion=await lab.getAttribute('data-snapshot-version');await lab.locator('[name="n"]').fill('0.5');await apply.click();await lab.getByRole('alert').waitFor();assert.equal(await lab.getAttribute('data-snapshot-version'),zeroVersion);
  await accepted(()=>lab.getByRole('button',{name:'Observe 4 steps',exact:true}).click());
  check('BM-05: zero-step limits and invalid observations never masquerade as a Gaussian result');
  const prior=await lab.getAttribute('data-snapshot-version');await lab.locator('[name="walkers"]').fill('10000');await lab.locator('[name="runSteps"]').fill('10000');await apply.click();await lab.getByRole('button',{name:'Restore accepted settings',exact:true}).waitFor();assert.equal(await lab.getAttribute('data-snapshot-version'),prior);await accepted(()=>lab.getByRole('button',{name:'Restore accepted settings',exact:true}).click());
  await lab.locator('[name="kernel"]').selectOption('uniform');await lab.locator('[name="runSteps"]').fill('401');await lab.locator('[name="n"]').fill('401');const previous=await lab.getAttribute('data-snapshot-version');await apply.click();await lab.getByText(/exact uniform-sum shape comparison is bounded to 400 steps/).waitFor();assert.equal(await lab.getAttribute('data-snapshot-version'),previous);await accepted(()=>lab.getByRole('button',{name:'Restore accepted settings',exact:true}).click());
  check('BM-05: work and exact-law budgets preserve accepted data and provide a working recovery');
  await lab.locator('[name="seed"]').fill('9007199254740992');await accepted(()=>apply.click());const seedCaption=await lab.locator('.accepted-caption').innerText();await lab.locator('[name="seed"]').fill('01');await apply.click();await lab.getByRole('alert').waitFor();assert.equal(await lab.locator('.accepted-caption').innerText(),seedCaption);
  await lab.getByRole('button',{name:'Copy accepted walk link',exact:true}).click();const link=await lab.getByLabel('Accepted trial link',{exact:true}).inputValue();assert.equal(new URL(link).searchParams.get('seed'),'9007199254740992');
  const shared=await context.newPage();let sharedWorkers=0;shared.on('worker',()=>sharedWorkers++);await shared.goto(link);await shared.getByText('Shared settings are loaded as a draft.',{exact:false}).waitFor();assert.equal(await shared.locator('[name="seed"]').inputValue(),'9007199254740992');assert.match(await shared.locator('.accepted-caption').innerText(),/seed 1905;/);assert.equal(sharedWorkers,0);await shared.close();
  check('BM-05: invalid seeds cannot overwrite accepted settings and shared links load drafts without autoplay');
  await page.getByRole('button',{name:'Open an independent walk laboratory',exact:true}).click();const second=page.locator('[data-instrument-id="bm-05"]').nth(1);await second.locator('[name="walkers"]').fill('20');await second.locator('[name="runSteps"]').fill('64');await second.locator('[name="seed"]').fill('42');const first=await lab.locator('.accepted-caption').innerText();await accepted(()=>second.getByRole('button',{name:'Apply walk settings',exact:true}).click(),second);assert.equal(workers,2);assert.equal(await lab.locator('.accepted-caption').innerText(),first);assert.notEqual(await second.getAttribute('data-instance-id'),await lab.getAttribute('data-instance-id'));await page.getByRole('button',{name:'Close second walk laboratory',exact:true}).click();
  check('BM-05: independent instances retain separate trials and worker ownership');
  const audit=await new AxeBuilder({page}).include('#main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  check('BM-05: automated accessibility supplement',{violations:audit.violations.map(v=>v.id),manualScreenReaderReview:'not performed'});
  await page.screenshot({path:'artifacts/browser/walks-desktop.png',fullPage:true});await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'artifacts/browser/walks-320.png',fullPage:true});assert.deepEqual(errors,[]);
  check('BM-05: interactive 320px reflow and no uncaught browser errors');
 }catch(error){await page.screenshot({path:'artifacts/browser/walks-failure.png',fullPage:true});console.error('Walk browser errors:',errors);throw error;}finally{await context.close();}
}
