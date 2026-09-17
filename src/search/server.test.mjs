import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageSearchIndex } from "./build.ts";
import { currentSearchShards, readCurrentSearchShard, readSearchManifest } from "./server.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "annus-search-")),
    digest = "c".repeat(64);
  const document = {
    id: "trial",
    type: "instrument",
    paper: "brownian-motion",
    section: "",
    lang: "en",
    title: "Tracer trial",
    text: "Synthetic preview",
    terms: [],
    route: "/lab/bm-01/",
    anchor: "",
    face: "",
    scopeLabel: "Laboratory preview",
  };
  const bundle = packageSearchIndex([document], [], digest, "scaffold");
  await mkdir(join(root, "generated/search"), { recursive: true });
  await mkdir(join(root, "generated/content"), { recursive: true });
  await writeFile(
    join(root, "generated/content/index.json"),
    JSON.stringify({ buildDigest: digest }),
  );
  await writeFile(join(root, "generated/search/index-manifest.json"), bundle.manifestText);
  for (const file of bundle.files)
    await writeFile(join(root, "generated/search", file.descriptor.path.slice(8)), file.text);
  return { root, bundle, name: bundle.files[0].descriptor.path.slice(8) };
}
test("static shard enumeration is exactly the current manifest, and reads verified bytes", async () => {
  const f = await fixture();
  assert.deepEqual(await currentSearchShards(f.root), [{ shard: f.name }]);
  assert.equal(await readCurrentSearchShard(f.name, f.root), f.bundle.files[0].text);
});
test("retained old shards never become public merely because files still exist", async () => {
  const f = await fixture(),
    old = `s-${"d".repeat(64)}.json`;
  await writeFile(join(f.root, "generated/search", old), "unpublished draft");
  assert.equal(await readCurrentSearchShard(old, f.root), null);
  assert.deepEqual(await currentSearchShards(f.root), [{ shard: f.name }]);
});
test("changing publication profiles excludes earlier draft shards without deleting them", async () => {
  const f = await fixture();
  const empty = packageSearchIndex([], [], f.bundle.manifest.buildDigest, "preview");
  await writeFile(join(f.root, "generated/search/index-manifest.json"), empty.manifestText);
  assert.equal((await readSearchManifest(f.root, "preview")).manifest.totalDocuments, 0);
  await assert.rejects(readSearchManifest(f.root, "scaffold"), /stale/u);
  assert.ok(!empty.manifest.shards.some((s) => s.path.endsWith(f.name)));
});
test("a stale content build or modified shard refuses serving", async () => {
  const f = await fixture();
  await writeFile(join(f.root, "generated/search", f.name), "{}");
  await assert.rejects(readCurrentSearchShard(f.name, f.root), /match/u);
  await writeFile(
    join(f.root, "generated/content/index.json"),
    JSON.stringify({ buildDigest: "e".repeat(64) }),
  );
  await assert.rejects(readSearchManifest(f.root), /stale/u);
});
test("untrusted dynamic route names cannot traverse generated directories", async () => {
  const f = await fixture();
  for (const name of [
    "../content/index.json",
    "%2e%2e/secret",
    "index-manifest.json",
    "s-abc.json",
    "/etc/passwd",
  ]) {
    assert.equal(await readCurrentSearchShard(name, f.root), null);
  }
});
