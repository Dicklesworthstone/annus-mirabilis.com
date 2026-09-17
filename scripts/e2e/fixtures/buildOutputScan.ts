/**
 * Proves that no fixture module id, fixture page, test hook, or fixture
 * static input appears in the `next build` output (am-test-e2e-harness-bqmh
 * requirement 8). The fixture server must never be reachable from the
 * application build; the architecture gate and the initial-route graph
 * check still run on the production build, which never imports this file.
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FixtureAppEntry } from "./fixtureApps.ts";

export interface BuildOutputScanIssue {
  readonly entryId: string;
  readonly needle: string;
  readonly file: string;
}

function needlesFor(entry: FixtureAppEntry): readonly string[] {
  return [entry.id, entry.entry, ...(entry.staticInputs ?? []).map((input) => input.servedPath)];
}

/**
 * Scans a flat listing of built output paths (or lines from a build
 * manifest/trace) for any string that would only appear if a fixture's
 * module directory, id, or a static input's served name had leaked into the
 * production build.
 */
export function scanBuildOutputListing(
  registry: readonly FixtureAppEntry[],
  listing: readonly string[],
): BuildOutputScanIssue[] {
  const issues: BuildOutputScanIssue[] = [];
  for (const entry of registry) {
    const needles = needlesFor(entry);
    for (const file of listing) {
      for (const needle of needles) {
        if (needle.length > 0 && file.includes(needle)) {
          issues.push({ entryId: entry.id, needle, file });
        }
      }
    }
  }
  return issues;
}

export function formatBuildOutputScanIssue(issue: BuildOutputScanIssue): string {
  return `build output file "${issue.file}" references fixture "${issue.entryId}" (matched "${issue.needle}")`;
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.startsWith("._") || name === ".DS_Store") {
      continue;
    }
    const full = join(dir, name);
    const relative = full.slice(root.length + 1);
    try {
      const stats = await stat(full);
      if (stats.isDirectory()) {
        await walk(root, full, out);
      } else {
        out.push(relative);
      }
    } catch {
      // A file that vanished mid-walk is not this scan's concern.
    }
  }
}

/** Walks a real build output directory (`.next/` or `out/`) into the flat listing `scanBuildOutputListing` expects. */
export async function listBuildOutputFiles(buildOutputDir: string): Promise<string[]> {
  const root = resolve(buildOutputDir);
  const out: string[] = [];
  await walk(root, root, out);
  return out.sort();
}
