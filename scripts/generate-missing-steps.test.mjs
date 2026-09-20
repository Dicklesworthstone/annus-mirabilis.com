import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateMissingSteps } from "./generate-missing-steps.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = await mkdtemp(resolve(tmpdir(), "annus-missing-step-"));
test("actual KaTeX emits both selected subtrees and MathML reproducibly", async () => {
  const first = await generateMissingSteps(root, "scaffold", output);
  const bytes = await readFile(resolve(output, "missing-steps.json"), "utf8");
  const second = await generateMissingSteps(root, "scaffold", output);
  assert.equal(await readFile(resolve(output, "missing-steps.json"), "utf8"), bytes);
  assert.deepEqual(first, second);
  assert.equal(first.lessons.length, 1);
  for (const step of first.lessons[0].steps)
    for (const html of [step.fromHtml, step.toHtml]) {
      assert.ok(html.includes("<math"));
      assert.ok(!html.includes("katex-error"));
      for (const id of step.changed) assert.ok(html.includes(`data-expression-id="${id}"`));
    }
  assert.deepEqual(
    first.lessons[0].cases.map((c) => c.result.meanSquare),
    [2, 4, 0],
  );
});
test("preview and launch do not promote instructional drafts", async () => {
  for (const profile of ["preview", "launch"])
    assert.equal((await generateMissingSteps(root, profile, output)).lessons.length, 0);
});
test("an unknown publication profile fails rather than exposing the draft", async () => {
  await assert.rejects(
    () => generateMissingSteps(root, "unreviewed-public", output),
    /Unknown missing-step publication profile/,
  );
});
