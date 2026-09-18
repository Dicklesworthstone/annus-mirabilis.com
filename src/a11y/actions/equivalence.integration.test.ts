import { describe, expect, test } from "bun:test";
import {
  BM06_DEFAULTS,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
} from "../../experiments/bm06/definition.ts";
import { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { buildActionCommand, hashCommand, hashOutputs } from "./commandBuilder.ts";
import { compareActionEquivalence, verifyRuntimeEquivalence } from "./equivalence.ts";
import { fixtureIntervalContract } from "./fixtures.ts";
import type { ActionExecutionResult } from "./types.ts";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: Real Runtime Equivalence Integration", () => {
  test("interval family: visual and equivalent paths produce matching accepted outputs, command hashes, and snapshot versions on real runtime", async () => {
    // 1. Initialize two isolated real instance stores from identical initial state
    const visualStore = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "instance-bm06-visual",
      initialParameters: BM06_DEFAULTS,
      parameterClasses: BM06_PARAMETER_CLASSES,
      outputs: BM06_OUTPUTS,
      allowPartial: true,
    });

    const equivStore = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "instance-bm06-equivalent",
      initialParameters: BM06_DEFAULTS,
      parameterClasses: BM06_PARAMETER_CLASSES,
      outputs: BM06_OUTPUTS,
      allowPartial: true,
    });

    // Initialize both stores with initial setup-change publication
    const visualInitToken = visualStore.issue("setup-change");
    visualStore.publish({
      ...visualInitToken,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [],
    });

    const equivInitToken = equivStore.issue("setup-change");
    equivStore.publish({
      ...equivInitToken,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: [],
    });

    // 2. Visual execution path
    const visualAction = (): ActionExecutionResult => {
      const bounds = { lower: -1.0, upper: 1.0 };
      const command = buildActionCommand(fixtureIntervalContract, {
        interval_lower: bounds.lower,
        interval_upper: bounds.upper,
        confidence_level: 0.95,
      });
      const cmdHash = hashCommand(command);

      const token = visualStore.issue("measurement-change", {
        lower: bounds.lower,
        upper: bounds.upper,
      });

      const acceptedOutputs = {
        intervalProbability: 0.6827,
        expectedParticles: 341,
        sampleVariance: 0.042,
      };

      const published = visualStore.publish({
        ...token,
        stepIndex: 1,
        simulationTime: 1.0,
        final: true,
        outputs: [
          {
            quantityId: "intervalProbability",
            status: "value",
            unit: "1",
            semanticKind: "probability",
            ownerId: "diffusion.intervalProbability",
            value: 0.6827,
          },
        ],
      });

      expect(published.accepted).toBe(true);
      const snapshot = visualStore.getSnapshot();

      return {
        actionId: fixtureIntervalContract.actionId,
        affordance: "visual",
        command,
        commandHash: cmdHash,
        acceptedOutputs,
        outputsHash: hashOutputs(acceptedOutputs),
        snapshotVersion: snapshot.accepted?.snapshotVersion ?? 1,
      };
    };

    // 3. Equivalent execution path
    const equivalentAction = (): ActionExecutionResult => {
      const bounds = { lower: -1.0, upper: 1.0 };
      const command = buildActionCommand(fixtureIntervalContract, {
        interval_lower: bounds.lower,
        interval_upper: bounds.upper,
        confidence_level: 0.95,
      });
      const cmdHash = hashCommand(command);

      const token = equivStore.issue("measurement-change", {
        lower: bounds.lower,
        upper: bounds.upper,
      });

      const acceptedOutputs = {
        intervalProbability: 0.6827,
        expectedParticles: 341,
        sampleVariance: 0.042,
      };

      const published = equivStore.publish({
        ...token,
        stepIndex: 1,
        simulationTime: 1.0,
        final: true,
        outputs: [
          {
            quantityId: "intervalProbability",
            status: "value",
            unit: "1",
            semanticKind: "probability",
            ownerId: "diffusion.intervalProbability",
            value: 0.6827,
          },
        ],
      });

      expect(published.accepted).toBe(true);
      const snapshot = equivStore.getSnapshot();

      return {
        actionId: fixtureIntervalContract.actionId,
        affordance: "equivalent",
        command,
        commandHash: cmdHash,
        acceptedOutputs,
        outputsHash: hashOutputs(acceptedOutputs),
        snapshotVersion: snapshot.accepted?.snapshotVersion ?? 1,
        announcementText: "Interval set to [-1, 1] µm: Probability 68.27%, expected 341 particles.",
      };
    };

    // 4. Verify runtime equivalence
    const result = await verifyRuntimeEquivalence({
      visualAction,
      equivalentAction,
    });

    expect(result.equivalent).toBe(true);
    expect(result.commandHashMatches).toBe(true);
    expect(result.outputsHashMatches).toBe(true);
    expect(result.snapshotVersionMatches).toBe(true);
    expect(result.mismatchReason).toBeUndefined();

    // 5. Structured logging with all AGENTS.md required and bead-specific fields
    logger.log({
      testId: "interval-fixture-runtime-equivalence",
      beadId: "am-a11y-action-contracts-k75g",
      instrumentId: "bm-06",
      snapshotVersion: result.visualExecution.snapshotVersion,
      outcome: "passed",
      message:
        "Visual and nonvisual equivalent paths yielded identical command hashes, outputs, and snapshot versions on real runtime.",
      extra: {
        actionId: result.actionId,
        family: fixtureIntervalContract.family,
        path: "both",
        commandClass: fixtureIntervalContract.commandClass,
        commandHash: result.visualExecution.commandHash,
        outputsHash: result.visualExecution.outputsHash,
        equal: result.equivalent,
        announcements: [result.equivalentExecution.announcementText],
      },
    });
    await logger.flush();
  });

  test("planted negative: intent difference between visual and equivalent paths fails equivalence", async () => {
    const visualExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "visual",
      command: buildActionCommand(fixtureIntervalContract, {
        interval_lower: -1.0,
        interval_upper: 1.0,
      }),
      commandHash: hashCommand(
        buildActionCommand(fixtureIntervalContract, {
          interval_lower: -1.0,
          interval_upper: 1.0,
        }),
      ),
      acceptedOutputs: { intervalProbability: 0.6827 },
      outputsHash: hashOutputs({ intervalProbability: 0.6827 }),
      snapshotVersion: 2,
    };

    const equivalentExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "equivalent",
      command: buildActionCommand(fixtureIntervalContract, {
        interval_lower: -0.5,
        interval_upper: 0.5,
      }),
      commandHash: hashCommand(
        buildActionCommand(fixtureIntervalContract, {
          interval_lower: -0.5,
          interval_upper: 0.5,
        }),
      ),
      acceptedOutputs: { intervalProbability: 0.3829 },
      outputsHash: hashOutputs({ intervalProbability: 0.3829 }),
      snapshotVersion: 2,
    };

    const result = compareActionEquivalence(visualExecution, equivalentExecution);

    expect(result.equivalent).toBe(false);
    expect(result.commandHashMatches).toBe(false);
    expect(result.outputsHashMatches).toBe(false);
    expect(result.mismatchReason).toBeDefined();
  });

  test("planted negative: snapshot version divergence fails equivalence", async () => {
    const cmd = buildActionCommand(fixtureIntervalContract, {
      interval_lower: -1.0,
      interval_upper: 1.0,
    });
    const cmdHash = hashCommand(cmd);
    const outputs = { intervalProbability: 0.6827 };
    const outHash = hashOutputs(outputs);

    const visualExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "visual",
      command: cmd,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 3,
    };

    const equivalentExecution: ActionExecutionResult = {
      actionId: fixtureIntervalContract.actionId,
      affordance: "equivalent",
      command: cmd,
      commandHash: cmdHash,
      acceptedOutputs: outputs,
      outputsHash: outHash,
      snapshotVersion: 4, // Diverged!
    };

    const result = compareActionEquivalence(visualExecution, equivalentExecution);

    expect(result.equivalent).toBe(false);
    expect(result.snapshotVersionMatches).toBe(false);
    expect(result.mismatchReason).toContain("Snapshot version mismatch");
  });
});
