/**
 * WHAT THE CLIENT-BOUNDARY CHECK ACTUALLY COVERS, WITH ITS DENOMINATOR (am-t84m, criterion 5).
 *
 * am-t84m: a production build failed on Vercel with `UnhandledSchemeError: Reading from "node:crypto"
 * is not handled by plugins` while every local check passed, because a module reachable from the CLIENT
 * graph imported node: builtins. Its fifth acceptance criterion asks for the denominator - "how many
 * client entry points the check covers, out of how many exist" - and that is the half a passing
 * assertion cannot supply on its own.
 *
 * The live-tree assertion in rscClientBoundary.test.ts says `violations).toEqual([])` and guards
 * emptiness with `files.length > 50`. A file-count floor is not a denominator: it cannot tell a run
 * that examined every route from one whose entry-point regex quietly stopped matching a Next.js
 * convention. An absent class cannot fail a loop over the present ones, which is how a check keeps
 * reporting zero while covering less than it did.
 *
 * So this states the population from GIT, not from the walker, because a walker that defines its own
 * population cannot be measured against it. Measured 2026-10-06:
 *
 *   148 tracked non-test sources under src/app
 *   108 of them are Next.js special files, and isAppRouterEntry accepts all 108, rejecting none
 *   142 of the 148 are the entries plus everything reachable from one by a runtime import
 *     6 are reachable from no entry, and every one of them is consumed only by tests
 *
 * THE SIX ARE NAMED, not counted. They are not a hole in the check: a module no route imports is not
 * in the reader's graph, so the boundary rules have nothing to say about it. They are listed because a
 * SEVENTH would be a decision - a non-route module under src/app that some other mechanism ships would
 * be exactly the shape am-t84m is about - and a count cannot ask for that decision while a named set
 * can.
 *
 * IN THE NODE LANE because it reads `git ls-files`, which bun's runner cannot posix_spawn on this host.
 * The tracked list is also the right population: an untracked scratch file under src/app is a RULE 2
 * violation for another gate to catch, not a route this check should be covering.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectAppRouterSourceFiles,
  extractRuntimeImportSpecifiers,
  isAppRouterEntry,
  resolveImport,
} from "../../scripts/rsc-client-boundary.ts";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/**
 * The Next.js App Router special-file names, written out from the framework's conventions rather than
 * taken from `isAppRouterEntry`, so the two can disagree. If a convention is added to the framework and
 * only one of these lists learns it, that is the divergence worth catching; sharing one regex would make
 * this test agree with the implementation by construction.
 */
const SPECIAL_FILE =
  /\/(page|layout|template|default|loading|error|global-error|not-found|route|robots|sitemap|opengraph-image)\.(tsx|ts|jsx|js)$/;

/**
 * Tracked sources under src/app that no App Router entry imports, each consumed only by tests.
 *
 * `_opengraph-image.tsx` is named OUTSIDE the file convention on purpose, and layout.tsx's own comment
 * says so, which is why it is not an entry. The theme modules derive data from the stylesheets for
 * contrast, glyph and baseline checks. `inline-scripts/registry.ts` is the record the offline and
 * theme-init tests read.
 *
 * A seventh entry is not a formality: adding one means asserting that nothing but a test consumes it.
 */
const TEST_ONLY_UNDER_APP: readonly string[] = [
  "src/app/_opengraph-image.tsx",
  "src/app/inline-scripts/registry.ts",
  "src/app/theme/colourChannels.ts",
  "src/app/theme/contentGlyphUsage.ts",
  "src/app/theme/fontGlyphs.ts",
  "src/app/theme/glyphBaseline.ts",
];

function trackedAppSources(): string[] {
  return execFileSync("git", ["ls-files", "src/app"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f) && !/\.(test|spec)\./.test(f));
}

