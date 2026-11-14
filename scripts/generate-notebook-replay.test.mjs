import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadPaperPayload } from "../src/content/compiler/serverLoaders.ts";
import { LQ08_MODEL } from "../src/experiments/lq08/definition.ts";
import { ME03_MODEL } from "../src/experiments/me03/definition.ts";
import { fixedSr03ComparisonParameters } from "../src/experiments/sr03/comparison.ts";
import { generateNotebookReplay } from "./generate-notebook-replay.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Scratch retained outside the source tree; no deletion or mutation of real build outputs.
const output = await mkdtemp(resolve(tmpdir(), "annus-replay-catalogue-"));
test("replay catalogue hashes actual compiled arguments, retains aliases and generates deterministically", async () => {
  const a = await generateNotebookReplay(root, output),
    first = await readFile(resolve(output, "notebook-replay.json"), "utf8");
  const observerFirst = await readFile(resolve(output, "sr03-notebook-replay.json"), "utf8");
  const b = await generateNotebookReplay(root, output);
  assert.deepEqual(a, b);
  assert.equal(await readFile(resolve(output, "notebook-replay.json"), "utf8"), first);
  assert.equal(await readFile(resolve(output, "sr03-notebook-replay.json"), "utf8"), observerFirst);
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
  const observer = JSON.parse(observerFirst);
  const relativity = await loadPaperPayload("special-relativity", root);
  for (const argument of relativity.arguments)
    assert.equal(
      observer.passages[argument.id].contentRevision,
      createHash("sha256").update(JSON.stringify(argument)).digest("hex"),
    );
  assert.ok(observer.passages["arg-sr-rod-events"]);
  assert.equal(observer.passages["arg-bm-observable"], undefined);
  assert.equal(a.passages["arg-sr-rod-events"], undefined);
  assert.deepEqual(
    fixedSr03ComparisonParameters(observer.example.parameters),
    observer.example.parameters,
  );
  const sr03 = JSON.parse(await readFile(resolve(root, "src/generated/sr03-example.json"), "utf8"));
  assert.equal(observer.identity.sourceDigest, sr03.sourceDigest);
  assert.equal(observer.example.sourceDigest, sr03.sourceDigest);
  assert.equal(observer.identity.streamVersion, "deterministic");
  assert.ok(!observerFirst.includes("explanationBefore"));
});

test("fresh preparation produces all owner examples before generating notebook catalogues", async () => {
  const config = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const commands = config.scripts["prepare:lab"].split(/\s*&&\s*/u);
  const notebook = commands.indexOf("bun scripts/generate-notebook-replay.mjs");
  assert.ok(notebook >= 0);
  for (const required of [
    "generate-brownian-comparison.mjs",
    "generate-sr03.mjs",
    "generate-photoelectric.mjs",
    "generate-lab-digests.mjs",
  ]) {
    const position = commands.indexOf(`bun scripts/${required}`);
    assert.ok(position >= 0 && position < notebook, `${required} must precede notebook replay`);
  }
});

test("photoelectric replay uses its real evaluator digest and only the light-quanta paper", async () => {
  await generateNotebookReplay(root, output);
  const first = await readFile(resolve(output, "lq08-notebook-replay.json"), "utf8");
  await generateNotebookReplay(root, output);
  assert.equal(await readFile(resolve(output, "lq08-notebook-replay.json"), "utf8"), first);
  const catalogue = JSON.parse(first);
  const paper = await loadPaperPayload("light-quanta", root);
  assert.equal(Object.keys(catalogue.passages).length, paper.arguments.length);
  for (const argument of paper.arguments)
    assert.equal(
      catalogue.passages[argument.id].contentRevision,
      createHash("sha256").update(JSON.stringify(argument)).digest("hex"),
    );
  assert.ok(catalogue.passages["arg-lq-photoelectric-energy"]);
  assert.equal(catalogue.passages["arg-lq-photoelectric-energy"].translationRevision, null);
  assert.equal(catalogue.passages["arg-bm-observable"], undefined);
  assert.equal(catalogue.passages["arg-sr-rod-events"], undefined);
  const example = JSON.parse(
    await readFile(resolve(root, "src/generated/lq08-example.json"), "utf8"),
  );
  assert.equal(catalogue.identity.sourceDigest, example.sourceDigest);
  assert.equal(catalogue.identity.modelVersion, LQ08_MODEL.id);
  assert.equal(catalogue.identity.constantSetId, LQ08_MODEL.constantSetId);
  assert.equal(catalogue.identity.streamVersion, "deterministic");
  assert.equal(catalogue.identity.allocationId, "deterministic");
  assert.equal(catalogue.identity.artifactDigest, null);
  assert.equal(catalogue.identity.executionLabel, "host-calculation");
  assert.equal(catalogue.example, undefined);
  assert.ok(!first.includes("explanationBefore"));
});

test("boundary replay uses the laboratory's source digest and only the mass–energy paper", async () => {
  await generateNotebookReplay(root, output);
  const first = await readFile(resolve(output, "me03-notebook-replay.json"), "utf8");
  await generateNotebookReplay(root, output);
  assert.equal(await readFile(resolve(output, "me03-notebook-replay.json"), "utf8"), first);
  const catalogue = JSON.parse(first);
  const paper = await loadPaperPayload("mass-energy", root);
  assert.equal(Object.keys(catalogue.passages).length, paper.arguments.length);
  for (const argument of paper.arguments)
    assert.equal(
      catalogue.passages[argument.id].contentRevision,
      createHash("sha256").update(JSON.stringify(argument)).digest("hex"),
    );
  assert.ok(catalogue.passages["arg-me-small-speed"]);
  assert.equal(catalogue.passages["arg-me-small-speed"].translationRevision, null);
  assert.equal(catalogue.passages["arg-bm-observable"], undefined);
  assert.equal(catalogue.passages["arg-lq-photoelectric-energy"], undefined);
  assert.equal(catalogue.passages["arg-sr-rod-events"], undefined);
  const digests = JSON.parse(
    await readFile(resolve(root, "src/generated/lab-source-digests.json"), "utf8"),
  );
  assert.equal(catalogue.identity.sourceDigest, digests["me-03"]);
  assert.equal(catalogue.identity.modelVersion, ME03_MODEL.id);
  assert.equal(catalogue.identity.constantSetId, ME03_MODEL.constantSetId);
  assert.equal(catalogue.identity.streamVersion, "deterministic");
  assert.equal(catalogue.identity.allocationId, "deterministic");
  assert.equal(catalogue.identity.artifactDigest, null);
  assert.equal(catalogue.identity.executionLabel, "host-calculation");
  assert.equal(catalogue.example, undefined);
  assert.ok(!first.includes("explanationBefore"));
});
