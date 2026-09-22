/**
 * Scans the tree for a second copy of the theater, mockery, overclaim, or independence-claim
 * vocabulary — a parallel deny list drifts from content/editorial/voice-rules.yaml the moment
 * either one is edited alone. Only this file's own scan is the source of truth that no second
 * copy exists; am-dataset-independence-registry-3dfb and the reception/causal-order beads rely on
 * that guarantee to keep no word list of their own.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseYaml } from "../../provenance/yaml.ts";
import type { DataOnlyRule, OverclaimRule, WordListRule } from "./rules.ts";
import { loadVoiceRules } from "./rules.ts";

export interface ParallelDenyListFinding {
  readonly file: string;
  readonly line: number;
  readonly matchedTerms: readonly string[];
}

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".js", ".json", ".yaml", ".yml"]);
const MIN_MATCHING_TERMS = 3;

export function collectDenyListVocabulary(): readonly string[] {
  const rules = loadVoiceRules();
  const theater = rules.rules.theater as WordListRule;
  const mockery = rules.rules.mockery as WordListRule;
  const overclaim = rules.rules.overclaim as OverclaimRule;
  const independence = rules.rules["independence-claim"] as DataOnlyRule;
  /**
   * The gated word lists belong here too (am-x9xf).
   *
   * A word moved out of `words` into `constructionGated` or `qualifierGated` is still this
   * rule's vocabulary; only the construction that reaches it changed. Reading `words` alone
   * means the protected vocabulary silently SHRINKS every time a word is gated, and a second
   * copy of it elsewhere in the tree stops being detected - in the gate whose whole job is to
   * notice second copies.
   *
   * This was already true before the change that found it: "points" moved to
   * theater.constructionGated under am-gzxs and dropped out of this list then. "naive" and
   * "naively" would have followed it today.
   */
  const words = [
    ...theater.words,
    ...(theater.markWords ?? []),
    ...(theater.constructionGated?.words ?? []),
    ...(theater.qualifierGated?.words ?? []),
    ...mockery.words,
    ...(mockery.constructionGated?.words ?? []),
    ...(mockery.qualifierGated?.words ?? []),
    ...overclaim.phrases,
    ...independence.phrases,
  ];
  return [...new Set(words.map((w) => w.toLowerCase()))];
}

/**
 * Excludes a file by its own path, or a directory by path segment (am-f6hr).
 *
 * A third clause, a bare `relativePath.startsWith(glob)`, used to sit here. With
 * no separator it subsumed both other clauses and excused every path that merely
 * BEGAN with the glob, so the exclusion "src/content/checks/voice", meant to be
 * this gate's own directory, also covered src/content/checks/voiceRules.ts,
 * voice2/ and voiceOverrides/ - in the gate whose file comment says its own scan
 * is the only proof that no second copy of the vocabulary exists. Nothing was
 * escaping through it; it was a fail-open waiting for a plausible filename.
 */
function isExcluded(relativePath: string, excludeGlobs: readonly string[]): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return excludeGlobs.some((glob) => normalized === glob || normalized.startsWith(`${glob}/`));
}

function listFiles(root: string, cwd: string, excludeGlobs: readonly string[]): string[] {
  const absoluteRoot = path.join(cwd, root);
  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(absoluteRoot);
  } catch {
    return [];
  }
  if (stats.isFile()) return isExcluded(root, excludeGlobs) ? [] : [absoluteRoot];

  const files: string[] = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const absoluteChild = path.join(dir, entry.name);
      const relativeChild = path.relative(cwd, absoluteChild);
      if (isExcluded(relativeChild, excludeGlobs)) continue;
      if (entry.isDirectory()) stack.push(absoluteChild);
      else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(absoluteChild);
    }
  }
  return files;
}

function lineOf(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) if (content[i] === "\n") line++;
  return line;
}