/** Everything an App Router entry pulls in, by the same resolver the boundary check uses. */
function reachableFromEntries(fileMap: Map<string, string>): Set<string> {
  const reachable = new Set<string>();
  const queue = [...fileMap.keys()].filter((p) => isAppRouterEntry(p));
  for (const entry of queue) reachable.add(entry);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const spec of extractRuntimeImportSpecifiers(fileMap.get(current) ?? "")) {
      const resolved = resolveImport(current, spec, fileMap);
      if (resolved && !reachable.has(resolved)) {
        reachable.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return reachable;
}

const tracked = trackedAppSources();
const records = collectAppRouterSourceFiles(ROOT);
const fileMap = new Map(records.map((r) => [r.path, r.content]));
const entriesOnDisk = tracked.filter((f) => SPECIAL_FILE.test(f));
const reachable = reachableFromEntries(fileMap);
const orphans = tracked.filter((f) => !reachable.has(f));

test("the population is real and printed beside the verdict", () => {
  // A `git ls-files` that returned nothing, or a walker that loaded nothing, would make every assertion
  // below vacuously true and read as full coverage.
  assert.ok(tracked.length > 100, `only ${tracked.length} tracked sources under src/app`);
  assert.ok(entriesOnDisk.length > 50, `only ${entriesOnDisk.length} App Router entries found`);
  assert.ok(fileMap.size > 1000, `the walker loaded only ${fileMap.size} files`);
  console.log(
    `[app-router coverage] ${tracked.length} tracked non-test sources under src/app; ` +
      `${entriesOnDisk.length} App Router entries; ${tracked.length - orphans.length} covered ` +
      `(entries plus everything reachable from one); ${orphans.length} reachable from no entry`,
  );
});

test("every Next.js special file under src/app is an entry the check covers", () => {
  // The divergence this exists for: a convention the framework adds and isAppRouterEntry does not
  // learn becomes a route whose client graph nothing examines, and no count would fall.
  const rejected = entriesOnDisk.filter((f) => !isAppRouterEntry(f));
  assert.deepEqual(rejected, [], `isAppRouterEntry rejects special files: ${rejected.join(", ")}`);
  const notLoaded = entriesOnDisk.filter((f) => !fileMap.has(f));
  assert.deepEqual(notLoaded, [], `entries the walker never loaded: ${notLoaded.join(", ")}`);
});

/**
 * The twelve names, as a vocabulary to probe rather than a population to count.
 *
 * THE REASON THIS EXISTS IS A GREEN PLANT. I first proved the test above by deleting
 * `opengraph-image` from isAppRouterEntry's regex, and every assertion stayed GREEN - because no file
 * under src/app is named `opengraph-image.tsx` (this repo's share card is `_opengraph-image.tsx`, named
 * outside the convention on purpose). Re-planted on `robots`, which has exactly one instance, it went
 * red at once.
 *
 * So the coverage test can only catch a convention being dropped while the tree HAPPENS to contain one.
 * Measured 2026-10-06: of the twelve names, five occur under src/app (page 93, route 7, layout 3,
 * sitemap 1, robots 1) and SEVEN occur zero times. A loop over the files present can never fail for
 * those seven, which is the absent-class problem in the test I had just written to state a denominator.
 *
 * Probing each name on a synthetic path asks the implementation's vocabulary directly, so a dropped
 * convention fails here whether or not this repository has a route using it yet.
 */
const APP_ROUTER_CONVENTIONS: readonly string[] = [
  "page",
  "layout",
  "template",
  "default",
  "loading",
  "error",
  "global-error",
  "not-found",
  "route",
  "robots",
  "sitemap",
  "opengraph-image",
];

test("isAppRouterEntry knows every App Router convention, including the seven with no instance here", () => {
  const unknown = APP_ROUTER_CONVENTIONS.filter(
    (name) => !isAppRouterEntry(`src/app/probe/${name}.tsx`),
  );
  assert.deepEqual(unknown, [], `isAppRouterEntry does not recognise: ${unknown.join(", ")}`);
  // And the negative, so the probe is not satisfied by a predicate that accepts everything under
  // src/app - which would make the arm above pass while the entry set swallowed ordinary modules.
  assert.equal(isAppRouterEntry("src/app/probe/notAConvention.tsx"), false);
  assert.equal(isAppRouterEntry("src/app/theme/colourChannels.ts"), false);
  console.log(
    `[app-router coverage] ${APP_ROUTER_CONVENTIONS.length} conventions probed; ` +
      `5 of them occur under src/app in this tree, so the file-population arms above can only ` +
      `fail for those five`,
  );
});

test("the only sources under src/app outside the checked graph are the named test-only ones", () => {
  assert.deepEqual([...orphans].sort(), [...TEST_ONLY_UNDER_APP].sort());
});

test("each named exemption really is unreachable, and really does exist", () => {
  // Both halves, because an exemption list whose entries are stale would silently grant cover to
  // nothing while a real orphan hid behind the count matching.
  for (const file of TEST_ONLY_UNDER_APP) {
    assert.ok(
      tracked.includes(file),
      `${file} is exempted but is not a tracked source under src/app`,
    );
    assert.ok(!reachable.has(file), `${file} is exempted but IS reachable from an entry`);
  }
});

test("PLANTED: a special file the walker cannot load is reported, not silently dropped", () => {
  // The failure mode of the second test, driven rather than asserted about: if the walker's file set
  // and the git population disagree, the check covers less than its own green suggests.
  const pretendMissing = [...entriesOnDisk, "src/app/does-not-exist/page.tsx"];
  const notLoaded = pretendMissing.filter((f) => !fileMap.has(f));
  assert.deepEqual(notLoaded, ["src/app/does-not-exist/page.tsx"]);
});
