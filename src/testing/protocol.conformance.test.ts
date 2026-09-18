/**
 * Tests for Protocol Conformance Suite against echoWorker.
 * Specification: am-rt-worker-protocol-gaq acceptance criterion 7.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runProtocolConformance } from "../workers/protocol/conformance.ts";
import { createInProcessEchoWorker } from "./protocol-fixtures/echoWorker.ts";

describe("protocol.conformance", () => {
  it("runs full conformance suite against echoWorker and passes all 12 steps", async () => {
    const report = await runProtocolConformance(() => createInProcessEchoWorker(), {
      verbose: false,
    });

    assert.equal(
      report.allPassed,
      true,
      `Conformance suite failed on steps: ${report.steps
        .filter((s) => !s.passed)
        .map((s) => `${s.testId}: ${s.message}`)
        .join("; ")}`,
    );

    assert.equal(report.failedSteps, 0);
    assert.ok(report.totalSteps >= 12, `Expected at least 12 steps, got ${report.totalSteps}`);

    for (const step of report.steps) {
      assert.equal(step.passed, true, `Step ${step.testId} failed: ${step.message}`);
    }
  });
});
