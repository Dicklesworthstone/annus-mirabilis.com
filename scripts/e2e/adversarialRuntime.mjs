/**
 * THE adversarial-runtime SUITE: the browser halves of rows 9 and 12 (am-ver-adversarial-audit-1ef).
 *
 * The bead's test plan: "an observer change on SR-03 keeps `data-run-id` and the event digest; a
 * BM-01 permalink with seed `9007199254740993` reproduces its latent digest after reload and differs
 * from `9007199254740992`."
 *
 * WHAT IS CHECKED HERE, AND WHAT IS DECLARED ABSENT. Three of the four clauses are checked against
 * the real built routes over HTTP. The fourth -- both digest clauses -- cannot be: NO LAB SESSION
 * PUBLISHES A SCIENTIFIC DIGEST. `src/experiments/digest/scientificDigest.ts` exists and is used by
 * the control tapes and by the invariant checker, but `instanceStore.ts` has no digest field and no
 * `data-*-digest` naming an event set or a latent path appears anywhere in the rendered markup
 * (`data-source-digest` is the build-time worked example, `data-equation-digest` is an equation
 * record). So the digest clause is a DECLARED ABSENCE below, keyed to the owning bead, and this suite
 * REFUSES in both directions: it fails if the attribute is missing while the declaration has been
 * removed, and it fails if the attribute APPEARS while the declaration is still here. The second half
 * is what makes the debt self-retiring rather than a comment nobody deletes.
 *
 * WHY IT RUNS AGAINST `out/` WITHOUT A REBUILD, stated because an exit code over stale output is not
 * evidence. Measured before writing this: zero commits have touched `src/experiments/sr03`,
 * `src/experiments/bm01`, `src/experiments/store`, `src/experiments/permalink`,
 * `src/experiments/identity`, `RodSimultaneityLab.tsx` or `TracerLab.tsx` since the commit `out/` was
 * built from. The suite still prints the built commit beside its verdict, so a reader can check that
 * claim rather than take it.
 *
 * Usage: node --experimental-strip-types scripts/e2e/adversarialRuntime.mjs
 *   BROWSERS=chromium,webkit   which engines to run (default both; both are installed here)
 */
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";
import {
  appendLogLine,
  evidenceDirFor,
  logPathFor,
  newLogRunId,
  writeEvidenceFile,
} from "../scaffold/logLine.ts";

const SUITE = "adversarial";
const BEAD = "am-ver-adversarial-audit-1ef";
const ROOT = resolve(".");
const logRunId = newLogRunId();
const logPath = logPathFor(SUITE, logRunId, ROOT);
const evidenceDir = evidenceDirFor(SUITE, logRunId, ROOT);

/**
 * The clauses this suite cannot check, and the bead that unblocks each.
 *
 * Removing an entry here without the attribute existing fails the suite; the attribute appearing
 * while its entry is still here also fails the suite. A declared absence is a debt with an owner,
 * never a budget.
 */
const DECLARED_ABSENCES = Object.freeze([
  Object.freeze({
    id: "sr-03-event-set-digest",
    row: 9,
    attribute: "data-event-set-digest",
    route: "/lab/sr-03/",
    selector: '[data-instrument-id="sr-03"]',
    owner: "am-rt-snapshot-store-aft",
    reason:
      "The accepted snapshot carries no scientific digest. instanceStore.ts has no digest field, and computing one is async (crypto.subtle) while useSyncExternalStore requires a stable synchronous snapshot, so publishing it is the snapshot store's design decision and not this bead's. runId, snapshotVersion and the input revisions ARE checked below, and they carry the row's claim.",
  }),
  Object.freeze({
    id: "bm-01-latent-path-digest",
    row: 12,
    attribute: "data-latent-path-digest",
    route: "/lab/bm-01/",
    selector: '[data-instrument-id="bm-01"]',
    owner: "am-rt-snapshot-store-aft",
    reason:
      "Same missing field. The row's claim -- that 9007199254740993 survives transport and is a different stream from 9007199254740992 -- is carried below by the permalink round trip, which is the transport the claim is about.",
  }),
]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};
const staticRoot = resolve("out");
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      staticRoot,
      `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`,
    );
    if (file !== staticRoot && !file.startsWith(staticRoot + sep)) throw new Error("outside root");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;

