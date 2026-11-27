import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { chapterFixture, fixtureMath } from "./chapter.test.mjs";
import { packageOfflineChapter } from "./chapter.ts";
import { loadOfflineManifest, parseOfflineManifest, publishOfflineChapters } from "./server.ts";
import { assertOfflineSourceInputs, offlineSourceInputs } from "./sourceInputs.ts";

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "am-offline-source-"));
  await mkdir(resolve(root, "content/source-blocks/brownian-motion"), { recursive: true });
  await mkdir(resolve(root, "content/translation-units/brownian-motion"), { recursive: true });
  await mkdir(resolve(root, "generated/content"), { recursive: true });
  await writeFile(resolve(root, "content/source-blocks/brownian-motion/s4-p1.yaml"), 'id: s4-p1\ntext: German\n');
  await writeFile(resolve(root, "content/translation-units/brownian-motion/s4-p1-s1.yaml"), 'id: s4-p1-s1\ntext: English\n');
  await writeFile(resolve(root, "generated/content/index.json"), JSON.stringify({ buildDigest: "a".repeat(64) }));
  return root;
}

test("source-only edits, new files and aliases change the pinned input even when compiled explanations do not", async () => {
  const root = await fixture();
  const initial = await offlineSourceInputs(root, ["brownian-motion"]);
  assert.deepEqual(await offlineSourceInputs(root, ["brownian-motion"]), initial);
  await writeFile(resolve(root, "content/translation-units/brownian-motion/s4-p1-s1.yaml"), 'id: s4-p1-s1\ntext: Changed English\n');
  const changed = await offlineSourceInputs(root, ["brownian-motion"]);
  assert.notEqual(changed.sha256, initial.sha256);
  await mkdir(resolve(root, "content/aliases"), { recursive: true });
  await writeFile(resolve(root, "content/aliases/brownian-motion.yaml"), 'aliases: []\n');
  assert.notEqual((await offlineSourceInputs(root, ["brownian-motion"])).sha256, changed.sha256);
});

test("changing a result card invalidates a saved chapter even with the same German source", async () => {
  const root = await fixture();
  await mkdir(resolve(root, "content/results"), { recursive: true });
  const file = resolve(root, "content/results/brownian-motion.yaml");
  await writeFile(file, "cards: []");
  const before = await offlineSourceInputs(root, ["brownian-motion"]);
  await writeFile(file, "cards: [{id: bm-diffusion-equation}]");
  const after = await offlineSourceInputs(root, ["brownian-motion"]);
  assert.throws(() => assertOfflineSourceInputs(before, after), { code: "offline-source-stale" });
});

test("a source edit makes the served chapter manifest stale without touching the reading digest (sourceInputs.ts:108)", async () => {
  const root = await fixture();
  const file = packageOfflineChapter(chapterFixture(), fixtureMath);
  const manifest = {
    schemaVersion: 1, buildDigest: "a".repeat(64), profile: "scaffold",
    sourceInputs: await offlineSourceInputs(root, ["brownian-motion"]),
    chapters: [file.entry],
  };
  await publishOfflineChapters(root, manifest, [file]);
  assert.equal((await loadOfflineManifest(root, "scaffold")).chapters.length, 1);
  await writeFile(resolve(root, "content/source-blocks/brownian-motion/s4-p1.yaml"), 'id: s4-p1\ntext: Corrected German\n');
  await assert.rejects(() => loadOfflineManifest(root, "scaffold"), { code: "offline-source-stale" });
});

