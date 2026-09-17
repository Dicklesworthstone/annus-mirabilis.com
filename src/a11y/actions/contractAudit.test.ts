import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { auditActionContract, auditInstrumentManifestContracts } from "./contractAudit.ts";
import {
  fixtureDragOnlyForbiddenContract,
  fixtureIntervalContract,
  fixtureMissingAnnouncementContract,
} from "./fixtures.ts";
import type { ActionContract } from "./types.ts";

const logger = getLogger("a11y-actions");

describe("am-a11y-action-contracts-k75g: Contract Audit Engine", () => {
  test("passes valid instrument action contracts with declared outputs", () => {
    const manifest = {
      id: "bm-06",
      hasInteractiveControls: true,
      outputs: [
        { id: "interval_probability" },
        { id: "expected_particles" },
        { id: "sample_variance" },
      ],
      actionContracts: [fixtureIntervalContract],
    };

    const diags = auditInstrumentManifestContracts(manifest);
    expect(diags.length).toBe(0);

    logger.log({
      testId: "contractAudit-valid-manifest-pass",
      beadId: "am-a11y-action-contracts-k75g",
      outcome: "passed",
      extra: { instrumentId: manifest.id },
    });
  });

  test("rejects missing action contracts on interactive instruments", () => {
    const manifest = {
      id: "bm-01",
      hasInteractiveControls: true,
      actionContracts: [],
    };

    const diags = auditInstrumentManifestContracts(manifest);
    expect(diags.length).toBe(1);
    expect(diags[0]!.code).toBe("missing-action-contract");
  });

  test("strictly rejects drag-only equivalent affordances", () => {
    const diags = auditActionContract(fixtureDragOnlyForbiddenContract, "test-inst");
    const dragErrors = diags.filter((d) => d.code === "drag-only-action-forbidden");

    expect(dragErrors.length).toBeGreaterThan(0);
    expect(dragErrors[0]!.message).toContain("drag");
  });

  test("strictly rejects contracts missing assistive announcements", () => {
    const diags = auditActionContract(fixtureMissingAnnouncementContract, "test-inst");
    const annErrors = diags.filter((d) => d.code === "missing-action-announcement");

    expect(annErrors.length).toBe(1);
  });

  test("rejects insufficient equivalent affordance lacking accessible modality keywords", () => {
    const insufficientContract: ActionContract = {
      actionId: "insufficient-test",
      family: "interval",
      question: "Test question",
      inputs: ["x"],
      commandClass: "setup-change",
      acceptedResult: { outputs: ["y"], allowedStatuses: ["value"] },
      visualAffordance: "View diagram",
      equivalentAffordance: "Experience the visual beauty of the curve", // Non-actionable!
      announcement: "Announced",
    };

    const diags = auditActionContract(insufficientContract, "test-inst");
    const insufficientErrors = diags.filter((d) => d.code === "action-equivalent-insufficient");

    expect(insufficientErrors.length).toBe(1);
    expect(insufficientErrors[0]!.code).toBe("action-equivalent-insufficient");
  });

  test("rejects result outputs not declared in instrument manifest", () => {
    const undeclaredOutputContract: ActionContract = {
      ...fixtureIntervalContract,
      acceptedResult: {
        outputs: ["nonexistent_output_id"],
        allowedStatuses: ["value"],
      },
    };

    const declaredOutputs = new Set(["interval_probability"]);
    const diags = auditActionContract(undeclaredOutputContract, "bm-06", declaredOutputs);
    const outputErrors = diags.filter((d) => d.code === "result-outputs-mismatch");

    expect(outputErrors.length).toBe(1);
    expect(outputErrors[0]!.message).toContain("nonexistent_output_id");
  });
});