const builtCommit = await readFile(resolve("out/release.json"), "utf8")
  .then((text) => JSON.parse(text).commit ?? "unknown")
  .catch(() => "unknown");

let failures = 0;
let checks = 0;
/** One recorded clause. `extra` carries the row and the measured values. */
function record(testId, ok, message, fields = {}) {
  checks += 1;
  if (!ok) failures += 1;
  appendLogLine(logPath, {
    suite: SUITE,
    logRunId,
    testId,
    beadId: BEAD,
    outcome: ok ? "pass" : "fail",
    message,
    expected: fields.expected,
    actual: fields.actual,
    comparisonKind: fields.comparisonKind,
    extra: { builtCommit, ...fields.extra },
  });
  console.log(`${ok ? "✔" : "✘"} ${testId}: ${message}`);
}

/** Opens every settings drawer: both labs keep their advanced controls in a closed <details>. */
async function openDrawers(page, selector) {
  for (const drawer of await page.locator(`${selector} details`).all()) {
    await drawer.evaluate((element) => {
      element.open = true;
    });
  }
  await page.waitForTimeout(250);
}

const identityOf = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => ({
      runId: element.getAttribute("data-run-id"),
      snapshotVersion: element.getAttribute("data-snapshot-version"),
      inputRevision: element.getAttribute("data-input-revision"),
      acceptedInputRevision: element.getAttribute("data-accepted-input-revision"),
      resultStatus: element.getAttribute("data-result-status"),
      instanceId: element.getAttribute("data-instance-id"),
    }));

async function retain(page, name) {
  try {
    const shot = await page.screenshot({ fullPage: false });
    writeEvidenceFile(evidenceDir, `${name}.png`, shot.toString("binary"));
    writeEvidenceFile(evidenceDir, `${name}.html`, await page.content());
  } catch (error) {
    console.error(`[adversarial-runtime] could not retain evidence for ${name}: ${error.message}`);
  }
}

