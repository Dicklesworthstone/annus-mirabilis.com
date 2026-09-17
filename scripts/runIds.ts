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

import { newRunIdentity } from "../src/testing/log/logger.ts";

export function newLogRunId(): string {
  return newRunIdentity();
}

export function newToolRunId(): string {
  return newRunIdentity();
}
