import { describe, expect, test } from "bun:test";
import { validateActionContract } from "../../accessibility/actionContracts.ts";
import { ExperimentValidationError } from "../../content/schemas/experiment.ts";
import { PASSAGE_ACTION_CONTRACTS } from "./passageActionContracts.ts";

describe("passage action contracts", () => {
  test("the declared copy, obstacle, and example actions pass the shared validator", () => {
    expect(PASSAGE_ACTION_CONTRACTS.map((c) => c.actionId).sort()).toEqual([
      "copy-passage-link",
      "name-obstacle",
      "open-example",
    ]);
  });

  test("planted negative: a drag-only copy action is refused", () => {
    expect(() =>
      validateActionContract({
        actionId: "copy-passage-link",
        family: "measurement",
        question: "How do I send someone this exact sentence?",
        inputs: ["anchor"],
        commandClass: "presentation-change",
        acceptedResult: { outputs: ["copiedUrl"], allowedStatuses: ["value"] },
        visualAffordance: "Drag the link onto the desktop",
        equivalentAffordance: "Drag the link onto the desktop",
        announcement: "Link copied.",
      }),
    ).toThrow(ExperimentValidationError);
    try {
      validateActionContract({
        actionId: "copy-passage-link",
        family: "measurement",
        question: "How do I send someone this exact sentence?",
        inputs: ["anchor"],
        commandClass: "presentation-change",
        acceptedResult: { outputs: ["copiedUrl"], allowedStatuses: ["value"] },
        visualAffordance: "Drag the link onto the desktop",
        equivalentAffordance: "Drag the link onto the desktop",
        announcement: "Link copied.",
      });
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("drag-only-action-forbidden");
    }
  });
});
