/** Native-browser DOM regression test, not a production Next.js navigation test.
 * Run after installing Chromium: bun scripts/test-notebook-browser.mjs
 * Storage is injected only at the I/O boundary; the notebook, schema and UI modules are real.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "artifacts/browser/notebook");
await mkdir(output, { recursive: true });
const cache = new Map();
/** `file` is an absolute path to a .ts module; its relative .ts imports are loaded the same way. */
async function moduleUrl(file) {
  if (cache.has(file)) return cache.get(file);
  assert.ok(file.startsWith(resolve(root, "src")) && file.endsWith(".ts"), file);
  const source = await readFile(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    reportDiagnostics: true,
  });
  assert.ok(!result.diagnostics?.some((d) => d.category === ts.DiagnosticCategory.Error));
  let text = result.outputText;
  for (const match of [...text.matchAll(/from "(\.{1,2}\/[\w./-]+\.ts)"/gu)])
    text = text.replace(match[0], `from "${await moduleUrl(resolve(dirname(file), match[1]))}"`);
  const url = `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
  cache.set(file, url);
  return url;
}
const notebookModule = (name) => moduleUrl(resolve(root, "src/reader/notebook", `${name}.ts`));
const style = await readFile(resolve(root, "src/reader/notebook/notebook.css"), "utf8");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 320, height: 720 },
  acceptDownloads: true,
});
const checks = [],
  errors = [],
  requests = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push({ name, outcome: "passed" });
};
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => requests.push(request.url()));
try {
  await page.setContent(`<!doctype html><html lang="en" data-detail="1"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font:18px/1.6 Georgia;margin:16px}button,textarea,input{font:inherit}button{margin:2px}article{padding:1rem 0}nav{display:flex;gap:1rem;flex-wrap:wrap}*{box-sizing:border-box}${style}
