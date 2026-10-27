/**
 * THE READER'S INVESTIGATION SURVIVES A RELOAD, AGAINST THE BUILT SITE
 * (am-rc1001-bridge-plan-pcjk.27, acceptance clauses 1 and 3).
 *
 * The unit tests prove the parser, the store and the provider's effect; `persistence.test.ts` runs
 * the storage layer against an injected `Storage`, and `context.test.tsx` mounts the provider
 * against happy-dom's `localStorage`. None of them loads the real page, so none of them can say
 * that the laboratory on /discover/brownian-motion/ actually connects, that the pin button becomes
 * enabled, or that a real browser's localStorage holds the report after a real reload. That is
 * what this does.
 *
 * It also answers the clause the unit tests structurally cannot: "0 network requests carry notebook
 * content". `noUpload.test.ts` proves no module on the path CONTAINS a network accessor; this
 * records every request the browser makes across the whole flow, including the reload, and asserts
 * that none carries the prediction. A module graph says what the code can do; this says what
 * happened.
 *
 *   AM_BASE_URL=http://127.0.0.1:3000 node scripts/e2e/investigationPersistence.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = process.env.AM_BASE_URL ?? "http://127.0.0.1:3000";
const output = resolve("artifacts/browser/investigation-persistence");
await mkdir(output, { recursive: true });

const ROUTE = "/discover/brownian-motion/";
const PROMPT = "bm-predict-perturb-explain-radius";
const KEY = "am:investigations:v1:brownian-motion";
/** Distinctive enough that finding it in a request URL or body is unambiguous. */
const PREDICTION = "Sentinel prediction qx7: the spread falls by root two, not by half.";

const browser = await chromium.launch({ headless: true });
const checks = [];
const errors = [];
/** Every request the browser makes, so "nothing is uploaded" is read off the log rather than hoped. */
const requests = [];
let page;

function record(name) {
  checks.push(name);
}

