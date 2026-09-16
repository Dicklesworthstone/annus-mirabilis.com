import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { artifactsRoot, getLogger } from "./logger.ts";
import type { Outcome } from "./schema.ts";

export interface RetainEvidenceMeta {
  suite: string;
  logRunId?: string;
  testId: string;
  beadId?: string;
  outcome?: Outcome;
  message?: string;
}

export function evidenceDir(suite: string, logRunId: string, testId: string): string {
  return path.join(artifactsRoot(), suite, logRunId, "evidence", testId);
}

export interface RetainEvidenceResult {
  copied: string[];
  missing: string[];
}

/**
 * Copies committed fixture files, captured stdout/stderr, or configuration
 * snapshots into the suite's evidence directory for one test, and records the
 * copies on the failing event's `evidence.files`. Never moves, truncates, or
 * deletes the originals (AGENTS.md Rule 1) — a missing source is reported in
 * the event message, never silently skipped.
 */
export async function retainEvidence(
  meta: RetainEvidenceMeta,
  sources: readonly string[],
): Promise<RetainEvidenceResult> {
  const logger = getLogger(meta.suite, meta.logRunId);
  const destDir = evidenceDir(meta.suite, logger.logRunId, meta.testId);
  mkdirSync(destDir, { recursive: true });

  const copied: string[] = [];
  const missing: string[] = [];
  for (const source of sources) {
    if (!existsSync(source)) {
      missing.push(source);
      continue;
    }
    const dest = path.join(destDir, path.basename(source));
    copyFileSync(source, dest);
    copied.push(dest);
  }

  const message =
    missing.length > 0 ? `Missing evidence source(s): ${missing.join(", ")}` : meta.message;

  logger.log({
    testId: meta.testId,
    ...(meta.beadId !== undefined ? { beadId: meta.beadId } : {}),
    outcome: meta.outcome ?? "failed",
    evidence: { files: copied },
    ...(message !== undefined ? { message } : {}),
  });
  await logger.flush();

  return { copied, missing };
}
