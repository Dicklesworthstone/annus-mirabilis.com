/**
 * Tracked-imports gate (am-zm52).
 *
 * The observed defect: 120c67e7 committed an import of `./pageMapReconciliation.ts`
 * into a tracked file while the imported module, 147 lines of it, was in no commit.
 * HEAD could not typecheck for about thirty minutes and nothing in the repository
 * could see it, because every local check runs in a tree where that file is present
 * on disk. It was visible only from a checkout that has no untracked files.
 *
 * So the question this asks is not "does the import resolve", which every local
 * check already answers yes to. It is "does it resolve to something a fresh clone
 * would also have".
 *
 * The trap, and the reason the distinction below is drawn with `git check-ignore`
 * rather than with absence from the index: generated build output is legitimately
 * untracked and legitimately absent from a clean checkout, because the build makes
 * it. A gate that fired on those would be switched off within a day. Ignored is
 * benign; untracked and not ignored is the defect.
 *
 * Specifier extraction and resolution are NOT reimplemented here. They come from
 * scripts/rsc-client-boundary.ts, which already walks this graph for the client
 * boundary rules, so the two cannot disagree about what a specifier means.
 */

import {
  extractImportSpecifiers,
  importCandidatePaths,
} from "../../scripts/rsc-client-boundary.ts";

export interface UntrackedImport {
  /** The tracked file carrying the import. */
  readonly from: string;
  /** The specifier as written. */
  readonly specifier: string;
  /** The candidate that exists on disk but is not tracked. */
  readonly resolved: string;
}

export interface TrackedImportProbe {
  /** Repo-relative paths in the git index. */
  readonly trackedFiles: readonly string[];
  /** Reads a repo-relative tracked file. */
  readonly readFile: (relPath: string) => string;
  /** Whether a repo-relative path exists on disk. */
  readonly exists: (relPath: string) => boolean;
  /** Whether git ignores a repo-relative path. */
  readonly isIgnored: (relPath: string) => boolean;
}

const MODULE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Tracked modules whose imports resolve only to files a clean checkout lacks.
 *
 * Injected filesystem and git so the fixtures can drive the exact state the
 * defect needs - a file PRESENT on disk and absent from the index - which no
 * fixture could reach by staging an imaginary missing file.
 */
export function findUntrackedImports(probe: TrackedImportProbe): UntrackedImport[] {
  const tracked = new Set(probe.trackedFiles);
  const ignoredCache = new Map<string, boolean>();
  const isIgnored = (path: string): boolean => {
    const cached = ignoredCache.get(path);
    if (cached !== undefined) return cached;
    const result = probe.isIgnored(path);
    ignoredCache.set(path, result);
    return result;
  };

  const violations: UntrackedImport[] = [];
  for (const from of probe.trackedFiles) {
    if (!MODULE_EXTENSIONS.test(from)) continue;
    const specifiers = extractImportSpecifiers(probe.readFile(from), { includeTypeOnly: true });
    for (const specifier of specifiers) {
      const candidates = importCandidatePaths(from, specifier);
      if (candidates.length === 0) continue;
      // A specifier that already reaches a tracked file is fine, whichever
      // candidate answered: that is what a clean checkout will resolve too.
      if (candidates.some((candidate) => tracked.has(candidate))) continue;
      // Nothing tracked answers it. If something on disk does, this tree is
      // resolving the import with a file no clean checkout has.
      const present = candidates.find((candidate) => probe.exists(candidate));
      if (present === undefined) {
        // Nothing answers it here either. That is a broken import in every
        // checkout alike, so tsc reports it everywhere and this gate has
        // nothing to add; it is not the invisible class.
        continue;
      }
      if (isIgnored(present)) continue;
      violations.push({ from, specifier, resolved: present });
    }
  }
  return violations;
}

/**
 * Formats violations as the failure message the gate prints.
 */
export function describeUntrackedImports(violations: readonly UntrackedImport[]): string {
  return [
    `${violations.length} tracked file(s) import a module that is present here and in no commit:`,
    ...violations.map(
      (v) => `  ${v.from}\n    imports "${v.specifier}" -> ${v.resolved}, which is untracked.`,
    ),
    "A clean checkout, CI, or a worktree will fail to resolve these (TS2307).",
    "Commit the imported file, or remove the import. See am-zm52.",
  ].join("\n");
}
