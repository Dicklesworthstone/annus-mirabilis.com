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
    expect(diags[0]?.code).toBe("missing-action-contract");
  });

  test("strictly rejects drag-only equivalent affordances", () => {
    const diags = auditActionContract(fixtureDragOnlyForbiddenContract, "test-inst");
    const dragErrors = diags.filter((d) => d.code === "drag-only-action-forbidden");

    expect(dragErrors.length).toBeGreaterThan(0);
    expect(dragErrors[0]?.message).toContain("drag");
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
    expect(insufficientErrors[0]?.code).toBe("action-equivalent-insufficient");
  });

  /**
   * Three sites that a plant sweep could delete with this file and
   * contractKinds.test.ts fully green (am-muyh). Two carry codes no test
   * named at all; the third shares "drag-only-action-forbidden" with the site
   * above it, which is what let it hide. Each test below asserts the message
   * as well as the code, so it pins its own site rather than its code name.
   */
  test("rejects a contract with no visual affordance, and accepts one that declares it", () => {
    const noVisual: ActionContract = { ...fixtureIntervalContract, visualAffordance: "   " };
    const diags = auditActionContract(noVisual, "test-inst");
    const missing = diags.filter((d) => d.code === "missing-visual-affordance");

    expect(missing.length).toBe(1);
    expect(missing[0]?.path).toBe(
      `actionContracts.${fixtureIntervalContract.actionId}.visualAffordance`,
    );
    expect(missing[0]?.message).toContain("must declare visualAffordance");

    // Accept: the untouched fixture declares one, and nothing else changed.
    expect(
      auditActionContract(fixtureIntervalContract, "test-inst").filter(
        (d) => d.code === "missing-visual-affordance",
      ).length,
    ).toBe(0);
  });

  test("rejects a contract with no equivalent affordance, and says that rather than calling it insufficient", () => {
    const noEquivalent: ActionContract = {
      ...fixtureIntervalContract,
      equivalentAffordance: "",
    };
    const diags = auditActionContract(noEquivalent, "test-inst");
    const missing = diags.filter((d) => d.code === "missing-equivalent-affordance");

    expect(missing.length).toBe(1);
    expect(missing[0]?.message).toContain("accessible equivalentAffordance");
    // An absent equivalent is a different complaint from an inadequate one:
    // a reader with no equivalent at all must not be told it is merely weak.
    expect(diags.filter((d) => d.code === "action-equivalent-insufficient").length).toBe(0);

    expect(
      auditActionContract(fixtureIntervalContract, "test-inst").filter(
        (d) => d.code === "missing-equivalent-affordance",
      ).length,
    ).toBe(0);
  });

  test("rejects a drag affordance offered unchanged as its own accessible equivalent", () => {
    // Both affordances name a drag gesture and are identical, so the contract
    // offers a screen-reader user the mouse gesture it cannot perform. The
    // wording keeps an accessible modality ("type") so the neighbouring
    // drag-only site cannot fire instead: this fixture reaches exactly one.
    const sameBothWays = "Drag the boundary handle or type a value";
    const identical: ActionContract = {
      ...fixtureIntervalContract,
      visualAffordance: sameBothWays,
      equivalentAffordance: sameBothWays,
    };

    const diags = auditActionContract(identical, "test-inst");
    const dragErrors = diags.filter((d) => d.code === "drag-only-action-forbidden");

    expect(dragErrors.length).toBe(1);
    expect(dragErrors[0]?.message).toContain("identical visual and equivalent affordances");

    // Accept: the same drag gesture with a genuinely different equivalent.
    const distinct: ActionContract = {
      ...fixtureIntervalContract,
      visualAffordance: sameBothWays,
      equivalentAffordance: "Type lower and upper limit values into numeric stepper fields",
    };
    expect(
      auditActionContract(distinct, "test-inst").filter(
        (d) => d.code === "drag-only-action-forbidden",
      ).length,
    ).toBe(0);
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
    expect(outputErrors[0]?.message).toContain("nonexistent_output_id");
  });
});
