import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/** SHA-256 of source text after normalizing every newline to LF. */
export function hashKernelSource(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}

/**
 * Digest of the real transitively-imported module closure.
 * Same algorithm as scripts/generate-*.mjs `evaluatorSources`: walk relative
 * `from` / `import` specifiers, refuse unhashable targets, hash path + byte length + text.
 */
export function evaluatorSources(
  root: string,
  entryPaths: readonly string[],
): readonly (readonly [string, string])[] {
  const seen = new Map<string, string>();
  function visit(path: string): void {
    if (seen.has(path)) return;
    const source = readFileSync(resolve(root, path), "utf8");
    seen.set(path, source);
    for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
      const spec = match[1];
      if (spec === undefined) continue;
      const target = relative(root, resolve(root, dirname(path), spec))
        .split("\\")
        .join("/");
      if (target.startsWith("../") || !/\.(ts|mjs)$/.test(target)) {
        throw new Error(`Unhashable evaluator dependency: ${target}`);
      }
      visit(target);
    }
  }
  for (const entry of entryPaths) visit(entry);
  return [...seen].sort(([a], [b]) => a.localeCompare(b, "en"));
}

export function hashModuleClosure(root: string, entryPaths: readonly string[]): string {
  const sources = evaluatorSources(root, entryPaths);
  const hash = createHash("sha256");
  for (const [path, text] of sources) {
    hash.update(`${path}\0${Buffer.byteLength(text)}\0`).update(text);
  }
  return `source:sha256:${hash.digest("hex")}`;
}
