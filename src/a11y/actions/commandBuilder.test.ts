import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { buildActionCommand, hashCommand, hashOutputs } from "./commandBuilder.ts";
import { fixtureIntervalContract, fixtureRatioContract } from "./fixtures.ts";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: Single Command Builder & Hasher", () => {
  test("yields identical command hashes for visual and equivalent affordances from same intent", () => {
    // Visual action: dragging handles to [-0.8, 0.8]
    const visualInputs = {
      interval_lower: -0.8,
      interval_upper: 0.8,
      confidence_level: 0.95,
      instanceId: "inst-visual-101", // Should be ignored in hash
    };
    const visualCmd = buildActionCommand(fixtureIntervalContract, visualInputs);
    const visualHash = hashCommand(visualCmd);

    // Nonvisual equivalent: typing -0.8 and 0.8 into inputs
    const equivalentInputs = {
      confidence_level: 0.95, // Key order differs
      interval_upper: 0.8,
      interval_lower: -0.8,
      instanceId: "inst-equiv-202", // Different instance ID
    };
    const equivCmd = buildActionCommand(fixtureIntervalContract, equivalentInputs);
    const equivHash = hashCommand(equivCmd);

    expect(visualHash).toBe(equivHash);
    expect(visualCmd.commandClass).toBe(fixtureIntervalContract.commandClass);
    expect(equivCmd.commandClass).toBe(fixtureIntervalContract.commandClass);

    logger.log({
      testId: "commandBuilder-visual-equiv-hash-identical",
      beadId: "am-a11y-action-contracts-k75g",
      outcome: "passed",
      extra: {
        commandHash: visualHash,
        commandClass: visualCmd.commandClass,
      },
    });
  });

  test("produces different command hashes for different user intents", () => {
    const cmd1 = buildActionCommand(fixtureIntervalContract, {
      interval_lower: -0.5,
      interval_upper: 0.5,
      confidence_level: 0.95,
    });
    const cmd2 = buildActionCommand(fixtureIntervalContract, {
      interval_lower: -0.8,
      interval_upper: 0.8,
      confidence_level: 0.95,
    });

    const hash1 = hashCommand(cmd1);
    const hash2 = hashCommand(cmd2);

    expect(hash1).not.toBe(hash2);
  });

  test("preserves commandClass as declared in action contract", () => {
    const ratioCmd = buildActionCommand(fixtureRatioContract, {
      frequency_ratio: 2.0,
      spectral_band: "visible",
    });

    expect(ratioCmd.commandClass).toBe("physical-intervention");
  });

  test("computes deterministic outputs hashes", () => {
    const outputs1 = { interval_probability: 68.2, expected_particles: 341 };
    const outputs2 = { expected_particles: 341, interval_probability: 68.2 };

    expect(hashOutputs(outputs1)).toBe(hashOutputs(outputs2));
  });
});
