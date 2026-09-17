import assert from "node:assert/strict";
import test from "node:test";
import { packageSearchIndex } from "./build.ts";
import { SEARCH_LIMITS } from "./core.ts";
import { createSearchLoader, readSearchResponse } from "./loadIndex.ts";
import { parseSearchShard, validateSearchManifest } from "./protocol.ts";

const documents = [
  {
    id: "a",
    type: "argument",
    paper: "brownian-motion",
    title: "RMS displacement",
    text: "The particles wander",
    terms: ["λ_x"],
    route: "/papers/brownian-motion/",
    anchor: "arg-bm-observable",
    face: "reading",
    section: "s5",
    lang: "en",
    scopeLabel: "Authored preview",
  },
  {
    id: "b",
    type: "instrument",
    paper: "special-relativity",
    title: "Clock synchronization",
    text: "Compare distant clocks",
    terms: ["sr-01"],
    route: "/lab/sr-01/",
    anchor: "",
    face: "",
    section: "",
    lang: "en",
    scopeLabel: "Laboratory preview",
  },
];
const bundle = () =>
  packageSearchIndex(
    documents,
    [{ phrase: "clocks disagree", target: "b", label: "search aid" }],
    "b".repeat(64),
    "scaffold",
  );
function network() {
  const pack = bundle(),
    calls = [];
  const files = new Map([
    ["/search/index-manifest.json", pack.manifestText],
    ...pack.files.map((f) => [f.descriptor.path, f.text]),
  ]);
  let online = true;
  const fetcher = async (path, options) => {
    calls.push({ path, options });
    if (!online) throw new Error("Offline");
    return files.has(path)
      ? new Response(files.get(path))
      : new Response("Not found", { status: 404 });
  };
  return {
    pack,
    calls,
    files,
    fetcher,
    offline() {
      online = false;
    },
  };
}

