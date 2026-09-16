#!/usr/bin/env node
/**
 * CLI script to verify cross-commit content revisions and lineages against a git base ref.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type AliasRecord, validateAliasRecord } from "../src/content/aliases.ts";
import {
  type VersionedRecord,
  checkRevisionChanges,
  computeCanonicalRecordHash,
  validateRecordLineage,
} from "../src/content/revisions.ts";
import { TestLogger, newRunIdentity } from "../src/testing/log/logger.ts";

function getGitFilesAtRef(ref: string, dir: string): string[] {
  try {
    const output = execSync(`git ls-tree -r --name-only ${ref} ${dir}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
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
    return execSync(`git show ${ref}:${relativePath}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function parseRecordContent(content: string, filePath: string): VersionedRecord | null {
  try {
    if (filePath.endsWith(".json")) {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && "id" in parsed && "revision" in parsed) {
        return parsed as VersionedRecord;
      }
    }
    // Simple key-value parser for basic yaml or JSON objects
    if (content.includes("id:") && content.includes("revision:")) {
      const idMatch = content.match(/^id:\s*["']?([^"'\r\n]+)["']?/m);
      const revMatch = content.match(/^revision:\s*(\d+)/m);
      if (idMatch && revMatch && idMatch[1] && revMatch[1]) {
        return {
          id: idMatch[1].trim(),
          revision: Number.parseInt(revMatch[1].trim(), 10),
          raw: content,
        };
      }
    }
  } catch {
    // Ignore unparseable
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
      if (rec) baseRecords.push(rec);
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
      if (rec) headRecords.push(rec);
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

  runRevisionCheck(baseRef, contentDir).then((ok) => {
    if (!ok) {
      console.error(`check-revisions failed against base ${baseRef}`);
      process.exit(1);
    } else {
      console.log(`check-revisions passed against base ${baseRef}`);
      process.exit(0);
    }
  }).catch((err) => {
    console.error("check-revisions error:", err);
    process.exit(1);
  });
}
