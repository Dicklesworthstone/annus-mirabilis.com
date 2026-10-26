/**
 * THE STANDALONE BROWSER SUITES, IN A LANE, AGAINST THE BUILT SITE (am-test-e2e-harness-bqmh).
 *
 * WHAT WAS MISSING. Thirteen `.mjs` suites live under `scripts/e2e`. Seven are named by a
 * `package.json` script, one is imported by a unit test, and `adversarialRuntime.mjs` is a
 * browser-family gate. Measured 2026-10-25 with the node lane's OWN derivation
 * (`nodeOnlyTestArgs(bunfig, root)` returns 108 files, 53 of them under `scripts/e2e`): the
 * remaining SIX were in no lane, no gate and no package script -- 1,113 lines carrying 160
 * assertions that nothing in the repository could reach. Run by hand against a fresh 765-page
 * build, two passed and four had drifted, every drift against a change made elsewhere with its own
 * tests. Nothing reported any of it, because the only thing that could was unreachable.
 *
 * WHY A LANE FILE RATHER THAN SIX PACKAGE SCRIPTS. A script would make them typable; it would not
 * make them RUN. dsr's four checks are `typecheck`, `test`, `test:node` and `gates`, so a script
 * nothing calls is a declaration, which is the exact confusion `src/testing/ciGateWiring.test.ts`
 * exists to refuse. This file is reached by `test:node` because the node lane selects it by
 * filename, and `bunfig.toml`'s `pathIgnorePatterns` keeps it out of `bun test` -- which is also
 * the rule for a test that spawns subprocesses (`scripts/quality-gates/subprocessE2eSplit.test.ts`).
 * One mechanism for all of them, not six wrappers.
 *
 * THE POPULATION IS DERIVED, SO A NEW ORPHAN CANNOT APPEAR IN SILENCE. The test below recomputes
 * which `.mjs` suites nothing names and asserts that set equals RUN plus DECLARED_UNWIRED. Add a
 * suite under `scripts/e2e` without wiring it and this lane reddens naming the file, which is the
 * failure the six above never produced. DECLARED_UNWIRED is a record of debt and carries a reason
 * per entry; it can only shrink.
 *
 * REACHABILITY IS A NAME SEARCH, and that is the honest instrument for this question: "is this file
 * mentioned anywhere" is a question about text, not about syntax, since these suites are reached by
 * a shell command in package.json as often as by an import. It errs toward calling an orphan
 * reached (a file named only in a comment counts), which is the safe direction for a population
 * that gates work.
 *
 * TAP, NOT THE SPEC REPORTER, for the two node:test suites. Their census line under the default
 * reporter is `<glyph> pass N` with a non-ASCII glyph, and reading it with the wrong glyph is a
 * mistake already made in this repository: a census parsed for `# tests N` reported "no tests" for
 * 23 files that had just run 72. `--test-reporter=tap` prints `# pass N` in ASCII.
 *
 * EVERY SUITE'S CENSUS IS ASSERTED, NOT ITS EXIT CODE ALONE. A suite that launched a browser and
 * asserted nothing would exit 0, which is indistinguishable from a clean run; so each entry names
 * the line it must print and the count must exceed zero.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { blankComments } from "../../src/testing/source/comments.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = join(REPO_ROOT, "out");
const E2E_DIR = join(REPO_ROOT, "scripts", "e2e");
const SUITE_TIMEOUT_MS = 240_000;

type Suite = Readonly<{
  /** Repository-relative path, which is also how a failure names it. */
  file: string;
  /** The suite's own base-url variable, read from its header. A wrong name measures the runner. */
  baseUrlVar: string;
  /** node:test files need --test; the rest are top-level scripts with their own assertions. */
  nodeTest: boolean;
  /** The line the suite prints to say what it examined, and whose count must exceed zero. */
  census: RegExp;
}>;

