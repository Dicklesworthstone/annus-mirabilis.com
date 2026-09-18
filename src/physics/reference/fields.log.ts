import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BEAD_ID = "am-ref-fields-6l9";
export const SUITE = "reference-fields";

let logRunId = "";
let dir = "";

export function fieldsLogStart(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  logRunId = `${stamp}-fields`;
  dir = join(process.cwd(), "artifacts/test-logs/reference-fields");
  mkdirSync(dir, { recursive: true });
  return logRunId;
}

export interface FieldsLogEntry {
  testId: string;
  scenarioId?: string;
  owner?: string;
  constantSetId?: string;
  beta?: number;
  unitSystem?: "si" | "gaussian";
  quantityId?: string;
  frame?: string;
  resultStatus: string;
  expected?: unknown;
  actual?: unknown;
  tolerance?: unknown;
  comparisonKind?: string;
  outcome: "passed" | "failed";
  durationMs: number;
  message: string;
  extra?: Record<string, unknown>;
}

export function logField(entry: FieldsLogEntry): void {
  if (!logRunId) fieldsLogStart();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: SUITE,
    logRunId,
    beadId: BEAD_ID,
    owner: entry.owner ?? "fields",
    ...entry,
  });
  appendFileSync(join(dir, `${logRunId}.jsonl`), `${line}\n`);
}

export function logFieldFailure(
  testId: string,
  payload: unknown,
  reproductionCommand?: string,
): void {
  if (!logRunId) fieldsLogStart();
  const failDir = join(dir, logRunId, "failures");
  mkdirSync(failDir, { recursive: true });
  const data = {
    testId,
    reproductionCommand:
      reproductionCommand ??
      "bun test src/physics/reference/fields.*.test.ts src/testing/fields.*.test.ts",
    payload,
  };
  writeFileSync(
    join(failDir, `${testId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`),
    JSON.stringify(data, null, 2),
  );
}
