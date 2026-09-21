import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  ACTION_FAMILIES,
  validateActionContract,
  validateActionContracts,
} from "../accessibility/actionContracts.ts";
import { ExperimentValidationError } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";

const ROOT = process.cwd();

describe("Accessibility Action Contracts (am-a11y-action-contracts-82f1)", () => {
  const validMe03Action = {
    actionId: "select-system-boundary",
    family: "energy-accounting",
    question: "When energy leaves a body, which system loses mass, and which does not?",
    inputs: ["boundary", "disposition"],
    commandClass: "measurement-change",
    acceptedResult: {
      outputs: ["energyChange", "massChange", "systemEnergyChange", "systemMassChange"],
      allowedStatuses: ["value", "not-applicable"],
    },
    visualAffordance: "Drag a boundary around objects",
    equivalentAffordance:
      "Select the objects included in the system and inspect energy crossing that boundary",
    announcement: "System boundary updated; energy and mass changes recalculated",
  };

  it("valid ME-03 action contract passes schema and accessible equivalence checks", () => {
    const contract = validateActionContract(validMe03Action);
    expect(contract.actionId).toBe("select-system-boundary");
    expect(contract.family).toBe("energy-accounting");
    expect(contract.visualAffordance).toBe("Drag a boundary around objects");
    expect(contract.equivalentAffordance).toBe(
      "Select the objects included in the system and inspect energy crossing that boundary",
    );
    expect(contract.announcement).toBe(
      "System boundary updated; energy and mass changes recalculated",
    );
    expect(contract.inputs).toEqual(["boundary", "disposition"]);
  });

  it("Planted Negative: an action with missing equivalent affordance fails", () => {
    const invalid = {
      ...validMe03Action,
      equivalentAffordance: "",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-equivalent-affordance");
    }
  });

  it("Planted Negative: a drag-only action where equivalent also requires drag fails (experiment.ts:291)", () => {
    const invalid = {
      ...validMe03Action,
      visualAffordance: "Drag a boundary around objects",
      equivalentAffordance: "Drag the bounding box on the screen",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("drag-only-action-forbidden");
    }
  });

  it("Planted Negative: identical visual drag affordance used as equivalent fails (experiment.ts:300)", () => {
    const invalid = {
      ...validMe03Action,
      visualAffordance: "Drag the slider to set temperature",
      equivalentAffordance: "Drag the slider to set temperature",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("drag-only-action-forbidden");
    }
  });

  it("Planted Negative: an action with missing assistive announcement fails", () => {
    const invalid = {
      ...validMe03Action,
      announcement: "",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-action-announcement");
    }
  });

  it("Planted Negative: insufficient non-actionable equivalent fails", () => {
    const invalid = {
      ...validMe03Action,
      equivalentAffordance: "Look at the diagram for results",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("action-equivalent-insufficient");
    }
  });

  it("Planted Negative: invalid action family is rejected", () => {
    const invalid = {
      ...validMe03Action,
      family: "invalid-family-name",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("invalid-action-family");
    }
  });

  it("Planted Negative: non-array inputs fails", () => {
    const invalid = {
      ...validMe03Action,
      inputs: "boundary",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-action-inputs");
    }
  });

  it("Planted Negative: blank input parameter element fails", () => {
    const invalid = {
      ...validMe03Action,
      inputs: ["boundary", "   "],
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("invalid-action-input");
    }
  });

  it("Planted Negative: non-kebab-case actionId fails", () => {
    const invalid = {
      ...validMe03Action,
      actionId: "Select System Boundary",
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("invalid-action-id");
    }
  });

  it("Planted Negative: invalid accepted result status fails", () => {
    const invalid = {
      ...validMe03Action,
      acceptedResult: {
        outputs: ["energyChange"],
        allowedStatuses: ["not-a-valid-scientific-status"],
      },
    };

    expect(() => validateActionContract(invalid)).toThrow(ExperimentValidationError);
    try {
      validateActionContract(invalid);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("invalid-accepted-result-status");
    }
  });

  it("Planted Negative: duplicate actionId in an actions list fails", () => {
    const list = [validMe03Action, { ...validMe03Action }];
    expect(() => validateActionContracts(list)).toThrow(ExperimentValidationError);
    try {
      validateActionContracts(list);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("duplicate-action-id");
    }
  });

  it("All experiment manifests in content/experiments declare valid accessible action contracts", () => {
    const dir = path.join(ROOT, "content/experiments");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") && !f.startsWith("tapes"));

    expect(files.length).toBeGreaterThanOrEqual(25);
    let totalActionsChecked = 0;

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const raw = strictParse(fs.readFileSync(fullPath, "utf8"), "yaml") as Record<string, unknown>;
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.actions)) continue;

      const validatedActions = validateActionContracts(raw.actions, `${file}.actions`);
      expect(validatedActions.length).toBeGreaterThan(0);
      totalActionsChecked += validatedActions.length;

      for (const action of validatedActions) {
        expect(ACTION_FAMILIES).toContain(action.family);
        expect(action.visualAffordance.length).toBeGreaterThan(5);
        expect(action.equivalentAffordance.length).toBeGreaterThan(5);
        expect(action.announcement.length).toBeGreaterThan(5);
      }
    }

    expect(totalActionsChecked).toBeGreaterThanOrEqual(30);
  });
});
