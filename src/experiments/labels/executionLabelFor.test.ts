import { describe, expect, test } from "bun:test";
import { deriveExecutionStateKind, type ExecutionStateKind } from "../provenance/executionState.ts";
import {
  DATA_EXECUTION_LABEL_VALUES,
  executionLabelFor,
  executionStateKindFromHostLabel,
} from "./executionLabelFor.ts";

const ALL_STATES: readonly ExecutionStateKind[] = [
  "frankensim-accepted",
  "host-accepted",
  "static-example",
  "unavailable",
];

describe("executionLabelFor: exhaustive mapping of the four public labels", () => {
  test("frankensim-accepted maps to the exact FrankenSim wording and attribute", () => {
    const info = executionLabelFor("frankensim-accepted");
    expect(info.text).toBe("Ideal model, computed with FrankenSim");
    expect(info.dataExecutionLabel).toBe("frankensim");
  });

  test("host-accepted maps to the exact host-calculation wording and attribute", () => {
    const info = executionLabelFor("host-accepted");
    expect(info.text).toBe("Ideal model, host calculation");
    expect(info.dataExecutionLabel).toBe("host");
  });

  test("static-example maps to the exact static wording and attribute", () => {
    const info = executionLabelFor("static-example");
    expect(info.text).toBe("Static worked example");
    expect(info.dataExecutionLabel).toBe("static");
  });

  test("unavailable maps to the exact unavailable wording and attribute", () => {
    const info = executionLabelFor("unavailable");
    expect(info.text).toBe("This experiment is unavailable on this device");
    expect(info.dataExecutionLabel).toBe("unavailable");
  });

  test('every derived state produces one of the four data-execution-label values, and only frankensim-accepted produces "frankensim"', () => {
    for (const state of ALL_STATES) {
      const info = executionLabelFor(state);
      expect(DATA_EXECUTION_LABEL_VALUES).toContain(info.dataExecutionLabel);
      if (info.dataExecutionLabel === "frankensim") {
        expect(state).toBe("frankensim-accepted");
      }
    }
  });

  test("no fallback state (host-accepted, static-example, unavailable) ever produces the FrankenSim label", () => {
    for (const state of ["host-accepted", "static-example", "unavailable"] as const) {
      expect(executionLabelFor(state).dataExecutionLabel).not.toBe("frankensim");
    }
  });

  test("a real derivation with an unaccepted FrankenSim-owned output renders the host label, never the FrankenSim one", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: false },
      ],
    });
    expect(executionLabelFor(state).text).toBe("Ideal model, host calculation");
  });

  test("executionStateKindFromHostLabel never maps a host derivation onto frankensim-accepted", () => {
    expect(executionStateKindFromHostLabel("host")).toBe("host-accepted");
    expect(executionStateKindFromHostLabel("static")).toBe("static-example");
    expect(executionStateKindFromHostLabel("unavailable")).toBe("unavailable");
    for (const label of ["host", "static", "unavailable"] as const) {
      expect(executionLabelFor(executionStateKindFromHostLabel(label)).dataExecutionLabel).not.toBe(
        "frankensim",
      );
    }
  });
});
