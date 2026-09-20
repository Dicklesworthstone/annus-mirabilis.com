import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { generateNotebookReplay } from "./generate-notebook-replay.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Scratch retained outside the source tree; no deletion or mutation of real build outputs.
const output = await mkdtemp(resolve(tmpdir(), "annus-replay-catalogue-"));
test("replay catalogue hashes actual compiled arguments, retains aliases and generates deterministically", async () => {
  const a = await generateNotebookReplay(root, output),
    first = await readFile(resolve(output, "notebook-replay.json"), "utf8");
  const b = await generateNotebookReplay(root, output);
  assert.deepEqual(a, b);
  assert.equal(await readFile(resolve(output, "notebook-replay.json"), "utf8"), first);
  const paper = await loadPaperPayload("brownian-motion", root);
  for (const argument of paper.arguments)
    assert.equal(
      a.passages[argument.id].contentRevision,
      createHash("sha256").update(JSON.stringify(argument)).digest("hex"),
    );
  assert.equal(a.passages["arg-bm-observable"].translationRevision, null);
  const prepared = JSON.parse(
    await readFile(resolve(root, "src/generated/bm01-example.json"), "utf8"),
  );
  assert.equal(a.identity.sourceDigest, prepared.sourceDigest);
  assert.ok(!first.includes("explanationBefore"));
  assert.ok(!first.includes("Private note"));
});
