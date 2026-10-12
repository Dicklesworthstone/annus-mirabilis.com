/** Real search/launcher controllers on a small fixture server; no mocked query engine or DOM. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ts from "typescript";
import { packageSearchIndex } from "../../src/search/build.ts";
// Imported rather than retyped: the literal this replaced is a string the palette never printed.
import {
  SEARCH_INDEX_FAILED_STATUS,
  SEARCH_NO_MATCH_STATUS,
} from "../../src/search/CommandPalette.ts";
import { reportPopulation } from "../gate-census/population.ts";

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
/**
 * The served module set is DERIVED from the entry's own import graph, never hand-listed.
 *
 * It was a hand-written map of six paths until 2026-10-12, and it went stale the moment
 * `CommandPalette.ts` gained `./searchLocation` and `./typeLabels`. The fixture served neither, so
 * the browser's dynamic `import("./CommandPalette.ts")` 404'd INSIDE its own graph, `launcher.ts`
 * caught that and wrote "Search could not open" into the status line, and this script then sat for
 * thirty seconds waiting for a combobox that was never going to appear.
 *
 * That is why the derivation matters more than the two missing names. The symptom is indistinguishable
 * from a broken palette, and it was recorded as one: am-7mw9 reads "the palette did not open, which is
 * a behaviour failure rather than a drifted locator", with the combobox's label checked against
 * `CommandPalette.ts` and found CURRENT, which made a product defect the only remaining reading. The
 * product was fine. The fixture was two imports behind, and a hand-listed graph gives no sign of it.
 *
 * Specifiers are read off the TRANSPILED output rather than the source, which is what makes the walk
 * right about `import type`: tsc has already erased the type-only edges, so what remains is exactly
 * what the browser will request. `protocol.ts`'s `import type { SearchManifest } from "./build.ts"`
 * is therefore NOT served and must not be, and a regex over the source would have demanded it and
 * pulled the whole index builder into a fixture that has no use for it.
 *
 * The palette closes through the site's one shared overlay behaviour, which the walk reaches on its
 * own through `../a11y/modal/dismiss.ts`; that edge used to need a bespoke rewrite rule of its own.
 */
