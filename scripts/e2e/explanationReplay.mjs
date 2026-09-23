import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { NOTEBOOK_KEY, parseNotebookDocument } from "../../src/reader/notebook/schema.ts";

// Actual built application acceptance; no fixture route, model replacement, or in-memory fallback.
const base = process.env.AM_BASE_URL ?? "http://127.0.0.1:3000";
const output = resolve("artifacts/browser/explanation-replay");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  requests = [];
const notes = "REPLAY-PRIVATE-ACCEPTANCE-NOTE";
try {
  const context = await browser.newContext({
    viewport: { width: 320, height: 900 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.replayWorkerCount = 0;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.replayWorkerCount++;
      }
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => requests.push(`${request.url()} ${request.postData() ?? ""}`));
  await page.goto(new URL("/lab/bm-01/compare/", base).href);
  const lab = page.locator("[data-controlled-comparison]");
  await lab.getByRole("button", { name: "Start live comparison", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-controlled-comparison]")
        ?.getAttribute("data-comparison-phase") === "live" &&
      document.querySelector("[data-controlled-comparison]")?.getAttribute("data-pending") ===
        "false",
  );
  const prediction = lab.getByLabel(
    "Optional prediction for the next request: coordinate RMS displacement",
    { exact: true },
  );
  await prediction.selectOption("smaller");
  await lab.getByRole("button", { name: "Use twice the baseline value", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-controlled-comparison]")?.getAttribute("data-pending") ===
      "false",
  );
  // A later choice must not overwrite the prediction already attached to this accepted request.
  await prediction.selectOption("larger");
  await lab
    .getByLabel("Your explanation before (optional; may be written retrospectively)", {
      exact: true,
    })
    .fill("My before explanation");
  await lab
    .getByLabel("Your explanation after (optional)", { exact: true })
    .fill("My after explanation");
  await lab.getByLabel("Private notes (optional)", { exact: true }).fill(notes);
  await lab
    .getByRole("button", { name: "Save this comparison and my explanation", exact: true })
    .click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key) ?? "null")?.entries?.some(
        (entry) => entry.kind === "replay",
      ),
    NOTEBOOK_KEY,
  );
  const saved = parseNotebookDocument(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), NOTEBOOK_KEY),
  );
  assert.equal(saved.entries[0].replay.tape.predictions[0].payload.candidateId, "smaller");
  assert.equal(saved.entries[0].text, notes);
  await page.goto(new URL("/notebook/", base).href);
  await page.getByRole("link", { name: "Open your notebook", exact: true }).click();
  const dialog = page.locator("[data-notebook-dialog]");
  const before = await page.evaluate(() => window.replayWorkerCount);
  await dialog
    .getByRole("button", { name: /^(Open saved evidence and replay|Open the saved comparison)$/ })
    .click();
  await dialog
    .getByRole("button", {
      name: /^(Replay saved comparison as a new run|Run the saved comparison again)$/,
    })
    .waitFor();
  assert.equal(await page.evaluate(() => window.replayWorkerCount), before);
  assert.ok((await dialog.innerText()).includes("What you saw on"));
  await dialog
    .getByRole("button", {
      name: /^(Replay saved comparison as a new run|Run the saved comparison again)$/,
    })
    .click();
  await page.waitForFunction(
    () => document.querySelector("[data-fresh-replay]")?.getAttribute("data-phase") === "complete",
    null,
    { timeout: 30000 },
  );
  assert.equal(await dialog.locator("table").count(), 2);
  assert.ok(
    (await dialog.locator("[data-fresh-replay]").innerText()).includes(
      "agree within relative tolerance",
    ),
  );
  const after = parseNotebookDocument(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), NOTEBOOK_KEY),
  );
  assert.deepEqual(after, saved);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export notebook JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  assert.ok(path);
  assert.deepEqual(parseNotebookDocument(JSON.parse(await readFile(path, "utf8"))), saved);
  assert.equal(
    requests.some((request) => request.includes(notes)),
    false,
  );
  assert.equal(new URL(page.url()).search, "");
  await page.screenshot({ path: resolve(output, "notebook-320.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Clear notebook", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), NOTEBOOK_KEY)).entries
      .length,
    1,
  );
  await dialog.getByRole("button", { name: "Clear notebook", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  assert.equal(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), NOTEBOOK_KEY)).entries
      .length,
    0,
  );
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false);
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      { outcome: "pass", scope: "actual HTTP application", viewport: 320, errors },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({ outcome: "fail", error: String(error), errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
