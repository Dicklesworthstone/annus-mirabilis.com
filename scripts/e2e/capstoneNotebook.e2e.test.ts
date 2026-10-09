/**
 * Offline browser proof of the real snapshot controls, not a mocked DOM. No site build or server.
 * Run: node --experimental-strip-types --test scripts/e2e/capstoneNotebook.e2e.test.ts
 * Notebook I/O is an explicit port: this does not claim browser-storage, React or Next coverage.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import ts from "typescript";
import type { Capstone } from "../../src/discovery/capstone/capstoneSchema.ts";
import type { WorksheetState } from "../../src/discovery/capstone/worksheetState.ts";
import type { NotebookState, NotebookStore } from "../../src/reader/notebook/notebookStore.ts";
import type { NotebookCapstoneEntry } from "../../src/reader/notebook/schema.ts";

/** Compile only the production island and its dependency-light helpers; no replacement modules. */
function browserModule(file: string, cache = new Map<string, string>()): string {
  const path = resolve(file);
  const cached = cache.get(path);
  if (cached) return cached;
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  assert.deepEqual(
    compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [],
    [],
  );
  const source = compiled.outputText.replace(
    /from\s+(["'])(\.[^"']+)\1/g,
    (_match, _quote, specifier: string) =>
      `from ${JSON.stringify(browserModule(resolve(dirname(path), specifier), cache))}`,
  );
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  cache.set(path, url);
  return url;
}

type Harness = Readonly<{
  snapshot(): {
    state: NotebookState;
    worksheet: WorksheetState;
    writes: number;
    restores: number;
    checks: number;
    listeners: number;
    downloads: { text: string; name: string }[];
  };
  type(text: string): void;
  remove(id: string): void;
  renderView(): void;
  dispose(): void;
}>;
declare global {
  interface Window {
    capstoneNotebookHarness: Harness;
  }
}

test("save, inspect, restore and export complete capstone attempts in Chromium", {
  timeout: 30_000,
}, async () => {
  const cache = new Map<string, string>();
  const urls = {
    controls: browserModule("src/discovery/capstone/notebookControls.ts", cache),
    capture: browserModule("src/reader/notebook/capstoneEntry.ts", cache),
    view: browserModule("src/reader/notebook/capstoneView.ts", cache),
  };
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  try {
    await page.setContent('<main><div id="controls"></div><div id="saved-view"></div></main>');
    await page.evaluate(async (modules) => {
      const controls: typeof import("../../src/discovery/capstone/notebookControls.ts") =
        await import(modules.controls);
      const capture: typeof import("../../src/reader/notebook/capstoneEntry.ts") = await import(
        modules.capture
      );
      const view: typeof import("../../src/reader/notebook/capstoneView.ts") = await import(
        modules.view
      );
      const capstone: Capstone = {
        id: "capstone-test",
        paper: "mass-energy",
        title: "Reconstruct the ledgers",
        question: "Why?",
        claims: [
          {
            id: "c1",
            text: "First claim.",
            anchor: "s0-p1",
            logicalRole: "assumption",
            buildsOn: [],
            assumptionIds: ["a1"],
          },
          {
            id: "c2",
            text: "Second claim.",
            anchor: "s0-p2",
            logicalRole: "derivation",
            buildsOn: ["c1"],
            assumptionIds: ["a1"],
          },
        ],
        assumptions: [{ id: "a1", statement: "The body is the system.", kind: "boundary-choice" }],
        equations: [{ equationId: "eq-ledger", purpose: "Explain" }],
        paperOrder: ["c1", "c2"],
        startOrder: ["c2", "c1"],
        presets: [],
        explanationPrompt: "Explain the subtraction.",
        selfCheckNotes: {},
        limits: "",
        reviewRecordIds: [],
      };
      let worksheet: WorksheetState = {
        schemaVersion: 1,
        capstoneId: capstone.id,
        order: ["c2", "c1"],
        annotations: { "eq-ledger": "<img src=x onerror=alert(1)>", retired: "Keep this note" },
        assumptionMarks: { c1: ["a1"] },
        explanation: "First explanation π",
        table: [["one", "two"]],
      };
      let state: NotebookState = {
        document: {
          format: "annus-reading-notebook",
          schemaVersion: 1,
          entries: [],
          lastPlace: null,
        },
        persistence: "saved",
        message: "Saved on this device.",
        recoveryRaw: null,
      };
      const listeners = new Set<() => void>();
      let writes = 0,
        restores = 0,
        checks = 0;
      const downloads: { text: string; name: string }[] = [];
      const store: Pick<
        NotebookStore,
        "open" | "getSnapshot" | "subscribe" | "checkForExternalChange" | "add"
      > = {
        open() {},
        getSnapshot: () => state,
        subscribe(fn) {
          listeners.add(fn);
          return () => {
            listeners.delete(fn);
          };
        },
        checkForExternalChange() {
          checks++;
        },
        add(entry) {
          if (entry.kind !== "capstone")
            return { ok: false, message: "This port accepts snapshots only." };
          const admitted: NotebookCapstoneEntry = {
            ...entry,
            capstone: capture.parseCapstoneCapture(entry.capstone, entry.frame.paper),
          };
          writes++;
          state = {
            ...state,
            document: { ...state.document, entries: [...state.document.entries, admitted] },
          };
          for (const fn of listeners) fn();
          return { ok: true };
        },
      };
      const host = document.querySelector<HTMLElement>("#controls");
      const savedView = document.querySelector<HTMLElement>("#saved-view");
      if (!host || !savedView) throw new Error("The fixture requires both hosts.");
      const mounted = controls.mountCapstoneNotebook(host, store, {
        capstone: () => capstone,
        worksheet: () => worksheet,
        equations: () => [{ equationId: "eq-ledger", title: "The ledger" }],
        restore(next) {
          restores++;
          worksheet = next;
        },
        download(text, name) {
          downloads.push({ text, name });
        },
      });
      window.capstoneNotebookHarness = {
        snapshot: () => ({
          state,
          worksheet,
          writes,
          restores,
          checks,
          downloads,
          listeners: listeners.size,
        }),
        type(text) {
          worksheet = { ...worksheet, explanation: text };
        },
        remove(id) {
          state = {
            ...state,
            document: {
              ...state.document,
              entries: state.document.entries.filter((entry) => entry.id !== id),
            },
          };
          for (const fn of listeners) fn();
        },
        renderView() {
          const entry = state.document.entries[0];
          if (entry?.kind !== "capstone") throw new Error("Save a snapshot first.");
          view.appendCapstoneView(savedView, entry, (text, name) => downloads.push({ text, name }));
        },
        dispose: () => mounted.dispose(),
      };
    }, urls);
    const state = () => page.evaluate(() => window.capstoneNotebookHarness.snapshot());
    assert.equal((await state()).writes, 0, "opening does not save private work");
    const save = page.getByRole("button", { name: "Save a snapshot to notebook", exact: true });
    await save.click();
    const first = (await state()).state.document.entries[0];
    assert.ok(first?.kind === "capstone");
    assert.equal(first.capstone.worksheet.annotations.retired, "Keep this note");
    await save.click();
    assert.equal((await state()).writes, 1, "unchanged attempts are not duplicated");
    await page.evaluate(() => window.capstoneNotebookHarness.type("Second explanation"));
    await save.click();
    assert.equal((await state()).state.document.entries.length, 2);
    const reviews = page.getByRole("button", { name: /^Review snapshot from/ });
    await reviews.last().click();
    assert.equal((await state()).restores, 0, "preview never restores");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "The attempt you selected",
    );
    await page.evaluate(() => window.capstoneNotebookHarness.type("Typed while reviewing"));
    const restore = page.getByRole("button", {
      name: "Replace worksheet with this snapshot",
      exact: true,
    });
    await restore.click();
    assert.equal((await state()).restores, 0);
    assert.equal((await state()).worksheet.explanation, "Typed while reviewing");
    assert.match(
      await page.locator("#controls").innerText(),
      /Your worksheet changed after this preview/,
    );
    await reviews.last().click();
    await restore.click();
    assert.equal((await state()).restores, 1);
    assert.equal((await state()).worksheet.explanation, "First explanation π");
    assert.deepEqual(
      (await state()).state.document.entries[0],
      first,
      "restoring does not mutate the saved snapshot",
    );
    await reviews.first().click();
    await page.evaluate(() => {
      const harness = window.capstoneNotebookHarness;
      const id = harness.snapshot().state.document.entries[1]?.id;
      if (id) harness.remove(id);
    });
    assert.equal(await restore.isDisabled(), true, "a removed snapshot cannot be restored");
    await page.getByRole("button", { name: "Export the selected worksheet", exact: true }).click();
    assert.equal(JSON.parse((await state()).downloads[0]!.text).explanation, "Second explanation");
    await page.evaluate(() => window.capstoneNotebookHarness.renderView());
    await page.getByText("Read the complete saved reconstruction", { exact: true }).click();
    assert.equal(await page.locator("img,script").count(), 0);
    assert.match(await page.locator("#saved-view").innerText(), /<img src=x onerror=alert\(1\)>/);
    await page
      .getByRole("button", { name: "Export this attempt as worksheet JSON", exact: true })
      .click();
    assert.deepEqual(JSON.parse((await state()).downloads[1]!.text), first.capstone.worksheet);
    assert.deepEqual(
      await page
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
      ["/notebook/"],
    );
    await page.evaluate(() => window.capstoneNotebookHarness.dispose());
    const checks = (await state()).checks;
    await page.evaluate(() => window.dispatchEvent(new Event("storage")));
    assert.equal(await page.locator("#controls").innerHTML(), "");
    assert.equal((await state()).listeners, 0);
    assert.equal((await state()).checks, checks);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], "opening a snapshot must make no network requests");
  } catch (error) {
    const base = resolve("artifacts/browser/capstone-notebook");
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(resolve(base, "failure-"));
    await page.screenshot({ path: resolve(directory, "failure.png"), fullPage: true });
    await writeFile(resolve(directory, "dom.html"), await page.content());
    await writeFile(resolve(directory, "errors.json"), JSON.stringify({ errors, requests }));
    throw error;
  } finally {
    await browser.close();
  }
});