const MODULE_ENTRY = "src/search/launcher.ts";
const RELATIVE_TS_IMPORT = /(from\s*["']|import\(\s*["'])(\.[^"']+)\.ts(["'])/gu;
const compiledModules = new Map();
const pendingModules = [resolve(root, MODULE_ENTRY)];
while (pendingModules.length > 0) {
  const absolute = pendingModules.pop();
  const name = basename(absolute, ".ts");
  const already = compiledModules.get(name);
  if (already !== undefined) {
    // Two modules of the same basename would both want /modules/<name>.js, and the second would
    // silently win. Flat serving is worth keeping, so the collision fails loudly instead.
    assert.equal(
      already.absolute,
      absolute,
      `two modules are named ${name}.ts (${already.absolute} and ${absolute}); the fixture serves ` +
        "modules flat by basename, so one would overwrite the other",
    );
    continue;
  }
  const compiled = ts.transpileModule(await readFile(absolute, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    fileName: `${name}.ts`,
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, `${absolute} did not transpile cleanly`);
  compiledModules.set(name, { absolute, text: compiled.outputText });
  for (const match of compiled.outputText.matchAll(RELATIVE_TS_IMPORT)) {
    pendingModules.push(resolve(dirname(absolute), `${match[2]}.ts`));
  }
}
for (const [name, module] of compiledModules) {
  files.set(
    `/modules/${name}.js`,
    module.text.replace(
      RELATIVE_TS_IMPORT,
      (_whole, head, specifier, tail) => `${head}./${basename(specifier)}.js${tail}`,
    ),
  );
}
// Printed before the browser launch, which on this machine fails often enough that a run can end
// knowing nothing. The walked set is the thing a reader of a failed run most needs: it says whether
// the fixture could have served the palette at all, independently of whether Chromium ever started.
console.log(
  `[search fixture] walked ${compiledModules.size} modules from ${MODULE_ENTRY}: ` +
    `${[...compiledModules.keys()].sort().join(", ")}`,
);
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
/**
 * A module the walk did not reach 404s, and `launcher.ts` swallows that into a status line. So the
 * 404 is recorded here and asserted below: the next time this graph grows an edge the walk misses,
 * the script says which specifier was unserved instead of timing out on a combobox.
 */
const unservedModuleRequests = [];
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
    if (path.startsWith("/modules/")) unservedModuleRequests.push(path);
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  // Playwright's default is 180s and this host exceeds it regularly: five of about twelve launches
  // timed out there on 2026-10-12, with no Chromium alive to contend with and nothing else running.
  // A launch that is merely slow should not be reported as a failing search palette.
  timeout: 600_000,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
/**
 * Raised from Playwright's 30s default for the same reason as the launch above: on 2026-10-12 this
 * host timed out navigating to its OWN fixture server on 127.0.0.1, having already spent minutes
 * launching. A slow host must not be reported as a search palette that does not load, so every
 * context this script opens gets these and `contexts.push` is the one place that is guaranteed to
 * see all four of them.
 */
const NAV_TIMEOUT_MS = 120_000;
const ACTION_TIMEOUT_MS = 60_000;
const checks = [],
  contexts = [];
/** Every context goes through here, so none can be opened without the timeouts above. */
function track(context) {
  context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  contexts.push(context);
  return context;
}
async function check(name, callback) {
  await callback();
  checks.push({ name, outcome: "passed" });
}
try {
  const context = track(await browser.newContext({ viewport: { width: 1100, height: 900 } }));
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
    name: "Words, names or symbols",
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
    await page.getByText(SEARCH_NO_MATCH_STATUS, { exact: false }).waitFor();
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
    await page.getByText(SEARCH_NO_MATCH_STATUS, { exact: false }).waitFor();
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
    const nojs = track(await browser.newContext({ javaScriptEnabled: false }));
    const tab = await nojs.newPage();
    await tab.goto(url);
    await tab.getByRole("link", { name: "Search", exact: true }).click();
    assert.equal(new URL(tab.url()).pathname, "/papers/");
  });
  await check("corrupt shard produces a recoverable error, never partial results", async () => {
    const failureContext = track(await browser.newContext());
    const tab = await failureContext.newPage();
    corrupt = true;
    await tab.goto(url);
    await tab.waitForFunction(() => window.fixtureReady);
    await tab.locator("#open").click();
    await tab.getByText(SEARCH_INDEX_FAILED_STATUS, { exact: false }).waitFor();
    assert.equal(await tab.getByRole("listbox").getByRole("option").count(), 0);
    corrupt = false;
    await tab.getByRole("button", { name: "Retry loading search" }).click();
    await tab.getByText("4 entries available.", { exact: false }).waitFor();
    await tab
      .getByRole("combobox", {
        name: "Words, names or symbols",
      })
      .fill("λₓ");
    await tab.getByText("1 result shown.", { exact: true }).waitFor();
  });
  await check(
    "on a phone the X sits top right and a tap outside closes, a drag out does not",
    async () => {
      const phone = track(
        await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        }),
      );
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
      const tapX = panel.x + panel.width / 2;
      const tapY = panel.y + panel.height - 6;
      /*
       * A failure here is either a dismiss defect or the fixture's geometry, and a count cannot
       * tell them apart: "0 !== 1" is what this printed on 2026-10-12 and it named neither. The
       * question is what the finger is actually over, so the message carries the panel's own
       * border box (which is what isPointerOutside judges a hit on the panel by), the scroll
       * offset (boundingBox is frame-relative while tap is viewport-relative), and the element
       * at the point.
       */
      const where = await dialog.evaluate(
        (node, point) => {
          const box = node.getBoundingClientRect();
          const hit = node.ownerDocument.elementFromPoint(point.x, point.y);
          return {
            box: `top ${Math.round(box.top)} bottom ${Math.round(box.bottom)} left ${Math.round(box.left)} right ${Math.round(box.right)}`,
            scrollY: node.ownerDocument.defaultView?.scrollY ?? -1,
            tag: hit?.tagName ?? "none",
            isPanel: hit === node,
            insidePanel: hit instanceof Node ? node.contains(hit) : false,
          };
        },
        { x: tapX, y: tapY },
      );
      await tab.touchscreen.tap(tapX, tapY);
      assert.equal(
        await dialog.count(),
        1,
        `a tap inside the panel closed it: tapped (${Math.round(tapX)}, ${Math.round(tapY)}); ` +
          `panel border box ${where.box}; scrollY ${where.scrollY}; element at that point ` +
          `${where.tag}, is the panel itself ${where.isPanel}, inside the panel ${where.insidePanel}`,
      );
      await tab.touchscreen.tap(...(await outside()));
      await dialog.waitFor({ state: "detached" });
      assert.equal(await tab.locator("#open").evaluate((n) => n === document.activeElement), true);
      await open();
      const field = await tab
        .getByRole("combobox", {
          name: "Words, names or symbols",
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
  assert.deepEqual(
    unservedModuleRequests,
    [],
    `the palette's import graph asked for ${unservedModuleRequests.join(", ")}, which the fixture ` +
      `does not serve. The served set is walked from ${MODULE_ENTRY}, so a specifier missing from ` +
      "it means the walk did not reach that module -- not that the palette is broken.",
  );
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
  // Two populations, because they fail for different reasons: a walk that reaches almost nothing
  // still lets the fixture boot, and a run that aborts early still writes the checks it reached.
  const vacuous = [
    reportPopulation({
      gate: "search-palette-browser",
      examined: compiledModules.size,
      noun: "fixture modules walked from the entry",
      minimum: 6,
    }),
    reportPopulation({
      gate: "search-palette-browser",
      examined: checks.filter((row) => row.outcome === "passed").length,
      noun: "registered browser checks",
      minimum: 12,
    }),
  ];
  if (vacuous.some(Boolean)) process.exitCode = 1;
}