/** Green against the current build on 2026-10-25, with the measured cost beside each. */
const RUN: readonly Suite[] = Object.freeze([
  Object.freeze({
    // 7s. 13 embed routes, each asserting a server-rendered example with JavaScript off.
    file: "scripts/e2e/embeddedLaboratories.mjs",
    baseUrlVar: "AM_EMBED_TEST_BASE_URL",
    nodeTest: false,
    census: /(\d+) embedded laboratory browser cases passed\./,
  }),
  Object.freeze({
    // 33s. One node:test per entry in GUIDED_TOURS, walking every real destination.
    file: "scripts/e2e/guidedTours.mjs",
    baseUrlVar: "TOUR_BASE_URL",
    nodeTest: true,
    census: /^# pass (\d+)$/m,
  }),
  Object.freeze({
    // 6s. 9 tests. Its alert query was scoped to the workbench in 4a6cd141a; before that two of the
    // nine failed on Next's route announcer while the page was correct.
    file: "scripts/e2e/independenceWorkbench.mjs",
    baseUrlVar: "AM_E2E_BASE_URL",
    nodeTest: true,
    census: /^# pass (\d+)$/m,
  }),
  Object.freeze({
    // 5s. 6 checks on /papers/brownian-motion/s4/, including the only one anywhere that reads the
    // reading's own promise -- "opening an explanation never starts one" -- against the MOUNTED
    // bm-01 rather than against the component in isolation.
    //
    // THIS ENTRY WAS IN DECLARED_UNWIRED BELOW, ON A REASON THAT WAS WRONG. It said the route
    // "links to the laboratory rather than an inline mount", measured from the single
    // `data-instrument-id` in the built HTML. The reading DOES mount bm-01: LazyInlineTracerLab
    // puts it behind `<details data-inline-lab="bm-01">` and loads it on first opening, so the
    // attribute is absent from the HTML by design and present once the disclosure is open. Both
    // halves were finished; nothing joined them. The repair was to open the disclosure.
    file: "scripts/e2e/missingStepExplorer.mjs",
    baseUrlVar: "AM_BASE_URL",
    nodeTest: false,
    census: /(\d+) missing-step explorer browser cases passed\./,
  }),
]);

/**
 * Suites that are still reached by nothing, each with the reason it is not in RUN. Measured
 * 2026-10-25 against the same build; the full diagnosis is on am-test-e2e-harness-bqmh.
 *
 * Both are suite drift rather than a site defect, and both drifted against a DELIBERATE current
 * design, so neither can be repaired by changing a selector. That is why they are declared here
 * instead of being wired red or quietly dropped.
 *
 * A third entry, missingStepExplorer.mjs, was here until its reason was re-measured and found
 * false; it is in RUN above, with the correction recorded at its entry. Treat each reason below as
 * a measurement that can be wrong in the same direction: an absent attribute is evidence about the
 * served HTML, never by itself evidence that nothing mounts it.
 */
const DECLARED_UNWIRED: Readonly<Record<string, string>> = Object.freeze({
  // THE REASON HERE IS NOT THE ONE THIS ENTRY CARRIED. It said the suite waits for an <iframe> the
  // built HTML deliberately lacks, which was true and is now repaired in 2ff67b8a7: the embedded
  // viewer is a rendered plate, and the suite asserts the plate's printed page, that it decoded, and
  // that it follows the page input. All 8 paper-by-width cases pass. The blocker below is what the
  // repair uncovered, three sections further down the same file, and it is a question about the
  // product rather than about the suite.
  "scripts/e2e/facsimile.mjs":
    'Its inline-panel section clicks `a[data-view-link="facsimile"]` on /papers/brownian-motion/ to prove that switching to the scan IN PLACE keeps the same mounted bm-01 and fetches facsimile.json exactly once. The reading route carries no such control: measured over the 2026-10-25 build, 224 routes carry that link and every one is a /papers/<paper>/<section>/view/<face>/ page, while the reading route offers only `?view=reading` and `?view=results`. The panel itself IS there, server-rendered and hidden, saying "Your reading position and laboratory are unchanged" -- which only means anything for an in-place switch. So both halves exist and nothing joins them, and whether the reading route should carry the face chooser is a reader-facing decision with a recorded constraint against it: faceAvailability.ts reports facsimile as `unknown` because establishing it costs a 1.6-4.4 MB PDF hash, and FaceFallback requires that "ordinary reading remains static and light". Sections 2 to 4 of the suite are otherwise sound; every anchor they name is present in the build.',
  "scripts/e2e/lightQuantaInvestigation.mjs":
    "Asserts `deepEqual(requests, [])` with its listener attached after networkidle and readiness, so the proposition is that operating the investigation fetches nothing further; 7 lazily-loaded `_next/static/chunks/*.js` now arrive on interaction. Excluding `_next` would weaken the assertion to get green, which is a budget decision rather than a test repair.",
});

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

/**
 * Serves `out/` byte for byte, resolving a directory to its index.html. Deliberately NOT a
 * single-page fallback: `serve -s` answers every route with the home page, which would let a suite
 * walk 36 routes and see one document while every assertion still passed.
 */
