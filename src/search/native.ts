/**
 * The native shell calls the edition's search owner through JSON strings in JavaScriptCore.
 * No DOM, network, storage, or host callbacks are required. The host verifies pinned bytes
 * before load(); this boundary validates the same bounded wire format as the web loader.
 */
import {
  createSearchEngine,
  SEARCH_LIMITS,
  SEARCH_TYPES,
  type SearchAlias,
  type SearchDocument,
  type SearchEngine,
  type SearchType,
  searchResultHref,
} from "./core.ts";
import { parseSearchShard, validateSearchManifest } from "./protocol.ts";
import { TYPE_LABELS } from "./typeLabels.ts";

export const NATIVE_SEARCH_SCHEMA = "annus-mirabilis-native-search.v1";

type QueryOptions = { paper?: string; type?: SearchType; limit?: number };
type NativeSearchErrorCode = "invalid-index" | "not-loaded" | "invalid-query" | "query-failed";

function failure(code: NativeSearchErrorCode, message: string): string {
  return JSON.stringify({ ok: false, error: { code, message } });
}

/** JavaScriptCore has no TextEncoder. Count UTF-8 without allocating a second copy of each shard. */
function byteLength(text: string, maximum: number): number {
  if (text.length > maximum) return maximum + 1;
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (
      unit >= 0xd800 &&
      unit <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
    if (bytes > maximum) return bytes;
  }
  return bytes;
}

export function createNativeSearchSession() {
  let engine: SearchEngine | null = null;

  return Object.freeze({
    load(manifestText: string, shardTexts: readonly string[]): string {
      // A refused replacement must never leave an older edition searchable under the new label.
      engine = null;
      try {
        if (
          typeof manifestText !== "string" ||
          byteLength(manifestText, SEARCH_LIMITS.manifestBytes) > SEARCH_LIMITS.manifestBytes ||
          !Array.isArray(shardTexts)
        )
          return failure("invalid-index", "The bundled search index is invalid.");
        const manifest = validateSearchManifest(JSON.parse(manifestText));
        if (shardTexts.length !== manifest.shards.length)
          return failure("invalid-index", "The bundled search index is incomplete.");
        const documents: SearchDocument[] = [];
        const aliases: SearchAlias[] = [];
        for (let index = 0; index < manifest.shards.length; index++) {
          const descriptor = manifest.shards[index];
          const text = shardTexts[index];
          if (
            !descriptor ||
            typeof text !== "string" ||
            byteLength(text, descriptor.bytes) !== descriptor.bytes
          )
            return failure("invalid-index", "A bundled search shard has the wrong size.");
          const shard = parseSearchShard(JSON.parse(text), descriptor.documents);
          documents.push(...shard.documents);
          aliases.push(...shard.aliases);
        }
        if (documents.length !== manifest.totalDocuments)
          return failure("invalid-index", "The bundled search index is incomplete.");
        const next = createSearchEngine(documents, aliases);
        const metadata = JSON.stringify({
          ok: true,
          schemaVersion: NATIVE_SEARCH_SCHEMA,
          buildDigest: manifest.buildDigest,
          profile: manifest.profile,
          documentCount: next.size,
          papers: [...new Set(documents.map((document) => document.paper).filter(Boolean))].sort(),
          typeLabels: TYPE_LABELS,
          limits: {
            queryCharacters: SEARCH_LIMITS.queryCharacters,
            results: SEARCH_LIMITS.results,
          },
        });
        engine = next;
        return metadata;
      } catch {
        return failure("invalid-index", "The bundled search index could not be read.");
      }
    },

    search(query: string, optionsJSON = "{}"): string {
      if (!engine) return failure("not-loaded", "Open the bundled search index first.");
      if (
        typeof query !== "string" ||
        query.length > SEARCH_LIMITS.queryCharacters ||
        typeof optionsJSON !== "string" ||
        optionsJSON.length > 1024
      )
        return failure("invalid-query", "The search request exceeds the edition's limits.");
      try {
        const raw: unknown = JSON.parse(optionsJSON);
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          return failure("invalid-query", "The search filters are invalid.");
        const options = raw as Record<string, unknown>;
        if (
          Object.keys(options).some((key) => !["paper", "type", "limit"].includes(key)) ||
          (options.paper !== undefined &&
            (typeof options.paper !== "string" || options.paper.length > 80)) ||
          (options.type !== undefined && !SEARCH_TYPES.includes(options.type as SearchType)) ||
          (options.limit !== undefined &&
            (typeof options.limit !== "number" || !Number.isSafeInteger(options.limit)))
        )
          return failure("invalid-query", "The search filters are invalid.");
        const hits = engine.search(query, options as QueryOptions).map((hit) => ({
          id: hit.document.id,
          type: hit.document.type,
          paper: hit.document.paper,
          section: hit.document.section,
          lang: hit.document.lang,
          title: hit.document.title,
          route: hit.document.route,
          anchor: hit.document.anchor,
          face: hit.document.face,
          scopeLabel: hit.document.scopeLabel,
          score: hit.score,
          snippet: hit.snippet,
          aliasLabel: hit.aliasLabel,
          href: searchResultHref(hit.document),
        }));
        return JSON.stringify({ ok: true, hits });
      } catch {
        return failure("query-failed", "The search request could not be completed.");
      }
    },

    clear(): void {
      engine = null;
    },
  });
}
