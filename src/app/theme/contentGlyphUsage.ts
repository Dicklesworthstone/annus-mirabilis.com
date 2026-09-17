/**
 * Real content glyph usage (am-design-themes-typography-288q): "assert the
 * actual glyph coverage of the fonts you ship against the character set
 * the content actually uses." Walks the real content corpus structurally
 * (a real YAML/JSON parse, never a raw-byte scan) and collects every
 * non-ASCII code point that appears in a value a reader could actually
 * see, excluding:
 *   - values under a key literally named "latex" (LaTeX source for KaTeX,
 *     which has its own fonts and is exempt from this bead's scope);
 *   - content/editorial/voice-rules.yaml, whose "markWords" list of
 *     forbidden vocabulary (including the literal characters "✓" and "✗")
 *     is lint configuration, never text a reader is shown.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import yaml from "js-yaml";

const EXCLUDED_FILES = new Set(["content/editorial/voice-rules.yaml"]);
const EXCLUDED_KEYS = new Set(["latex"]);

export interface GlyphUsage {
  readonly codePoint: number;
  readonly char: string;
  /** Repo-relative paths of every file where this code point was found (deduplicated). */
  readonly files: readonly string[];
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listFiles(full));
    else if ([".json", ".yaml", ".yml"].includes(extname(full))) out.push(full);
  }
  return out;
}

function collectCodePoints(
  value: unknown,
  key: string | undefined,
  into: Map<number, Set<string>>,
  filePath: string,
): void {
  if (key !== undefined && EXCLUDED_KEYS.has(key)) return;
  if (typeof value === "string") {
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      if (cp === undefined || cp <= 127) continue;
      if (!into.has(cp)) into.set(cp, new Set());
      into.get(cp)?.add(filePath);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectCodePoints(item, undefined, into, filePath);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectCodePoints(v, k, into, filePath);
  }
}

/**
 * Scans `contentRoot` (default: the repo's `content/` directory) and
 * returns every non-ASCII code point found in a non-excluded value, with
 * the files it came from.
 */
export function scanContentGlyphUsage(
  contentRoot: string,
  repoRoot: string,
): readonly GlyphUsage[] {
  const found = new Map<number, Set<string>>();
  for (const filePath of listFiles(contentRoot)) {
    const relPath = relative(repoRoot, filePath).replace(/\\/g, "/");
    if (EXCLUDED_FILES.has(relPath)) continue;
    const raw = readFileSync(filePath, "utf-8");
    let parsed: unknown;
    try {
      parsed = extname(filePath) === ".json" ? JSON.parse(raw) : yaml.load(raw);
    } catch {
      continue; // A malformed content file is a compiler error elsewhere, not this scan's job.
    }
    collectCodePoints(parsed, undefined, found, relPath);
  }
  return [...found.entries()]
    .map(([codePoint, files]) => ({
      codePoint,
      char: String.fromCodePoint(codePoint),
      files: [...files].sort(),
    }))
    .sort((a, b) => a.codePoint - b.codePoint);
}
