import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { buildActionCommand, hashCommand } from "./commandBuilder.ts";
import { auditActionContract } from "./contractAudit.ts";
import {
  ALL_FIXTURE_ACTION_CONTRACTS,
  fixtureAxisComponentContract,
  fixtureEventTableContract,
  fixtureObjectInclusionContract,
  fixtureRatioContract,
  fixtureSubexpressionContract,
} from "./fixtures.ts";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: All Six Action Contract Family Kinds", () => {
  test("validates all 6 family fixtures pass contract audit with zero diagnostics", () => {
    for (const contract of ALL_FIXTURE_ACTION_CONTRACTS) {
      const diags = auditActionContract(contract, "test-instrument");
      expect(diags.length).toBe(0);
    }

    logger.log({
      testId: "all-6-family-fixtures-pass-audit",
      beadId: "am-a11y-action-contracts-k75g",
      outcome: "passed",
      extra: {
        familyCount: ALL_FIXTURE_ACTION_CONTRACTS.length,
      },
    });
  });

  test("event-table family: validates simultaneity event selection contract", () => {
    const cmd = buildActionCommand(fixtureEventTableContract, {
      event_id: "event-clock-sync-01",
      reference_frame: "moving-k-prime",
    });
    const hash = hashCommand(cmd);

    expect(fixtureEventTableContract.family).toBe("event-table");
    expect(fixtureEventTableContract.commandClass).toBe("observer-change");
    expect(hash.length).toBe(64);
  });

  test("ratio family: validates frequency/energy ratio selection contract", () => {
    const cmd = buildActionCommand(fixtureRatioContract, {
      frequency_ratio: 0.5,
      spectral_band: "uv-band",
    });
    const hash = hashCommand(cmd);

    expect(fixtureRatioContract.family).toBe("ratio");
    expect(fixtureRatioContract.commandClass).toBe("physical-intervention");
    expect(hash.length).toBe(64);
  });

  test("axis-component family: validates field component selection contract", () => {
    const cmd = buildActionCommand(fixtureAxisComponentContract, {
      field_axis: "E_y",
      component_magnitude: 1500,
      frame_velocity: 0.6,
    });
    const hash = hashCommand(cmd);

    expect(fixtureAxisComponentContract.family).toBe("axis-component");
    expect(fixtureAxisComponentContract.commandClass).toBe("setup-change");
    expect(hash.length).toBe(64);
  });

  test("object-inclusion family: validates boundary toggle contract", () => {
    const cmd = buildActionCommand(fixtureObjectInclusionContract, {
      object_id: "emitter-cavity-left",
      included_in_boundary: true,
    });
    const hash = hashCommand(cmd);

    expect(fixtureObjectInclusionContract.family).toBe("object-inclusion");
    expect(fixtureObjectInclusionContract.commandClass).toBe("estimator-change");
    expect(hash.length).toBe(64);
  });

  test("subexpression family: validates algebraic step derivation contract", () => {
    const cmd = buildActionCommand(fixtureSubexpressionContract, {
      subexpression_id: "term-gamma-expansion",
      rule_id: "rule-taylor-series",
    });
    const hash = hashCommand(cmd);

    expect(fixtureSubexpressionContract.family).toBe("subexpression");
    expect(fixtureSubexpressionContract.commandClass).toBe("presentation-change");
    expect(hash.length).toBe(64);
  });
});
