import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hashModuleClosure } from "../src/content/kernel/sourceDigest.ts";
import { generateInferenceWorkbench } from "./generate-inference-workbench.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = await mkdtemp(resolve(tmpdir(), "annus-inference-generation-"));

test("real prepared observations generate deterministically through the real store", async () => {
  const a = await generateInferenceWorkbench(root, "scaffold", scratch);
  const first = await readFile(resolve(scratch, "inference-workbench.json"), "utf8");
  const b = await generateInferenceWorkbench(root, "scaffold", scratch);
  assert.equal(first, await readFile(resolve(scratch, "inference-workbench.json"), "utf8"));
  assert.deepEqual(a, b);
  assert.equal(a.examples.length, 1);
  assert.equal(
    a.sourceDigest,
    hashModuleClosure(root, [
      "src/reasoning/infer/session.ts",
      "scripts/generate-inference-workbench.mjs",
    ]),
  );
  for (const evidence of Object.values(a.examples[0])) {
    const { kind, dt, d, exposure, knownDrift, increments } = evidence;
    assert.equal(
      evidence.observationDigest,
      createHash("sha256")
        .update(JSON.stringify({ kind, dt, d, exposure, knownDrift, increments }))
        .digest("hex"),
    );
  }
});
test("publication profiles exclude the instructional datasets and unknown profiles fail", async () => {
  for (const profile of ["preview", "launch"]) {
    const result = await generateInferenceWorkbench(root, profile, scratch);
    assert.deepEqual(result.examples, []);
  }
  await assert.rejects(() => generateInferenceWorkbench(root, "public-ish", scratch), /Unknown/);
});