try {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    requests.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? "",
      resourceType: request.resourceType(),
    });
  });

  // ── 1. Arrive with nothing kept.
  await page.goto(new URL(ROUTE, base).href, { waitUntil: "load" });
  const task = page.locator(`section[data-ppe-task-id="${PROMPT}"]`);
  await task.waitFor();
  const notice = task.locator("p[data-investigation-keep]");
  await notice.waitFor({ state: "attached" });
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), KEY),
    null,
    "arrived with an investigation already kept; the test cannot tell a restore from a leftover",
  );
  assert.equal(
    await notice.getAttribute("data-investigation-keep"),
    "idle",
    "the keep notice claims a state before the reader has done anything",
  );
  record("a first visit keeps nothing and says so");

  // ── 2. Open the workspace and wait for the laboratory to connect.
  await task.locator("details.investigation-disclosure > summary").click();
  const workspace = page.locator(`section[data-investigation="${PROMPT}"]`);
  await workspace.waitFor();
  const pin = workspace.getByRole("button", { name: /Pin prediction and starting reading/ });
  // The button is disabled until the store holds an accepted reading, which arrives only when
  // BrownianWorldCheck's bm-01 session connects through useInvestigationWitness. Waiting on
  // ENABLED rather than on visible is the whole point: it is the wiring under test.
  await pin.waitFor();
  await page.waitForFunction(
    (promptId) => {
      const root = document.querySelector(`section[data-investigation="${promptId}"]`);
      const button = [...(root?.querySelectorAll("button") ?? [])].find((element) =>
        element.textContent?.includes("Pin prediction and starting reading"),
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    PROMPT,
    { timeout: 30000 },
  );
  record("the laboratory on the page connects, so a prediction can be pinned");

  // ── 3. Pin a prediction. This is the reader's first explicit action, and the first write.
  await workspace.locator("textarea").first().fill(PREDICTION);
  await pin.click();
  await page.waitForFunction((key) => window.localStorage.getItem(key) !== null, KEY, {
    timeout: 20000,
  });
  const stored = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), KEY));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.report.format, "annus-discovery-investigation");
  assert.equal(stored.report.prediction, PREDICTION);
  assert.equal(stored.report.paper, "brownian-motion");
  assert.equal(stored.report.promptId, PROMPT);
  assert.ok(
    stored.report.baseline.reading.outputs.length > 0,
    "the pinned starting reading carries no outputs, so nothing was captured from the laboratory",
  );
  assert.equal(await notice.getAttribute("data-investigation-keep"), "kept");
  record("pinning writes the report to this device, under the registered key");

  // ── 4. Reload. This is the clause: the reader comes back and the work is there.
  await page.reload({ waitUntil: "load" });
  const taskAfter = page.locator(`section[data-ppe-task-id="${PROMPT}"]`);
  await taskAfter.waitFor();
  const noticeAfter = taskAfter.locator("p[data-investigation-keep]");
  await noticeAfter.waitFor({ state: "attached" });
  await page.waitForFunction(
    () =>
      document
        .querySelector("p[data-investigation-keep]")
        ?.getAttribute("data-investigation-keep") === "restored",
    undefined,
    { timeout: 20000 },
  );
  // textContent, NOT innerText: the notice sits inside a <details> that is closed on arrival, and
  // innerText reflects what is RENDERED, so it returns "" for a hidden element. This cost a run.
  assert.match(
    (await noticeAfter.textContent()) ?? "",
    /kept on this device/i,
    "the restored notice does not tell the reader where their work came from",
  );
  record("after a reload the investigation is open again, marked restored");

  // ── 5. The pinned prediction is shown, not merely stored.
  await taskAfter.locator("details.investigation-disclosure > summary").click();
  const committed = taskAfter.locator("p[data-investigation-prediction]");
  await committed.waitFor();
  assert.match(await committed.innerText(), /Sentinel prediction qx7/);
  record("the reader sees their own pinned prediction after the reload");

  // ── 6. A restored investigation refuses a new capture, in the words the decision chose.
  const workspaceAfter = page.locator(`section[data-investigation="${PROMPT}"]`);
  await workspaceAfter.waitFor();
  const capture = workspaceAfter.getByRole("button", { name: /Capture changed reading/ });
  await capture.waitFor();
  await capture.click();
  const alert = workspaceAfter.locator('p[role="alert"]');
  await alert.waitFor();
  const refusal = await alert.innerText();
  assert.match(
    refusal,
    /restored from an earlier visit/i,
    `the refusal did not say why a restored investigation cannot take a reading: ${refusal}`,
  );
  assert.doesNotMatch(
    refusal,
    /placement changed/i,
    "the refusal fell back to the instance-mixing wording, which misleads a returning reader",
  );
  record("a restored investigation refuses a new reading and says why");

  // ── 7. Nothing was uploaded, read off the request log.
  const leaked = requests.filter(
    (request) =>
      request.url.includes("qx7") ||
      request.url.includes(encodeURIComponent("Sentinel prediction")) ||
      request.body.includes("qx7"),
  );
  assert.deepEqual(
    leaked.map((request) => `${request.method} ${request.url}`),
    [],
    "a request carried the reader's prediction",
  );
  const offOrigin = requests.filter((request) => !request.url.startsWith(base));
  assert.deepEqual(
    offOrigin.map((request) => request.url),
    [],
    "a request left this origin during a private investigation",
  );
  const posts = requests.filter((request) => request.method !== "GET");
  assert.deepEqual(
    posts.map((request) => `${request.method} ${request.url}`),
    [],
    "the investigation path sent a non-GET request",
  );
  record(
    `no request carried the prediction (${requests.length} request(s) recorded, 0 off-origin, 0 non-GET)`,
  );

  // ── 8. THE CONTROL: with the stored bytes gone, the same page restores nothing.
  //
  // Without this, every assertion above is satisfied by a page that somehow shows a pinned
  // prediction for another reason, and "restored" would be a word rather than a mechanism. Clearing
  // one key and reloading the same URL is the smallest intervention that isolates it.
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload({ waitUntil: "load" });
  const taskCleared = page.locator(`section[data-ppe-task-id="${PROMPT}"]`);
  await taskCleared.waitFor();
  const noticeCleared = taskCleared.locator("p[data-investigation-keep]");
  await noticeCleared.waitFor({ state: "attached" });
  // Give the provider's effect the same chance to run as it had when it DID restore.
  await page.waitForTimeout(2000);
  assert.equal(
    await noticeCleared.getAttribute("data-investigation-keep"),
    "idle",
    "the page reported a kept investigation after its stored bytes were removed",
  );
  await taskCleared.locator("details.investigation-disclosure > summary").click();
  const workspaceCleared = page.locator(`section[data-investigation="${PROMPT}"]`);
  await workspaceCleared.waitFor();
  assert.equal(
    await workspaceCleared.locator("p[data-investigation-prediction]").textContent(),
    "",
    "the pinned prediction survived the removal of the only copy on this device",
  );
  record("control: with the stored bytes removed, the same page restores nothing");

  assert.deepEqual(errors, [], `page errors during the investigation flow: ${errors.join(" | ")}`);
  record("no page error during the whole flow");

  await writeFile(
    resolve(output, "requests.json"),
    `${JSON.stringify({ route: ROUTE, recorded: requests.length, requests }, null, 2)}\n`,
  );
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: resolve(output, "failure.png"), fullPage: false })
      .catch(() => undefined);
    await writeFile(resolve(output, "failure.html"), await page.content()).catch(() => undefined);
  }
  console.error(error);
  await browser.close();
  process.exit(1);
}

await browser.close();
for (const check of checks) console.log(`  ok  ${check}`);
console.log(`${checks.length} investigation persistence browser cases passed.`);
