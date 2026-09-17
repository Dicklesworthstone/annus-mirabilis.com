/** Build-time static route input. Retained files are not public unless in the current manifest. */
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SEARCH_LIMITS } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";
import { parseSearchShard, validateSearchManifest } from "./protocol.ts";

async function boundedFile(path: string, budget: number): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > budget)
    throw new Error("Invalid or oversized generated search file.");
  const bytes = await readFile(path);
  if (bytes.byteLength > budget) throw new Error("Generated search file exceeded its budget.");
  return bytes;
}
export async function readSearchManifest(
  root = process.cwd(),
  expectedProfile: SearchProfile = searchProfile(process.env.AM_RELEASE_PROFILE),
) {
  const bytes = await boundedFile(resolve(root, "generated/search/index-manifest.json"), SEARCH_LIMITS.manifestBytes);
  const manifest = validateSearchManifest(JSON.parse(bytes.toString("utf8")));
  const content = JSON.parse((await boundedFile(resolve(root, "generated/content/index.json"), 2 * 1024 * 1024)).toString("utf8"));
  if (content.buildDigest !== manifest.buildDigest || manifest.profile !== expectedProfile)
    throw new Error("Search is stale for this content build or release profile. Run prepare:content.");
  return { manifest, text: bytes.toString("utf8") };
}
export async function currentSearchShards(root = process.cwd()) {
  const { manifest } = await readSearchManifest(root);
  return manifest.shards.map((shard) => ({ shard: shard.path.slice("/search/".length) }));
}
export async function readCurrentSearchShard(name: string, root = process.cwd()): Promise<string | null> {
  if (!/^s-[a-f0-9]{64}\.json$/u.test(name)) return null;
  const { manifest } = await readSearchManifest(root);
  const descriptor = manifest.shards.find((shard) => shard.path === `/search/${name}`);
  if (!descriptor) return null;
  const bytes = await boundedFile(resolve(root, "generated/search", name), descriptor.bytes);
  if (bytes.byteLength !== descriptor.bytes || createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256)
    throw new Error("Generated search shard does not match its manifest.");
  const text = bytes.toString("utf8");
  parseSearchShard(JSON.parse(text), descriptor.documents);
  return text;
}
