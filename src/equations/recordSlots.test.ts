import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import source from "../../content/equations/brownian-motion/eq-model-bm-diffusivity.json";
import { parseEquationRecord } from "./record.ts";
import { compileEquation } from "./render.ts";

function comparison() {
  return {
    ...structuredClone(source),
    schemaVersion: 2,
    bindings: ["baseline", "variant"].flatMap((instanceSlot) =>
      source.bindings.map((binding) => ({ ...binding, instanceSlot })),
    ),
  };
}

describe("named equation comparison slots (am-eq-live-bindings-2se)", () => {
  test("existing version-one records retain their primary bindings", () => {
    const parsed = parseEquationRecord(source, "existing Brownian equation");
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.bindings.length).toBeGreaterThan(0);
    expect(parsed.bindings).toEqual(source.bindings);
  });

  test("version two preserves independent baseline and variant bindings in the compiled payload", () => {
    const record = parseEquationRecord(comparison(), "comparison equation");
    const equation = compileEquation(record);
    for (const term of equation.terms) {
      const bindings = equation.bindings.filter((binding) => binding.termId === term.termId);
      expect(bindings.map((binding) => binding.instanceSlot)).toEqual(["baseline", "variant"]);
      expect(bindings.every((binding) => binding.quantityId === term.quantityId)).toBe(true);
    }
    expect(equation.bindings.length).toBeGreaterThan(0);
  });

  test("a comparison cannot silently change the version-one contract", () => {
    expect(() => parseEquationRecord({ ...comparison(), schemaVersion: 1 }, "old version")).toThrow(
      "Binding must resolve",
    );
    expect(() =>
      parseEquationRecord({ ...comparison(), schemaVersion: 3 }, "future version"),
    ).toThrow("Only registered modern teaching papers");
  });

  test("one term cannot select two outputs from the same experiment slot", () => {
    const record = comparison();
    const first = record.bindings[0];
    assert.ok(first);
    record.bindings.push({ ...first });
    expect(() => parseEquationRecord(record, "duplicate binding")).toThrow("Binding must resolve");
  });

  test("slots stay bounded, and exact output, term and experiment checks still apply", () => {
    for (const instanceSlot of [
      "",
      " baseline",
      "baseline ",
      "x/y",
      "<b>x</b>",
      "A",
      "a".repeat(33),
    ]) {
      const record = comparison();
      const first = record.bindings[0];
      assert.ok(first);
      first.instanceSlot = instanceSlot;
      expect(() => parseEquationRecord(record, "invalid slot")).toThrow("Binding must resolve");
    }
    for (const patch of [
      { outputId: "temperature" },
      { quantityId: "temperature" },
      { termId: "eq-model-bm-diffusivity.t.unknown" },
      { experimentId: "me-02" },
    ]) {
      const record = comparison();
      const first = record.bindings[0];
      assert.ok(first);
      record.bindings[0] = { ...first, ...patch };
      expect(() => parseEquationRecord(record, "mismatched binding")).toThrow(
        "Binding must resolve",
      );
    }
  });
});
