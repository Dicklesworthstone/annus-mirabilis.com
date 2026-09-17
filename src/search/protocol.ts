/** Validated wire format shared by static serving and the lazy browser loader. */
import type { SearchManifest, SearchShardDescriptor } from "./build.ts";
import { SEARCH_LIMITS, SEARCH_VERSION, validateAliases, validateSearchDocument } from "./core.ts";

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Malformed search index record.");
  return input as Record<string, unknown>;
}
function integer(value: unknown, max: number, minimum = 0): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > max)
    throw new RangeError("Search index count or byte budget is invalid.");
}
export function validateSearchManifest(input: unknown): SearchManifest {
  const data = record(input);
  if (
    data.schemaVersion !== SEARCH_VERSION ||
    typeof data.buildDigest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(data.buildDigest) ||
    !["scaffold", "preview", "launch"].includes(String(data.profile)) ||
    !Array.isArray(data.shards) ||
    data.shards.length > SEARCH_LIMITS.shards
  )
    throw new TypeError("Unsupported search index manifest.");
  integer(data.totalDocuments, SEARCH_LIMITS.documents);
  const paths = new Set<string>();
  const shards = data.shards.map((input): SearchShardDescriptor => {
    const shard = record(input);
    if (
      typeof shard.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(shard.sha256) ||
      shard.path !== `/search/s-${shard.sha256}.json` ||
      paths.has(shard.path)
    )
      throw new TypeError("Search shard must have a unique same-origin content-addressed path.");
    integer(shard.bytes, SEARCH_LIMITS.shardBytes, 1);
    integer(shard.gzipBytes, SEARCH_LIMITS.gzipShardBytes, 1);
    integer(shard.documents, SEARCH_LIMITS.documents);
    paths.add(shard.path);
    return Object.freeze({
      path: shard.path,
      sha256: shard.sha256,
      bytes: shard.bytes,
      gzipBytes: shard.gzipBytes,
      documents: shard.documents,
    });
  });
  if (
    shards.reduce((sum, shard) => sum + shard.documents, 0) !== data.totalDocuments ||
    shards.reduce((sum, shard) => sum + shard.bytes, 0) > SEARCH_LIMITS.totalBytes
  )
    throw new RangeError("Search index totals do not match its bounded manifest.");
  return Object.freeze({
    schemaVersion: SEARCH_VERSION,
    buildDigest: data.buildDigest,
    profile: data.profile as SearchManifest["profile"],
    totalDocuments: data.totalDocuments,
    shards: Object.freeze(shards),
  });
}

export function parseSearchShard(input: unknown, expectedCount: number) {
  const data = record(input);
  if (
    data.schemaVersion !== SEARCH_VERSION ||
    !Array.isArray(data.documents) ||
    data.documents.length !== expectedCount ||
    data.documents.length > SEARCH_LIMITS.documents
  )
    throw new TypeError("Search shard version or document count does not match the manifest.");
  const documents = data.documents.map(validateSearchDocument);
  const aliases = validateAliases(data.aliases, new Set(documents.map((doc) => doc.id)));
  return { documents, aliases };
}