test("source identity cannot publish under a stricter profile or name a missing translation revision (server.ts:47) (server.ts:86)", async () => {
  const root = await fixture();
  const file = packageOfflineChapter(chapterFixture(), fixtureMath);
  const sourceInputs = await offlineSourceInputs(root, ["brownian-motion"]);
  const manifest = {
    schemaVersion: 1, buildDigest: "a".repeat(64), profile: "scaffold", sourceInputs,
    chapters: [{
      ...file.entry,
      sources: { germanBlocks: 1, englishUnits: 1, revision: "b".repeat(64), translationRevision: "c".repeat(64) },
    }],
  };
  assert.ok(parseOfflineManifest(manifest));
  for (const profile of ["preview", "launch"])
    assert.throws(() => parseOfflineManifest({ ...manifest, profile }), { code: "offline-source-manifest" });
  assert.throws(() => parseOfflineManifest({
    ...manifest,
    chapters: [{ ...manifest.chapters[0], sources: { ...manifest.chapters[0].sources, translationRevision: null } }],
  }), { code: "offline-source-coverage" });
  assert.throws(() => parseOfflineManifest({
    ...manifest, sourceInputs: { ...sourceInputs, papers: ["../private"] },
  }), { code: "offline-source-manifest" });
});

test("a symlink or unsafe paper id cannot import unrelated local files (sourceInputs.ts:26) (sourceInputs.ts:49)", async () => {
  const root = await fixture();
  await assert.rejects(() => offlineSourceInputs(root, ["../private"]), { code: "offline-source-input" });
  await assert.rejects(() => offlineSourceInputs(root, ["brownian-motion", "brownian-motion"]), { code: "offline-source-input" });
  await writeFile(resolve(root, "private.json"), '{"private":"not a source"}');
  await symlink(resolve(root, "private.json"), resolve(root, "content/source-blocks/brownian-motion/linked.json"));
  await assert.rejects(() => offlineSourceInputs(root, ["brownian-motion"]), { code: "offline-source-input" });
});

test("provenance corrections and compiled formula metadata participate in source freshness", async () => {
  const root = await fixture();
  const initial = await offlineSourceInputs(root, ["brownian-motion"]);
  await mkdir(resolve(root, "docs/provenance"), { recursive: true });
  await writeFile(resolve(root, "docs/provenance/ap-17-549.md"), "A corrected source note.");
  const withNote = await offlineSourceInputs(root, ["brownian-motion"]);
  assert.notEqual(withNote.sha256, initial.sha256);
  await mkdir(resolve(root, "src/generated"), { recursive: true });
  // Compiled registries legitimately exceed a single source block's 512 KiB limit.
  await writeFile(resolve(root, "src/generated/printed-displays.json"), JSON.stringify({ data: "x".repeat(600_000) }));
  const withFormula = await offlineSourceInputs(root, ["brownian-motion"]);
  assert.notEqual(withFormula.sha256, withNote.sha256);
  assert.doesNotThrow(() => assertOfflineSourceInputs(withFormula, withFormula));
  assert.throws(() => assertOfflineSourceInputs(withNote, withFormula), { code: "offline-source-stale" });
});

test("a source directory cannot be replaced by a file (sourceInputs.ts:70)", async () => {
  const root = await fixture();
  await mkdir(resolve(root, "docs"), { recursive: true });
  await writeFile(resolve(root, "docs/provenance"), "Not a directory");
  await assert.rejects(() => offlineSourceInputs(root, ["brownian-motion"]), { code: "offline-source-input" });
});

test("one oversized source input refuses (sourceInputs.ts:49)", async () => {
  const root = await fixture();
  await writeFile(resolve(root, "content/source-blocks/brownian-motion/oversized.yaml"), "x".repeat(512 * 1024 + 1));
  await assert.rejects(() => offlineSourceInputs(root, ["brownian-motion"]), { code: "offline-source-input" });
});

test("many individually bounded inputs cannot exceed the complete source budget (sourceInputs.ts:57)", async () => {
  const root = await fixture();
  await Promise.all(Array.from({ length: 33 }, (_, index) =>
    writeFile(resolve(root, "content/source-blocks/brownian-motion/bounded-" + index + ".yaml"), "x".repeat(512 * 1024))));
  await assert.rejects(() => offlineSourceInputs(root, ["brownian-motion"]), { code: "offline-source-input" });
});

test("a filesystem inspection failure cannot become an empty source set (sourceInputs.ts:38)", async () => {
  const root = await fixture();
  await writeFile(resolve(root, "not-a-directory"), "File");
  await assert.rejects(() => offlineSourceInputs(resolve(root, "not-a-directory"), ["brownian-motion"]),
    { code: "offline-source-read" });
});
