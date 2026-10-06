/**
 * A MISSING ROOT ATTRIBUTE FAILS A NAMED CHECK INSTEAD OF CRASHING THE RUN (am-xyxk).
 *
 * checks.ts contained no try/catch at all, so a root missing a required data attribute threw a
 * DomContractError out of whichever check was parsing it and took the whole conformance run with it.
 * A reader of the output saw a crash where the harness should have named the attribute and the
 * placement, and the run's remaining checks never executed. `missingIdentityAttribute` was written to
 * turn that error into the attribute's name and nothing called it: it is the only export of
 * identityReader.ts that is not a pass-through to parseInstrumentRoot, and it was born orphaned in the
 * same commit as the runner, 9c38a5f7.
 *
 * THE STUB IS A PAGE, NOT A PARSER. The point is the behaviour of the real check function, so these
 * drive checkTwoPlacementsIndependent and checkObserverChangePreservesWorld through a stub that
 * answers the two things rootAttrs asks a Playwright page for. Testing the private helper directly
 * would prove the helper and not that any check uses it, which is the whole defect.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "playwright";
import { checkTwoPlacementsIndependent } from "./checks.ts";

type Attrs = Record<string, string | null>;

const complete = (suffix: string): Attrs => ({
  "data-instrument-id": "rt-01",
  "data-instance-id": `runtime-analytic-${suffix}`,
  "data-run-id": `runtime-analytic-${suffix}/run/1`,
  "data-snapshot-version": "1",
  "data-input-revision": "1",
  "data-accepted-input-revision": "1",
  "data-pending": "false",
  "data-execution-label": "host",
});

/** Answers `page.locator(sel).first().evaluate(...)` with the attributes chosen per selector. */
function stubPage(bySelector: Record<string, Attrs>): Page {
  return {
    locator(selector: string) {
      return {
        first() {
          return {
            evaluate: async () => {
              const attrs = bySelector[selector];
              if (attrs === undefined) throw new Error(`stub has no attributes for ${selector}`);
              return attrs;
            },
          };
        },
      };
    },
  } as unknown as Page;
}

test("two complete placements pass, which is the control for the cases below", async () => {
  // Without this, a check that failed for ANY reason would satisfy the assertions below and they
  // would prove nothing about a missing attribute in particular.
  const result = await checkTwoPlacementsIndependent(
    stubPage({ "#placement-a": complete("a"), "#placement-b": complete("b") }),
  );
  assert.equal(result.ok, true);
  assert.match(result.message, /distinct instanceId and runId/);
});

test("a placement missing a required attribute fails by name and does not throw", async () => {
  const { "data-run-id": _dropped, ...withoutRunId } = complete("a");
  const result = await checkTwoPlacementsIndependent(
    stubPage({ "#placement-a": withoutRunId, "#placement-b": complete("b") }),
  );
  assert.equal(result.ok, false);
  // The attribute AND the placement, because a run with two placements has to say which one.
  assert.match(result.message, /data-run-id/);
  assert.match(result.message, /#placement-a/);
});

test("the SECOND placement is named too, so the report is not hard-coded to the first", async () => {
  const { "data-snapshot-version": _dropped, ...withoutVersion } = complete("b");
  const result = await checkTwoPlacementsIndependent(
    stubPage({ "#placement-a": complete("a"), "#placement-b": withoutVersion }),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /data-snapshot-version/);
  assert.match(result.message, /#placement-b/);
});

test("a contract error with no attribute still fails a check rather than crashing", async () => {
  // data-execution-label is present but not one of the four admitted labels, so DomContractError
  // carries an attribute here; the branch that matters is the fallback for an error carrying none,
  // which must still produce ok: false and say what went wrong rather than propagating.
  const result = await checkTwoPlacementsIndependent(
    stubPage({
      "#placement-a": { ...complete("a"), "data-execution-label": "not-a-label" },
      "#placement-b": complete("b"),
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /data-execution-label|not-a-label/);
});

test("the old behaviour is gone: no check rejects instead of returning a result", async () => {
  // The defect in one assertion. Before this wiring the call below threw, so the runner never saw a
  // CheckResult at all and every later check was skipped. This is what a regression would look like.
  const { "data-instance-id": _dropped, ...withoutInstance } = complete("a");
  await assert.doesNotReject(async () => {
    const result = await checkTwoPlacementsIndependent(
      stubPage({ "#placement-a": withoutInstance, "#placement-b": complete("b") }),
    );
    assert.equal(result.ok, false);
  });
});

/**
 * THE ARRIVAL CONTRACT, tested without a browser (am-xyxk).
 *
 * `classifyNetworkRequest` had no caller anywhere: nothing watched the network during a conformance
 * run. The predicate it now feeds is separated from the page precisely so these four arms can run in
 * the unit lane, and the browser half is three lines in run.ts.
 */
import { checkNoWasmOnArrival, type ObservedRequest } from "./checks.ts";
import { classifyNetworkRequest } from "./networkLogClassifier.ts";

const observed = (...urls: string[]): ObservedRequest[] =>
  urls.map((url) => ({ url, kind: classifyNetworkRequest(url) }));

test("a normal arrival passes and says what it saw", () => {
  const result = checkNoWasmOnArrival(
    observed(
      "http://127.0.0.1:1/runtime-conformance.html",
      "http://127.0.0.1:1/app.js",
      "blob:http://127.0.0.1:1/abc",
    ),
  );
  assert.equal(result.ok, true);
  assert.match(result.message, /3 request\(s\)/);
  assert.match(result.message, /no wasm/);
});

test("a wasm fetch on arrival fails and names the url", () => {
  // The fixture SERVES this artifact, which is what makes the passing case above meaningful.
  const result = checkNoWasmOnArrival(
    observed(
      "http://127.0.0.1:1/runtime-conformance.html",
      "http://127.0.0.1:1/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm",
    ),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /fs_annus_diffusion_bg\.wasm/);
  assert.match(result.message, /1 wasm request/);
});

test("a wasm path without the extension is still wasm, since the classifier reads /wasm/ too", () => {
  const result = checkNoWasmOnArrival(observed("http://127.0.0.1:1/wasm/manifest.json"));
  assert.equal(result.ok, false);
  assert.match(result.message, /wasm request/);
});

test("observing NOTHING fails rather than passing, because a page that loaded nothing has no wasm", () => {
  // The vacuity arm, and the reason the predicate counts before it filters: a listener attached after
  // goto, or a navigation that never happened, both produce an empty list that would otherwise read as
  // the cleanest possible pass.
  const result = checkNoWasmOnArrival([]);
  assert.equal(result.ok, false);
  assert.match(result.message, /did not load|nothing was checked/);
});
