/**
 * THE TWO WORKER ARMS ARE SEPARABLE, AND A MENTION IS NOT A REQUEST (am-xyxk).
 *
 * The classifier's worker test used to be `lower.includes("worker") || lower.startsWith("blob:")`,
 * and this file's only worker case was `classifyNetworkRequest("blob:http://127.0.0.1/worker")` --
 * a string that satisfies BOTH arms. Either arm could have been deleted and this test would still
 * have passed, which is why a substring deciding a NetworkKind survived here unexamined.
 *
 * So the cases below are chosen to make each arm fail on its own:
 *
 *   a blob with no "worker" anywhere in it      -> only the blob arm can classify it
 *   a worker script that is not a blob          -> only the filename arm can classify it
 *   a page whose path or query says "worker"    -> NEITHER arm may classify it
 *
 * The third group is the defect. It is kept as an explicit negative rather than left to the
 * absence of a positive, because an absence proves nothing about a predicate nobody ran.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { classifyNetworkRequest } from "./networkLogClassifier.ts";

test("network-log classifier distinguishes worker, WASM, and page requests", () => {
  assert.equal(classifyNetworkRequest("blob:http://127.0.0.1/worker"), "worker");
  assert.equal(classifyNetworkRequest("/apps/runtime/wasm/fs_annus_diffusion_bg.wasm"), "wasm");
  assert.equal(classifyNetworkRequest("/apps/runtime/bundle.js"), "page");
  assert.equal(classifyNetworkRequest("/runtime-conformance.html"), "page");
});

test("the blob arm alone: a blob url that never says worker is still a worker", () => {
  // Deletes the filename arm's contribution. A blob has no path to read, so this is the case that
  // cannot be recognised any other way.
  for (const url of [
    "blob:http://127.0.0.1/3f9a1c2e-0b44-4a1f-9c7e-1d2b3a4c5d6e",
    "blob:https://annus-mirabilis.com/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  ]) {
    assert.ok(
      !url.toLowerCase().includes("worker"),
      `the control must not contain the token: ${url}`,
    );
    assert.equal(classifyNetworkRequest(url), "worker", url);
  }
});

test("the filename arm alone: a worker script that is not a blob is a worker", () => {
  // Deletes the blob arm's contribution, over the three spellings this tree actually produces.
  for (const url of [
    "/_next/static/chunks/bm06Worker.js",
    "/pdfjs/pdf.worker.min.mjs",
    "/src/experiments/bm07/kitchen/worker.ts",
  ]) {
    assert.ok(!url.toLowerCase().startsWith("blob:"), `the control must not be a blob: ${url}`);
    assert.equal(classifyNetworkRequest(url), "worker", url);
  }
});

test("A MENTION IS NOT A REQUEST: a url that says worker and is not one", () => {
  // The defect, as explicit negatives. Every one of these classified as "worker" under the old
  // predicate, ahead of the .js and .html arms, because the token appears somewhere in the string.
  const notWorkers: readonly (readonly [string, string])[] = [
    ["/foundations/worker-explainer/", "other"],
    ["/papers/brownian-motion/#worker", "other"],
    ["/lab/bm-01/?view=worker", "other"],
    ["/_next/static/chunks/worker-explainer-page.css", "page"],
    ["/runtime-conformance.html?mode=worker", "page"],
    // THE TWO am-worker-predicate-tautology-9jyk NAMES, both recorded there as outputs of the
    // shipped function. The second was fixed when the match moved to the filename; the FIRST
    // survived that repair, because `worker-protocol.js` is a script filename containing the token
    // and a bare substring cannot tell a module that DEFINES the worker protocol, loaded on the
    // main thread, from a worker.
    ["http://127.0.0.1/apps/runtime/worker-protocol.js", "page"],
    ["http://127.0.0.1/docs/workers-guide.html", "page"],
    // The same shape from this repository rather than from the bead: a test file whose name begins
    // with the token and is not a worker.
    ["/chunks/workerLabDraftTapes.js", "page"],
  ];
  for (const [url, expected] of notWorkers) {
    assert.ok(url.toLowerCase().includes("worker"), `the control must contain the token: ${url}`);
    assert.equal(classifyNetworkRequest(url), expected, url);
  }
});

test("the query and fragment are removed before the filename is read", () => {
  // The mechanism behind the group above, asserted directly: a script's classification must not
  // change because a parameter was appended, in either direction.
  assert.equal(classifyNetworkRequest("/chunks/bm06Worker.js?v=2"), "worker");
  assert.equal(classifyNetworkRequest("/chunks/bm06Worker.js#top"), "worker");
  assert.equal(classifyNetworkRequest("/chunks/bundle.js?worker=1"), "page");
  assert.equal(classifyNetworkRequest("/chunks/bundle.js#worker"), "page");
});

/**
 * THE REAL POPULATION, which am-worker-predicate-tautology-9jyk asks for by name: "what URL shapes
 * the conformance fixture app actually issues, taken from a recorded run rather than imagined".
 *
 * Read off the BUILT fixture output, artifacts/e2e-fixtures/runtime/, plus the page the harness
 * serves and the blob the app makes:
 *
 *   bundle.js, bundle.js.map, manifest.json
 *   fs-annus-diffusion/<digest>/fs_annus_diffusion_bg.wasm  (two digests present)
 *   the served html page
 *   blob:<origin>/<uuid>  -- src/testing/runtime-fixtures/app/channel.ts builds the worker with
 *                            `new Blob([RUNTIME_WORKER_SOURCE])` and `URL.createObjectURL`
 *
 * TWO THINGS THIS SETTLES. The fixture's only worker request is a BLOB, so the blob arm is the one
 * that fires in the lane and the filename arm guards traffic this fixture never issues -- worth
 * knowing before anyone tunes the filename rule against it. And `bundle.js` is the app's own code
 * classified as "page": NetworkKind has no "script" member, so a page asset and a page share one
 * name. That is the type's coarseness, not a misreading, and it is asserted here so a future
 * reading of "page" as "an html document" fails rather than quietly misinterprets the count.
 */