</style></head><body><nav><a id="trigger" href="/notebook/">Notebook</a><div id="host"></div></nav><main><div data-reader-root data-view="reading">
<article class="reader-passage" data-unit="arg-bm-observable" id="arg-bm-observable" tabindex="-1"><h3>The observable</h3><p class="passage-question">What should you measure?</p><div data-reading="0"><p>The authored overview.</p></div><div data-face-results hidden><p>The signed mean can vanish while the mean square grows.</p></div><nav class="passage-actions"><a data-foundation="mean-square" href="/foundations/mean-square/">Show me one example first</a></nav></article>
<article class="reader-passage" data-unit="arg-bm-gaussian" id="arg-bm-gaussian" tabindex="-1"><h3>The density</h3><p class="passage-question">Where does the probability lie?</p><div data-reading="0"><p>Probability is an area.</p></div><div data-face-results hidden><p>Finite intervals have probabilities.</p></div></article>
</div></main></body></html>`);
  await page.evaluate(
    async ({ storeUrl, browserUrl }) => {
      const { createNotebookStore } = await import(storeUrl);
      const { mountReaderNotebook } = await import(browserUrl);
      window.io = {
        value: null,
        mode: "ok",
        maxBytes: 64000,
        read() {
          return this.mode === "blocked"
            ? { status: "unavailable" }
            : this.value === null
              ? { status: "missing" }
              : { status: "ok", value: this.value };
        },
        write(doc) {
          if (this.mode !== "ok")
            return { status: this.mode === "blocked" ? "unavailable" : "quota" };
          this.value = JSON.stringify(doc);
          return { status: "ok" };
        },
        decode: JSON.parse,
        preserve() {},
        discardFallback() {},
      };
      window.readerLocation = { pathname: "/papers/brownian-motion/", search: "", hash: "" };
      // Injected at the same I/O boundary as the notebook document.
      window.recapMemory = {
        value: null,
        dismissed() {
          return this.value;
        },
        dismiss(href) {
          this.value = href;
        },
      };
      window.remount = () => {
        window.dispose?.();
        window.store = createNotebookStore(window.io);
        window.dispose = mountReaderNotebook(
          document.getElementById("host"),
          document.getElementById("trigger"),
          window.store,
          () => window.readerLocation,
          window.recapMemory,
        );
      };
      window.remount();
    },
    {
      storeUrl: await notebookModule("notebookStore"),
      browserUrl: await notebookModule("browser"),
    },
  );
  const first = page.locator("#arg-bm-observable");
  const button = (name) => page.getByRole("button", { name, exact: true });
  const notes = () => page.evaluate(() => store.getSnapshot().document.entries);
  const bookmarks = page.locator("button.notebook-save-toggle");
  const firstBookmark = first.locator("button.notebook-save-toggle");
  /** One bookmark per passage; pressing it opens the menu that holds the four actions. */
  async function menuAction(name) {
    if ((await first.locator(".notebook-save-menu").count()) === 0) await firstBookmark.click();
    await first.getByRole("button", { name, exact: true }).click();
  }
  check("one bookmark per passage", (await bookmarks.count()) === 2);
  check(
    "no action buttons before the bookmark is pressed",
    (await button("Save question").count()) === 0,
  );
  check(
    "the bookmark names its passage",
    (await firstBookmark.getAttribute("aria-label")) === "Save to notebook: The observable",
  );
  await firstBookmark.click();
  check("the bookmark opens one menu", (await page.locator(".notebook-save-menu").count()) === 1);
  check(
    "the menu takes focus",
    (await page.evaluate(() => document.activeElement.textContent)) === "Save question",
  );
  await page.keyboard.press("Escape");
  check(
    "Escape closes the menu and returns focus to the bookmark",
    (await page.locator(".notebook-save-menu").count()) === 0 &&
      (await firstBookmark.evaluate((node) => node === document.activeElement)),
  );
  await firstBookmark.click();
  await page.locator(".notebook-save-menu button.modal-close").click();
  check("the X closes the menu", (await page.locator(".notebook-save-menu").count()) === 0);
  await firstBookmark.click();
  await page.mouse.click(300, 700);
  check(
    "a press outside closes the menu",
    (await page.locator(".notebook-save-menu").count()) === 0,
  );
  await menuAction("Save question");
  await menuAction("Save question");
  check("pin is idempotent", (await notes()).length === 1);
  check(
    "a saved passage keeps a filled bookmark",
    (await firstBookmark.getAttribute("data-saved")) === "",
  );
  await menuAction("Save example");
  check(
    "example preserves foundation return frame",
    (await notes())[1].frame.open === "foundation:mean-square",
  );
  await menuAction("Add a note");
  await page
    .getByLabel("Your note or question", { exact: true })
    .fill('<img src="https://invalid.example"> PRIVATE_SENTINEL λₓ');
  await button("Save note").click();
  check(
    "hostile note text is not markup",
    (await page.locator(".notebook-entries img").count()) === 0 &&
      (await page.locator(".notebook-entries").innerText()).includes("PRIVATE_SENTINEL"),
  );
  check("note retains its passage", (await notes())[2].frame.anchor === "arg-bm-observable");
  await page.keyboard.press("Escape");
  check(
    "Escape restores focus to the passage's bookmark",
    await firstBookmark.evaluate((node) => node === document.activeElement),
  );
  await page.locator("#trigger").click();
  await button("Edit note: The observable").click();
  await page.getByLabel("Your note or question", { exact: true }).fill("Revised private question");
  await button("Save changes").click();
  check("selected note is editable", (await notes())[2].text === "Revised private question");
  check(
    "modal fits at 320px",
    await page.evaluate(() => {
      const d = document.querySelector("[data-notebook-dialog]");
      return d !== null && d.scrollWidth <= d.clientWidth + 1;
    }),
  );
  const downloading = page.waitForEvent("download");
  await button("Export notebook JSON").click();
  const download = await downloading,
    exportedPath = resolve(output, "fixture-export.json");
  await download.saveAs(exportedPath);
  check(
    "download contains all entries",
    JSON.parse(await readFile(exportedPath, "utf8")).entries.length === 3,
  );
  await button("Clear notebook").click();
  await button("Cancel").click();
  check("clear can be cancelled", (await notes()).length === 3);

  // Negative test: another dialog mounted and open does not spoof notebook state
  await page.evaluate(() => {
    const foreign = document.createElement("dialog");
    foreign.setAttribute("data-clarification-dialog", "true");
    foreign.open = true;
    document.body.prepend(foreign);
  });
  await button("Close notebook").click();
  check(
    "closing notebook dialog while another remains mounted correctly reflects notebook closure",
    await page.evaluate(() => {
      const nb = document.querySelector("[data-notebook-dialog]");
      const foreign = document.querySelector("[data-clarification-dialog]");
      return Boolean(nb && !nb.open && foreign?.open);
    }),
  );
  await page.evaluate(() => {
    document.querySelector("[data-clarification-dialog]")?.remove();
  });
  await first.locator("h3").click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.evaluate(() => window.remount());
  check("new store restores persisted entries", (await notes()).length === 3);
  check("no reminder on a paper page", (await page.locator(".notebook-recap").count()) === 0);
  await page.evaluate(() => {
    readerLocation.pathname = "/papers/";
    window.remount();
  });
  check(
    "one line on /papers/ names the saved place",
    (await page.locator(".notebook-recap").innerText()) ===
      "Continue where you left off: The observable",
  );
  await button("Dismiss: continue where you left off").click();
  await page.evaluate(() => window.remount());
  check(
    "a dismissal outlives the page view",
    (await page.locator(".notebook-recap").count()) === 0,
  );
  await page.evaluate(() => {
    readerLocation.pathname = "/";
    window.remount();
  });
  check("and holds on the home page too", (await page.locator(".notebook-recap").count()) === 0);
  await page.evaluate(() => {
    readerLocation.pathname = "/papers/brownian-motion/";
    window.remount();
  });
  await page.locator("#trigger").click();
  await button("Clear notebook").click();
  await button("Confirm").click();
  check(
    "clear removes entries and last place",
    await page.evaluate(
      () =>
        store.getSnapshot().document.entries.length === 0 &&
        store.getSnapshot().document.lastPlace === null,
    ),
  );
  await page.keyboard.press("Escape");
  await first.locator("h3").click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  check(
    "automatic tracking does not undo clear",
    await page.evaluate(() => store.getSnapshot().document.lastPlace === null),
  );
  await page.locator("#trigger").click();
  await page
    .getByLabel("Import an exported notebook JSON file", { exact: true })
    .setInputFiles(exportedPath);
  await button("Confirm").waitFor();
  check("import preview changes nothing", (await notes()).length === 0);
  await button("Confirm").click();
  check("import restores exported entries", (await notes()).length === 3);
  await page
    .getByLabel("Import an exported notebook JSON file", { exact: true })
    .setInputFiles(exportedPath);
  await button("Confirm").click();
  check("repeated imports do not duplicate notes", (await notes()).length === 3);
  await button("Clear notebook").click();
  await button("Confirm").click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    io.mode = "quota";
  });
  await menuAction("Add a note");
  await page
    .getByLabel("Your note or question", { exact: true })
    .fill("Session survives a failed save");
  await button("Save note").click();
  check(
    "quota failure retains session work",
    await page.evaluate(
      () =>
        store.getSnapshot().persistence === "session-only" &&
        store.getSnapshot().document.entries.length === 1,
    ),
  );
  await page.evaluate(() => {
    io.mode = "ok";
  });
  await button("Retry saving").click();
  check(
    "retry saves retained notes",
    await page.evaluate(
      () =>
        store.getSnapshot().persistence === "saved" && JSON.parse(io.value).entries.length === 1,
    ),
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    io.value = JSON.stringify({ schemaVersion: 99, future: "preserve" });
    window.remount();
  });
  await page.locator("#trigger").click();
  check(
    "unsupported original remains exportable",
    (await button("Export preserved original").isVisible()) &&
      (await page.evaluate(() => JSON.parse(io.value).schemaVersion === 99)),
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.remount());
  check(
    "remount disposes owned DOM",
    (await page.locator(".notebook-dialog").count()) === 1 && (await bookmarks.count()) === 2,
  );
  check(
    "no private note in network requests",
    requests.every((url) => !/PRIVATE_SENTINEL|Revised|invalid\.example/u.test(url)),
  );
  check("no uncaught browser errors", errors.length === 0);
  await page.locator("#trigger").click();
  await page.screenshot({ path: resolve(output, "notebook-320.png"), fullPage: true });
  console.log(`${checks.length} notebook browser checks passed.`);
} catch (error) {
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      {
        environment:
          "Native Chromium DOM fixture; injected storage I/O; not full Next.js navigation",
        browser: browser.version(),
        node: process.version,
        typescript: ts.version,
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
