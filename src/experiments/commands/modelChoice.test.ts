import { describe, expect, test } from "bun:test";
import { assertModelChoiceAndFallbackAreDisjoint, validateModelChoice } from "./modelChoice.ts";

describe("validateModelChoice", () => {
  const models = ["exact-gaussian-propagator", "explicit-ftcs-grid"] as const;

  test("an id the instrument declares is accepted", () => {
    const decision = validateModelChoice(models, "explicit-ftcs-grid");
    expect(decision).toEqual({ accepted: true, modelId: "explicit-ftcs-grid" });
  });

  test("an id the instrument does not declare is refused rather than defaulted", () => {
    const decision = validateModelChoice(models, "typo-gaussian");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.code).toBe("invalid-parameter");
    expect(decision.refusal.affected.parameterIds).toEqual(["modelId"]);
    expect(decision.refusal.details).toEqual({
      requestedModelId: "typo-gaussian",
      declaredModelIds: ["exact-gaussian-propagator", "explicit-ftcs-grid"],
    });
  });

  test("accepts a Set of declared ids identically to an array", () => {
    const decision = validateModelChoice(new Set(models), "exact-gaussian-propagator");
    expect(decision).toEqual({ accepted: true, modelId: "exact-gaussian-propagator" });
  });

  test("an empty declared-models collection is a caller error, not a refusal", () => {
    expect(() => validateModelChoice([], "anything")).toThrow();
  });

  test("the declared id list in a refusal is sorted, independent of declaration order", () => {
    const decision = validateModelChoice(["b-model", "a-model"], "missing");
    expect(decision.accepted).toBe(false);
    if (decision.accepted) throw new Error("unreachable");
    expect(decision.refusal.details?.declaredModelIds).toEqual(["a-model", "b-model"]);
  });
});

describe("assertModelChoiceAndFallbackAreDisjoint", () => {
  test("a command naming only modelId passes", () => {
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({ modelId: "explicit-ftcs-grid" }),
    ).not.toThrow();
  });

  test("a command naming only fallbackReason passes", () => {
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({ fallbackReason: "worker-unavailable" }),
    ).not.toThrow();
  });

  test("a command naming neither passes", () => {
    expect(() => assertModelChoiceAndFallbackAreDisjoint({})).not.toThrow();
  });

  test("a command naming both modelId and fallbackReason throws: a deliberate choice is never a degradation", () => {
    expect(() =>
      assertModelChoiceAndFallbackAreDisjoint({
        modelId: "explicit-ftcs-grid",
        fallbackReason: "worker-unavailable",
      }),
    ).toThrow();
  });
});