/** ROW 9: an observer change re-describes the world and does not restart it. */
async function row09(page, engine) {
  const selector = '[data-instrument-id="sr-03"]';
  await page.goto(`${base}/lab/sr-03/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(selector).count(), 1, "SR-03 root must be present");
  await openDrawers(page, selector);

  const before = await identityOf(page, selector);
  const readingsBefore = await page
    .locator(`${selector} [data-output]`)
    .evaluateAll((nodes) =>
      nodes.map((n) => `${n.getAttribute("data-output")}=${(n.textContent ?? "").trim()}`),
    );
  // A control that does nothing would pass every identity assertion below, so the population is
  // stated first: this must be a real select with both frames on it.
  const frame = page.locator(`${selector} select[id$="-meas-frame"]`);
  const options = await frame.locator("option").evaluateAll((nodes) => nodes.map((n) => n.value));
  record(
    `row09-observer-control-exists-${engine}`,
    options.includes("K") && options.includes("k") && (await frame.inputValue()) === "K",
    `the measuring observer's frame is a real control with both frames (${options.join(",")}), at K`,
    { extra: { row: 9, instrumentId: "sr-03", browser: engine, options } },
  );

  await frame.selectOption("k");
  await page.waitForTimeout(700);
  const after = await identityOf(page, selector);
  const readingsAfter = await page
    .locator(`${selector} [data-output]`)
    .evaluateAll((nodes) =>
      nodes.map((n) => `${n.getAttribute("data-output")}=${(n.textContent ?? "").trim()}`),
    );

  if (before.runId !== after.runId) await retain(page, `row09-runid-${engine}`);
  record(
    `row09-runid-stable-${engine}`,
    before.runId === after.runId && typeof after.runId === "string" && after.runId.length > 0,
    `the observer change kept data-run-id (${after.runId})`,
    {
      expected: before.runId,
      actual: after.runId,
      comparisonKind: "bitwise",
      extra: {
        row: 9,
        instrumentId: "sr-03",
        instanceId: after.instanceId,
        runId: after.runId,
        browser: engine,
      },
    },
  );
  record(
    `row09-input-revision-untouched-${engine}`,
    before.inputRevision === after.inputRevision &&
      before.acceptedInputRevision === after.acceptedInputRevision,
    `the observer change left both input revisions at ${after.acceptedInputRevision}`,
    {
      expected: before.acceptedInputRevision,
      actual: after.acceptedInputRevision,
      extra: { row: 9, instrumentId: "sr-03", browser: engine },
    },
  );
  record(
    `row09-snapshot-advanced-${engine}`,
    Number(after.snapshotVersion) > Number(before.snapshotVersion),
    `a new snapshot was published for the new description (${before.snapshotVersion} -> ${after.snapshotVersion})`,
    {
      expected: `> ${before.snapshotVersion}`,
      actual: after.snapshotVersion,
      extra: {
        row: 9,
        instrumentId: "sr-03",
        snapshotVersion: after.snapshotVersion,
        browser: engine,
      },
    },
  );
  // THE NON-INERTNESS HALF. If the readings were identical the identity assertions above would hold
  // for a control that does nothing, which is the shape of a fixture that describes its defaults
  // rather than its subject. The measured change is a TYPED result: the chosen endpoints are no
  // longer simultaneous in frame k, so measuredLength becomes not-applicable with a sentence.
  const changed = readingsBefore.filter((line, index) => line !== readingsAfter[index]);
  record(
    `row09-description-really-changed-${engine}`,
    changed.length > 0 && after.resultStatus === "not-applicable",
    `the new description changed ${changed.length} of ${readingsAfter.length} outputs and the result is typed ${after.resultStatus}, not NaN`,
    {
      expected: "at least one changed output, status not-applicable",
      actual: `${changed.length} changed, status ${after.resultStatus}`,
      extra: { row: 9, instrumentId: "sr-03", browser: engine, changed },
    },
  );
}

