import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { retainEvidence, evidenceDir } from "./evidence.ts";
import { getLogger, newRunIdentity } from "./logger.ts";
import { parseLogLine } from "./schema.ts";

const SUITE = "test-logging";
const FIXTURES = path.join(process.cwd(), "src/testing/fixtures/test-logs/evidence-fixtures");
const STDOUT_FIXTURE = path.join(FIXTURES, "sample-stdout.txt");
const CONFIG_FIXTURE = path.join(FIXTURES, "sample-config.json");

test("retainEvidence copies fixture files without mutating the originals, and the failing event references the copies", async () => {
  const logRunId = newRunIdentity();
  const testId = "retain-evidence-basic";
  const originalStdoutBytes = readFileSync(STDOUT_FIXTURE);
  const originalConfigBytes = readFileSync(CONFIG_FIXTURE);
  const originalStdoutMtime = statSync(STDOUT_FIXTURE).mtimeMs;
  const originalConfigMtime = statSync(CONFIG_FIXTURE).mtimeMs;

  const { copied, missing } = await retainEvidence(
    { suite: SUITE, logRunId, testId, message: "captured failure output" },
    [STDOUT_FIXTURE, CONFIG_FIXTURE],
  );

  assert.equal(missing.length, 0);
  assert.equal(copied.length, 2);
  const expectedDir = evidenceDir(SUITE, logRunId, testId);
  assert.ok(copied.every((p) => p.startsWith(expectedDir)));

  assert.deepEqual(readFileSync(copied[0]!), originalStdoutBytes);
  assert.deepEqual(readFileSync(copied[1]!), originalConfigBytes);

  // The originals themselves must be untouched: same bytes, same mtime.
  assert.deepEqual(readFileSync(STDOUT_FIXTURE), originalStdoutBytes);
  assert.deepEqual(readFileSync(CONFIG_FIXTURE), originalConfigBytes);
  assert.equal(statSync(STDOUT_FIXTURE).mtimeMs, originalStdoutMtime);
  assert.equal(statSync(CONFIG_FIXTURE).mtimeMs, originalConfigMtime);

  const logger = getLogger(SUITE, logRunId);
  const lines = readFileSync(logger.filePath, "utf8").split("\n").filter((l) => l.length > 0);
  const event = lines.map(parseLogLine).find((e) => e.testId === testId);
  assert.ok(event, "expected a log event for retain-evidence-basic");
  assert.equal(event!.outcome, "failed");
  assert.deepEqual(event!.evidence?.files, copied);
  assert.equal(event!.message, "captured failure output");
});

test("a missing evidence source is reported in the event message and never skipped silently", async () => {
  const logRunId = newRunIdentity();
  const testId = "retain-evidence-missing-source";
  const missingSource = path.join(FIXTURES, "does-not-exist.txt");

  const { copied, missing } = await retainEvidence({ suite: SUITE, logRunId, testId }, [STDOUT_FIXTURE, missingSource]);

  assert.equal(copied.length, 1);
  assert.deepEqual(missing, [missingSource]);

  const logger = getLogger(SUITE, logRunId);
  const lines = readFileSync(logger.filePath, "utf8").split("\n").filter((l) => l.length > 0);
  const event = lines.map(parseLogLine).find((e) => e.testId === testId);
  assert.ok(event, "expected a log event for retain-evidence-missing-source");
  assert.match(event!.message ?? "", /Missing evidence source\(s\)/);
  assert.match(event!.message ?? "", /does-not-exist\.txt/);
});
