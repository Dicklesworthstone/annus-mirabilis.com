/**
 * Run identifiers for tool and test-suite executions.
 *
 * Two kinds of run get their own field name so they are never confused with
 * `runId`, which AGENTS.md "Structured logs" reserves for an experiment
 * realization under the runtime contract:
 * - `logRunId` identifies one execution of a test suite (for example the
 *   browser acceptance harness in scripts/e2e-paper-vertical-slices.ts).
 * - `toolRunId` identifies one execution of a pipeline or tool script (for
 *   example scripts/verified-production-deploy.ts or
 *   scripts/smoke-test-deployment.ts).
 *
 * Both use the same timestamp-plus-hex format as `newLogRunId` in
 * src/testing/perfProfiles.ts so directory names sort chronologically.
 */

function newRunStamp(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const hex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${stamp}-${hex}`;
}

export function newLogRunId(): string {
  return newRunStamp();
}

export function newToolRunId(): string {
  return newRunStamp();
}