function startStaticServer(): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rawUrl = (req.url ?? "/").split("?")[0] ?? "/";
    let filePath = join(OUT_DIR, decodeURIComponent(rawUrl));
    if (existsSync(filePath) && statSync(filePath).isDirectory())
      filePath = join(filePath, "index.html");
    if (!filePath.startsWith(OUT_DIR) || !existsSync(filePath)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(filePath));
  });
  return new Promise((ok) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      ok({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * Every file under src/ and scripts/ that could name a suite, plus package.json, EXCEPT THIS ONE.
 *
 * Excluding this file is not a convenience. It names all six suites itself -- four in RUN and two
 * in DECLARED_UNWIRED -- so including it makes every suite look reached and the derivation returns
 * the empty set, which is precisely the shape AGENTS.md warns about: a check that can match the
 * thing doing the checking. It did, on this file's first working run, and the non-vacuity assertion
 * below is what reported it. So "orphan" here means named by nothing OTHER than this registry.
 */
const SELF = fileURLToPath(import.meta.url);

function searchableFiles(): readonly string[] {
  const found: string[] = [join(REPO_ROOT, "package.json")];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(full);
      } else if (full !== SELF && /\.(ts|tsx|mjs|js|json|toml)$/.test(entry.name)) {
        found.push(full);
      }
    }
  };
  walk(join(REPO_ROOT, "src"));
  walk(join(REPO_ROOT, "scripts"));
  return found;
}

/**
 * Is `name` named by this body AS CODE? Comments are blanked first, strings are not.
 *
 * THE FIRST VERSION READ RAW TEXT AND WAS DEFEATED WITHIN THE HOUR, in the dangerous direction.
 * A comment added to missingStepExplorer.mjs read "the same form embeddedLaboratories.mjs prints",
 * and that mention alone took embeddedLaboratories.mjs out of the orphan set: the derivation
 * reported 5 unnamed suites where 6 are unnamed, and nothing failed, because a suite LEAVING the
 * orphan set only shrinks the population the assertions range over. AGENTS.md states this exactly
 * -- "a gate that forbids a construct must read code, not text", and "the densest prose about a
 * forbidden construct is the documentation explaining why it is forbidden". Here the prose about an
 * unwired suite is the note recording that it is unwired.
 *
 * STRINGS ARE DELIBERATELY NOT BLANKED, and that is not an oversight. The legitimate way these
 * suites are reached is a string: a `package.json` script, or an argument in a spawn array. Blank
 * strings as well and every suite in the repository looks orphaned, including the nine that are
 * properly wired -- a refusal in the safe direction, and a useless instrument.
 *
 * Measured over 4,419 searched files on 2026-10-25: blanking comments changes exactly one verdict
 * today (embeddedLaboratories.mjs returns to the orphan set). Two other suites carry a prose-only
 * mention -- adversarialRuntime.mjs in gatesPersistEvidence.ts, searchPalette.mjs in
 * CommandPalette.ts -- and both stay out of the set because package.json names them in code.
 */
function namesSuite(body: string, name: string): boolean {
  return blankComments(body).includes(name);
}

/** The `.mjs` suites under scripts/e2e whose basename appears as code in no other file. */
function orphanSuites(): readonly string[] {
  const suites = readdirSync(E2E_DIR)
    .filter((name) => name.endsWith(".mjs"))
    .sort();
  const files = searchableFiles();
  const bodies = new Map<string, string>();
  for (const file of files) bodies.set(file, readFileSync(file, "utf8"));
  const orphans: string[] = [];
  for (const name of suites) {
    const self = join(E2E_DIR, name);
    let named = false;
    for (const [file, body] of bodies) {
      if (file === self) continue;
      if (namesSuite(body, name)) {
        named = true;
        break;
      }
    }
    if (!named) orphans.push(`scripts/e2e/${name}`);
  }
  return orphans;
}

/**
 * ASYNC SPAWN, NOT spawnSync, AND THE REASON IS LOAD-BEARING. The static server above runs in THIS
 * process, so a synchronous spawn blocks the event loop that serves it: the suite launches its
 * browser, navigates, and every request hangs until `page.goto` times out at 30s. That is what the
 * first working version of this file did, and it reads as a site failure ("Timeout 30000ms exceeded
 * navigating to ...") rather than as a harness one.
 *
 * NODE_TEST_CONTEXT MUST NOT REACH THE CHILD either. This lane is itself a `node --test` process,
 * which exports that variable; a nested runner that inherits it prints "node:test run() is being
 * called recursively within a test file. skipping running files" and EXITS 0 having run nothing.
 * Both node:test suites did exactly that on this file's first run, and the census assertion is what
 * caught it -- the exit code alone said they had passed.
 */