function countMatches(strings: readonly string[], vocabulary: readonly string[]): string[] {
  const lowered = new Set(strings.map((s) => s.toLowerCase()));
  return vocabulary.filter((term) => lowered.has(term));
}

const STRING_LITERAL_PATTERN = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;

function extractStringLiterals(text: string): string[] {
  return [...text.matchAll(STRING_LITERAL_PATTERN)].map((m) => (m[1] ?? m[2] ?? "").trim());
}

function scanCodeFile(
  absolutePath: string,
  relativePath: string,
  vocabulary: readonly string[],
): ParallelDenyListFinding[] {
  const content = readFileSync(absolutePath, "utf8");
  const findings: ParallelDenyListFinding[] = [];
  const stack: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "[") stack.push(i);
    else if (content[i] === "]") {
      const start = stack.pop();
      if (start === undefined) continue;
      const literals = extractStringLiterals(content.slice(start, i));
      const matched = countMatches(literals, vocabulary);
      if (matched.length >= MIN_MATCHING_TERMS) {
        findings.push({ file: relativePath, line: lineOf(content, start), matchedTerms: matched });
      }
    }
  }
  return findings;
}

function walkYamlArrays(
  node: unknown,
  vocabulary: readonly string[],
  onFound: (matched: string[]) => void,
): void {
  if (Array.isArray(node)) {
    if (node.every((item) => typeof item === "string")) {
      const matched = countMatches(node as string[], vocabulary);
      if (matched.length >= MIN_MATCHING_TERMS) onFound(matched);
    }
    for (const item of node) walkYamlArrays(item, vocabulary, onFound);
  } else if (node !== null && typeof node === "object") {
    for (const value of Object.values(node)) walkYamlArrays(value, vocabulary, onFound);
  }
}

function scanYamlFile(
  absolutePath: string,
  relativePath: string,
  vocabulary: readonly string[],
): ParallelDenyListFinding[] {
  const content = readFileSync(absolutePath, "utf8");
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    return [];
  }
  const findings: ParallelDenyListFinding[] = [];
  walkYamlArrays(parsed, vocabulary, (matched) => {
    // Line-precise reporting would need a line-annotating YAML parser; approximate with the
    // first line where one of the matched terms literally appears in the raw text.
    const anchor = matched[0];
    const idx = anchor ? content.toLowerCase().indexOf(anchor.toLowerCase()) : -1;
    findings.push({
      file: relativePath,
      line: idx >= 0 ? lineOf(content, idx) : 1,
      matchedTerms: matched,
    });
  });
  return findings;
}

export interface ScanOptions {
  readonly roots: readonly string[];
  readonly excludeGlobs?: readonly string[];
  readonly cwd?: string;
}

export function scanForParallelDenyLists(options: ScanOptions): ParallelDenyListFinding[] {
  const vocabulary = collectDenyListVocabulary();
  const cwd = options.cwd ?? process.cwd();
  const excludeGlobs = options.excludeGlobs ?? [];
  const findings: ParallelDenyListFinding[] = [];
  for (const root of options.roots) {
    for (const absolutePath of listFiles(root, cwd, excludeGlobs)) {
      const relativePath = path.relative(cwd, absolutePath);
      const ext = path.extname(absolutePath);
      if (ext === ".yaml" || ext === ".yml")
        findings.push(...scanYamlFile(absolutePath, relativePath, vocabulary));
      else findings.push(...scanCodeFile(absolutePath, relativePath, vocabulary));
    }
  }
  return findings;
}

/** The real scan the gate step runs: the whole tree, excluding this rule set's own file and this bead's fixtures. */
export function scanRealTreeForParallelDenyLists(
  cwd: string = process.cwd(),
): ParallelDenyListFinding[] {
  return scanForParallelDenyLists({
    roots: ["src", "content", "scripts"],
    excludeGlobs: ["content/editorial/voice-rules.yaml", "src/content/checks/voice"],
    cwd,
  });
}
