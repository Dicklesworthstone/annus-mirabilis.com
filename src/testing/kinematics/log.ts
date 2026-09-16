import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BEAD = "am-ref-kinematics-tjq";
let logRunId = "";
let dir = "";

export function kinematicsLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-kine`;
  dir = join("artifacts/test-logs/reference-kinematics");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export function logKinematics(entry: Record<string, unknown>): void {
  if (!logRunId) kinematicsLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: "reference-kinematics",
    logRunId,
    beadId: BEAD,
    owner: "kinematics",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logFailure(testId: string, payload: unknown): void {
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  writeFileSync(join(failDir, `${testId}.json`), JSON.stringify(payload, null, 2));
}
