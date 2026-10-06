import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nodeOnlyTestArgs } from "../../scripts/quality-gates/bunfigNodeOnlyTests.ts";

/**
 * am-xyxk. The runtime-conformance directory's reachability, checked rather than remembered.
 *
 * Two separate properties, and they fail for different reasons on purpose.
 *
 * THIS FILE RUNS IN THE BUN LANE, DELIBERATELY. Everything it polices lives under scripts/e2e,
 * which bunfig's pathIgnorePatterns hands to the NODE lane, and the thing the second test
 * protects is carried by that same node lane. A check that lived beside what it checks would
 * disappear at exactly the moment its subject did, which is the failure AGENTS.md describes
 * under "A Gate's Own Test Must Not Live Only In The Lane That Gate Controls". So the proof
 * sits in the other lane and reads the files off disk.
 *
 * Reachability is decided by an import specifier or a call token, never by a substring of the
 * module's name, following scriptReachability.test.ts: a census that counted a name as coverage
 * reported one orphan where there were six.
 */

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DIR = join(ROOT, "scripts/e2e/runtime-conformance");
const REL = "scripts/e2e/runtime-conformance";

/**
 * Modules with no importer but their own test, each with the reason and what clears it. An entry
 * is a recorded decision, not a suppression: the test fails when a listed module BECOMES
 * reachable, so wiring one in forces its line to be deleted rather than left as stale prose.
 *
 * All five arrived orphaned in 9c38a5f7, the same commit as run.ts, whose message enumerates the
 * nine assertions run.ts makes and names none of these properties. They are checks that were
 * never written, not wiring that was lost, and am-xyxk holds the decision on each.
 *
 * FOUR NOW, NOT FIVE. performanceMarkReader is composed into checks.ts as of am-xyxk item 4,
 * and its entry was deleted because this test failed when it became reachable - the stale-entry
 * arm doing its job on the person who wrote it. The claim that blocked it, that nothing emits
 * performance marks, was measured against the fixture app's own source; the fixture drives the
 * REAL scheduler, which calls markInput and markAccepted, and four marks are present in the
 * page after load.
 */
const EXPECTED_ORPHANED: ReadonlyMap<string, string> = new Map([
  // identityReader.ts came OUT of this map on 2026-10-06. Its recorded reason named the defect that
  // made it worth wiring - "checks.ts has no try/catch, so a DomContractError crashes the run instead
  // of naming the attribute" - and 9bf233a2 wired missingIdentityAttribute, the one export that is not
  // a pass-through, into all four of those call sites. A missing root attribute is now a named failing
  // check. The pass-through half, readInstrumentIdentity, is still called by nothing, and retiring it
  // is a smaller question than the one this entry was holding open.
  // networkLogClassifier.ts came OUT of this map on 2026-10-06. Its reason was "nothing classifies
  // network requests during a conformance run (checks.ts has no network handling at all)", and
  // checks.ts now watches the network from before navigation and asserts the arrival contract: an
  // instrument shows its static worked example and fetches no wasm. Non-vacuous because the runtime
  // fixture SERVES a wasm artifact and a manifest, so declining to fetch one is a fact about the app.
  // Its predicate's tautological-test complaint is filed separately and is untouched by this.
  // rafSampler.ts came OUT of this map on 2026-10-06. Its reason was "Helper half of an unwritten
  // check: nothing samples painted frames during a conformance run", and checks.ts now samples 25
  // animation frames across two setup changes and hands the settled ones to findMislabeledPaint. The
  // check asks the question the predicate makes possible: a frame whose labeled input revision is
  // ahead of the accepted revision that produced its number is LEGITIMATE while pending or while
  // distinguished as refused or unavailable, and a defect only when the page simultaneously calls the
  // view "accepted". Proved by plant: setting data-view-state to "accepted" unconditionally in the
  // fixture turned exactly this one check red - "25 settled frame(s) painted 0.4559512189589441 from
  // accepted revision 2 while labeled 3" - and the other thirteen stayed green.
  //
  // Wiring it found a second defect, in the harness rather than the module: run.ts opened every
  // assertion with a goto to a url differing from the current one only in its FRAGMENT, which is a
  // same-document navigation, so eleven checks had been sharing one document and one set of workers.
  // See freshNavigation.ts for the measured sequence.
  // tapeUrlBuilder.ts came OUT of this map on 2026-10-06. Its reason was "nothing exercises a tape
  // seed URL during a conformance run", and checks.ts now navigates with a built url carrying
  // 2^64 - 1 and compares the accepted snapshot's own seed with it. Wiring it found a bug in the
  // module itself: the builder appended ?seed= blindly, so on a hash route the query landed inside
  // the FRAGMENT where neither URL.searchParams nor the page's location.search can see it, and the
  // seed was silently ignored. Its own test had only ever passed a fragment-free path.
]);

