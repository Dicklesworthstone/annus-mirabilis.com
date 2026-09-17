import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { parsePredictPromptId } from "../../content/ids.ts";
import { ExperimentValidationError, validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const FIXTURES_DIR = path.resolve(__dirname, "../../content/schemas/__fixtures__/experiment");

function loadValidExperiment(): any {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  return strictParse(yaml, "yaml");
}

describe("predictExemption & manifest validation (am-inst-predict-mode-ti7m)", () => {
  test("valid manifest with exactly 3 candidates and separatingAssumptions passes", () => {
    const raw = loadValidExperiment();
    expect(() => validateExperiment(raw)).not.toThrow();
  });

  test("manifest with fewer than 3 candidates fails with predict-candidates-count", () => {
    const raw = loadValidExperiment();
    raw.predictMode.prompts[0].candidates.pop(); // now 2 candidates

    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
    try {
      validateExperiment(raw);
    } catch (err: any) {
      expect(err.code).toBe("predict-candidates-count");
      expect(err.message).toContain("must provide exactly 3 plausible candidates");
    }
  });

  test("manifest with more than 3 candidates fails with predict-candidates-count", () => {
    const raw = loadValidExperiment();
    const extraCandidate = {
      ...raw.predictMode.prompts[0].candidates[0],
      id: "extra-candidate-4",
    };
    raw.predictMode.prompts[0].candidates.push(extraCandidate);

    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
    try {
      validateExperiment(raw);
    } catch (err: any) {
      expect(err.code).toBe("predict-candidates-count");
    }
  });

  test("candidate missing separatingAssumption fails naming instrument, prompt, and candidate", () => {
    const raw = loadValidExperiment();
    delete raw.predictMode.prompts[0].candidates[1].separatingAssumption;

    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
    try {
      validateExperiment(raw);
    } catch (err: any) {
      expect(err.code).toBe("missing-separating-assumption");
      expect(err.message).toContain("separatingAssumption");
      expect(err.message).toContain(raw.predictMode.prompts[0].candidates[1].id);
      expect(err.message).toContain(raw.predictMode.prompts[0].promptId);
    }
  });

  test("empty or whitespace separatingAssumption fails", () => {
    const raw = loadValidExperiment();
    raw.predictMode.prompts[0].candidates[0].separatingAssumption = "   ";

    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
    try {
      validateExperiment(raw);
    } catch (err: any) {
      expect(err.code).toBe("missing-separating-assumption");
    }
  });

  test("exempt predictMode without reason or with empty reason fails", () => {
    const raw = loadValidExperiment();
    raw.predictMode = { exempt: true, reason: "" };

    expect(() => validateExperiment(raw)).toThrow(ExperimentValidationError);
    try {
      validateExperiment(raw);
    } catch (err: any) {
      expect(err.code).toBe("missing-predict-exemption-reason");
      expect(err.message).toContain("predictMode exemption requires a non-empty reason");
    }
  });

  test("exempt predictMode with valid reason validates successfully", () => {
    const raw = loadValidExperiment();
    raw.predictMode = {
      exempt: true,
      reason:
        "An event ledger whose first action is itself the prediction requires no separate prompt.",
    };

    expect(() => validateExperiment(raw)).not.toThrow();
    const result = validateExperiment(raw);
    expect("exempt" in result.predictMode && result.predictMode.exempt).toBe(true);
  });

  test("prompt id grammar: follows <instrumentId>-predict-<slug>", () => {
    // Valid prompt IDs
    const validIds = [
      "sr-09-predict-approaching",
      "bm-01-predict-observation-interval",
      "bm-01-predict-viscosity",
      "me-02-predict-exact-versus-quadratic",
    ];
    for (const id of validIds) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.length).toBeGreaterThan(0);
      }
    }

    // Invalid prompt IDs
    const invalidIds = [
      "invalid-prompt-id",
      "sr-09-approaching",
      "predict-sr-09-something",
      "-predict-slug",
    ];
    for (const id of invalidIds) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(false);
    }
  });
});
