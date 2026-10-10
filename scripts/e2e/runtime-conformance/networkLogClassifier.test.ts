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

test("wasm still wins over both worker arms, which is the documented precedence", () => {
  // A worker-named wasm module is wasm, and a blob of wasm is wasm. Asserted because the .wasm arm
  // sits above both and a reordering would be invisible otherwise.
  assert.equal(classifyNetworkRequest("/wasm/bm06Worker.wasm"), "wasm");
  assert.equal(classifyNetworkRequest("/apps/runtime/wasm/anything"), "wasm");
});
