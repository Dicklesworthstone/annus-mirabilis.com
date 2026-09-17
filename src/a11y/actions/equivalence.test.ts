import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { buildActionCommand, hashCommand, hashOutputs } from "./commandBuilder.ts";
import { compareActionEquivalence } from "./equivalence.ts";
import { fixtureIntervalContract } from "./fixtures.ts";
import type { ActionExecutionResult } from "./types.ts";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: Action Equivalence Harness", () => {
  test("returns equivalent: true when visual and nonvisual executions match", () => {
    const inputs = { interval_lower: -1.0, interval_upper: 1.0, confidence_level: 0.95 };
    const command = buildActionCommand(fixtureIntervalContract, inputs);
    const cmdHash = hashCommand(command);

    const outputs = { interval_probability: 68.27, expected_particles: 341 };
    const outHash = hashOutputs(outputs);

    const visualExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "visual",
      command,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 5,
    };

    const equivalentExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "equivalent",
      command,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 5,
    };

    const result = compareActionEquivalence(visualExecution, equivalentExecution);

    expect(result.equivalent).toBe(true);
    expect(result.commandHashMatches).toBe(true);
    expect(result.outputsHashMatches).toBe(true);
    expect(result.snapshotVersionMatches).toBe(true);
    expect(result.mismatchReason).toBeUndefined();

    logger.log({
      testId: "equivalence-harness-match",
      beadId: "am-a11y-action-contracts-k75g",
      outcome: "passed",
      extra: {
        actionId: result.actionId,
        equivalent: result.equivalent,
      },
    });
  });

  test("detects command hash mismatch between affordances", () => {
    const cmd1 = buildActionCommand(fixtureIntervalContract, { interval_lower: -1.0, interval_upper: 1.0 });
    const cmd2 = buildActionCommand(fixtureIntervalContract, { interval_lower: -0.5, interval_upper: 1.0 });

    const outputs = { interval_probability: 68.27 };
    const outHash = hashOutputs(outputs);

    const visualExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "visual",
      command: cmd1,
      commandHash: hashCommand(cmd1),
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 5,
    };

    const equivalentExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "equivalent",
      command: cmd2,
      commandHash: hashCommand(cmd2),
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 5,
    };

    const result = compareActionEquivalence(visualExecution, equivalentExecution);

    expect(result.equivalent).toBe(false);
    expect(result.commandHashMatches).toBe(false);
    expect(result.mismatchReason).toContain("Command hash mismatch");
  });

  test("detects snapshotVersion mismatch between affordances", () => {
    const cmd = buildActionCommand(fixtureIntervalContract, { interval_lower: -1.0, interval_upper: 1.0 });
    const cmdHash = hashCommand(cmd);
    const outputs = { interval_probability: 68.27 };
    const outHash = hashOutputs(outputs);

    const visualExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "visual",
      command: cmd,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 5,
    };

    const equivalentExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "equivalent",
      command: cmd,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 6, // Divergence!
    };

    const result = compareActionEquivalence(visualExecution, equivalentExecution);

    expect(result.equivalent).toBe(false);
    expect(result.snapshotVersionMatches).toBe(false);
    expect(result.mismatchReason).toContain("Snapshot version mismatch");
  });
});
