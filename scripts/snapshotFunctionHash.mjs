import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractTypeScriptFromText } from "../src/content/kernel/extractTypeScript.ts";
import { hashKernelSource } from "../src/content/kernel/sourceDigest.ts";

/**
 * Hash the source of the function a laboratory's worked example actually ran
 * (am-70h7).
 *
 * ShowTheCode compares this against the listing's own `sourceHash`, which
 * `src/content/kernel/verify.ts` writes during `prepare:content`. The two are
 * produced by different scripts in different prepare steps from the same file, so
 * they agree when both are current and diverge when one is stale - which is the
 * staleness the reader-facing "Source listing refused" notice claims to detect.
 *
 * Before am-70h7 the component compared that listing hash against the example's
 * `sourceDigest`, a `source:sha256:` module-closure digest. The prefixes alone
 * made them unequal, so the listing claiming the current snapshot was refused on
 * every page that rendered it and the code it promises to show never appeared.
 *
 * Returns a `sha256:` function hash, never a `source:sha256:` closure digest.
 */
export async function hashSnapshotFunction(root, { exportName, filePath }) {
  const sourceText = await readFile(resolve(root, filePath), "utf8");
  const extracted = extractTypeScriptFromText({ fileName: filePath, sourceText, exportName });
  return hashKernelSource(extracted.source);
}
