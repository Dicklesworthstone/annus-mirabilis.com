/**
 * Offline real-browser proof: no built site or network server required.
 * Run: node --experimental-strip-types --test scripts/e2e/capstoneReturnLinks.e2e.test.ts
 * This exercises the actual link enhancer, not Next's hydration or the laboratory calculation.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import ts from "typescript";

function moduleSource(name: string): string {
  const fileName = resolve("src/discovery/capstone", `${name}.ts`);
  const compiled = ts.transpileModule(readFileSync(fileName, "utf8"), {
    fileName,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  assert.deepEqual(
    compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [],
    [],
  );
  return compiled.outputText;
}
const dataModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

const HTML = `<base href="https://annus-mirabilis.com"><main>
<a id="lab" href="/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b#result">Open experiment</a>
<a id="source" href="/papers/special-relativity/view/parallel/#s1-p7">Source passage</a>
<a id="external" href="https://other.example/">External</a>
<a id="private" href="/notebook/">Notebook</a>
<a id="download" href="/papers/file/" download>Download</a>
<a id="blank" href="/foundations/probability/" target="_blank">Foundation</a>
</main>`;

test("capstone return links in an actual browser DOM", { timeout: 30_000 }, async (t) => {
  const route = dataModule(moduleSource("returnRoute"));
  const source = moduleSource("returnLinks");
  assert.ok(source.includes('"./returnRoute.ts"'), "the browser module must load the real helper");
  const entry = dataModule(source.replace('"./returnRoute.ts"', JSON.stringify(route)));
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function retainFailure() {
    const base = resolve("artifacts/browser/capstone-return");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(resolve(base, "failure-"));
    await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
    await writeFile(resolve(directory, "dom.html"), await page.content());
    await writeFile(resolve(directory, "errors.json"), JSON.stringify(errors));
  }
  async function check(name: string, run: () => Promise<void>) {
    await t.test(name, async () => {
      try {
        await run();
      } catch (error) {
        await retainFailure();
        throw error;
      }
    });
  }
  try {
    await page.setContent(HTML);
    await page.evaluate(async (url) => {
      const module = await import(url);
      const main = document.querySelector("main");
      (window as Window & { disposeLinks?: () => void }).disposeLinks =
        module.mountCapstoneReturnLinks(main, "special-relativity");
    }, entry);

    await check(
      "the actual href preserves encoded settings and gains the public return",
      async () => {
        assert.equal(
          await page.locator("#lab").getAttribute("href"),
          "/lab/sr-03/?tape=a%2Fb%2B%3D&x=a+b&fromCapstone=special-relativity#result",
        );
        assert.equal(
          await page.locator("#source").getAttribute("href"),
          "/papers/special-relativity/view/parallel/?fromCapstone=special-relativity#s1-p7",
        );
      },
    );
    await check("external, private and download links stay untouched", async () => {
      for (const [selector, href] of [
        ["#external", "https://other.example/"],
        ["#private", "/notebook/"],
        ["#download", "/papers/file/"],
      ] as const) {
        assert.equal(await page.locator(selector).getAttribute("href"), href);
      }
    });
    await check("new-tab links keep their native target", async () => {
      assert.equal(await page.locator("#blank").getAttribute("target"), "_blank");
      assert.equal(
        await page.locator("#blank").getAttribute("href"),
        "/foundations/probability/?fromCapstone=special-relativity",
      );
    });
    await check("newly mounted walkthrough links are enhanced", async () => {
      await page.evaluate(() => {
        const link = document.createElement("a");
        link.id = "late";
        link.href = "/tapes/the-two-pulses/";
        link.textContent = "Later walkthrough";
        document.querySelector("main")?.append(link);
      });
      await page.waitForFunction(() =>
        document.querySelector("#late")?.getAttribute("href")?.includes("fromCapstone="),
      );
    });
    await check("a framework update keeps its new settings without losing focus", async () => {
      await page.locator("#lab").focus();
      await page.evaluate(() =>
        document.querySelector("#lab")?.setAttribute("href", "/lab/sr-03/?tape=CHANGED#changed"),
      );
      await page.waitForFunction(
        () =>
          document.querySelector("#lab")?.getAttribute("href") ===
          "/lab/sr-03/?tape=CHANGED&fromCapstone=special-relativity#changed",
      );
      assert.equal(await page.evaluate(() => document.activeElement?.id), "lab");
    });
    await check("a link converted to a download loses only the enhancer's marker", async () => {
      await page.locator("#late").evaluate((link) => link.setAttribute("download", ""));
      await page.waitForFunction(
        () => document.querySelector("#late")?.getAttribute("href") === "/tapes/the-two-pulses/",
      );
    });
    await check("disposal restores the most recent original link", async () => {
      await page.evaluate(() =>
        (window as Window & { disposeLinks?: () => void }).disposeLinks?.(),
      );
      assert.equal(
        await page.locator("#lab").getAttribute("href"),
        "/lab/sr-03/?tape=CHANGED#changed",
      );
    });
    await check("disposal does not overwrite an intervening owner's new target", async () => {
      await page.evaluate(async (url) => {
        const module = await import(url);
        const dispose = module.mountCapstoneReturnLinks(
          document.querySelector("main"),
          "mass-energy",
        );
        document.querySelector("#source")?.setAttribute("href", "https://changed.example/");
        dispose();
      }, entry);
      assert.equal(await page.locator("#source").getAttribute("href"), "https://changed.example/");
    });
    assert.deepEqual(errors, []);
  } catch (error) {
    await retainFailure();
    throw error;
  } finally {
    await browser.close();
  }
});
