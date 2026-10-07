/** Offline native-event proof. The address is a controlled port, not a live navigation test. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import ts from "typescript";

const source = readFileSync(resolve("src/experiments/permalink/walkthroughLocation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "walkthroughLocation.ts",
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [], []);
const moduleUrl = `data:text/javascript,${encodeURIComponent(compiled.outputText)}`;

test("walkthrough selection responds to native browser events and releases its listeners", { timeout: 30_000 }, async () => {
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.setContent("<!doctype html><html><body><main><output aria-label='Selected instructions'></output></main></body></html>");
    await page.evaluate(async (url) => {
      const module = await import(url);
      const state = {
        search: "?walkthrough=the-boost-to-0.6c&stop=7",
        seen: [] as unknown[], dispose: () => {},
      };
      (window as unknown as Window & { navigationTest?: typeof state }).navigationTest = state;
      state.dispose = module.observeWalkthroughLocation({
        get location() { return { search: state.search }; },
        addEventListener: window.addEventListener.bind(window),
        removeEventListener: window.removeEventListener.bind(window),
      }, (next: { kind: string; selection?: { actionIndex: number } }) => {
        state.seen.push(next);
        document.querySelector("output")!.textContent = next.kind === "selected"
          ? `Instructions at action ${next.selection?.actionIndex}` : next.kind;
      });
    }, moduleUrl);
    const latest = () => page.evaluate(() => (window as unknown as Window & { navigationTest: { seen: unknown[] } }).navigationTest.seen.at(-1));
    assert.deepEqual(await latest(), { kind: "selected", selection: { tapeId: "the-boost-to-0.6c", actionIndex: 7 } });
    assert.equal(await page.locator("output").textContent(), "Instructions at action 7");
    async function address(search: string, event: "popstate" | "pageshow") {
      await page.evaluate(({ search, event }) => {
        (window as unknown as Window & { navigationTest: { search: string } }).navigationTest.search = search;
        window.dispatchEvent(new Event(event));
      }, { search, event });
    }
    await address("?walkthrough=the-boost-to-0.6c&stop=12", "popstate");
    assert.equal(await page.locator("output").textContent(), "Instructions at action 12");
    await address("?walkthrough=the-boost-to-0.6c&stop=7", "popstate");
    assert.equal(await page.locator("output").textContent(), "Instructions at action 7");
    await address("?tape=unrelated", "pageshow");
    assert.deepEqual(await latest(), { kind: "absent" });
    await address("?walkthrough=a&stop=0&stop=0", "popstate");
    assert.equal((await latest() as { kind: string }).kind, "invalid");
    assert.equal(await page.locator("output").textContent(), "invalid", "do not retain stale instructions");
    const count = await page.evaluate(() => {
      const state = (window as unknown as Window & { navigationTest: { seen: unknown[]; dispose(): void } }).navigationTest;
      state.dispose();
      state.dispose();
      return state.seen.length;
    });
    await address("?walkthrough=the-boost-to-0.6c&stop=0", "popstate");
    await address("?walkthrough=the-boost-to-0.6c&stop=0", "pageshow");
    assert.equal(await page.evaluate(() => (window as unknown as Window & { navigationTest: { seen: unknown[] } }).navigationTest.seen.length), count);
    assert.deepEqual(errors, []);
    console.log("walkthrough event delivery: initial selection, forward/backward address changes, pageshow, invalid query, disposal and no page errors verified; address is a test port");
  } catch (error) {
    const base = resolve("artifacts/browser/walkthrough-location");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(resolve(base, "failure-"));
    await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
    await writeFile(resolve(directory, "dom.html"), await page.content());
    await writeFile(resolve(directory, "errors.json"), JSON.stringify(errors));
    throw error;
  } finally {
    await browser.close();
  }
});
