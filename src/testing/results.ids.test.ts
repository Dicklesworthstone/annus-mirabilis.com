import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  executionOutcomeIds,
  outputStatusIds,
  refusalCodeIds,
  resultIds,
  statusEnumIds,
} from "../experiments/results/ids.ts";
import { executionOutcomeRegistry } from "../experiments/results/outcomes.ts";
import { defineRefusalRegistry, refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import { outputStatusRegistry } from "../experiments/results/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("results.ids: Frozen ID Exports & Registry Reflection", () => {
  it("outputStatusIds equals the seven output statuses", () => {
    const expected = [
      "analytic-limit",
      "divergent",
      "not-applicable",
      "outside-domain",
      "symbolic",
      "underdetermined",
      "value",
    ];
    assert.deepEqual(outputStatusIds, expected);
    assert.equal(outputStatusIds.length, 7);
    assert.deepEqual(outputStatusIds, Object.keys(outputStatusRegistry).sort());
  });

  it("executionOutcomeIds equals the twelve execution outcomes", () => {
    const expected = [
      "artifact-mismatch",
      "budget-exhausted",
      "cancelled",
      "context-lost",
      "environment-unsupported",
      "invariant-violation",
      "malformed-response",
      "missing-artifact",
      "protocol-mismatch",
      "superseded",
      "transport-error",
      "worker-crashed",
    ];
    assert.deepEqual(executionOutcomeIds, expected);
    assert.equal(executionOutcomeIds.length, 12);
    assert.deepEqual(executionOutcomeIds, Object.keys(executionOutcomeRegistry).sort());
  });

  it("refusalCodeIds reflects all keys of refusalCodeRegistry", () => {
    assert.deepEqual(refusalCodeIds, Object.keys(refusalCodeRegistry).sort());
    assert.ok(refusalCodeIds.includes("ftcs-unstable"));
    assert.ok(refusalCodeIds.includes("superluminal-observer"));
    assert.ok(refusalCodeIds.includes("outside-wien-domain"));
  });

  it("statusEnumIds is the sorted union of statuses, outcomes, and refusal codes with no duplicates", () => {
    const expected = [
      ...new Set([...outputStatusIds, ...executionOutcomeIds, ...refusalCodeIds]),
    ].sort();
    assert.deepEqual(statusEnumIds, expected);
    assert.ok(statusEnumIds.includes("divergent"));
    assert.ok(statusEnumIds.includes("budget-exhausted"));
    assert.ok(statusEnumIds.includes("ftcs-unstable"));
  });

  it("dynamically registered refusal codes are reflected in resultIds(newRegistry)", () => {
    const customRegistry = defineRefusalRegistry({
      ...refusalCodeRegistry,
      "custom-test-refusal-code": {
        domainKind: "input",
        message: "Test refusal message.",
        repair: "Test repair action.",
      },
    });
    const derived = resultIds(customRegistry);
    assert.ok(derived.refusalCodeIds.includes("custom-test-refusal-code"));
    assert.ok(derived.statusEnumIds.includes("custom-test-refusal-code"));
  });

  it("every exported array is frozen", () => {
    assert.ok(Object.isFrozen(outputStatusIds));
    assert.ok(Object.isFrozen(executionOutcomeIds));
    assert.ok(Object.isFrozen(refusalCodeIds));
    assert.ok(Object.isFrozen(statusEnumIds));
    assert.throws(() => {
      (outputStatusIds as unknown as string[]).push("error");
    });
    assert.throws(() => {
      (executionOutcomeIds as unknown as string[]).push("fail");
    });
    assert.throws(() => {
      (statusEnumIds as unknown as string[]).push("extra");
    });
  });

  it("module graph of ids.ts contains no .tsx files and no worker entries", () => {
    const idsPath = resolve(ROOT, "src/experiments/results/ids.ts");
    const content = readFileSync(idsPath, "utf-8");
    // Assert only pure modules are imported
    assert.match(content, /from "\.\/outcomes\.ts"/);
    assert.match(content, /from "\.\/refusalCodes\.ts"/);
    assert.match(content, /from "\.\/types\.ts"/);
    assert.doesNotMatch(content, /\.tsx/);
    assert.doesNotMatch(content, /worker/i);
    assert.doesNotMatch(content, /react/i);
  });
});
