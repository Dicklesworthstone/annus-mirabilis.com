import assert from "node:assert/strict";
import test from "node:test";
import { seedFromTapeUrl, tapeUrlWithSeed } from "./tapeUrlBuilder.ts";

test("tape URL builder keeps seeds above 2^53 exact", () => {
  const over = "9007199254740993";
  const max = "18446744073709551615";
  assert.equal(seedFromTapeUrl(tapeUrlWithSeed("/runtime-conformance.html", over)), over);
  assert.equal(seedFromTapeUrl(tapeUrlWithSeed("/runtime-conformance.html", max)), max);
});
