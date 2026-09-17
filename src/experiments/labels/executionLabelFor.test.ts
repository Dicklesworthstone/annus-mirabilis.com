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

  test("FrankenSim primary outputs with host secondary outputs derive frankensim-accepted and show the FrankenSim label", () => {
    // In the composite rule, secondary outputs (e.g., host ensembleMoments) do not enter primaryOutputs.
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: true },
      ],
    });
    expect(state).toBe("frankensim-accepted");
    const info = executionLabelFor(state);
    expect(info.text).toBe("Ideal model, computed with FrankenSim");
    expect(info.dataExecutionLabel).toBe("frankensim");
  });

  test("mixed primary outputs (some FrankenSim, some host) derive host-accepted and show the host label", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: true },
        { outputId: "analyticDensity", ownerKind: "host-reference", acceptedThisSnapshot: true },
      ],
    });
    expect(state).toBe("host-accepted");
    const info = executionLabelFor(state);
    expect(info.text).toBe("Ideal model, host calculation");
    expect(info.dataExecutionLabel).toBe("host");
  });

  test("a snapshot whose WebGL view was replaced by a declared 2D view keeps its earned engine label", () => {
    // When a live 2D view survives, isUnavailable is false; numbers were really computed.
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: true },
      ],
    });
    expect(state).toBe("frankensim-accepted");
    expect(executionLabelFor(state).dataExecutionLabel).toBe("frankensim");
  });

  test("a mode with no live view the device can render reports environment-unsupported and derives unavailable", () => {
    // When the active mode declares only WebGL and WebGL is unavailable, isUnavailable is true.
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: true,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: true },
      ],
    });
    expect(state).toBe("unavailable");
    const info = executionLabelFor(state);
    expect(info.text).toBe("This experiment is unavailable on this device");
    expect(info.dataExecutionLabel).toBe("unavailable");
  });

  test("a static mode derives static-example and renders the static label", () => {
    const state = deriveExecutionStateKind({
      isStatic: true,
      isUnavailable: false,
      primaryOutputs: [],
    });
    expect(state).toBe("static-example");
    const info = executionLabelFor(state);
    expect(info.text).toBe("Static worked example");
    expect(info.dataExecutionLabel).toBe("static");
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
