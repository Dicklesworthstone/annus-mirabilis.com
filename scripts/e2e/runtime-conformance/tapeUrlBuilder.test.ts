import assert from "node:assert/strict";
import test from "node:test";
import { seedFromTapeUrl, tapeUrlWithSeed } from "./tapeUrlBuilder.ts";

test("tape URL builder keeps seeds above 2^53 exact", () => {
  const over = "9007199254740993";
  const max = "18446744073709551615";
  assert.equal(seedFromTapeUrl(tapeUrlWithSeed("/runtime-conformance.html", over)), over);
  assert.equal(seedFromTapeUrl(tapeUrlWithSeed("/runtime-conformance.html", max)), max);
});

test("the seed goes before a fragment, so a hash route still carries it", () => {
  // THE DEFECT THIS FILE MISSED until the builder was first used. Appending blindly put the query
  // inside the fragment, where neither URL.searchParams nor the page's own location.search can see it,
  // so the seed was silently ignored and the run used the default. The case above passes a
  // fragment-free path and cannot reach it.
  const seed = "18446744073709551615";
  const url = tapeUrlWithSeed("/runtime-conformance.html#/runtime", seed);
  assert.equal(url, `/runtime-conformance.html?seed=${seed}#/runtime`);
  assert.equal(seedFromTapeUrl(url), seed);
});

test("an existing query is joined with &, not a second ?", () => {
  const url = tapeUrlWithSeed("/runtime-conformance.html?blockWorkers=1#/runtime", "7");
  assert.equal(url, "/runtime-conformance.html?blockWorkers=1&seed=7#/runtime");
  assert.equal(seedFromTapeUrl(url), "7");
  assert.equal(new URL(url, "http://127.0.0.1").searchParams.get("blockWorkers"), "1");
});
