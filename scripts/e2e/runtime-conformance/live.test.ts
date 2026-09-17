import assert from "node:assert/strict";
import test from "node:test";
import { runRuntimeConformance } from "./run.ts";

test("runtime-conformance: live Chromium catalogue with planted negatives", async () => {
  const result = await runRuntimeConformance();
  assert.equal(result.ok, true, `runtime-conformance failed; log ${result.logPath}`);
});
