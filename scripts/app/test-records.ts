/**
 * The app's test records, in the shared test-log schema (bead am-app-test-harness-da6e,
 * requirement 1). Swift tests attach each record to their result as `amtestlog*` (the AMTestLog
 * helper in ios/AnnusMirabilisTestSupport/). After a run, the Apple gate exports the `.xcresult`
 * attachments, validates every record with the web's own `validateEvent`
 * (src/testing/log/schema.ts), and appends it to artifacts/test-logs/<suite>/<logRunId>.jsonl,
 * so both writers are held to one schema by one validator.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LogEvent, validateEvent } from "../../src/testing/log/schema.ts";

export const RECORD_ATTACHMENT_PREFIX = "amtestlog";

export interface CollectedRecords {
  readonly records: readonly LogEvent[];
  /** Records that failed the shared schema, each with the attachment it came from and why. */
  readonly invalid: readonly { readonly attachment: string; readonly reason: string }[];
}

interface AttachmentManifest {
  readonly attachments: readonly {
    readonly exportedFileName: string;
    readonly suggestedHumanReadableName: string;
  }[];
}

/** The records among attachments exported by `xcresulttool export attachments --output-path dir`. */
export function collectTestRecords(exportDir: string): CollectedRecords {
  const manifest = JSON.parse(
    readFileSync(join(exportDir, "manifest.json"), "utf8"),
  ) as AttachmentManifest[];
  const records: LogEvent[] = [];
  const invalid: { attachment: string; reason: string }[] = [];
  for (const test of manifest) {
    for (const attachment of test.attachments) {
      if (!attachment.suggestedHumanReadableName.startsWith(RECORD_ATTACHMENT_PREFIX)) continue;
      const name = attachment.suggestedHumanReadableName;
      try {
        const raw = JSON.parse(
          readFileSync(join(exportDir, attachment.exportedFileName), "utf8"),
        ) as Record<string, unknown>;
        records.push(validateEvent(raw));
      } catch (error) {
        invalid.push({
          attachment: name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return { records, invalid };
}

/** Appends each record to its suite's file; returns the files written, relative to the repository. */
export function writeTestRecords(repo: string, records: readonly LogEvent[]): string[] {
  const written = new Set<string>();
  for (const record of records) {
    const relative = join("artifacts", "test-logs", record.suite, `${record.logRunId}.jsonl`);
    mkdirSync(join(repo, "artifacts", "test-logs", record.suite), { recursive: true });
    appendFileSync(join(repo, relative), `${JSON.stringify(record)}\n`);
    written.add(relative);
  }
  return [...written].sort();
}
