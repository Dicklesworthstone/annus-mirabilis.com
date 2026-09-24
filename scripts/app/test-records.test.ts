/**
 * The app's test records meet the web's own log schema. The fixture is the shape AMTestLog writes
 * (ios/AnnusMirabilisTestSupport/AMTestLog.swift); the Swift tests hold AMTestLog to the same file.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseLogLine, validateEvent } from "../../src/testing/log/schema.ts";
import { collectTestRecords, RECORD_ATTACHMENT_PREFIX, writeTestRecords } from "./test-records.ts";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "amtestlog-record.json");
const record = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;

/** An `xcresulttool export attachments` directory holding these attachments. */
function exported(attachments: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "amtestlog-export-"));
  const entries = Object.entries(attachments).map(([name, body], index) => {
    const file = `${index}.json`;
    writeFileSync(join(dir, file), typeof body === "string" ? body : JSON.stringify(body));
    return { exportedFileName: file, suggestedHumanReadableName: `${name}_0_${index}.json` };
  });
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify([{ testIdentifier: "T/t()", attachments: entries }]),
  );
  return dir;
}

describe("the app's test records", () => {
  it("the fixture AMTestLog is held to passes the web's own validator", () => {
    assert.doesNotThrow(() => validateEvent(record));
  });

  it("collects valid records, refuses invalid ones with the reason, and ignores other attachments", () => {
    const failingWithoutEvidence = { ...record, testId: "failing", outcome: "failed" };
    const dir = exported({
      [`${RECORD_ATTACHMENT_PREFIX}-good`]: record,
      [`${RECORD_ATTACHMENT_PREFIX}-stray-field`]: { ...record, device: "iPhone" },
      [`${RECORD_ATTACHMENT_PREFIX}-no-evidence`]: failingWithoutEvidence,
      [`${RECORD_ATTACHMENT_PREFIX}-not-json`]: "{",
      "screen-reading-default": record,
    });
    const { records, invalid } = collectTestRecords(dir);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.testId, record.testId);
    assert.deepEqual(
      invalid.map((entry) => entry.attachment.split("_0_")[0]),
      [
        `${RECORD_ATTACHMENT_PREFIX}-stray-field`,
        `${RECORD_ATTACHMENT_PREFIX}-no-evidence`,
        `${RECORD_ATTACHMENT_PREFIX}-not-json`,
      ],
    );
    assert.match(invalid[0]?.reason ?? "", /extra\.device/);
    assert.match(invalid[1]?.reason ?? "", /screenshot and a DOM snapshot/);
  });

  it("writes each record to its suite's file under the gate's run id", () => {
    const repo = mkdtempSync(join(tmpdir(), "amtestlog-repo-"));
    mkdirSync(join(repo, "artifacts"), { recursive: true });
    const files = writeTestRecords(repo, [
      validateEvent(record),
      validateEvent({ ...record, testId: "second" }),
    ]);
    assert.deepEqual(files, [`artifacts/test-logs/app-lifecycle/${record.logRunId}.jsonl`]);
    const lines = readFileSync(join(repo, files[0] ?? ""), "utf8")
      .trim()
      .split("\n");
    assert.deepEqual(
      lines.map(
        (line) => validateEvent(parseLogLine(line) as unknown as Record<string, unknown>).testId,
      ),
      [record.testId, "second"],
    );
  });
});
