import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import ts from "typescript";

// Exercise the real DOM island and capture owner in Chromium. These accepted-view boundary
// fixtures do NOT execute React, the site's physics sessions, or a full Next build.
let browser;
const compiled = {};
let css = "";
before(async () => {
  for (const file of ["core.ts", "specs.ts", "workspace.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const built = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
    assert.equal(built.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
    compiled[file] = built.outputText;
  }
  css = await readFile(new URL("investigation.css", import.meta.url), "utf8");
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); });
async function pageFor(paper = "brownian-motion", width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A wholly in-memory fixture: no navigation, server, network permission, or external assets.
  await page.setContent('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Investigation boundary fixture</title><body><h1>Investigation boundary fixture</h1><form id="enclosing-form"><div id="host"></div></form><div id="other-host"></div></body></html>');
  await page.addStyleTag({ content: ':root{--ink:#202020;--panel:#fff;--line:#aaa;--accent:#124;--wash:#eee}body{font:16px/1.5 system-ui;max-width:720px;margin:auto;padding:16px}button,input,textarea{font:inherit}button{padding:8px}h4{font-size:1.1rem}' + css });
  await page.evaluate(({ compiled, paper }) => {
    // The three actual modules compiled to CommonJS, not replacements for their implementations.
    const cache = new Map();
    function load(path) {
      const name = path.replace(/^\.\//, "");
      if (cache.has(name)) return cache.get(name).exports;
      if (!Object.hasOwn(compiled, name)) throw new Error(`Unexpected fixture dependency: ${path}`);
      const module = { exports: {} }; cache.set(name, module);
      new Function("require", "module", "exports", compiled[name])(load, module, module.exports);
      return module.exports;
    }
    const { createInvestigationStore } = load("core.ts");
    const { INVESTIGATIONS } = load("specs.ts");
    const { mountInvestigationWorkspace } = load("workspace.ts");
    window.submitCount = 0;
    window.storageReads = 0;
    // Spy only on prohibited I/O, not on the model or capture implementation.
    for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(window, key, { get() { window.storageReads++; throw new Error("The investigation must not read browser storage."); } });
    document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.submitCount++; });
    function mount(paper, host, placement) {
      const spec = INVESTIGATIONS[paper];
      const identity = { experimentId: spec.experimentId, instanceId: placement, runId: 'fixture-run-1', actionIndex: 1, revisions: {input:1,observer:0,measurement:0,estimator:0}, parameters: { radius: 5e-7, temperature: 290.15, seed: '18446744073709551615' } };
      let current = {status:'accepted',pending:false,requested:{...identity},accepted:{...identity,snapshotVersion:1,stepIndex:0,simulationTime:0,final:true,outputs:spec.quantities.map((q,i)=>({quantityId:q.id,ownerId:'fixture.owner',semanticKind:'fixture-scalar',unit:'fixture-unit',status:'value',value:(i+1)*1e-7}))}};
      const initial = current;
      const listeners = new Set();
      const session = {getSnapshot:()=>current,getServerSnapshot:()=>initial,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)}};
      const store = createInvestigationStore(spec);
      const detach = store.connect(session, 'fixture-source-v1');
      const task = { promptId:spec.promptId, task:'Predict this boundary fixture.', perturbPrompt:'Change a fixture setting.', explainPrompt:'Explain this model fixture, not a measurement.' };
      const mounted = mountInvestigationWorkspace(host,store,task);
      return {store,session,
        update({pending=false,notify=true,extra=false,nonnumeric=false,offset=false}={}){
          current = structuredClone(current); current.pending=pending;current.status=pending?'pending':'accepted';
          current.accepted.actionIndex++;current.accepted.snapshotVersion++;current.accepted.runId='fixture-run-'+current.accepted.actionIndex;
          current.accepted.revisions.input++; current.accepted.parameters.radius *= 2;
          if(extra)current.accepted.parameters.temperature++;
          if(offset)current.accepted.parameters.offset=-0;
          current.accepted.outputs[0].value=5.65685424949238e-8;
          if(nonnumeric)current.accepted.outputs[0]={quantityId:spec.quantities[0].id,ownerId:'fixture.owner',semanticKind:'fixture-scalar',unit:'fixture-unit',status:'not-applicable',reason:'No electron is emitted in this model.'};
          current.requested={...current.accepted};
          if(notify)for(const listener of listeners)listener();
        },
        dispose(){mounted.dispose();detach()},
        listeners:()=>listeners.size,
      };
    }
    window.fixture = mount(paper,document.querySelector('#host'),'fixture-placement-A');
    window.mountOther = ()=>window.other=mount(paper,document.querySelector('#other-host'),'fixture-placement-B');
  }, { compiled, paper });
  return { page, errors };
}
async function start(page) {
  await page.getByLabel("What do you predict, and why?", { exact: true }).fill("I expect a smaller reading because only one setting changes.");
  await page.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).click();
}
async function downloadText(download) {
  const stream = await download.createReadStream();
  assert.ok(stream);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

for (const paper of ["brownian-motion", "light-quanta", "special-relativity", "mass-energy"]) {
  test(`${paper}: pin a prediction, capture a changed accepted reading, and keep both`, async () => {
    const { page, errors } = await pageFor(paper);
    try {
      await start(page);
      await page.evaluate(() => fixture.update());
      await page.getByLabel("Label for the changed reading (optional)").fill("Changed case");
      await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
      const report = await page.evaluate(() => fixture.store.getSnapshot().report);
      assert.equal(report.observations.length, 1);
      assert.equal(report.observations[0].reading.outputs[0].value, 5.65685424949238e-8);
      assert.equal(report.baseline.reading.outputs[0].value, 1e-7);
      assert.equal(await page.locator('[data-investigation-reading="Changed case"]').count(), 1);
      assert.match(await page.locator('[data-investigation-reading="Changed case"]').innerText(), /One accepted setting changed/);
      assert.equal(await page.evaluate(() => window.submitCount), 0);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
test("a silently pending worker is refused at click time and cannot overwrite the pinned evidence", async () => {
  const { page, errors } = await pageFor();
  try {
    await start(page);
    await page.evaluate(() => fixture.update({ pending: true, notify: false }));
    assert.equal(await page.getByRole("button", { name: "Capture changed reading", exact: true }).isEnabled(), true);
    await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
    assert.match(await page.getByRole("alert").innerText(), /complete result/);
    assert.equal(await page.evaluate(() => fixture.store.getSnapshot().report.observations.length), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test("several changed controls are named rather than represented as a one-variable experiment", async () => {
  const { page } = await pageFor();
  try {
    await start(page); await page.evaluate(() => fixture.update({ extra: true }));
    await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
    assert.match(await page.locator('[data-investigation-reading="Comparison 1"]').innerText(), /2 accepted settings changed/);
  } finally { await page.close(); }
});
test("nonnumeric scientific statuses display the reason instead of a zero", async () => {
  const { page } = await pageFor("light-quanta");
  try {
    await start(page); await page.evaluate(() => fixture.update({ nonnumeric: true }));
    await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
    const text = await page.locator('[data-investigation-reading="Comparison 1"] [data-investigation-quantity="incidentPower"]').innerText();
    assert.match(text, /No electron is emitted/);
    assert.doesNotMatch(text, /^0/);
  } finally { await page.close(); }
});
test("private prediction markup is inert and never sent to storage or URL state", async () => {
  const { page, errors } = await pageFor();
  try {
    const url = page.url();
    await page.getByLabel("What do you predict, and why?", { exact: true }).fill('<img src="https://invalid.test" onerror="window.bad=true"><script>window.bad=true</script>');
    await page.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).click();
    assert.equal(await page.locator("img").count(), 0);
    assert.equal(await page.evaluate(() => window.bad), undefined);
    assert.equal(await page.evaluate(() => window.storageReads), 0);
    assert.equal(page.url(), url);
    assert.match(await page.locator('[data-investigation-prediction]').innerText(), /<script>/);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test("JSON download includes exact values, signed zero, and the explanation still in the editor", async () => {
  const { page } = await pageFor();
  try {
    await start(page); await page.evaluate(() => fixture.update({ offset: true }));
    await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
    await page.getByLabel("Explain what changed, what stayed fixed, and what this model cannot establish").fill("This was computed, not measured. λ");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download investigation JSON", exact: true }).click();
    const download = await pending;
    const report = JSON.parse(await downloadText(download));
    assert.equal(report.explanation, "This was computed, not measured. λ");
    assert.equal(report.observations[0].reading.outputs[0].value, 5.65685424949238e-8);
    assert.ok(Object.is(report.observations[0].reading.parameters.offset, -0));
    assert.equal(download.suggestedFilename(), "brownian-motion-investigation.json");
  } finally { await page.close(); }
});
test("printable download is self-contained and safely renders private text", async () => {
  const { page } = await pageFor();
  try {
    await start(page);
    await page.getByLabel("Explain what changed, what stayed fixed, and what this model cannot establish").fill('<img src="https://invalid.test"> A & B');
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download printable investigation", exact: true }).click();
    const text = await downloadText(await pending);
    assert.match(text, /&lt;img/); assert.doesNotMatch(text, /<script|<img|<iframe/);
    assert.match(text, /Content-Security-Policy/); assert.match(text, /not measurements/);
    assert.match(text, /A &amp; B/);
  } finally { await page.close(); }
});
test("recording controls do not submit their enclosing laboratory form, including Enter in the label", async () => {
  const { page } = await pageFor();
  try {
    await start(page);
    const label = page.getByLabel("Label for the changed reading (optional)");
    await label.fill("Case"); await label.press("Enter");
    await page.getByRole("button", { name: "Keep my explanation", exact: true }).click();
    assert.equal(await page.evaluate(() => window.submitCount), 0);
  } finally { await page.close(); }
});
test("replacement requires explicit confirmation and leaves laboratory parameters intact", async () => {
  const { page } = await pageFor();
  try {
    await start(page);
    const before = await page.evaluate(() => fixture.session.getSnapshot());
    await page.getByRole("button", { name: "Start another investigation", exact: true }).click();
    await page.getByRole("button", { name: "Keep this investigation", exact: true }).click();
    assert.ok(await page.evaluate(() => fixture.store.getSnapshot().report));
    await page.getByRole("button", { name: "Start another investigation", exact: true }).click();
    await page.getByRole("button", { name: "Replace this investigation", exact: true }).click();
    assert.equal(await page.evaluate(() => fixture.store.getSnapshot().report), null);
    assert.deepEqual(await page.evaluate(() => fixture.session.getSnapshot()), before);
    assert.equal(await page.getByLabel("What do you predict, and why?", { exact: true }).inputValue(), "");
  } finally { await page.close(); }
});
test("two workspaces keep their evidence and control identities separate", async () => {
  const { page } = await pageFor();
  try {
    await page.evaluate(() => mountOther());
    const first = page.locator("#host"), second = page.locator("#other-host");
    await first.getByLabel("What do you predict, and why?", { exact: true }).fill("First prediction");
    await first.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).click();
    await second.getByLabel("What do you predict, and why?", { exact: true }).fill("Second prediction");
    await second.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).click();
    assert.equal(await page.evaluate(() => fixture.store.getSnapshot().report.prediction), "First prediction");
    assert.equal(await page.evaluate(() => other.store.getSnapshot().report.prediction), "Second prediction");
    const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, ids.length);
  } finally { await page.close(); }
});
for (const width of [320, 1280]) {
  test(`${width}px: long words, complete metadata, and all controls remain within the viewport`, async () => {
    const { page, errors } = await pageFor("light-quanta", width);
    try {
      await page.getByLabel("What do you predict, and why?", { exact: true }).fill("word".repeat(800));
      await page.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).click();
      await page.evaluate(() => fixture.update({ extra: true }));
      await page.getByLabel("Label for the changed reading (optional)").fill("x".repeat(160));
      await page.getByRole("button", { name: "Capture changed reading", exact: true }).click();
      await page.locator("details").evaluateAll((nodes) => nodes.forEach((node) => { node.open = true; }));
      const widths = await page.evaluate(() => ({ view: innerWidth, page: document.documentElement.scrollWidth }));
      assert.ok(widths.page <= widths.view, JSON.stringify(widths));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
test("disposing the island releases listeners and prevents detached controls from recording", async () => {
  const { page } = await pageFor();
  try {
    await start(page);
    await page.evaluate(() => { window.oldCapture = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Capture changed reading'); fixture.dispose(); fixture.update(); oldCapture.click(); });
    assert.equal(await page.locator("#host").textContent(), "");
    assert.equal(await page.evaluate(() => fixture.listeners()), 0);
    assert.equal(await page.evaluate(() => fixture.store.getSnapshot().report.observations.length), 0);
  } finally { await page.close(); }
});

test("pinning by keyboard moves focus out of the now-hidden prediction controls", async () => {
  const { page } = await pageFor();
  try {
    await page.getByLabel("What do you predict, and why?", { exact: true }).fill("My prediction");
    await page.getByRole("button", { name: "Pin prediction and starting reading", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Go to this task's laboratory on this page");
    assert.equal(await page.evaluate(() => window.submitCount), 0);
  } finally { await page.close(); }
});