const sourceFiles = readdirSync(DIR)
  .filter((n) => n.endsWith(".ts"))
  .filter((n) => !n.endsWith(".test.ts"))
  .sort();

/** Local import specifiers, from static imports, re-exports and dynamic import(). */
function localSpecifiers(text: string): readonly string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+\.ts)["']/g)) {
    const spec = m[1];
    if (spec) out.push(spec.slice(spec.lastIndexOf("/") + 1));
  }
  return out;
}

describe("runtime-conformance modules are reachable, or recorded as not (am-xyxk)", () => {
  test("every module has an importer that is not merely its own test", () => {
    const importersOf = new Map<string, string[]>();
    for (const name of sourceFiles) importersOf.set(name, []);

    // Importers from anywhere in the repository, not only from this directory: a module wired in
    // from scripts/ or src/ is reachable, and looking only at siblings would call it orphaned.
    const roots = [join(ROOT, "scripts"), join(ROOT, "src")];
    const walk = (dir: string): string[] => {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...walk(full));
        else if (/\.(ts|mts|mjs)$/.test(entry.name)) found.push(full);
      }
      return found;
    };
    for (const file of roots.flatMap(walk)) {
      const rel = file.slice(ROOT.length + 1);
      const text = readFileSync(file, "utf8");
      for (const spec of localSpecifiers(text)) {
        const list = importersOf.get(spec);
        if (!list) continue;
        // Only count an importer that actually resolves to THIS directory's module. A sibling
        // basename elsewhere in the tree must not credit it.
        const resolved = join(dirname(file), spec);
        if (!resolved.startsWith(DIR)) continue;
        if (rel === `${REL}/${spec}`) continue;
        list.push(rel);
      }
    }

    const orphaned: string[] = [];
    const unexpectedlyReachable: string[] = [];
    for (const name of sourceFiles) {
      const ownTest = `${REL}/${name.replace(/\.ts$/, ".test.ts")}`;
      const others = (importersOf.get(name) ?? []).filter((i) => i !== ownTest);
      const isOrphan = others.length === 0;
      if (isOrphan && !EXPECTED_ORPHANED.has(name)) {
        orphaned.push(`${name}: no importer but ${ownTest}`);
      }
      if (!isOrphan && EXPECTED_ORPHANED.has(name)) {
        unexpectedlyReachable.push(`${name}: now imported by ${others.join(", ")}`);
      }
    }

    expect(
      orphaned,
      `A runtime-conformance module is measured by nothing but its own test. Compose it into run.ts with an assertion that consumes its output, or record it in EXPECTED_ORPHANED with the reason (am-xyxk).\n${orphaned.join("\n")}`,
    ).toEqual([]);
    expect(
      unexpectedlyReachable,
      `A module recorded as orphaned is now reachable. Delete its EXPECTED_ORPHANED entry and its now-stale reason (am-xyxk).\n${unexpectedlyReachable.join("\n")}`,
    ).toEqual([]);
  });

  test("the conformance run is INVOKED from a lane that runs, not merely imported", () => {
    // The property the directory's own tests cannot have. run.ts's nine assertions are carried
    // in CI by one unconditional call in live.test.ts, reached through the node lane, and
    // deleting that one call would silently retire nine live-class assertions.
    //
    // The registered browser-acceptance gate now names this journey too (am-xyxk item 1; before
    // that it exited 2 on a usage error), but it is NOT a second CI route: its family is
    // "browser" and no workflow runs --family browser, while .github/workflows/
    // browser-acceptance.yml runs a glob that excludes this directory. So the node lane remains
    // the only route that executes these assertions in CI, and this test keys on it.
    //
    // A call token, not an import. `import { runRuntimeConformance }` does not match; only
    // `runRuntimeConformance(` does, which is what distinguishes "wired" from "named".
    const laneFiles = nodeOnlyTestArgs(readFileSync(join(ROOT, "bunfig.toml"), "utf8"), ROOT)
      .filter((a) => /\.(ts|mjs)$/.test(a))
      .map((a) => (a.startsWith(ROOT) ? a.slice(ROOT.length + 1) : a));
    expect(
      laneFiles.length,
      "the node lane resolved to no files; the derivation is broken",
    ).toBeGreaterThan(0);

    const callers = laneFiles.filter((rel) => {
      let text: string;
      try {
        text = readFileSync(join(ROOT, rel), "utf8");
      } catch {
        return false;
      }
      return /\brunRuntimeConformance\s*\(/.test(text);
    });

    expect(
      callers,
      "No file in the node lane CALLS runRuntimeConformance. The nine live-class runtime-conformance assertions are then reachable from nothing CI runs: the registered browser-acceptance gate names this journey but its family is 'browser' and no workflow runs that family, and the browser-acceptance workflow's glob excludes scripts/e2e/runtime-conformance. Restore the call, or declare the new route here (am-xyxk).",
    ).not.toEqual([]);
  });
});
