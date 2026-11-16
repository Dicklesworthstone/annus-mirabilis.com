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

/** Model the browser's separate network and HTTP cache, including offline revalidation failure. */
function cachedNetwork() {
  const n = network();
  const cache = new Map();
  let online = true;
  const calls = [];
  return {
    ...n,
    calls,
    cache,
    offline() {
      online = false;
    },
    async fetcher(path, options) {
      calls.push({ path, options });
      if (options.cache === "only-if-cached") {
        assert.equal(options.mode, "same-origin");
        return cache.has(path)
          ? new Response(cache.get(path))
          : new Response("Not cached", { status: 504 });
      }
      if (options.cache === "force-cache" && cache.has(path))
        return new Response(cache.get(path));
      if (!online) throw new TypeError("Network unavailable");
      if (!n.files.has(path)) return new Response("Not found", { status: 404 });
      const text = n.files.get(path);
      cache.set(path, text);
      return new Response(text);
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
test("a new page can search the complete cached edition after going offline", async () => {
  const n = cachedNetwork();
  const online = await createSearchLoader(n.fetcher).load();
  const beforeReload = n.calls.length;
  n.offline();
  // A fresh loader is essential: reusing the old loader would only prove its memory cache.
  const offline = await createSearchLoader(n.fetcher).load();
  assert.notEqual(offline, online);
  assert.equal(offline.buildDigest, online.buildDigest);
  assert.equal(offline.engine.size, documents.length);
  assert.equal(offline.engine.search("clocks disagree")[0].document.id, "b");
  assert.equal(offline.engine.search("λₓ")[0].document.id, "a");
  const requests = n.calls.slice(beforeReload);
  assert.equal(requests[0].options.cache, "no-cache");
  assert.ok(requests.slice(1).every(({ options }) => options.cache === "only-if-cached"));
  assert.ok(requests.every(({ options }) => options.credentials === "omit"));
});
test("offline reload refuses incomplete or corrupt cached editions, without partial results", async () => {
  for (const damage of [
    (n) => n.cache.clear(),
    (n) => n.cache.delete(n.pack.files[0].descriptor.path),
    (n) => n.cache.set(n.pack.files[0].descriptor.path, "invalid"),
    (n) => n.cache.set("/search/index-manifest.json", "invalid"),
  ]) {
    const n = cachedNetwork();
    await createSearchLoader(n.fetcher).load();
    damage(n);
    n.offline();
    await assert.rejects(createSearchLoader(n.fetcher).load());
  }
});
test("online reload prefers the current edition over a valid cached manifest", async () => {
  const n = cachedNetwork();
  const earlier = await createSearchLoader(n.fetcher).load();
  const next = packageSearchIndex(
    [...documents, { ...documents[0], id: "new-passage", title: "Newly published passage" }],
    [],
    "c".repeat(64),
    "scaffold",
  );
  n.files.set("/search/index-manifest.json", next.manifestText);
  for (const file of next.files) n.files.set(file.descriptor.path, file.text);
  const current = await createSearchLoader(n.fetcher).load();
  assert.notEqual(current.buildDigest, earlier.buildDigest);
  assert.equal(current.engine.search("Newly published passage")[0].document.id, "new-passage");
  assert.ok(n.calls.every(({ options }) => options.cache !== "only-if-cached"));
});
test("a network response containing an invalid manifest never falls back to the older edition", async () => {
  const n = cachedNetwork();
  await createSearchLoader(n.fetcher).load();
  n.files.set("/search/index-manifest.json", "not json");
  await assert.rejects(createSearchLoader(n.fetcher).load());
  assert.ok(n.calls.every(({ options }) => options.cache !== "only-if-cached"));
});
test("oversized and unavailable cached shards are replaced once with verified network bytes", async () => {
  const n = cachedNetwork();
  await createSearchLoader(n.fetcher).load();
  const shard = n.pack.files[0];
  n.cache.set(shard.descriptor.path, `${shard.text} oversized cache entry`);
  const before = n.calls.length;
  const loaded = await createSearchLoader(n.fetcher).load();
  assert.equal(loaded.engine.size, documents.length);
  assert.deepEqual(
    n.calls
      .slice(before)
      .filter(({ path }) => path === shard.descriptor.path)
      .map(({ options }) => options.cache),
    ["force-cache", "reload"],
  );
  assert.equal(n.cache.get(shard.descriptor.path), shard.text);

  const calls = [];
  const fetcher = async (path, options) => {
    calls.push({ path, options });
    if (path === shard.descriptor.path && options.cache === "force-cache")
      return new Response("Cached error", { status: 503 });
    return n.fetcher(path, options);
  };
  assert.equal((await createSearchLoader(fetcher).load()).engine.size, documents.length);
  assert.ok(
    calls.some(
      ({ path, options }) => path === shard.descriptor.path && options.cache === "reload",
    ),
  );
});
test("aborted manifest requests are never retried through the offline cache", async () => {
  const calls = [];
  const loader = createSearchLoader(async (path, options) => {
    calls.push({ path, options });
    throw new DOMException("Cancelled", "AbortError");
  });
  await assert.rejects(loader.load(), { name: "AbortError" });
  assert.equal(calls.length, 1);
});
test("the download deadline cancels the request without an offline retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  const loader = createSearchLoader(
    (path, options) =>
      new Promise((_resolve, reject) => {
        calls.push({ path, options });
        options.signal.addEventListener("abort", () => reject(options.signal.reason), {
          once: true,
        });
      }),
  );
  const pending = loader.load();
  t.mock.timers.tick(30000);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, true);
});
test("shards download concurrently within a fixed bound and retain every document", async () => {
  const records = Array.from({ length: 12 }, (_, i) => ({
    ...documents[0],
    id: `passage-${i}`,
    paper: `collection-${i}`,
    title: `Passage ${i}`,
  }));
  const pack = packageSearchIndex(records, [], "d".repeat(64), "scaffold");
  const files = new Map(pack.files.map((file) => [file.descriptor.path, file.text]));
  let active = 0;
  let maximum = 0;
  let completed = 0;
  const loader = createSearchLoader(async (path) => {
    if (path === "/search/index-manifest.json") return new Response(pack.manifestText);
    active++;
    maximum = Math.max(maximum, active);
    // Vary completion order without asserting elapsed time. Serial loading reaches one active
    // request; an unbounded Promise.all starts every request before any timer can resolve.
    await new Promise((resolve) => setTimeout(resolve, 1 + ((files.size - completed) % 3)));
    active--;
    completed++;
    return new Response(files.get(path));
  });
  const result = await loader.load();
  assert.ok(maximum > 1, "Independent shards must overlap in flight");
  assert.ok(maximum <= 4, `At most four shard downloads may run together, observed ${maximum}`);
  assert.equal(completed, pack.files.length);
  assert.equal(result.engine.size, records.length);
  for (const record of records)
    assert.ok(result.engine.search(record.title).some((hit) => hit.document.id === record.id));
});
test("one invalid network shard cancels its in-flight siblings and a later load can retry", async () => {
  const n = network();
  const broken = n.pack.files[0];
  let fail = true;
  let cancelled = 0;
  const loader = createSearchLoader(async (path, options) => {
    if (!fail || path === "/search/index-manifest.json") return n.fetcher(path, options);
    if (path === broken.descriptor.path) return new Response("invalid");
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => {
          cancelled++;
          reject(options.signal.reason);
        },
        { once: true },
      );
    });
  });
  await assert.rejects(loader.load(), /match/u);
  assert.ok(cancelled > 0, "Failure must cancel an actually in-flight sibling");
  fail = false;
  assert.equal((await loader.load()).engine.size, documents.length);
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
