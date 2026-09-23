/** Real search/launcher controllers on a small fixture server; no mocked query engine or DOM. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ts from "typescript";
import { packageSearchIndex } from "../../src/search/build.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifactDir = resolve(root, "artifacts/browser/search");
await mkdir(artifactDir, { recursive: true });
const base = {
  paper: "brownian-motion",
  section: "s5",
  lang: "en",
  terms: [],
  route: "/papers/brownian-motion/",
  anchor: "arg-bm-observable",
  face: "reading",
  scopeLabel: "Authored explanatory preview",
};
const documents = [
  {
    ...base,
    id: "rms",
    type: "argument",
    title: "Mean square displacement",
    text: "How far a particle wanders",
  },
  {
    ...base,
    id: "spread",
    type: "equation",
    title: "Mean square model",
    text: "Compare the diffusion model",
    terms: ["λ_x"],
  },
  {
    ...base,
    id: "clock",
    type: "instrument",
    paper: "special-relativity",
    title: "Clock synchronization",
    text: "Compare distant clocks",
    route: "/lab/sr-01/",
    anchor: "",
    face: "",
  },
  {
    ...base,
    id: "html",
    type: "glossary",
    title: '<img src="x" onerror="alert(1)">',
    text: "Hostile fixture text, rendered literally",
  },
];
const bundle = packageSearchIndex(
  documents,
  [{ phrase: "clocks disagree", target: "clock", label: "search aid" }],
  "f".repeat(64),
  "scaffold",
);
const files = new Map([
  ["/search/index-manifest.json", bundle.manifestText],
  ...bundle.files.map((file) => [file.descriptor.path, file.text]),
  ["/search.css", await readFile(resolve(root, "src/search/search.css"), "utf8")],
  ["/modal.css", await readFile(resolve(root, "src/a11y/modal/modal.css"), "utf8")],
]);
// The palette closes through the site's one shared overlay behaviour, served beside it.
const modulePaths = {
  core: "src/search/core.ts",
  protocol: "src/search/protocol.ts",
  loadIndex: "src/search/loadIndex.ts",
  CommandPalette: "src/search/CommandPalette.ts",
  launcher: "src/search/launcher.ts",
  dismiss: "src/a11y/modal/dismiss.ts",
};
for (const [name, path] of Object.entries(modulePaths)) {
  const source = await readFile(resolve(root, path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    fileName: `${name}.ts`,
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0);
  files.set(
    `/modules/${name}.js`,
    compiled.outputText
      .replace(/(from\s*["'])\.\.\/a11y\/modal\/dismiss\.ts(["'])/gu, "$1./dismiss.js$2")
      .replace(/(from\s*["']|import\(["'])(\.\/[^"']+)\.ts(["'])/gu, "$1$2.js$3"),
  );
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Search acceptance fixture</title><link rel="stylesheet" href="/search.css"><link rel="stylesheet" href="/modal.css"><style>
:root{--ink:#242a29;--panel:#fffdf7;--line:#c7c5b9;--muted:#545b56;--accent:#8b3526;--wash:#e8eadf}
*{box-sizing:border-box}body{font:18px/1.5 Georgia,serif;padding:1rem}button,input{font:inherit}input{width:100%;padding:.6rem}.fine{font:14px/1.5 Arial,sans-serif}
</style></head><body><a id="open" href="/papers/">Search</a><span id="launch-status" role="status"></span>
<label>Unrelated field<input id="unrelated"></label><div contenteditable="true" id="editable">Editable prose</div>
<section id="arg-bm-observable" tabindex="-1"><h1>The selected argument</h1></section>
<script type="module">import {mountSearchLauncher} from '/modules/launcher.js';
window.disposeSearch=mountSearchLauncher(document.querySelector('#open'),document.querySelector('#launch-status'));
window.fixtureReady=true;</script></body></html>`;
let corrupt = false;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://fixture.test").pathname;
  const value = files.get(path);
  if (value !== undefined) {
    const type = path.endsWith(".js")
      ? "text/javascript"
      : path.endsWith(".css")
        ? "text/css"
        : "application/json";
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    response.end(corrupt && /^\/search\/s-/u.test(path) ? "invalid" : value);
  } else if (path === "/" || path.startsWith("/papers/") || path.startsWith("/lab/")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  } else {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const checks = [],
  contexts = [];
async function check(name, callback) {
  await callback();
  checks.push({ name, outcome: "passed" });
}
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  contexts.push(context);
  const page = await context.newPage(),
    requests = [],
    errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.fixtureReady);
  await check("lazy initial route", async () => {
    assert.ok(!requests.some((path) => path.includes("/search/")));
    assert.ok(
      !requests.some((path) => path.includes("CommandPalette") || path.includes("loadIndex")),
    );
  });
  await check("editable fields keep keyboard shortcuts", async () => {
    await page.locator("#unrelated").focus();
    await page.keyboard.press("Control+k");
    assert.equal(await page.locator("[data-search-dialog]").count(), 0);
    await page.locator("#editable").focus();
    await page.keyboard.press("Control+k");
    assert.equal(await page.locator("[data-search-dialog]").count(), 0);
  });
  await page.locator("#open").focus();
  await page.keyboard.press("Control+k");
  const query = page.getByRole("combobox", {
    name: /^(Words, symbols, or a laboratory ID|Words, names or symbols)$/,
  });
  await query.waitFor();
  await page.getByText("4 entries available.", { exact: false }).waitFor();
  await check("modal focus and result semantics", async () => {
    assert.equal(await query.evaluate((node) => node === document.activeElement), true);
    await query.fill("mean square");
    await page.getByText("2 results shown.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("listbox").getByRole("option").count(), 2);
    assert.equal(await query.getAttribute("aria-expanded"), "true");
    assert.equal(await page.getByRole("listbox").count(), 1);
  });
  await check("non-wrapping keyboard selection and stale-result clearing", async () => {
    const first = await query.getAttribute("aria-activedescendant");
    await query.press("ArrowUp");
    assert.equal(await query.getAttribute("aria-activedescendant"), first);
    await query.press("ArrowDown");
    const last = await query.getAttribute("aria-activedescendant");
    assert.notEqual(first, last);
    await query.press("ArrowDown");
    assert.equal(await query.getAttribute("aria-activedescendant"), last);
    await query.fill("clocks disagree");
    assert.equal(await query.getAttribute("aria-activedescendant"), null);
    await page.getByText("1 result shown.", { exact: true }).waitFor();
  });
  await check("Escape returns focus and reopening uses the cached index", async () => {
    await query.press("Escape");
    assert.equal(await page.locator("[data-search-dialog]").count(), 0);
    assert.equal(
      await page.locator("#open").evaluate((node) => node === document.activeElement),
      true,
    );
    const before = requests.filter((path) => path.includes("/search/")).length;
    await page.locator("#open").click();
    await query.waitFor();
    await query.fill("mean square");
    await page.getByText("2 results shown.", { exact: true }).waitFor();
    assert.equal(requests.filter((path) => path.includes("/search/")).length, before);
  });
  await check("offline queries and paper filters", async () => {
    await context.setOffline(true);
    await query.fill("clocks disagree");
    await page.getByText("1 result shown.", { exact: true }).waitFor();
    await page.getByLabel("Paper or collection").selectOption("brownian-motion");
    await page.getByText("No matching entries", { exact: false }).waitFor();
    await page.getByLabel("Paper or collection").selectOption("");
    await page.getByText("1 result shown.", { exact: true }).waitFor();
    await context.setOffline(false);
  });
  await check("untrusted titles stay text and queries never reach the network", async () => {
    await query.fill("hostile");
    await page.getByText("1 result shown.", { exact: true }).waitFor();
    assert.equal(await page.locator("[data-search-dialog] img").count(), 0);
    assert.ok((await page.getByRole("listbox").getByRole("option").innerText()).includes("<img"));
    await query.fill("private-query-sentinel");
    await page.getByText("No matching entries", { exact: false }).waitFor();
    assert.ok(!requests.some((path) => path.includes("private-query-sentinel")));
    assert.equal(await page.evaluate(() => localStorage.length), 0);
  });
  await check("Enter follows the actual reading face and content anchor", async () => {
    await query.fill("mean square displacement");
    await page.getByText("1 result shown.", { exact: true }).waitFor();
    await query.press("Enter");
    await page.waitForURL("**/papers/brownian-motion/?view=reading#arg-bm-observable");
    await page.waitForFunction(() => document.activeElement?.id === "arg-bm-observable");
  });
  await check("320px reflow, repeated close, and listener disposal", async () => {
    await page.setViewportSize({ width: 320, height: 780 });
    for (let i = 0; i < 3; i++) {
      await page.locator("#open").click();
      await query.waitFor();
      await query.fill("mean square");
      await page.getByText("2 results shown.", { exact: true }).waitFor();
      assert.equal(
        await page
          .locator("[data-search-dialog]")
          .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
        true,
      );
      await page.screenshot({ path: resolve(artifactDir, "search-320.png"), fullPage: true });
      await page.getByRole("button", { name: "Close search", exact: true }).click();
      assert.equal(await page.locator("[data-search-dialog]").count(), 0);
    }
    await page.evaluate(() => window.disposeSearch());
    await page.locator("#open").focus();
    await page.keyboard.press("Control+k");
    assert.equal(await page.locator("[data-search-dialog]").count(), 0);
  });
  await check("no-script fallback remains a real outline link", async () => {
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    contexts.push(nojs);
    const tab = await nojs.newPage();
    await tab.goto(url);
    await tab.getByRole("link", { name: "Search", exact: true }).click();
    assert.equal(new URL(tab.url()).pathname, "/papers/");
  });
  await check("corrupt shard produces a recoverable error, never partial results", async () => {
    const failureContext = await browser.newContext();
    contexts.push(failureContext);
    const tab = await failureContext.newPage();
    corrupt = true;
    await tab.goto(url);
    await tab.waitForFunction(() => window.fixtureReady);
    await tab.locator("#open").click();
    await tab.getByText("Search could not load a complete", { exact: false }).waitFor();
    assert.equal(await tab.getByRole("listbox").getByRole("option").count(), 0);
    corrupt = false;
    await tab.getByRole("button", { name: "Retry loading search" }).click();
    await tab.getByText("4 entries available.", { exact: false }).waitFor();
    await tab
      .getByRole("combobox", {
        name: /^(Words, symbols, or a laboratory ID|Words, names or symbols)$/,
      })
      .fill("λₓ");
    await tab.getByText("1 result shown.", { exact: true }).waitFor();
  });
  await check(
    "on a phone the X sits top right and a tap outside closes, a drag out does not",
    async () => {
      const phone = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      contexts.push(phone);
      const tab = await phone.newPage();
      tab.on("pageerror", (error) => errors.push(error.message));
      await tab.goto(url);
      await tab.waitForFunction(() => window.fixtureReady);
      const dialog = tab.locator("[data-search-dialog]");
      const close = tab.getByRole("button", { name: "Close search", exact: true });
      const open = async () => {
        await tab.locator("#open").tap();
        await close.waitFor();
      };
      // A point on the backdrop: below the panel when it leaves room, else in the side margin.
      const outside = async () => {
        const box = await dialog.boundingBox();
        const below = box.y + box.height;
        return below < 844 - 24 ? [195, (below + 844) / 2] : [Math.max(1, box.x / 2), 422];
      };
      await open();
      const x = await dialog.evaluate((panel) => {
        const p = panel.getBoundingClientRect();
        const b = panel.querySelector("[data-modal-close]").getBoundingClientRect();
        return { w: b.width, h: b.height, right: p.right - b.right, top: b.top - p.top };
      });
      assert.ok(x.w >= 44 && x.h >= 44, `X is ${x.w}x${x.h}`);
      assert.ok(x.right <= 32 && x.top <= 32, `X is ${x.right}px from the right, ${x.top}px down`);
      await tab.screenshot({ path: resolve(artifactDir, "search-390-close.png") });
      const panel = await dialog.boundingBox();
      await tab.touchscreen.tap(panel.x + panel.width / 2, panel.y + panel.height - 6);
      assert.equal(await dialog.count(), 1, "a tap inside the panel closed it");
      await tab.touchscreen.tap(...(await outside()));
      await dialog.waitFor({ state: "detached" });
      assert.equal(await tab.locator("#open").evaluate((n) => n === document.activeElement), true);
      await open();
      const field = await tab
        .getByRole("combobox", {
          name: /^(Words, symbols, or a laboratory ID|Words, names or symbols)$/,
        })
        .boundingBox();
      const [ox, oy] = await outside();
      await tab.mouse.move(field.x + 8, field.y + field.height / 2);
      await tab.mouse.down();
      await tab.mouse.move(ox, oy, { steps: 6 });
      await tab.mouse.up();
      assert.equal(await dialog.count(), 1, "a selection dragged out of the field closed it");
      await close.tap();
      await dialog.waitFor({ state: "detached" });
    },
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ suite: "search-browser", browser: browser.version(), checks }, null, 2),
  );
} finally {
  await writeFile(
    resolve(artifactDir, "search-browser-results.json"),
    JSON.stringify({ browser: browser.version(), checks }, null, 2),
  );
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
