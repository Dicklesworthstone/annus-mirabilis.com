/**
 * Package the same query engine and index for native search. No second corpus is generated.
 * The script is a normal static asset, so the existing edition file table and bundle-copy
 * verification carry it without a separate Xcode resource phase.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createSearchEngine,
  SEARCH_LIMITS,
  type SearchAlias,
  type SearchDocument,
} from "../../src/search/core.ts";
import { NATIVE_SEARCH_SCHEMA } from "../../src/search/native.ts";
import { parseSearchShard, validateSearchManifest } from "../../src/search/protocol.ts";

export const NATIVE_SEARCH_SCRIPT_FILE = "native/search-query.js";
export const NATIVE_SEARCH_MANIFEST_PATH = "search/index-manifest.json";
export const NATIVE_SEARCH_SCRIPT_LIMIT = 256 * 1024;

export type NativeSearchDescriptor = Readonly<{
  schemaVersion: typeof NATIVE_SEARCH_SCHEMA;
  queryScript: Readonly<{ file: typeof NATIVE_SEARCH_SCRIPT_FILE; sha256: string; bytes: number }>;
  manifestPath: typeof NATIVE_SEARCH_MANIFEST_PATH;
  buildDigest: string;
  totalDocuments: number;
}>;

type PinnedFile = Readonly<{ path: string; sha256: string; size: number }>;
type Inspection =
  | Readonly<{ ok: true; descriptor: NativeSearchDescriptor | null }>
  | Readonly<{ ok: false; message: string }>;

/** Called by the existing search-index preparation step, before its manifest is published. */
export function buildNativeSearchScript(root: string): void {
  const output = resolve(root, "public", NATIVE_SEARCH_SCRIPT_FILE);
  mkdirSync(dirname(output), { recursive: true });
  const executable = process.versions.bun ? process.execPath : "bun";
  execFileSync(
    executable,
    [
      "build",
      resolve(root, "src/search/nativeEntry.ts"),
      "--target=browser",
      "--format=iife",
      "--minify",
      "--reject-unresolved",
      "--outfile=" + output,
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30_000 },
  );
}

/**
 * Inspect only the files that this edition will actually ship. Old exports with neither asset
 * retain an explicit unavailable native-search state; a partial or corrupt pair refuses export.
 */
export function inspectNativeSearch(outDir: string, files: readonly PinnedFile[]): Inspection {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const script = byPath.get(NATIVE_SEARCH_SCRIPT_FILE);
  const index = byPath.get(NATIVE_SEARCH_MANIFEST_PATH);
  if (!script && !index) return { ok: true, descriptor: null };
  if (!script || !index)
    return {
      ok: false,
      message:
        "The app edition is missing its native query script or search index. Rebuild the search index and web export together.",
    };

  function readPinned(entry: PinnedFile, limit: number): Buffer | null {
    const path = resolve(outDir, entry.path);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > limit) return null;
    const bytes = readFileSync(path);
    if (
      bytes.byteLength !== entry.size ||
      bytes.byteLength > limit ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    )
      return null;
    return bytes;
  }

  try {
    if (!readPinned(script, NATIVE_SEARCH_SCRIPT_LIMIT))
      return {
        ok: false,
        message: "The native search query script does not match the edition's bounded file record.",
      };
    const manifestBytes = readPinned(index, SEARCH_LIMITS.manifestBytes);
    if (!manifestBytes)
      return {
        ok: false,
        message: "The search manifest does not match the edition's bounded file record.",
      };
    const manifest = validateSearchManifest(JSON.parse(manifestBytes.toString("utf8")));
    const documents: SearchDocument[] = [];
    const aliases: SearchAlias[] = [];
    for (const descriptor of manifest.shards) {
      const entry = byPath.get(descriptor.path.slice(1));
      if (!entry || entry.sha256 !== descriptor.sha256 || entry.size !== descriptor.bytes)
        return {
          ok: false,
          message: "A search shard is missing or differs from the index's pinned descriptor.",
        };
      const bytes = readPinned(entry, descriptor.bytes);
      if (!bytes)
        return { ok: false, message: "A bundled search shard does not match its pinned bytes." };
      const shard = parseSearchShard(JSON.parse(bytes.toString("utf8")), descriptor.documents);
      documents.push(...shard.documents);
      aliases.push(...shard.aliases);
    }
    const engine = createSearchEngine(documents, aliases);
    if (engine.size !== manifest.totalDocuments)
      return { ok: false, message: "The bundled search document count differs from its manifest." };
    return {
      ok: true,
      descriptor: {
        schemaVersion: NATIVE_SEARCH_SCHEMA,
        queryScript: { file: NATIVE_SEARCH_SCRIPT_FILE, sha256: script.sha256, bytes: script.size },
        manifestPath: NATIVE_SEARCH_MANIFEST_PATH,
        buildDigest: manifest.buildDigest,
        totalDocuments: manifest.totalDocuments,
      },
    };
  } catch {
    return { ok: false, message: "The app edition's search index is malformed or unreadable." };
  }
}
