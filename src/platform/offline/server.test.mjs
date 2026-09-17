import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { offlineDigest } from "./chapter.ts";
import { loadOfflineChapter, loadOfflineManifest, offlineProfile, parseOfflineManifest, publishOfflineChapters } from "./server.ts";
async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "annus-offline-test-"));
  await mkdir(resolve(root, "generated/content"), { recursive: true });
  await writeFile(resolve(root, "generated/content/index.json"), JSON.stringify({ buildDigest: "a".repeat(64) }));
  const html = "<!doctype html><html><body>fixture</body></html>";
  const sha256 = offlineDigest(html);
  const entry = { paper: "brownian-motion", section: "s4", title: "Section 4", sha256,
    contentRevision: "b".repeat(64), bytes: Buffer.byteLength(html), gzipBytes: 50,
    path: `/offline/brownian-motion/s4-${sha256}.html` };
  const manifest = { schemaVersion: 1, buildDigest: "a".repeat(64), profile: "scaffold", chapters: [entry] };
  return { root, html, entry, manifest, file: entry.path.split("/").pop() };
}
test("publishes and verifies the exact current chapter", async () => {
  const f = await fixture();
  await publishOfflineChapters(f.root, f.manifest, [f]);
  assert.deepEqual(await loadOfflineManifest(f.root, "scaffold"), f.manifest);
  assert.equal((await loadOfflineChapter(f.entry.paper, f.file, f.root)).html, f.html);
});
test("publication is repeatable and never overwrites a different content-addressed artifact", async () => {
  const f = await fixture();
  await publishOfflineChapters(f.root, f.manifest, [f]);
  await publishOfflineChapters(f.root, f.manifest, [f]);
  await writeFile(resolve(f.root, "generated/offline", f.entry.paper, f.file), "tampered");
  await assert.rejects(publishOfflineChapters(f.root, f.manifest, [f]), /different bytes/);
});
test("tampered chapter bytes fail integrity checking", async () => {
  const f = await fixture(); await publishOfflineChapters(f.root, f.manifest, [f]);
  await writeFile(resolve(f.root, "generated/offline", f.entry.paper, f.file), f.html.replace("fixture", "changed"));
  await assert.rejects(loadOfflineChapter(f.entry.paper, f.file, f.root), /integrity/);
});
test("old retained artifacts cannot be served after a profile stops publishing them", async () => {
  const f = await fixture(); await publishOfflineChapters(f.root, f.manifest, [f]);
  await publishOfflineChapters(f.root, { ...f.manifest, chapters: [] }, []);
  assert.equal(await loadOfflineChapter(f.entry.paper, f.file, f.root), null);
});
test("stale content and profile mismatch fail rather than exposing a previous build", async () => {
  const f = await fixture(); await publishOfflineChapters(f.root, f.manifest, [f]);
  await assert.rejects(loadOfflineManifest(f.root, "preview"), /stale/);
  await writeFile(resolve(f.root, "generated/content/index.json"), JSON.stringify({ buildDigest: "c".repeat(64) }));
  await assert.rejects(loadOfflineManifest(f.root, "scaffold"), /stale/);
});
test("unknown files and path traversal return not found", async () => {
  const f = await fixture(); await publishOfflineChapters(f.root, f.manifest, [f]);
  for (const [paper, file] of [["..", f.file], [f.entry.paper, "../index.json"], [f.entry.paper, `s5-${"c".repeat(64)}.html`]])
    assert.equal(await loadOfflineChapter(paper, file, f.root), null);
});
test("incomplete publication refuses to replace the current manifest", async () => {
  const f = await fixture(); await publishOfflineChapters(f.root, f.manifest, [f]);
  await assert.rejects(publishOfflineChapters(f.root, f.manifest, []), /Incomplete/);
  assert.deepEqual(await loadOfflineManifest(f.root, "scaffold"), f.manifest);
});
test("malformed descriptors, duplicate section entries and unknown profiles fail", async () => {
  const f = await fixture();
  for (const patch of [{ bytes: -1 }, { path: "/etc/passwd" }, { sha256: "bad" }, { gzipBytes: 0 }])
    assert.throws(() => parseOfflineManifest({ ...f.manifest, chapters: [{ ...f.entry, ...patch }] }));
  assert.throws(() => parseOfflineManifest({ ...f.manifest, chapters: [f.entry, f.entry] }));
  assert.throws(() => offlineProfile("development"));
});
test("an unbuilt offline feature has no download links", async () => {
  const f = await fixture(); assert.equal(await loadOfflineManifest(f.root, "scaffold"), null);
});
