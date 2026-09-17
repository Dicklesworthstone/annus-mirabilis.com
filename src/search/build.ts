/** Build-only content-addressed search packaging. Never imported by a client component. */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  createSearchEngine,
  SEARCH_LIMITS,
  SEARCH_VERSION,
  type SearchAlias,
  type SearchDocument,
} from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

export type SearchShardDescriptor = Readonly<{
  path: string;
  sha256: string;
  bytes: number;
  gzipBytes: number;
  documents: number;
}>;
export type SearchManifest = Readonly<{
  schemaVersion: typeof SEARCH_VERSION;
  buildDigest: string;
  profile: SearchProfile;
  totalDocuments: number;
  shards: readonly SearchShardDescriptor[];
}>;

export function packageSearchIndex(
  documents: readonly SearchDocument[],
  aliases: readonly SearchAlias[],
  buildDigest: string,
  profile: SearchProfile,
) {
  if (!/^[a-f0-9]{64}$/u.test(buildDigest))
    throw new TypeError("Search requires the compiled build digest.");
  searchProfile(profile);
  createSearchEngine(documents, aliases); // Validate the whole set, including duplicate ids and aliases.
  const sorted = [...documents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const files: { descriptor: SearchShardDescriptor; text: string }[] = [];
  function emit(records: readonly SearchDocument[], splitByType: boolean): void {
    const ids = new Set(records.map((document) => document.id));
    const shardAliases = aliases
      .filter((alias) => ids.has(alias.target))
      .sort((a, b) => {
        const left = `${a.phrase}\0${a.target}\0${a.label}`,
          right = `${b.phrase}\0${b.target}\0${b.label}`;
        return left < right ? -1 : left > right ? 1 : 0;
      });
    // Reconstruct keys in fixed order; caller object insertion order cannot affect a digest.
    const canonical = records.map((d) => ({
      id: d.id,
      type: d.type,
      paper: d.paper,
      section: d.section,
      lang: d.lang,
      title: d.title,
      text: d.text,
      terms: [...d.terms].sort(),
      route: d.route,
      anchor: d.anchor,
      face: d.face,
      scopeLabel: d.scopeLabel,
    }));
    const text = `${JSON.stringify({
      schemaVersion: SEARCH_VERSION,
      documents: canonical,
      aliases: shardAliases.map((a) => ({ phrase: a.phrase, target: a.target, label: a.label })),
    })}\n`;
    const bytes = Buffer.byteLength(text),
      gzipBytes = gzipSync(text, { level: 9 }).byteLength;
    if (bytes > SEARCH_LIMITS.shardBytes || gzipBytes > SEARCH_LIMITS.gzipShardBytes) {
      if (records.length <= 1)
        throw new RangeError("A single search document exceeds the shard budget.");
      const types = [...new Set(records.map((d) => d.type))].sort();
      if (splitByType && types.length > 1) {
        for (const type of types)
          emit(
            records.filter((d) => d.type === type),
            false,
          );
      } else {
        const half = Math.ceil(records.length / 2);
        emit(records.slice(0, half), false);
        emit(records.slice(half), false);
      }
      return;
    }
    const sha256 = createHash("sha256").update(text).digest("hex");
    files.push({
      descriptor: {
        path: `/search/s-${sha256}.json`,
        sha256,
        bytes,
        gzipBytes,
        documents: records.length,
      },
      text,
    });
  }
  // Keep one empty shard so static-export dynamic-route enumeration remains nonempty
  // even while publication profiles correctly expose no schema-v1 draft content.
  if (!sorted.length) emit([], false);
  for (const paper of [...new Set(sorted.map((d) => d.paper))].sort())
    emit(
      sorted.filter((document) => document.paper === paper),
      true,
    );
  if (
    files.length > SEARCH_LIMITS.shards ||
    files.reduce((sum, file) => sum + file.descriptor.bytes, 0) > SEARCH_LIMITS.totalBytes
  )
    throw new RangeError("Search index transfer budget exceeded.");
  const manifest: SearchManifest = {
    schemaVersion: SEARCH_VERSION,
    buildDigest,
    profile,
    totalDocuments: documents.length,
    shards: files.map((file) => file.descriptor),
  };
  const manifestText = `${JSON.stringify(manifest)}\n`;
  if (Buffer.byteLength(manifestText) > SEARCH_LIMITS.manifestBytes)
    throw new RangeError("Search manifest budget exceeded.");
  return { manifest, manifestText, files };
}
