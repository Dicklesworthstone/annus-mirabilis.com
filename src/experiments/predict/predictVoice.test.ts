import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { checkVoice, type VoiceFinding } from "../../content/checks/voice/index.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { ME02_PREDICT_PROMPT } from "../me02/definition.ts";

function hasError(findings: readonly VoiceFinding[], rule?: string): boolean {
  return findings.some((f) => f.severity === "error" && (rule === undefined || f.rule === rule));
}

describe("predictVoice (am-inst-predict-mode-ti7m)", () => {
  describe("planted negatives", () => {
    test('a planted "Wrong!" fixture fails theater in task-feedback context', () => {
      const text = "Wrong! That is outside the model's range.";
      const findings = checkVoice(text, { context: "task-feedback" });
      expect(hasError(findings, "theater")).toBe(true);
    });

    test('a planted "You guessed wrong" inside a separatingAssumption fails theater', () => {
      const text = "You guessed wrong about the drift direction.";
      const findings = checkVoice(text, { context: "task-feedback" });
      expect(hasError(findings, "theater")).toBe(true);
    });

    test('planted scoring language "Incorrect" or "streak" fails', () => {
      const text = "Incorrect prediction. Your streak is broken.";
      const findings = checkVoice(text, { context: "task-feedback" });
      expect(hasError(findings)).toBe(true);
    });
  });

  describe("production predict strings pass voice lint", () => {
    test("adjudication statements contain no scoring language", () => {
      const statements = [
        "This prediction cannot be scored here: nothing was recorded to compare.",
        "This prediction cannot be scored here: a freehand sketch is not compared with the model.",
        "This prediction cannot be scored here: the model does not name a supported candidate for this prompt.",
        "This is the relation the model supports.",
        "This is not the relation the model supports.",
        "This prediction cannot be scored here: no supported direction and shape are named for this prompt.",
        "This prediction cannot be scored here: no named values are given to compare.",
        "The typed values match the model's values.",
        "The typed values are close to the model's values.",
        "The typed values are not close to the model's values.",
      ];

      for (const statement of statements) {
        const findings = checkVoice(statement, { context: "task-feedback" });
        expect(hasError(findings)).toBe(false);
      }
    });

    test("predict panel and export preview copy contain no scoring language", () => {
      const uiCopy = [
        "Predict before the numbers",
        "Skip prediction",
        "I have one in mind",
        "Prediction recorded. Apply settings to see what the model does. The recorded choice cannot be edited after that.",
        "Nothing was stored. Apply settings to see what the model does.",
        "Nothing was stored. Compare the one you have in mind with the result.",
        "The result appears when you choose, say you have one in mind, or skip.",
        "A later guess, marked as after the result was shown",
        "Recorded after the result was shown. The original prediction is unchanged.",
        "Show me the reasoning",
        "kept to yourself, not recorded",
        "Predictions are omitted from this export.",
      ];

      for (const str of uiCopy) {
        const findings = checkVoice(str, { context: "task-feedback" });
        expect(hasError(findings)).toBe(false);
      }
    });

    test("ME-02 prompt candidates and separating assumptions pass voice lint", () => {
      expect(hasError(checkVoice(ME02_PREDICT_PROMPT.question, { context: "task-feedback" }))).toBe(
        false,
      );
      for (const candidate of ME02_PREDICT_PROMPT.candidates) {
        expect(hasError(checkVoice(candidate.label, { context: "task-feedback" }))).toBe(false);
        expect(hasError(checkVoice(candidate.description, { context: "task-feedback" }))).toBe(
          false,
        );
        expect(
          hasError(checkVoice(candidate.separatingAssumption, { context: "task-feedback" })),
        ).toBe(false);
      }
    });

    test("BM-01 authored predict prompts and separating assumptions pass voice lint", () => {
      const yamlPath = path.resolve(process.cwd(), "content/experiments/bm-01.yaml");
      const raw = strictParse(fs.readFileSync(yamlPath, "utf8"), "yaml") as {
        predictMode: {
          prompts: Array<{
            question: string;
            candidates: Array<{
              label: string;
              description: string;
              separatingAssumption: string;
            }>;
          }>;
        };
      };

      for (const prompt of raw.predictMode.prompts) {
        expect(hasError(checkVoice(prompt.question, { context: "task-feedback" }))).toBe(false);
        for (const candidate of prompt.candidates) {
          expect(hasError(checkVoice(candidate.label, { context: "task-feedback" }))).toBe(false);
          expect(hasError(checkVoice(candidate.description, { context: "task-feedback" }))).toBe(
            false,
          );
          const findings = checkVoice(candidate.separatingAssumption, { context: "task-feedback" });
          expect(hasError(findings)).toBe(false);
        }
      }
    });
  });
});
