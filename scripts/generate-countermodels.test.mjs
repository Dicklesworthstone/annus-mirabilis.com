import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { hashKernelSource, hashModuleClosure } from "../src/content/kernel/sourceDigest.ts";
import { createCountermodelSession } from "../src/reasoning/countermodel/session.ts";
import { generateCountermodels } from "./generate-countermodels.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Retained scratch artifacts never race with the actual build's generated modules.
const output = await mkdtemp(resolve(tmpdir(), "annus-countermodel-generator-"));

test("two generations are byte-identical and accepted by the real instance store", async () => {
  const a = await generateCountermodels(root, "scaffold", output);
  const rawA = await readFile(resolve(output, "countermodels.json"), "utf8");
  const b = await generateCountermodels(root, "scaffold", output);
  const rawB = await readFile(resolve(output, "countermodels.json"), "utf8");
  assert.equal(rawA, rawB);
  assert.deepEqual(a, b);
  assert.equal(a.cases.length, 2);
  for (const example of a.cases)
    assert.equal(
      createCountermodelSession("generated", example).getSnapshot().view.accepted.final,
      true,
    );
  assert.equal(
    a.sourceDigest,
    hashModuleClosure(root, [
      "src/reasoning/countermodel/session.ts",
      "scripts/generate-countermodels.mjs",
    ]),
  );
  for (const source of a.sourceCode) {
    assert.equal(source.text, await readFile(resolve(root, source.path), "utf8"));
    assert.equal(source.hash, hashKernelSource(source.text));
  }
});
test("preview and launch cannot publish these explanatory drafts", async () => {
  try {
    for (const profile of ["preview", "launch"]) {
      const result = await generateCountermodels(root, profile, output);
      assert.equal(result.cases.length, 0);
      assert.equal(result.profile, profile);
    }
  } finally {
    await generateCountermodels(root, "scaffold", output);
  }
});
test("unknown publication profiles fail rather than exposing drafts", async () => {
  await assert.rejects(
    () => generateCountermodels(root, "public-ish", output),
    /Unknown countermodel publication profile/,
  );
});