test("the fixture app's actual requests, from the built output and the app's own worker", () => {
  const recorded: readonly (readonly [string, string])[] = [
    ["http://127.0.0.1:8080/apps/runtime/", "page"],
    ["http://127.0.0.1:8080/apps/runtime/index.html", "page"],
    ["http://127.0.0.1:8080/apps/runtime/bundle.js", "page"],
    ["http://127.0.0.1:8080/apps/runtime/bundle.js.map", "page"],
    ["http://127.0.0.1:8080/apps/runtime/manifest.json", "page"],
    [
      "http://127.0.0.1:8080/apps/runtime/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm",
      "wasm",
    ],
    [
      "http://127.0.0.1:8080/apps/runtime/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm",
      "wasm",
    ],
    ["blob:http://127.0.0.1:8080/3f9a1c2e-0b44-4a1f-9c7e-1d2b3a4c5d6e", "worker"],
  ];
  for (const [url, expected] of recorded) {
    assert.equal(classifyNetworkRequest(url), expected, url);
  }
  // Non-vacuity on the population itself: it must contain at least one of each kind the gate
  // counts, or a classifier that answered one thing for everything would pass this.
  const kinds = new Set(recorded.map(([url]) => classifyNetworkRequest(url)));
  assert.ok(kinds.has("wasm"), "the recorded population must include a wasm request");
  assert.ok(kinds.has("worker"), "the recorded population must include the blob worker");
  assert.ok(kinds.has("page"), "the recorded population must include a page request");
});

test("wasm still wins over both worker arms, which is the documented precedence", () => {
  // A worker-named wasm module is wasm, and a blob of wasm is wasm. Asserted because the .wasm arm
  // sits above both and a reordering would be invisible otherwise.
  assert.equal(classifyNetworkRequest("/wasm/bm06Worker.wasm"), "wasm");
  assert.equal(classifyNetworkRequest("/apps/runtime/wasm/anything"), "wasm");
});
