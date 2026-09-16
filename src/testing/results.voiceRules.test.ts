import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { statusEnumIds } from "../experiments/results/ids.ts";
import { defineRefusalRegistry, refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface VoiceRulesCheckResult {
  readonly ok: boolean;
  readonly missingHyphenatedIds: readonly string[];
  readonly singleWordIds: readonly string[];
  readonly checkedCount: number;
}

/**
 * Checks a voice-rules YAML string for completeness against registered statusEnumIds.
 * Multi-word hyphenated IDs MUST be explicitly listed in status-enum-leak.
 * Single-word IDs are tracked for informational purposes.
 */
export function checkVoiceRulesCompleteness(
  yamlContent: string,
  enumIds: readonly string[],
): VoiceRulesCheckResult {
  const missingHyphenated: string[] = [];
  const singleWord: string[] = [];

  for (const id of enumIds) {
    if (id === "value") continue; // "value" is a general word and not a leak enum

    if (!id.includes("-")) {
      singleWord.push(id);
    }

    // Check if ID is listed in the YAML content
    const isPresent =
      yamlContent.includes(`"${id}"`) ||
      yamlContent.includes(`'${id}'`) ||
      yamlContent.includes(`- ${id}`);
    if (!isPresent && id.includes("-")) {
      missingHyphenated.push(id);
    }
  }

  return {
    ok: missingHyphenated.length === 0,
    missingHyphenatedIds: missingHyphenated,
    singleWordIds: singleWord,
    checkedCount: enumIds.length,
  };
}

describe("results.voiceRules: Leak-List Completeness Check (Requirement 12)", () => {
  it("checks real content/editorial/voice-rules.yaml if present, or skips if absent", (t) => {
    const realRulesPath = resolve(ROOT, "content/editorial/voice-rules.yaml");
    if (!existsSync(realRulesPath)) {
      t.skip("voice-rules.yaml not present (owned by am-edit-voice-lint-trmf)");
      return;
    }
    const content = readFileSync(realRulesPath, "utf-8");
    const result = checkVoiceRulesCompleteness(content, statusEnumIds);
    assert.deepEqual(
      result.missingHyphenatedIds,
      [],
      `voice-rules.yaml missing enum leak IDs: ${result.missingHyphenatedIds.join(", ")}`,
    );
  });

  it("fails and names missing ID when a fixture rules file is missing 'ftcs-unstable'", () => {
    // Fixture YAML with everything except ftcs-unstable
    const allExceptFtcs = statusEnumIds
      .filter((id) => id !== "ftcs-unstable")
      .map((id) => `  - "${id}"`)
      .join("\n");
    const fixtureYaml = `rules:\n  status-enum-leak:\n    forbidden:\n${allExceptFtcs}\n`;

    const result = checkVoiceRulesCompleteness(fixtureYaml, statusEnumIds);
    assert.equal(result.ok, false);
    assert.ok(result.missingHyphenatedIds.includes("ftcs-unstable"));
  });

  it("fails and names missing ID when a fixture rules file is missing 'divergent'", () => {
    // Divergent is single-word so let's verify singleWordIds tracking
    const result = checkVoiceRulesCompleteness("rules:\n", statusEnumIds);
    assert.ok(result.singleWordIds.includes("divergent"));
    assert.ok(result.singleWordIds.includes("underdetermined"));
    assert.ok(result.singleWordIds.includes("cancelled"));
    assert.ok(result.singleWordIds.includes("superseded"));
  });

  it("fails when a newly registered refusal code is not in the rules file until listed", () => {
    const _newRegistry = defineRefusalRegistry({
      ...refusalCodeRegistry,
      "quantum-discontinuity-detected": {
        domainKind: "model",
        message: "A discontinuity is detected.",
        repair: "Use continuous model.",
      },
    });
    const newEnumIds = [...new Set([...statusEnumIds, "quantum-discontinuity-detected"])].sort();

    // YAML missing the new code
    const existingYaml = statusEnumIds.map((id) => `  - "${id}"`).join("\n");
    const res1 = checkVoiceRulesCompleteness(existingYaml, newEnumIds);
    assert.equal(res1.ok, false);
    assert.ok(res1.missingHyphenatedIds.includes("quantum-discontinuity-detected"));

    // YAML with the new code added
    const updatedYaml = `${existingYaml}\n  - "quantum-discontinuity-detected"`;
    const res2 = checkVoiceRulesCompleteness(updatedYaml, newEnumIds);
    assert.equal(res2.ok, true);
    assert.deepEqual(res2.missingHyphenatedIds, []);
  });
});