/** ROW 12: a 64-bit seed survives the permalink, and its neighbour is a different state. */
async function row12(page, engine) {
  const selector = '[data-instrument-id="bm-01"]';
  const above = "9007199254740993"; // 2^53 + 1
  const below = "9007199254740992"; // 2^53, what a JSON number collapses it to
  await page.goto(`${base}/lab/bm-01/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(selector).count(), 1, "BM-01 root must be present");
  await openDrawers(page, selector);

  const links = {};
  const states = {};
  for (const seed of [above, below]) {
    await page.locator(`${selector} input[name="seed"]`).first().fill(seed);
    await page.getByRole("button", { name: "Apply trial settings", exact: true }).first().click();
    await page.waitForTimeout(1200);
    links[seed] = await page
      .locator(`${selector} input[aria-label*="Shareable"], ${selector} input[readonly]`)
      .first()
      .inputValue();
    states[seed] = await identityOf(page, selector);
    record(
      `row12-seed-accepted-${seed}-${engine}`,
      (await page.locator(`${selector} input[name="seed"]`).first().inputValue()) === seed,
      `the control holds seed ${seed} exactly`,
      {
        expected: seed,
        actual: await page.locator(`${selector} input[name="seed"]`).first().inputValue(),
        comparisonKind: "bitwise",
        extra: { row: 12, instrumentId: "bm-01", seed, browser: engine },
      },
    );
  }

  if (links[above] === links[below]) await retain(page, `row12-permalinks-${engine}`);
  record(
    `row12-neighbouring-seeds-differ-${engine}`,
    links[above] !== links[below] && links[above].length > 0,
    links[above] !== links[below]
      ? "2^53+1 and 2^53 produce different permalinks, so they are different states"
      : "2^53+1 and 2^53 produced the SAME permalink: the transport collapsed them into one state",
    {
      expected: `distinct permalinks`,
      actual: `${links[above].slice(-24)} vs ${links[below].slice(-24)}`,
      comparisonKind: "bitwise",
      extra: { row: 12, instrumentId: "bm-01", browser: engine },
    },
  );

  // THE TRANSPORT ITSELF. The tape is compressed, so the digits are not literally in the URL; the
  // claim is about what comes back, which is why this reloads rather than grepping the link.
  for (const seed of [above, below]) {
    const target = links[seed].replace(/^https?:\/\/[^/]+/, base);
    await page.goto(target, { waitUntil: "networkidle" });
    await openDrawers(page, selector);
    const restored = await page.locator(`${selector} input[name="seed"]`).first().inputValue();
    if (restored !== seed) await retain(page, `row12-reload-${seed}-${engine}`);
    record(
      `row12-seed-survives-reload-${seed}-${engine}`,
      restored === seed,
      `after reload the permalink restored seed ${restored}`,
      {
        expected: seed,
        actual: restored,
        comparisonKind: "bitwise",
        extra: {
          row: 12,
          instrumentId: "bm-01",
          seed,
          runId: states[seed].runId,
          browser: engine,
          url: target,
        },
      },
    );
  }
}

/** The declared absences, refused in BOTH directions so the debt cannot go stale either way. */
async function declaredAbsences(page, engine) {
  for (const absence of DECLARED_ABSENCES) {
    await page.goto(`${base}${absence.route}`, { waitUntil: "networkidle" });
    const present = await page
      .locator(absence.selector)
      .first()
      .evaluate((element, name) => element.hasAttribute(name), absence.attribute);
    record(
      `declared-absence-${absence.id}-${engine}`,
      present === false,
      present
        ? `STALE DECLARATION: ${absence.attribute} now exists on ${absence.route}. Delete this entry and assert the digest clause of row ${absence.row}.`
        : `${absence.attribute} is absent as declared, owned by ${absence.owner}`,
      {
        expected: "absent, as declared",
        actual: present ? "present" : "absent",
        extra: {
          row: absence.row,
          absenceId: absence.id,
          ownerBeadId: absence.owner,
          reason: absence.reason,
          browser: engine,
        },
      },
    );
  }
}

const engines = (process.env.BROWSERS ?? "chromium,webkit").split(",").map((s) => s.trim());
const launchers = { chromium, webkit };
try {
  for (const engine of engines) {
    const launcher = launchers[engine];
    if (!launcher) {
      record(`engine-unknown-${engine}`, false, `no launcher named ${engine}`, {
        extra: { browser: engine },
      });
      continue;
    }
    const browser = await launcher.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      console.log(`\n--- ${engine} ---`);
      await row09(page, engine);
      await row12(page, engine);
      await declaredAbsences(page, engine);
      record(
        `no-page-errors-${engine}`,
        pageErrors.length === 0,
        `${pageErrors.length} uncaught page error(s)`,
        { expected: 0, actual: pageErrors.length, extra: { browser: engine, pageErrors } },
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

console.error(
  `[adversarial-runtime] ${checks} clause(s) checked across ${engines.join(", ")} on out/ built from ${builtCommit.slice(0, 12)}; ` +
    `${failures} failed; ${DECLARED_ABSENCES.length} declared absence(s); log artifacts/test-logs/${SUITE}/${logRunId}.jsonl`,
);
// A run that checked nothing is not a pass: AGENTS.md, "A Tool's Exit Code Is Not Evidence Until You
// Know What It Examined".
if (checks === 0) {
  console.error("[adversarial-runtime] NOTHING WAS CHECKED");
  process.exit(1);
}
process.exit(failures > 0 ? 1 : 0);
