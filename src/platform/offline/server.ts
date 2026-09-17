import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { OFFLINE_CHAPTER_VERSION, offlineDigest, type OfflineChapterEntry } from "./chapter.ts";

export type OfflineProfile = "scaffold" | "preview" | "launch";
export type OfflineManifest = Readonly<{
  schemaVersion: 1;
  buildDigest: string;
  profile: OfflineProfile;
  chapters: readonly OfflineChapterEntry[];
}>;
export function offlineProfile(input: unknown): OfflineProfile {
  if (input === undefined) return "scaffold";
  if (input === "scaffold" || input === "preview" || input === "launch") return input;
  throw new TypeError("Unsupported offline publication profile.");
}
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9-]{0,100}$/u;
export function parseOfflineManifest(value: unknown): OfflineManifest {
  if (!value || typeof value !== "object") throw new TypeError("Invalid offline manifest.");
  const manifest = value as OfflineManifest;
  if (manifest.schemaVersion !== OFFLINE_CHAPTER_VERSION || typeof manifest.buildDigest !== "string" ||
      !HASH.test(manifest.buildDigest) || !Array.isArray(manifest.chapters) || manifest.chapters.length > 2048 ||
      !["scaffold", "preview", "launch"].includes(manifest.profile)) throw new TypeError("Invalid offline manifest.");
  const seen = new Set<string>();
  for (const entry of manifest.chapters) {
    if (!entry || typeof entry !== "object" || typeof entry.paper !== "string" || !ID.test(entry.paper) ||
        typeof entry.section !== "string" || !ID.test(entry.section) || typeof entry.title !== "string" ||
        !entry.title.trim() || entry.title.length > 2000 || !HASH.test(entry.sha256) || !HASH.test(entry.contentRevision) ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 16_777_216 ||
        !Number.isSafeInteger(entry.gzipBytes) || entry.gzipBytes < 1 ||
        entry.path !== `/offline/${entry.paper}/${entry.section}-${entry.sha256}.html` ||
        seen.has(`${entry.paper}/${entry.section}`)) throw new TypeError("Invalid or duplicate offline chapter descriptor.");
    seen.add(`${entry.paper}/${entry.section}`);
  }
  return manifest;
}

/** Old artifacts stay outside public/. Only the current manifest can expose a chapter. */
export async function publishOfflineChapters(root: string, manifest: OfflineManifest,
  files: readonly Readonly<{ entry: OfflineChapterEntry; html: string }>[]) {
  parseOfflineManifest(manifest);
  if (files.length !== manifest.chapters.length) throw new Error("Incomplete offline publication.");
  const directory = resolve(root, "generated/offline");
  await mkdir(directory, { recursive: true });
  const byPath = new Map(files.map((file) => [file.entry.path, file]));
  if (byPath.size !== files.length) throw new Error("Duplicate offline publication path.");
  for (const entry of manifest.chapters) {
    const file = byPath.get(entry.path);
    if (!file || offlineDigest(file.html) !== entry.sha256 || Buffer.byteLength(file.html) !== entry.bytes)
      throw new Error("Offline chapter bytes differ from their descriptor.");
    const path = resolve(directory, entry.path.slice("/offline/".length));
    await mkdir(dirname(path), { recursive: true });
    try { await writeFile(path, file.html, { flag: "wx" }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await readFile(path, "utf8") !== file.html)
        throw new Error("An existing content-addressed offline chapter has different bytes.");
    }
  }
  await writeFile(resolve(directory, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function loadOfflineManifest(root = process.cwd(), profile = offlineProfile(process.env.AM_RELEASE_PROFILE)):
  Promise<OfflineManifest | null> {
  let text: string;
  try { text = await readFile(resolve(root, "generated/offline/index.json"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  if (Buffer.byteLength(text) > 2_097_152) throw new Error("Offline manifest is oversized.");
  const manifest = parseOfflineManifest(JSON.parse(text));
  const current = JSON.parse(await readFile(resolve(root, "generated/content/index.json"), "utf8")) as { buildDigest: string };
  if (manifest.buildDigest !== current.buildDigest || manifest.profile !== profile)
    throw new Error("Offline chapters are stale for the current content or profile. Run prepare:offline.");
  return manifest;
}
export async function loadOfflineChapter(paper: string, file: string, root = process.cwd()):
  Promise<Readonly<{ html: string; entry: OfflineChapterEntry }> | null> {
  if (!ID.test(paper) || !/^[a-z][a-z0-9-]*-[a-f0-9]{64}\.html$/u.test(file)) return null;
  const manifest = await loadOfflineManifest(root);
  const entry = manifest?.chapters.find((item) => item.path === `/offline/${paper}/${file}`);
  if (!entry) return null;
  const bytes = await readFile(resolve(root, "generated/offline", paper, file));
  if (bytes.byteLength !== entry.bytes || offlineDigest(bytes) !== entry.sha256)
    throw new Error("Offline chapter integrity check failed.");
  return Object.freeze({ html: new TextDecoder("utf-8", { fatal: true }).decode(bytes), entry });
}
