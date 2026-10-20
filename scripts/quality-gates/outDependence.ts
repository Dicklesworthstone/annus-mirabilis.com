/**
 * WHICH NODE-LANE TESTS ACTUALLY NEED out/, SO A STALE BUILD STOPS TAKING DOWN THE ONES THAT DO NOT.
 *
 * The node lane refuses to start when `out/` is stale. That refusal is right and it was an
 * improvement: before it, seven browser and E2E tests each paid to rediscover the same fact. But it
 * is lane-wide, and the lane holds tests that never read the build at all. They are there for a
 * different reason -- bun cannot spawn git in this repository, so anything whose population is
 * `git ls-files` has to run under node.
 *
 * MEASURED 2026-10-20, with out/ stale: of the 107 files the lane runs, 47 reference nothing under
 * `out/` even through their local imports, and 37 of those drive no browser. All 37 were run in that
 * state: 223 tests, 223 pass, 0 fail, 39 seconds. So the refusal was denying them for no reason.
 *
 * THE ONE THAT MATTERS MOST IS `src/content/provenance/yamlDifferential.node.test.ts`, the test that
 * puts every committed YAML record through a second parser. Its whole purpose is to catch a record
 * this project's own parser mis-reads, and a content edit is the only thing that can introduce one.
 * A content edit is also what makes `out/` stale. So the gate was unavailable at exactly the moment
 * it was needed, and on 2026-10-19 that is what happened: `cda842215` records four journey records
 * dropped by the site's parser reaching origin/main, and the lane that would have named them had
 * refused to start.
 *
 * WHICH DIRECTION THE SCAN FAILS IN, because it is a text scan and so it must say. A comment that
 * MENTIONS `out/` counts as a reference, so a test is classified as needing the build when it only
 * talks about it. That costs nothing but a test staying in the gated group, which is where it was
 * already. The dangerous direction would be the other one -- a test that reads the build through a
 * route the scan misses -- and it is why `drivesBrowser` is a second, independent filter: a browser
 * test needs a served site whether or not this scan can see the path, so it stays gated regardless.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * A reference to the build output. Each alternative is a way this repository actually names it,
 * taken from the lane's own files rather than guessed:
 *
 *   "out" / "out/..." / "../out"   a path literal, in any quote style
 *   join(…, "out", …)               composed, which is the common form
 *   checkOutFreshness, OUT_DIR,     the helpers and constants that mean the same thing
 *   outDir, OUT_ROOT
 */
const OUT_REFERENCE =
  /["'`](?:\.\.\/)*out(?:\/|["'`])|\bjoin\([^)]*["']out["']|\bcheckOutFreshness\b|\bOUT_DIR\b|\bOUT_ROOT\b|\boutDir\b/;

/**
 * A test that drives a real browser. Independent of the scan above, on purpose: a browser test
 * needs a served site, and whether this module can see the path to it is not the question.
 */
const BROWSER_DRIVER =
  /playwright|puppeteer|chromium|firefox|webkit|launchBrowser|newPage|jsdom|happy-dom|browserFixture/i;

const LOCAL_IMPORT = /from\s+["'](\.[^"']+)["']/g;
const MAX_DEPTH = 6;

export type OutDependence = Readonly<{
  /** Files that reference the build, or drive a browser, and so stay gated on freshness. */
  needsOut: readonly string[];
  /** Files that do neither, and can run against a stale or absent build. */
  outIndependent: readonly string[];
  /** For each gated file, the reason: the module where the reference was found, or "browser". */
  reasons: Readonly<Record<string, string>>;
}>;

function resolveLocal(importer: string, spec: string): string | undefined {
  const base = resolve(dirname(importer), spec);
  if (existsSync(base) && !base.endsWith("/")) return base;
  for (const ext of [".ts", ".tsx", ".mts", ".mjs", ".js"]) {
    const withExt = `${base}${ext}`;
    if (existsSync(withExt)) return withExt;
  }
  const index = join(base, "index.ts");
  return existsSync(index) ? index : undefined;
}

/**
 * The module where a reference to `out/` was found, following local imports, or undefined.
 *
 * Depth-capped and cycle-guarded. The repository's import graph is deep enough that an uncapped
 * walk from an E2E test reaches most of `src/`, which would classify everything as needing the
 * build and make this module's answer useless rather than wrong.
 */
export function outReferenceIn(
  file: string,
  root: string,
  seen: Set<string> = new Set(),
  depth = 0,
): string | undefined {
  if (depth > MAX_DEPTH || seen.has(file) || !existsSync(file)) return undefined;
  seen.add(file);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  if (OUT_REFERENCE.test(text)) return file.startsWith(root) ? file.slice(root.length + 1) : file;
  for (const match of text.matchAll(LOCAL_IMPORT)) {
    const spec = match[1];
    if (spec === undefined) continue;
    const dep = resolveLocal(file, spec);
    if (dep === undefined) continue;
    const found = outReferenceIn(dep, root, seen, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Whether this file drives a real browser, read from the file itself and not from its imports. */
export function drivesBrowser(file: string): boolean {
  if (!existsSync(file)) return false;
  try {
    return BROWSER_DRIVER.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

export function partitionByOutDependence(
  files: readonly string[],
  root: string = process.cwd(),
): OutDependence {
  const needsOut: string[] = [];
  const outIndependent: string[] = [];
  const reasons: Record<string, string> = {};
  for (const relative of files) {
    const absolute = resolve(root, relative);
    if (drivesBrowser(absolute)) {
      needsOut.push(relative);
      reasons[relative] = "drives a browser, so it needs a served site";
      continue;
    }
    const found = outReferenceIn(absolute, root);
    if (found !== undefined) {
      needsOut.push(relative);
      reasons[relative] = `references the build in ${found}`;
      continue;
    }
    outIndependent.push(relative);
  }
  return {
    needsOut: Object.freeze(needsOut),
    outIndependent: Object.freeze(outIndependent),
    reasons: Object.freeze(reasons),
  };
}

/**
 * THE GATES THIS PARTITION EXISTS TO KEEP REACHABLE, as a floor rather than as the list that is run.
 *
 * The set that runs is DERIVED, so it follows the lane as it changes. A derived set can also quietly
 * shrink to nothing, which would look exactly like a clean lane, so these are asserted to be in it.
 * Each one reads `content/` or the repository's own records and no build output; each was run on
 * 2026-10-20 against a stale `out/` and passed.
 */
export const CONTENT_GATES_THAT_MUST_STAY_REACHABLE: readonly string[] = Object.freeze([
  // Every committed YAML record through a second parser. The reason this module exists.
  "src/content/provenance/yamlDifferential.node.test.ts",
  // The structural checks over the real corpus.
  "src/content/checks/structural/structural.e2e.test.ts",
  // The source-layer and manifest reads.
  "src/content/manifest/sourceLayers.node.test.ts",
  // The ledger validator's CLI, which is how a ledger edit is checked.
  "src/content/ledger/validateLedgerCli.test.ts",
  // The pinned kernel declarations.
  "src/content/kernel/declaredPins.node.test.ts",
  // The refusal census, which a content edit can stale.
  "src/testing/refusals/flattenedRefusals.test.ts",
  // The gate census's own floor machinery.
  "scripts/gate-census/population.node.test.ts",
]);
