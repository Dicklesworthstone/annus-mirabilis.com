import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkAccessibleEquivalence,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";
import { ExperimentValidationError } from "../../content/schemas/experiment.ts";

describe("Interactions: Command Classes & Accessible Action Contracts (am-inst-interaction-families-m2ps)", () => {
  it("validates that all six interaction families enforce accessible equivalence", () => {
    const families = [
      {
        family: "clock-event",
        actionId: "select-clock-events",
        commandClass: "measurement-change",
        vis: "Select event points on space-time diagram",
        eq: "Choose named events from table and inspect simultaneity in frame S'",
      },
      {
        family: "radiation-entropy",
        actionId: "resize-radiation-volume",
        commandClass: "setup-change",
        vis: "Drag volume partition boundary slider",
        eq: "Enter volume ratio or select half, same, or double preset with fixed energy and band",
      },
      {
        family: "fields-boosts",
        actionId: "edit-field-component",
        commandClass: "observer-change",
        vis: "Rotate field vector arrow and drag coefficient handles",
        eq: "Select component and enter signed magnitude, then inspect transformed components",
      },
      {
        family: "energy-accounting",
        actionId: "select-system-boundary",
        commandClass: "measurement-change",
        vis: "Drag a boundary around objects",
        eq: "Select the objects included in the system and inspect energy crossing that boundary",
      },
      {
        family: "derivations",
        actionId: "step-derivation",
        commandClass: "presentation-change",
        vis: "Highlight clickable equation subexpressions",
        eq: "Select named subexpression, read role, and trigger justified derivation step",
      },
      {
        family: "probability-diffusion",
        actionId: "select-observation-interval",
        commandClass: "measurement-change",
        vis: "Drag interval bracket handles on time axis",
        eq: "Enter observation interval or select standard preset step",
      },
    ];

    for (const item of families) {
      const contract = {
        actionId: item.actionId,
        family: item.family,
        question: `Test question for ${item.family}?`,
        inputs: ["param1"],
        commandClass: item.commandClass,
        acceptedResult: {
          outputs: ["output1"],
          allowedStatuses: ["value"],
        },
        visualAffordance: item.vis,
        equivalentAffordance: item.eq,
        announcement: `Live announcement for ${item.family}`,
      };

      const validated = validateActionContract(contract);
      assert.equal(validated.family, item.family);
      assert.equal(validated.commandClass, item.commandClass);
      checkAccessibleEquivalence(validated);
    }
  });

  it("Planted Negative: Drag-only action in any family without accessible alternative is strictly rejected", () => {
    const dragOnlyContract = {
      actionId: "drag-only-partition",
      family: "radiation-entropy",
      question: "How does entropy change when dragging the partition?",
      inputs: ["volumeRatio"],
      commandClass: "setup-change",
      acceptedResult: {
        outputs: ["entropyDifference"],
        allowedStatuses: ["value"],
      },
      visualAffordance: "Drag the partition slider",
      equivalentAffordance: "Drag the pointer across the canvas", // Drag-only equivalent!
      announcement: "Partition dragged",
    };

    assert.throws(
      () => validateActionContract(dragOnlyContract),
      (err: unknown) => {
        assert.ok(err instanceof ExperimentValidationError);
        assert.equal(err.code, "drag-only-action-forbidden");
        return true;
      },
    );
  });
});
