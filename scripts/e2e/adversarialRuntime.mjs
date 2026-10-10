/**
 * THE adversarial-runtime SUITE: the browser halves of rows 9 and 12 (am-ver-adversarial-audit-1ef).
 *
 * The bead's test plan: "an observer change on SR-03 keeps `data-run-id` and the event digest; a
 * BM-01 permalink with seed `9007199254740993` reproduces its latent digest after reload and differs
 * from `9007199254740992`."
 *
 * WHAT IS CHECKED HERE, AND WHAT BELONGS TO ANOTHER SURFACE. The production-lab clauses are checked
 * against the real built routes over HTTP. The digest clauses are NOT, and the reason is a design
 * decision someone else already made rather than a hole: `am-rt-browser-conformance-09i5` specifies
 * them in detail against dedicated RUNTIME FIXTURE APPS -- "changing frame speed back and forth keeps
 * `data-run-id`, `eventSetDigest`, and `worldlineDigest`", and on `fixtureNormals.ts`
 * "`?seed=9007199254740993` ... reloads to the same latent digest" while "`?seed=9007199254740992`
 * gives a different digest". Those are this suite's two clauses, proved where a digest can be
 * published cheaply.
 *
 * That is why no production lab renders one, and the measurement agrees: `instanceStore.ts` has no
 * digest field, and the only `data-*-digest` attributes in the markup are `data-source-digest` (the
 * build-time worked example) and `data-equation-digest` (an equation record). Publishing a scientific
 * digest from a lab session would be async via `crypto.subtle` while `useSyncExternalStore` requires
 * a stable synchronous snapshot, so a fixture app is the cheaper and more honest place for it.
 *
 * So the digest clause is a DECLARED ABSENCE below, keyed to that bead, and this suite REFUSES IN
 * BOTH DIRECTIONS: it fails if an entry is deleted while the attribute is still missing, and it fails
 * if the attribute APPEARS on a production lab while the entry is still here -- because that would
 * mean the design changed and this suite should then assert the digest directly. The second half is
 * what makes the declaration self-retiring rather than a comment nobody deletes.
 *
 * Verified, not assumed, when this was written: `src/testing/runtime-fixtures/eventLedgerFixture.ts`
 * and `seededWalkFixture.ts` exist, `fixtureNormals.ts` does not, and `scripts/e2e/fixtures/
 * fixtureApps.ts` has no `runtime` entry -- so that bead is genuinely outstanding and this is a live
 * pointer, not a dead one.
 *
 * WHY IT RUNS AGAINST `out/` WITHOUT A REBUILD, and why that is a REFUSAL rather than a sentence.
 * `out/` in this checkout is around a hundred commits behind HEAD, and the harness's own
 * `assertOutFreshness` refuses past fifty, so a blanket commit count would stop this suite from ever
 * running here. The narrower question is the right one: has anything THESE TWO ROWS depend on moved
 * since the build? `SUBSYSTEMS` below names those paths and `assertSubsystemFreshness` asks git
 * directly, refusing with the offending commits listed if any of them changed.
 *
 * The first version of this file only PRINTED the built commit and relied on a measurement recorded
 * in a commit message. That is the shape AGENTS.md warns about twice over -- a persuasive reason to
 * trust a gate is a reason to check separately that the gate reaches a verdict -- so the measurement
 * is now executed on every run instead of being quoted from the day it was taken.
 *
 * Usage: node --experimental-strip-types scripts/e2e/adversarialRuntime.mjs
 *   BROWSERS=chromium,webkit   which engines to run (default both; both are installed here)
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";
import { reportPopulation } from "../gate-census/population.ts";
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
    owner: "am-rt-browser-conformance-09i5",
    reason:
      "That bead owns this clause verbatim -- 'changing frame speed back and forth keeps data-run-id, eventSetDigest, and worldlineDigest' -- against the eventLedgerFixture runtime app, where a digest can be published synchronously. A production lab publishes none by design. runId, snapshotVersion and both input revisions ARE checked below, and they carry the rest of the row's claim.",
  }),
  Object.freeze({
    id: "bm-01-latent-path-digest",
    row: 12,
    attribute: "data-latent-path-digest",
    route: "/lab/bm-01/",
    selector: '[data-instrument-id="bm-01"]',
    owner: "am-rt-browser-conformance-09i5",
    reason:
      "Same bead, same verbatim clause: on fixtureNormals.ts '?seed=9007199254740993 ... reloads to the same latent digest' and '?seed=9007199254740992 gives a different digest'. Here the row's claim -- that the larger seed survives transport and is a different state from its neighbour -- is carried by the permalink round trip, which is the transport the claim is about.",
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

/**
 * The paths these two rows actually exercise. A change to any of them invalidates this run; a change
 * anywhere else in the repository does not.
 */
const SUBSYSTEMS = Object.freeze([
  "src/experiments/sr03",
  "src/experiments/bm01",
  "src/experiments/store",
  "src/experiments/permalink",
  "src/experiments/identity",
  "src/components/lab/RodSimultaneityLab.tsx",
  "src/components/lab/TracerLab.tsx",
]);

/** Refuses when a subsystem this suite reads has moved since `out/` was built. */
function assertSubsystemFreshness() {
  if (builtCommit === "unknown") {
    throw new Error(
      "out/release.json names no commit, so the freshness of this build cannot be established. Run `bun run build`.",
    );
  }
  let moved;
  try {
    moved = execFileSync("git", ["log", "--oneline", `${builtCommit}..HEAD`, "--", ...SUBSYSTEMS], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    throw new Error(
      `could not ask git what changed since ${builtCommit}: ${error.message}. This suite reads built output, so it refuses rather than reporting over an unknown build.`,
    );
  }
  if (moved.length > 0) {
    const commits = moved.split("\n");
    throw new Error(
      `out/ was built from ${builtCommit.slice(0, 12)} and ${commits.length} commit(s) have since touched a subsystem these rows read, so this run would describe code that is no longer there. Run \`bun run build\`.\n  ${commits.join("\n  ")}`,
    );
  }
  console.log(
    `[adversarial-runtime] out/ built from ${builtCommit.slice(0, 12)}; 0 commits since have touched any of ${SUBSYSTEMS.length} subsystems these rows read`,
  );
}

assertSubsystemFreshness();

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

// THE POPULATION, PRINTED BEFORE ANY ENGINE LAUNCHES (am-rc1001-bridge-plan-pcjk.9). ENGINES and not
// clauses, because the collapse that matters here is an engine silently going missing: rows 9 and 12
// are checked twice over, once per engine, and a run that quietly dropped webkit would still report
// thirteen healthy clauses. The clause count is printed beside the verdict for a reader; the floor
// sits on the thing whose absence would not show.
//
// EARLY, and that placement is the point. It sat after the engine loop until I tried to verify it on
// a host where chromium will not launch: the suite hung before reaching the line, so a gate that
// cannot start printed no population at all and the census could not tell that from a gate with no
// record. The count depends only on the BROWSERS list, which is known before any work, so there is
// no reason to make a reader wait for it.
const censusVacuous = reportPopulation({
  gate: "adversarial-runtime",
  examined: engines.length,
  noun: "browser engines",
  minimum: 2,
});
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
process.exit(censusVacuous || failures > 0 ? 1 : 0);
