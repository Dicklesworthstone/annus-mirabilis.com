import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OfflineSourceError } from "./sourceProjection.ts";

export type OfflineSourceInputs = Readonly<{
  papers: readonly string[];
  sha256: string;
}>;

/**
 * Source YAML does not participate in the reading compiler's input digest. Pin it separately,
 * so changing a translation, source block or retired address cannot serve a stale saved chapter.
 * The face renderers also read public provenance notes and compiled printed-formula metadata.
 * Pin those exact dependencies too; reader storage and notebooks are never read.
 */
export async function offlineSourceInputs(
  root: string,
  paperIds: readonly string[],
): Promise<OfflineSourceInputs> {
  const papers = [...new Set(paperIds)].sort();
  if (
    papers.length !== paperIds.length ||
    papers.some((paper) => !/^[a-z][a-z0-9-]{0,100}$/u.test(paper))
  )
    throw new OfflineSourceError(
      "offline-source-input",
      "Offline source papers must have unique, safe ids.",
    );
  const files: { path: string; text: string }[] = [];
  let sourceBytes = 0;
  let generatedBytes = 0;
  async function inspect(relative: string) {
    try {
      return await lstat(resolve(root, relative));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new OfflineSourceError(
        "offline-source-read",
        "An offline source input could not be inspected: " + relative,
      );
    }
  }
  async function file(relative: string, generated = false) {
    const stat = await inspect(relative);
    if (!stat) return;
    const fileLimit = generated ? 16 * 1024 * 1024 : 512 * 1024;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > fileLimit)
      throw new OfflineSourceError(
        "offline-source-input",
        "Invalid or oversized offline source input: " + relative,
      );
    const data = await readFile(resolve(root, relative));
    if (generated) generatedBytes += data.byteLength;
    else sourceBytes += data.byteLength;
    if (files.length >= 4096 || sourceBytes > 16 * 1024 * 1024 || generatedBytes > 64 * 1024 * 1024)
      throw new OfflineSourceError(
        "offline-source-input",
        "Offline source inputs exceed their bounded text budget.",
      );
    files.push({
      path: relative,
      text: new TextDecoder("utf-8", { fatal: true }).decode(data),
    });
  }
  async function directory(relative: string, extension: RegExp) {
    const stat = await inspect(relative);
    if (!stat) return;
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new OfflineSourceError(
        "offline-source-input",
        "Source input directories must be ordinary directories.",
      );
    const entries = await readdir(resolve(root, relative));
    for (const name of entries.sort()) {
      if (extension.test(name)) await file(relative + "/" + name);
    }
  }
  for (const paper of papers) {
    for (const family of ["source-blocks", "translation-units"])
      await directory("content/" + family + "/" + paper, /\.(?:json|ya?ml)$/u);
    for (const family of ["alignments", "aliases"])
      for (const extension of ["yaml", "json"])
        await file("content/" + family + "/" + paper + "." + extension);
  }
  // Misprint notes are loaded from every top-level provenance receipt by the canonical renderer.
  await directory("docs/provenance", /\.md$/u);
  // These build products are larger than a source block; their separate bounds stay finite.
  for (const name of [
    "printed-displays", "printed-inlines", "quantity-colours", "equation-explanations",
  ])
    await file("src/generated/" + name + ".json", true);
  const hash = createHash("sha256");
  for (const input of files.sort((a, b) => a.path.localeCompare(b.path, "en")))
    hash.update(input.path + "\0" + Buffer.byteLength(input.text) + "\0" + input.text);
  return Object.freeze({ papers: Object.freeze(papers), sha256: hash.digest("hex") });
}

/** Both publication and serving compare the same inputs; a source-only edit cannot pass either. */
export function assertOfflineSourceInputs(
  expected: OfflineSourceInputs,
  current: OfflineSourceInputs,
): void {
  if (
    expected.sha256 !== current.sha256 ||
    JSON.stringify(expected.papers) !== JSON.stringify(current.papers)
  )
    throw new OfflineSourceError(
      "offline-source-stale",
      "Offline source texts are stale. Run prepare:offline.",
    );
}
