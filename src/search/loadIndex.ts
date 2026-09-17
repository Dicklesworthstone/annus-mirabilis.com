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

/** No query parameter, telemetry, disk storage or partial-result cache exists on this path. */
export function createSearchLoader(fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {
  let pending: Promise<LoadedSearch> | null = null;
  let loaded: LoadedSearch | null = null;
  async function fetchAll(): Promise<LoadedSearch> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetcher("/search/index-manifest.json", {
        cache: "no-cache",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      const manifest = validateSearchManifest(
        json(await readSearchResponse(response, SEARCH_LIMITS.manifestBytes)),
      );
      const documents: SearchDocument[] = [],
        aliases: SearchAlias[] = [];
      for (const descriptor of manifest.shards) {
        const response = await fetcher(descriptor.path, {
          cache: "force-cache",
          credentials: "omit",
          redirect: "error",
          signal: controller.signal,
        });
        const bytes = await readSearchResponse(response, descriptor.bytes);
        if (
          bytes.byteLength !== descriptor.bytes ||
          (await searchBytesDigest(bytes)) !== descriptor.sha256
        )
          throw new Error("Search shard bytes do not match the current manifest.");
        const shard = parseSearchShard(json(bytes), descriptor.documents);
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
    }
  }
  return Object.freeze({
    load(): Promise<LoadedSearch> {
      if (loaded) return Promise.resolve(loaded);
      if (!pending) {
        pending = fetchAll().then((result) => {
          loaded = result;
          return result;
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
