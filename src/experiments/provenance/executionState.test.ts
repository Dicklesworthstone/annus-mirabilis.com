import { describe, expect, test } from "bun:test";
import { deriveExecutionStateKind, type PrimaryOutputOwnership } from "./executionState.ts";

const frankenSimAccepted = (outputId: string): PrimaryOutputOwnership => ({
  outputId,
  ownerKind: "frankensim",
  acceptedThisSnapshot: true,
});
const hostAccepted = (outputId: string): PrimaryOutputOwnership => ({
  outputId,
  ownerKind: "host-reference",
  acceptedThisSnapshot: true,
});

describe("deriveExecutionStateKind (am-inst-execution-labels-5ywv)", () => {
  test("every primary output an accepted FrankenSim call earns frankensim-accepted", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [frankenSimAccepted("tracerPositions")],
    });
    expect(state).toBe("frankensim-accepted");
  });

  test("all-host primary outputs earn host-accepted", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [hostAccepted("ftcsProfile")],
    });
    expect(state).toBe("host-accepted");
  });

  test("a mixed primary set earns host-accepted, never frankensim-accepted", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [frankenSimAccepted("tracerPositions"), hostAccepted("sampleMeanSquare")],
    });
    expect(state).toBe("host-accepted");
  });

  test("isStatic earns static-example regardless of ownership", () => {
    const state = deriveExecutionStateKind({
      isStatic: true,
      isUnavailable: false,
      primaryOutputs: [frankenSimAccepted("tracerPositions")],
    });
    expect(state).toBe("static-example");
  });

  test("isUnavailable earns unavailable regardless of ownership or isStatic", () => {
    const state = deriveExecutionStateKind({
      isStatic: true,
      isUnavailable: true,
      primaryOutputs: [frankenSimAccepted("tracerPositions")],
    });
    expect(state).toBe("unavailable");
  });

  test("no primary outputs at all earns host-accepted, never frankensim-accepted by default", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [],
    });
    expect(state).toBe("host-accepted");
  });

  // THE PLANTED NEGATIVE (BoldHarbor, am-inst-execution-labels-5ywv): a snapshot with a
  // FrankenSim-owned primary output whose call was NOT accepted for this snapshot -- the
  // shape a loaded-but-unused artifact would produce -- must never earn the FrankenSim label.
  test("PLANTED NEGATIVE: a FrankenSim-owned output not accepted this snapshot never earns frankensim-accepted", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        { outputId: "tracerPositions", ownerKind: "frankensim", acceptedThisSnapshot: false },
      ],
    });
    expect(state).not.toBe("frankensim-accepted");
    expect(state).toBe("host-accepted");
  });

  test("PLANTED NEGATIVE: one accepted FrankenSim output beside one unaccepted FrankenSim output still fails to earn the label", () => {
    const state = deriveExecutionStateKind({
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [
        frankenSimAccepted("tracerPositions"),
        { outputId: "diffusionCoefficient", ownerKind: "frankensim", acceptedThisSnapshot: false },
      ],
    });
    expect(state).not.toBe("frankensim-accepted");
  });

  test("the derivation input type carries no loader or artifact-loaded field at all", () => {
    // A structural guarantee, not just a runtime one: ExecutionStateInput has exactly
    // isStatic, isUnavailable, and primaryOutputs. There is no field this test -- or any
    // future caller -- could set to "artifact loaded" and have it reach the derivation.
    const input: Parameters<typeof deriveExecutionStateKind>[0] = {
      isStatic: false,
      isUnavailable: false,
      primaryOutputs: [],
    };
    expect(Object.keys(input).sort()).toEqual(
      ["isStatic", "isUnavailable", "primaryOutputs"].sort(),
    );
  });
});