function runSuite(
  suite: Suite,
  origin: string,
): Promise<{ status: number | null; output: string }> {
  const args = suite.nodeTest
    ? ["--experimental-strip-types", "--test", "--test-reporter=tap", suite.file]
    : ["--experimental-strip-types", suite.file];
  const env = { ...process.env, [suite.baseUrlVar]: origin };
  delete env.NODE_TEST_CONTEXT;
  return new Promise((ok) => {
    const child = spawn("node", args, { cwd: REPO_ROOT, env });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), SUITE_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      ok({ status, output });
    });
  });
}

test("the orphan set is exactly what this lane runs plus the declared debt", () => {
  // The naming predicate, proved in BOTH directions at the point of use, because reading prose as
  // wiring is how this derivation was already wrong once and the failure was silent. A blanker that
  // blanked everything would report every suite orphaned forever, so the second case is not padding.
  assert.equal(
    namesSuite("// the idiom is the one guidedTours.mjs prints\n", "guidedTours.mjs"),
    false,
    "a suite mentioned only in a comment must not count as reached",
  );
  assert.equal(
    namesSuite('spawn("node", ["scripts/e2e/guidedTours.mjs"]);\n', "guidedTours.mjs"),
    true,
    "a suite named in code must count as reached",
  );
  const orphans = orphanSuites();
  // Non-vacuity: this lane's whole value is that the set is non-empty and accounted for. An empty
  // derivation would make every assertion below pass over nothing, which is how a check that has
  // stopped working looks from the outside.
  assert.ok(
    orphans.length > 0,
    "the derivation found no unnamed .mjs suite, which cannot be right",
  );
  const accounted = new Set([...RUN.map((s) => s.file), ...Object.keys(DECLARED_UNWIRED)]);
  const unaccounted = orphans.filter((file) => !accounted.has(file));
  assert.deepEqual(
    unaccounted,
    [],
    `a browser suite under scripts/e2e is reached by nothing and is not declared: ${unaccounted.join(", ")}. Wire it into RUN or record why it cannot be wired.`,
  );
  // And the debt can only shrink: a declared entry that has since become reachable, or that names a
  // file that no longer exists, is stale and must be removed rather than left to accumulate.
  for (const file of accounted) {
    assert.ok(existsSync(join(REPO_ROOT, file)), `${file} is declared here but does not exist`);
  }
  for (const file of Object.keys(DECLARED_UNWIRED)) {
    assert.ok(
      orphans.includes(file),
      `${file} is declared unwired but something now names it; remove the entry`,
    );
  }
  console.log(
    `[standalone suites] ${orphans.length} unnamed suite(s): ${RUN.length} run here, ${Object.keys(DECLARED_UNWIRED).length} declared unwired`,
  );
});

for (const suite of RUN) {
  test(`${suite.file} passes against the built site`, async () => {
    assertOutFreshness("out", REPO_ROOT);
    const { server, origin } = await startStaticServer();
    try {
      const { status, output } = await runSuite(suite, origin);
      const match = suite.census.exec(output);
      // The census BEFORE the verdict, because a suite that examined nothing also exits 0.
      assert.ok(
        match?.[1] !== undefined,
        `${suite.file} printed no census line matching ${suite.census}; last 600 chars:\n${output.slice(-600)}`,
      );
      const examined = Number(match[1]);
      console.log(`[standalone suites] ${suite.file}: ${examined} case(s) passed`);
      assert.ok(examined > 0, `${suite.file} reported ${examined} passing cases`);
      assert.equal(
        status,
        0,
        `${suite.file} exited ${status}; last 1200 chars:\n${output.slice(-1200)}`,
      );
    } finally {
      server.close();
    }
  });
}

test("PLANTED: a suite pointed at a dead origin fails this lane", async () => {
  // Without this, the three tests above would pass on a lane that had quietly stopped reaching the
  // suites at all -- a spawn that never ran would report no census and no failure if the assertions
  // were ordered the other way. The dead port proves the exit code and the census are both read.
  const suite = RUN[0];
  assert.ok(suite);
  const { status, output } = await runSuite(suite, "http://127.0.0.1:1");
  assert.notEqual(status, 0, "a suite that cannot reach the site must not exit 0");
  assert.equal(
    suite.census.exec(output)?.[1],
    undefined,
    "a suite that reached nothing must not print a passing census",
  );
  console.log(`[standalone suites] PLANT: ${suite.file} against a dead origin exited ${status}`);
});
