import {
  createSearchEngine,
  SEARCH_LIMITS,
  type SearchAlias,
  type SearchDocument,
} from "./core.ts";
import { parseSearchShard, validateSearchManifest } from "./protocol.ts";

/** Bound decoded response bytes even when Content-Length is missing or compressed. */
export async function readSearchResponse(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok || response.redirected || !response.body)
    throw new Error("Search index response was unavailable or redirected.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) throw new RangeError("Search response exceeded its byte budget.");
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
function json(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function searchBytesDigest(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export type LoadedSearch = Readonly<{
  engine: ReturnType<typeof createSearchEngine>;
  buildDigest: string;
  profile: "scaffold" | "preview" | "launch";
  papers: readonly string[];
}>;

const SHARD_DOWNLOAD_CONCURRENCY = 4;

/** No query parameter, telemetry or application storage exists on this path. */
export function createSearchLoader(fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {
  let pending: Promise<LoadedSearch> | null = null;
  let loaded: LoadedSearch | null = null;
  let hasFailed = false;
  async function fetchAll(forceReload = false): Promise<LoadedSearch> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const isAborted = (error: unknown) =>
      controller.signal.aborted ||
      (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"));
    const request = (path: string, cache: RequestCache) =>
      fetcher(path, {
        cache,
        mode: "same-origin",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
    try {
      let response: Response;
      let cachedOnly = false;
      try {
        response = await request("/search/index-manifest.json", "no-cache");
      } catch (error) {
        if (isAborted(error)) throw error;
        // A new page has no in-memory index. Reuse the HTTP cache when revalidation cannot reach
        // the network, but never conceal a server error, invalid manifest, timeout or cancellation.
        // Every shard is still checked against this manifest before any result is published.
        response = await request("/search/index-manifest.json", "only-if-cached");
        cachedOnly = true;
      }
      controller.signal.throwIfAborted();
      const manifest = validateSearchManifest(
        json(await readSearchResponse(response, SEARCH_LIMITS.manifestBytes)),
      );
      const shards: ReturnType<typeof parseSearchShard>[] = new Array(manifest.shards.length);
      let nextShard = 0;
      async function downloadShards() {
        while (nextShard < manifest.shards.length) {
          controller.signal.throwIfAborted();
          const index = nextShard++;
          const descriptor = manifest.shards[index]!;
          async function verifiedBytes(cache: RequestCache) {
            const shardResponse = await request(descriptor.path, cache);
            const bytes = await readSearchResponse(shardResponse, descriptor.bytes);
            if (
              bytes.byteLength !== descriptor.bytes ||
              (await searchBytesDigest(bytes)) !== descriptor.sha256
            )
              throw new Error("Search shard bytes do not match the current manifest.");
            controller.signal.throwIfAborted();
            return bytes;
          }
          try {
            let bytes: Uint8Array;
            try {
              bytes = await verifiedBytes(
                cachedOnly ? "only-if-cached" : forceReload ? "reload" : "force-cache",
              );
            } catch (error) {
              if (cachedOnly || forceReload || isAborted(error)) throw error;
              // Retry corrupt, truncated, oversized or unavailable cached responses once. The
              // same byte bound applies while reading the replacement, before parsing it.
              bytes = await verifiedBytes("reload");
            }
            shards[index] = parseSearchShard(json(bytes), descriptor.documents);
          } catch (error) {
            // A failed index is not a partial result. Stop the other bounded download workers,
            // including their response streams, rather than leaving them running after refusal.
            // Preserve the first failure as the abort reason, regardless of completion order.
            controller.abort(error);
            throw error;
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(SHARD_DOWNLOAD_CONCURRENCY, manifest.shards.length) },
          downloadShards,
        ),
      );
      const documents: SearchDocument[] = [],
        aliases: SearchAlias[] = [];
      // Completion order cannot change result tie-breaking or the edition's document order.
      for (const shard of shards) {
        documents.push(...shard.documents);
        aliases.push(...shard.aliases);
      }
      if (documents.length !== manifest.totalDocuments) throw new Error("Incomplete search index.");
      return Object.freeze({
        engine: createSearchEngine(documents, aliases),
        buildDigest: manifest.buildDigest,
        profile: manifest.profile,
        papers: Object.freeze([...new Set(documents.map((doc) => doc.paper))].sort()),
      });
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
  return Object.freeze({
    load(): Promise<LoadedSearch> {
      if (loaded) return Promise.resolve(loaded);
      if (!pending) {
        const isRetry = hasFailed;
        pending = fetchAll(isRetry)
          .then((result) => {
            loaded = result;
            hasFailed = false;
            return result;
          })
          .catch((error) => {
            hasFailed = true;
            throw error;
          });
        // Clear both success and failure in-flight state; failures remain retryable.
        void pending.then(
          () => {
            pending = null;
          },
          () => {
            pending = null;
          },
        );
      }
      return pending;
    },
  });
}
// Construction performs no fetch. The first palette opening calls load().
export const searchIndexLoader = createSearchLoader();
