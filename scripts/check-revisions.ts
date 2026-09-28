#!/usr/bin/env node
/**
 * CLI script to verify cross-commit content revisions and lineages against a git base ref.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type AliasRecord, validateAliasRecord } from "../src/content/aliases.ts";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { checkRevisionChanges, type VersionedRecord } from "../src/content/revisions.ts";
import { newRunIdentity, TestLogger } from "../src/testing/log/logger.ts";

function getGitFilesAtRef(ref: string, dir: string): string[] {
  try {
    const output = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, dir], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return output
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".json") || s.endsWith(".yaml") || s.endsWith(".yml"));
  } catch {
    return [];
  }
}

function readGitFileAtRef(ref: string, relativePath: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${relativePath}`], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch {
    return null;
  }
}

/**
 * The record as the cross-commit check pairs it: keyed by its FILE PATH, not by its id
 * (am-9755). 537 of the corpus's 770 ids name more than one file, so an id-keyed map compared
 * one paper's masthead with another's. revisions.ts's `pairingKey` carries the reasoning.
 */
function withPathKey(record: VersionedRecord, relativePath: string): VersionedRecord {
  return { ...record, key: relativePath.split(path.sep).join("/") };
}

/** Records that carry an id and a revision but could not be parsed. Reported, never dropped. */
export const unparsed: string[] = [];

/**
 * A record as the check sees it (am-9755).
 *
 * THE YAML SIDE USED TO BE TWO REGEXES, for `id` and `revision`, with the whole file text under a
 * `raw` key. So `record.lineage` was ALWAYS undefined for a YAML record, and
 * `validateRecordLineage` demands a lineage array of every record past revision 1. The check was
 * therefore asking 64 YAML records for a field its own reader could not read: no lineage anyone
 * wrote would have satisfied it. Parsing with the site's own YAML parser is what makes the
 * requirement answerable.
 *
 * A file that carries an id and a revision and then fails to parse is recorded in `unparsed`
 * rather than returning null into the void, because a record silently missing from both sides of
 * the comparison is a record this check no longer examines, and a shrinking population reads
 * exactly like a clean one.
 */
export function parseRecordContent(content: string, filePath: string): VersionedRecord | null {
  const looksLikeRecord = filePath.endsWith(".json")
    ? content.includes('"id"') && content.includes('"revision"')
    : /^id:/m.test(content) && /^revision:/m.test(content);
  if (!looksLikeRecord) return null;
  try {
    const parsed = filePath.endsWith(".json") ? JSON.parse(content) : parseYaml(content);
    if (parsed && typeof parsed === "object" && "id" in parsed && "revision" in parsed) {
      return parsed as VersionedRecord;
    }
    unparsed.push(`${filePath}: parsed, but has no id and revision at the top level`);
  } catch (error) {
    unparsed.push(`${filePath}: ${(error as Error).message.slice(0, 120)}`);
  }
  return null;
}

function loadLocalAliases(aliasesDir: string): AliasRecord[] {
  const aliases: AliasRecord[] = [];
  if (!existsSync(aliasesDir)) return aliases;

  const files = readdirSync(aliasesDir).filter((f) => f.endsWith(".json") || f.endsWith(".yaml"));
  for (const file of files) {
    const fullPath = path.join(aliasesDir, file);
    try {
      const content = readFileSync(fullPath, "utf8");
      if (file.endsWith(".json")) {
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          const val = validateAliasRecord(item);
          if (val.ok) aliases.push(val.value);
        }
      }
    } catch {
      // Ignore invalid files
    }
  }
  return aliases;
}

export async function runRevisionCheck(baseRef: string, contentDir: string): Promise<boolean> {
  const logger = new TestLogger("check-revisions", newRunIdentity());
  const baseFiles = getGitFilesAtRef(baseRef, contentDir);
  const baseRecords: VersionedRecord[] = [];
  const headRecords: VersionedRecord[] = [];

  for (const relPath of baseFiles) {
    const rawBase = readGitFileAtRef(baseRef, relPath);
    if (rawBase) {
      const rec = parseRecordContent(rawBase, relPath);
      if (rec) baseRecords.push(withPathKey(rec, relPath));
    }
  }

  // Read local worktree head records
  function walkDir(dir: string): string[] {
    const files: string[] = [];
    if (!existsSync(dir)) return files;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        files.push(...walkDir(full));
      } else if (ent.isFile() && (ent.name.endsWith(".json") || ent.name.endsWith(".yaml"))) {
        files.push(full);
      }
    }
    return files;
  }

  const headFiles = walkDir(contentDir);
  for (const fullPath of headFiles) {
    try {
      const raw = readFileSync(fullPath, "utf8");
      const rec = parseRecordContent(raw, fullPath);
      // The same spelling git gives: ls-tree prints repository-relative paths.
      if (rec) headRecords.push(withPathKey(rec, path.relative(process.cwd(), fullPath)));
    } catch {
      // Ignore
    }
  }

  const aliases = loadLocalAliases(path.join(contentDir, "aliases"));
  const result = checkRevisionChanges(baseRecords, headRecords, aliases);

  // Log findings
  for (const finding of result.findings) {
    logger.log({
      testId: finding.recordId,
      outcome: "failed",
      message: finding.message,
      extra: {
        recordId: finding.recordId,
        kind: finding.kind,
        baseRef,
        baseRevision: finding.baseRevision,
        headRevision: finding.headRevision,
        baseHash: finding.baseHash,
        headHash: finding.headHash,
      },
    });
  }

  console.log(
    `[check-revisions] ${baseRecords.length} records at ${baseRef}, ${headRecords.length} at HEAD, ` +
      `${unparsed.length} carried an id and a revision and could not be parsed, ` +
      `${result.findings.length} findings`,
  );
  for (const line of unparsed.slice(0, 10)) console.log(`  unparsed: ${line}`);
  if (result.ok) {
    logger.log({
      testId: "all-records",
      outcome: "passed",
      message: `Checked ${headRecords.length} records against base ${baseRef}: all revisions valid`,
      extra: {
        recordCount: headRecords.length,
        baseRef,
      },
    });
  }

  await logger.flush();
  return result.ok;
}

// CLI execution
if (process.argv[1]?.endsWith("check-revisions.ts")) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      base: { type: "string", default: "HEAD~1" },
      dir: { type: "string", default: "content" },
    },
    allowPositionals: true,
  });

  const baseRef = values.base ?? "HEAD~1";
  const contentDir = values.dir ?? "content";

  runRevisionCheck(baseRef, contentDir)
    .then((ok) => {
      if (!ok) {
        console.error(`check-revisions failed against base ${baseRef}`);
        process.exit(1);
      } else {
        console.log(`check-revisions passed against base ${baseRef}`);
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error("check-revisions error:", err);
      process.exit(1);
    });
}