test("loader construction fetches nothing; loading is deduplicated and local queries work offline", async () => {
  const n = network(),
    loader = createSearchLoader(n.fetcher);
  assert.equal(n.calls.length, 0);
  const [one, two] = await Promise.all([loader.load(), loader.load()]);
  assert.equal(one, two);
  assert.equal(n.calls.length, 1 + n.pack.files.length);
  n.offline();
  const sentinel = "my-private-search-sentinel";
  assert.deepEqual(one.engine.search(sentinel), []);
  assert.equal(one.engine.search("clocks disagree")[0].document.id, "b");
  assert.equal((await loader.load()).engine.search("λₓ")[0].document.id, "a");
  assert.equal(n.calls.length, 1 + n.pack.files.length);
  assert.ok(n.calls.every(({ path }) => !path.includes(sentinel) && !path.includes("?")));
  assert.ok(
    n.calls.every(({ options }) => options.credentials === "omit" && options.redirect === "error"),
  );
  assert.equal(n.calls[0].options.cache, "no-cache");
});
test("failed partial downloads never become an offline cache and can be retried", async () => {
  const n = network(),
    loader = createSearchLoader(n.fetcher),
    broken = n.pack.files[1];
  n.files.set(broken.descriptor.path, broken.text.replace("synchronization", "synchronizatioX"));
  await assert.rejects(loader.load(), /match/u);
  n.files.set(broken.descriptor.path, broken.text);
  const result = await loader.load();
  assert.equal(result.engine.size, 2);
  assert.equal(n.calls.filter((c) => c.path === "/search/index-manifest.json").length, 2);
});
test("corrupt shard triggers cache-busting reload and retries with cache: reload, while healthy shards use force-cache (am-uzr9)", async () => {
  const n = network(),
    loader = createSearchLoader(n.fetcher),
    broken = n.pack.files[1];

  // Healthy initial fetch uses force-cache
  const healthyCalls = [];
  const healthyFetcher = async (path, options) => {
    healthyCalls.push({ path, options });
    return n.fetcher(path, options);
  };
  const healthyLoader = createSearchLoader(healthyFetcher);
  await healthyLoader.load();
  const healthyShardCalls = healthyCalls.filter((c) => c.path.startsWith("/search/s-"));
  assert.ok(healthyShardCalls.length > 0);
  assert.ok(
    healthyShardCalls.every((c) => c.options.cache === "force-cache"),
    "Healthy shards must use force-cache, never blanket no-store or reload",
  );

  // Corrupt shard scenario
  n.files.set(broken.descriptor.path, "invalid");
  await assert.rejects(loader.load(), /match/u);

  // Verify that upon detecting corrupt bytes under force-cache, an inline reload was attempted
  const corruptCalls = n.calls.filter((c) => c.path === broken.descriptor.path);
  assert.ok(
    corruptCalls.some((c) => c.options.cache === "reload"),
    "Corrupt shard must attempt reload to bypass/bust poisoned cache",
  );

  // Server fixes the corrupt file
  n.files.set(broken.descriptor.path, broken.text);

  // Retry after failure uses cache: reload
  const retryResult = await loader.load();
  assert.equal(retryResult.engine.size, 2);
  const retryShardCalls = n.calls
    .slice(n.calls.findLastIndex((c) => c.path === "/search/index-manifest.json"))
    .filter((c) => c.path.startsWith("/search/s-"));
  assert.ok(
    retryShardCalls.some((c) => c.options.cache === "reload"),
    "Retry after failure must request with reload to bust poisoned cache entries",
  );
});
test("truncated and oversized shards are refused before parsing", async () => {
  for (const change of [(s) => s.slice(1), (s) => `${s} `]) {
    const n = network(),
      shard = n.pack.files[0];
    n.files.set(shard.descriptor.path, change(shard.text));
    await assert.rejects(createSearchLoader(n.fetcher).load());
  }
});
test("a missing shard is an error, not an empty search result", async () => {
  const n = network();
  n.files.delete(n.pack.files[0].descriptor.path);
  await assert.rejects(createSearchLoader(n.fetcher).load(), /unavailable/u);
});
test("external paths and path traversal are rejected before any shard request", async () => {
  for (const path of [
    "https://evil.test/search.json",
    "//evil.test/search.json",
    "/search/../secret",
    "/search/%2e%2e/secret",
  ]) {
    const n = network(),
      manifest = JSON.parse(n.pack.manifestText);
    manifest.shards[0].path = path;
    n.files.set("/search/index-manifest.json", JSON.stringify(manifest));
    await assert.rejects(createSearchLoader(n.fetcher).load(), /same-origin/u);
    assert.equal(n.calls.length, 1);
  }
});
test("invalid manifests reject versions, profiles, duplicate shards and inconsistent totals", () => {
  for (const patch of [
    { schemaVersion: 2 },
    { buildDigest: "bad" },
    { profile: "preveiw" },
    { totalDocuments: NaN },
    { totalDocuments: 3 },
    { totalDocuments: SEARCH_LIMITS.documents + 1 },
  ]) {
    assert.throws(() => validateSearchManifest({ ...bundle().manifest, ...patch }));
  }
  const m = bundle().manifest;
  assert.throws(() => validateSearchManifest({ ...m, shards: [m.shards[0], m.shards[0]] }));
});
test("manifest size budgets include each shard and the complete transfer", () => {
  const m = structuredClone(bundle().manifest);
  m.shards[0].bytes = SEARCH_LIMITS.shardBytes + 1;
  assert.throws(() => validateSearchManifest(m));
  const many = Array.from({ length: 9 }, (_, i) => {
    const sha = String(i).repeat(64);
    return {
      path: `/search/s-${sha}.json`,
      sha256: sha,
      bytes: SEARCH_LIMITS.shardBytes,
      gzipBytes: 100,
      documents: 1,
    };
  });
  assert.throws(() =>
    validateSearchManifest({ ...bundle().manifest, totalDocuments: 9, shards: many }),
  );
});
test("stream reading is bounded even without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(10));
      controller.enqueue(new Uint8Array(10));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(readSearchResponse(new Response(stream), 15), /budget/u);
  assert.equal(cancelled, true);
});
test("redirected responses and malformed UTF-8 or JSON do not get accepted", async () => {
  const redirected = new Response("{}");
  Object.defineProperty(redirected, "redirected", { value: true });
  await assert.rejects(readSearchResponse(redirected, 10), /redirected/u);
  for (const content of ["not json", new Uint8Array([255, 254])]) {
    await assert.rejects(createSearchLoader(async () => new Response(content)).load());
  }
});
test("shard document counts, versions, aliases and unsafe document links are validated", () => {
  const data = JSON.parse(bundle().files[0].text);
  assert.throws(() => parseSearchShard(data, 99));
  assert.throws(() => parseSearchShard({ ...data, schemaVersion: 2 }, 1));
  assert.throws(() =>
    parseSearchShard(
      { ...data, aliases: [{ phrase: "bad", target: "missing", label: "search aid" }] },
      1,
    ),
  );
  data.documents[0].route = "javascript:alert(1)";
  assert.throws(() => parseSearchShard(data, 1));
});
